// Turns a photo into a "3D" ASCII portrait that can turn a full 360 degrees.
//
// Front view: the photo's silhouette gives the width of the head, neck and shoulders row by row.
// Depth: each row is a rounded slice whose front/back depth follows a real head PROFILE (forehead,
// brow, cheeks, chin, back of the skull), and facial features (nose, brow ridge, eye sockets, lips,
// chin) are sculpted on at the heights given by `landmarks`. So the side view has a nose and a chin
// instead of being a smooth oval.
// Light: every point has a surface normal and is lit by a fixed light, so the lit side brightens and
// the far side falls into shadow while the head turns. The photo itself is only painted where the
// surface faces the viewer; on the sides and back a smooth skin/hair tone is used instead of
// stretching the photo's edge pixels.
//
// Points are rotated around the vertical axis and splatted into the character grid, averaging the
// brightness of everything that lands in the same character.

import { RAMP, CELL_W, CELL_H } from "./bust.js";

const SAMPLE = 0.3; // size of one source pixel, in em
const FRONT_TOLERANCE = 0.5; // em: samples this close to the front surface are averaged together
const GAMMA = 1.7; // > 1 pushes skin tones into the middle of the character ramp
const SHARPEN = 2.0; // local contrast boost so eyes, nose and mouth stand out
const SHARPEN_RADIUS = 1.6; // em: features smaller than this get emphasised
const FLOOR = 0.14; // darkest the subject gets, so dark hair never disappears into the page
const ROUNDNESS = 0.8; // < 1 flattens the front of the face a little (1 = perfectly elliptical slices)

