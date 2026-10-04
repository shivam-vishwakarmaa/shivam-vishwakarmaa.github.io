// Procedural 3D bust, ray-marched straight into ASCII characters.
// Pure maths (no DOM), so it can run anywhere. `renderBust` returns one frame as text.

export const RAMP = " .:-=+*#%@";
export const CELL_W = 0.6; // width of one monospace glyph, in em
export const CELL_H = 1.0; // height of one text line, in em

const sqrt = Math.sqrt;

// Approximate signed distance to an ellipsoid
function ellipsoid(x, y, z, rx, ry, rz) {
  const a = x / rx, b = y / ry, c = z / rz;
  const k0 = sqrt(a * a + b * b + c * c);
  const d = x / (rx * rx), e = y / (ry * ry), f = z / (rz * rz);
  const k1 = sqrt(d * d + e * e + f * f);
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

// Smooth union / intersection (blends shapes together like clay)
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
const smax = (a, b, k) => -smin(-a, -b, k);

// The whole scene: head, hair, face features, neck and shoulders
function map(x, y, z) {
  const ax = x < 0 ? -x : x; // the face is symmetric

  // neck + shoulders
  const nz = z + 0.05;
  const neck = Math.max(sqrt(x * x + nz * nz) - 0.34, Math.abs(y + 1.35) - 0.55);
  const shoulders = ellipsoid(x, y + 2.15, z, 1.5, 0.65, 0.78);
  let body = smin(neck, shoulders, 0.4);
  body = Math.max(body, -2.65 - y); // flat cut at the bottom of the bust

  // Cheap bounding volume: far from the head we skip all the detail
  const bound = ellipsoid(x, y - 0.1, z, 1.0, 1.35, 1.1);
  if (bound > 0.2) return Math.min(bound, body);

  // cranium + jaw + chin
  let d = ellipsoid(x, y - 0.25, z, 0.64, 0.8, 0.72);
  d = smin(d, ellipsoid(x, y + 0.5, z - 0.1, 0.5, 0.58, 0.56), 0.35);
  d = smin(d, ellipsoid(x, y + 0.95, z - 0.4, 0.2, 0.14, 0.2), 0.12);

  // cheeks, brow, ears
  d = smin(d, ellipsoid(ax - 0.3, y + 0.3, z - 0.45, 0.2, 0.15, 0.2), 0.15);
  d = smin(d, ellipsoid(x, y - 0.2, z - 0.64, 0.54, 0.1, 0.18), 0.1);
  d = smin(d, ellipsoid(ax - 0.64, y, z + 0.05, 0.07, 0.2, 0.13), 0.08);

  // nose
  let nose = ellipsoid(x, y + 0.12, z - 0.74, 0.11, 0.28, 0.18);
  nose = smin(nose, ellipsoid(x, y + 0.32, z - 0.82, 0.11, 0.1, 0.11), 0.08);
  nose = smin(nose, ellipsoid(ax - 0.11, y + 0.3, z - 0.7, 0.07, 0.07, 0.08), 0.06);
  d = smin(d, nose, 0.1);

  // lips and the line of the mouth
  d = smin(d, ellipsoid(x, y + 0.55, z - 0.58, 0.2, 0.08, 0.1), 0.05);
  d = smax(d, -ellipsoid(x, y + 0.58, z - 0.7, 0.2, 0.025, 0.08), 0.02);

  // eye sockets
  d = smax(d, -(sqrt((ax - 0.25) * (ax - 0.25) + (y - 0.08) * (y - 0.08) + (z - 0.74) * (z - 0.74)) - 0.13), 0.08);

  // short hair: a slightly larger shell above a sloping hairline
  const hair = smax(
    ellipsoid(x, y - 0.25, z + 0.02, 0.69, 0.86, 0.77),
    -(y - 0.25 * z - 0.55) / 1.031,
    0.06
  );
  d = smin(d, hair, 0.05);

  return smin(d, body, 0.18);
}

const LIGHT = (() => {
  const x = -0.75, y = 0.45, z = 0.5;
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
})();

// Draw the bust turned by `angle` radians around its vertical axis.
export function renderBust(cols, rows, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const unit = 3.84 / rows; // world units per em, so the bust always fills the height
  const centerY = -0.8;
  const lx = LIGHT[0] * c - LIGHT[2] * s, ly = LIGHT[1], lz = LIGHT[0] * s + LIGHT[2] * c;
  const e = 0.004;
  let out = "";

  for (let j = 0; j < rows; j++) {
    const yw = centerY + (rows / 2 - j - 0.5) * CELL_H * unit;
    for (let i = 0; i < cols; i++) {
      const xw = (i - cols / 2 + 0.5) * CELL_W * unit;
      if (yw < -2.8 || yw > 1.2 || xw < -1.6 || xw > 1.6) {
        out += " ";
        continue;
      }
      // camera ray, expressed in the head's own coordinates
      const ox = xw * c - 2.2 * s, oz = xw * s + 2.2 * c;
      let t = 0, steps = 0, hit = false;
      for (; steps < 48; steps++) {
        const d = map(ox + s * t, yw, oz - c * t);
        if (d < 0.003) { hit = true; break; }
        t += d * 0.9;
        if (t > 4.4) break;
      }
      if (!hit) {
        out += " ";
        continue;
      }
      const px = ox + s * t, pz = oz - c * t;
      const n1 = map(px + e, yw - e, pz - e);
      const n2 = map(px - e, yw - e, pz + e);
      const n3 = map(px - e, yw + e, pz - e);
      const n4 = map(px + e, yw + e, pz + e);
      let nx = n1 - n2 - n3 + n4, ny = -n1 - n2 + n3 + n4, nz = -n1 + n2 - n3 + n4;
      const nl = sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      const facing = Math.max(0, -nx * s + nz * c);
      const rim = Math.pow(1 - facing, 3);
      const occlusion = 1 - (steps / 48) * 0.5;
      let b = (0.05 + 1.0 * Math.pow(diffuse, 1.15) + 0.28 * rim) * occlusion;
      b = Math.pow(Math.min(1, Math.max(0, b)), 1.1);
      out += RAMP[1 + Math.floor(b * (RAMP.length - 2))];
    }
    out += "\n";
  }
  return out;
}