// Lighting (x right, y down, z toward the viewer): a light from the upper left, in front
const AMBIENT = 0.4; // brightness of surfaces facing away from the light
const RIM = 0.3; // extra glow on surfaces turning away from the viewer, outlines the silhouette
const LIGHT = (() => {
  const x = -0.6, y = -0.5, z = 0.65;
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
})();

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load face photo: ${url}`));
    img.src = url;
  });
}

// Box blur that only averages pixels belonging to the subject (no dark halo at the edges)
export function maskedBlur(src, keep, w, h, r) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!keep[y * w + x]) continue;
      let sum = 0, n = 0;
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const i = yy * w + xx;
          if (keep[i]) { sum += src[i]; n++; }
        }
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

export function stretch(values, keep) {
  const kept = [];
  for (let i = 0; i < values.length; i++) if (keep[i]) kept.push(values[i]);
  kept.sort((a, b) => a - b);
  const lo = kept[Math.floor(kept.length * 0.01)] ?? 0;
  const hi = kept[Math.floor(kept.length * 0.995)] ?? 1;
  for (let i = 0; i < values.length; i++) values[i] = Math.min(1, Math.max(0, (values[i] - lo) / (hi - lo || 1)));
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => t * t * (3 - 2 * t);
const smoothstep = (a, b, x) => ease(clamp((x - a) / (b - a)));
const gauss = (x, s) => Math.exp(-(x * x) / (s * s)); // soft bump of width s
const flat = (x, s) => Math.exp(-Math.pow(x / s, 4)); // flat-topped bump of half-width s

// Smoothly interpolate between control points [[position, value], ...] sorted by position
function along(points, v) {
  if (v <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (v <= points[i][0]) {
      const [v0, a0] = points[i - 1], [v1, a1] = points[i];
      return a0 + (a1 - a0) * ease((v - v0) / (v1 - v0 || 1));
    }
  }
  return points[points.length - 1][1];
}

export async function createPhotoRenderer(
  url,
  { cols, rows, cutoff = 0, invert = false, landmarks = null, centerX = null }
) {
  const img = await loadImage(url);

  // Fit the picture inside the character grid, keeping its proportions
  const gridW = cols * CELL_W, gridH = rows * CELL_H;
  let wEm = gridH * (img.width / img.height), hEm = gridH;
  if (wEm > gridW) { wEm = gridW; hEm = gridW * (img.height / img.width); }
  const sw = Math.max(8, Math.round(wEm / SAMPLE)), sh = Math.max(8, Math.round(hEm / SAMPLE));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);
  const px = ctx.getImageData(0, 0, sw, sh).data;

  const lum = new Float32Array(sw * sh);
  const keep = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    let l = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
    if (invert) l = 1 - l;
    lum[i] = l;
    if (px[i * 4 + 3] > 128 && l >= cutoff) keep[i] = 1;
  }

  // Local contrast (unsharp mask), then stretch so the subject uses the whole brightness range
  const broad = maskedBlur(lum, keep, sw, sh, Math.round(SHARPEN_RADIUS / SAMPLE));
  for (let i = 0; i < lum.length; i++) if (keep[i]) lum[i] += SHARPEN * (lum[i] - broad[i]);
  stretch(lum, keep);

  // ── Silhouette of every row ──
  const rowLeft = new Int16Array(sh).fill(-1), rowRight = new Int16Array(sh).fill(-1);
  const rowWidthEm = new Float32Array(sh);
  let firstRow = -1, lastRow = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (!keep[y * sw + x]) continue;
      if (rowLeft[y] < 0) rowLeft[y] = x;
      rowRight[y] = x;
    }
    if (rowLeft[y] >= 0) {
      rowWidthEm[y] = (rowRight[y] - rowLeft[y] + 1) * SAMPLE;
      if (firstRow < 0) firstRow = y;
      lastRow = y;
    }
  }

  // ── Where the features are (sample rows). Given as picture fractions, or guessed from the silhouette ──
  const lm = landmarks || {};
  const vTop = lm.top != null ? lm.top * sh : firstRow;
  const vChin = lm.chin != null ? lm.chin * sh : vTop + 0.57 * (lastRow - vTop);
  const H = Math.max(8, vChin - vTop);
  const vBrow = lm.brow != null ? lm.brow * sh : vTop + 0.577 * H;
  const vEyes = lm.eyes != null ? lm.eyes * sh : vTop + 0.616 * H;
  const vNose = lm.noseTip != null ? lm.noseTip * sh : vTop + 0.741 * H;
  const vMouth = lm.mouth != null ? lm.mouth * sh : vTop + 0.868 * H;
  const hv = Math.max(2, vMouth - vNose); // one "face unit" vertically: nose tip to mouth

  const eyeRow = Math.min(sh - 1, Math.max(0, Math.round(vEyes)));
  const headWidth = rowWidthEm[eyeRow] || wEm * 0.45; // em: width of the face at eye level
  const cx = centerX != null ? centerX * sw : (rowLeft[eyeRow] + rowRight[eyeRow]) / 2;

  // Depth of the head in front of / behind the ear plane, in head widths, going down the head
  const frontProfile = [
    [vTop, 0.0], [vTop + 0.3 * (vBrow - vTop), 0.5], [vBrow, 0.64], [vEyes, 0.62],
    [vNose, 0.62], [vMouth, 0.6], [vChin, 0.54], [vChin + 0.2 * H, 0.4],
  ];
  const backProfile = [
    [vTop, 0.0], [vTop + 0.3 * (vBrow - vTop), 0.48], [vBrow, 0.6], [vMouth, 0.52],
    [vChin, 0.42], [vChin + 0.2 * H, 0.34],
  ];
  // Below the chin the neck and shoulders take over: shoulders are much shallower than they are wide
  const bodyDepth = (widthEm) => (0.5 - 0.3 * smoothstep(0.4, 0.8, widthEm / wEm)) * widthEm;

  // Sculpted facial features, in head widths. v = sample row, u = sideways distance from the face centre
  const features = (v, u) => {
    const au = Math.abs(u);
    let z = 0;
    const yN = (v - vEyes) / (vNose - vEyes || 1); // 0 at the eyes, 1 at the nose tip
    if (yN > 0 && yN < 1.35) {
      const rise = ease(Math.min(1, yN / 0.85));
      const fall = 1 - ease(clamp((yN - 1.0) / 0.35));
      z += 0.14 * rise * fall * gauss(u, 0.035 + 0.045 * Math.min(1, yN)); // nose
    }
    z += 0.04 * gauss((v - vBrow) / (0.5 * hv), 1) * flat(u, 0.28); // brow ridge
    z -= 0.05 * gauss((v - vEyes) / (0.55 * hv), 1) * gauss(au - 0.17, 0.07); // eye sockets
    z += 0.03 * gauss((v - vNose) / (1.3 * hv), 1) * gauss(au - 0.22, 0.12); // cheeks
    z += 0.04 * gauss((v - vMouth) / (0.4 * hv), 1) * flat(u, 0.15); // lips
    z -= 0.02 * gauss((v - vMouth - 0.12 * hv) / (0.14 * hv), 1) * flat(u, 0.14); // mouth line
    z += 0.055 * gauss((v - (vChin - 0.3 * hv)) / (0.7 * hv), 1) * gauss(u, 0.17); // chin
    return z;
  };

  // ── Depth of both surfaces ──
  const smooth = maskedBlur(lum, keep, sw, sh, 3);
  const zFront = new Float32Array(sw * sh);
  const zBack = new Float32Array(sw * sh);
  const edgeT = new Float32Array(sw * sh);
  const edgeSide = new Int8Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    if (rowLeft[y] < 0) continue;
    const mid = (rowLeft[y] + rowRight[y]) / 2, half = Math.max(1, (rowRight[y] - rowLeft[y]) / 2);
    const blend = ease(clamp((y - vChin) / (0.3 * H))); // 0 on the head, 1 on the body
    const body = bodyDepth(rowWidthEm[y]);
    const frontEm = (1 - blend) * along(frontProfile, y) * headWidth + blend * body;
    const backEm = (1 - blend) * along(backProfile, y) * headWidth + blend * body;
    for (let x = rowLeft[y]; x <= rowRight[y]; x++) {
      const i = y * sw + x;
      if (!keep[i]) continue;
      const t = Math.min(1, Math.abs(x - mid) / half);
      const dome = Math.sqrt(1 - t * t);
      const u = ((x - cx) * SAMPLE) / headWidth;
      const relief = (features(y, u) + 0.1 * (smooth[i] - 0.5)) * headWidth * (1 - blend);
      zFront[i] = frontEm * Math.pow(dome, ROUNDNESS) + relief * dome;
      zBack[i] = -backEm * Math.pow(dome, ROUNDNESS);
      edgeT[i] = t;
      edgeSide[i] = x >= mid ? 1 : -1;
    }
  }

  // Distance from the top of the silhouette in each column, for lighting the crown of the head
  const topOfColumn = new Int16Array(sw).fill(-1);
  for (let x = 0; x < sw; x++) {
    for (let y = 0; y < sh; y++) if (keep[y * sw + x]) { topOfColumn[x] = y; break; }
  }

  // ── Surface normals. Slopes come from neighbouring depths; near the silhouette the normal is bent
  // outward (sideways at the left/right edge, upward at the top) so the head looks rounded.
  const slopeLimit = 3, step = 2;
  const zAt = (z, u, v, fallback) => {
    if (u < 0 || v < 0 || u >= sw || v >= sh || !keep[v * sw + u]) return fallback;
    return z[v * sw + u];
  };
  const normalOf = (z, u, v, facing) => {
    const i = v * sw + u, zc = z[i];
    const gx = clamp((zAt(z, u + step, v, zc) - zAt(z, u - step, v, zc)) / (2 * step * SAMPLE), -slopeLimit, slopeLimit);
    const gy = clamp((zAt(z, u, v + step, zc) - zAt(z, u, v - step, zc)) / (2 * step * SAMPLE), -slopeLimit, slopeLimit);
    // front faces +z: (-gx, -gy, 1). back faces -z: (gx, gy, -1)
    let nx = -gx * facing, ny = -gy * facing, nz = facing;
    let len = Math.hypot(nx, ny, nz);
    nx /= len; ny /= len; nz /= len;
    const side = smoothstep(0.7, 1, edgeT[i]);
    const crown = ease(clamp(1 - ((v - topOfColumn[u]) * SAMPLE) / 2.5));
    nx += (edgeSide[i] - nx) * side;
    nz += (facing * 0.25 - nz) * side;
    ny += (-1 - ny) * crown;
    len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  };

  // Smooth skin/hair tone for the sides and back: a very blurred copy of the photo with a little speckle
  const veryBlurred = maskedBlur(maskedBlur(lum, keep, sw, sh, 5), keep, sw, sh, 5);
  const speckle = (u, v) => {
    const n = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453;
    return n - Math.floor(n);
  };

  // ── Point clouds, one per surface. Where a surface is steep (the sides of the head) neighbouring samples
  // are far apart in depth, so extra points are interpolated between them to keep the side solid. ──
  const MAX_DEPTH_GAP = 0.35; // em
  const gridLF = new Float32Array(sw * sh), gridLB = new Float32Array(sw * sh);
  const gridNF = new Float32Array(sw * sh * 3), gridNB = new Float32Array(sw * sh * 3);
  for (let v = 0; v < sh; v++) {
    for (let u = 0; u < sw; u++) {
      const i = v * sw + u;
      if (!keep[i]) continue;
      const grain = speckle(u, v) - 0.5;
      const nf = normalOf(zFront, u, v, 1);
      const photoWeight = smoothstep(0.3, 0.75, nf[2]); // photo only where the surface faces the viewer
      const skinTone = clamp(0.9 * veryBlurred[i] + 0.12 * grain);
      gridLF[i] = lum[i] * photoWeight + skinTone * (1 - photoWeight);
      gridLB[i] = clamp(0.15 + 0.45 * veryBlurred[i] + 0.18 * grain);
      gridNF.set(nf, i * 3);
      gridNB.set(normalOf(zBack, u, v, -1), i * 3);
    }
  }

  const buildCloud = (z, gridL, gridN) => {
    const x = [], row = [], zs = [], l = [], nx = [], ny = [], nz = [];
    const push = (px, r, pz, pl, ax, ay, az) => {
      const len = Math.hypot(ax, ay, az) || 1;
      x.push(px); row.push(r); zs.push(pz); l.push(pl); nx.push(ax / len); ny.push(ay / len); nz.push(az / len);
    };
    for (let v = 0; v < sh; v++) {
      const r = Math.floor(((v - sh / 2) * SAMPLE) / CELL_H + rows / 2);
      if (r < 0 || r >= rows) continue;
      for (let u = 0; u < sw; u++) {
        const i = v * sw + u;
        if (!keep[i]) continue;
        const x0 = (u - cx) * SAMPLE;
        push(x0, r, z[i], gridL[i], gridN[i * 3], gridN[i * 3 + 1], gridN[i * 3 + 2]);
        if (u + 1 < sw && keep[i + 1]) {
          const m = Math.min(10, Math.ceil(Math.abs(z[i + 1] - z[i]) / MAX_DEPTH_GAP));
          for (let q = 1; q < m; q++) {
            const f = q / m, lerp = (a, b) => a + (b - a) * f;
            push(
              lerp(x0, x0 + SAMPLE), r, lerp(z[i], z[i + 1]), lerp(gridL[i], gridL[i + 1]),
              lerp(gridN[i * 3], gridN[i * 3 + 3]), lerp(gridN[i * 3 + 1], gridN[i * 3 + 4]),
              lerp(gridN[i * 3 + 2], gridN[i * 3 + 5])
            );
          }
        }
      }
    }
    return {
      n: x.length, x: Float32Array.from(x), row: Int16Array.from(row), z: Float32Array.from(zs),
      l: Float32Array.from(l), nx: Float32Array.from(nx), ny: Float32Array.from(ny), nz: Float32Array.from(nz),
    };
  };
  const cloudF = buildCloud(zFront, gridLF, gridNF);
  const cloudB = buildCloud(zBack, gridLB, gridNB);

  const zbuf = new Float32Array(cols * rows);
  const sum = new Float32Array(cols * rows);
  const count = new Uint16Array(cols * rows);

  // Brightness of a surface point after the head has turned by (c = cos, s = sin) of the angle
  const [lx, ly, lz] = LIGHT;
  const shade = (tex, nx, ny, nz, c, s) => {
    const nxr = nx * c + nz * s, nzr = -nx * s + nz * c; // normal rotated with the head
    const diffuse = Math.max(0, nxr * lx + ny * ly + nzr * lz) / lz; // 1 = like a flat front-facing surface
    const lit = AMBIENT + (1 - AMBIENT) * Math.min(1.3, diffuse);
    const edge = 1 - Math.max(0, nzr);
    return Math.min(1, tex * lit + RIM * edge * edge * edge);
  };

  const splat = (x, row, z, b, c, s) => {
    const xr = x * c + z * s, zr = -x * s + z * c;
    const col = Math.floor(xr / CELL_W + cols / 2);
    if (col < 0 || col >= cols) return;
    const idx = row * cols + col;
    if (zr > zbuf[idx] + FRONT_TOLERANCE) {
      zbuf[idx] = zr; sum[idx] = b; count[idx] = 1;
    } else if (zr > zbuf[idx] - FRONT_TOLERANCE) {
      sum[idx] += b; count[idx]++;
      if (zr > zbuf[idx]) zbuf[idx] = zr;
    }
  };

  return {
    // angle in radians; 0 = facing the camera, PI = seen from behind
    render(angle) {
      zbuf.fill(-Infinity);
      count.fill(0);
      const c = Math.cos(angle), s = Math.sin(angle);
      for (const cloud of [cloudF, cloudB]) {
        for (let j = 0; j < cloud.n; j++) {
          splat(cloud.x[j], cloud.row[j], cloud.z[j], shade(cloud.l[j], cloud.nx[j], cloud.ny[j], cloud.nz[j], c, s), c, s);
        }
      }
      // Seen from the side the surface stretches; close one-character gaps between neighbours
      for (let r = 0; r < rows; r++) {
        for (let q = 1; q < cols - 1; q++) {
          const idx = r * cols + q;
          if (count[idx] || !count[idx - 1] || !count[idx + 1]) continue;
          sum[idx] = (sum[idx - 1] / count[idx - 1] + sum[idx + 1] / count[idx + 1]) / 2;
          count[idx] = 1;
        }
      }
      let out = "";
      for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
          const idx = r * cols + q;
          if (!count[idx]) { out += " "; continue; }
          const b = FLOOR + (1 - FLOOR) * Math.pow(sum[idx] / count[idx], GAMMA);
          out += RAMP[1 + Math.floor(b * (RAMP.length - 2))];
        }
        out += "\n";
      }
      return out;
    },
  };
}
