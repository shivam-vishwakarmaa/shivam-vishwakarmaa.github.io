// An ASCII "scene": a photo of someone working at a laptop, drawn in characters, with:
//   - an entrance: the scene assembles itself bottom-up out of glitching characters, rising from the desk
//   - typing: each finger taps on its own rhythm, the forearm follows, the head nods and the body breathes
//   - code glyphs ( < / > { } ; 0 1 ) drifting up from the laptop
// The photo can be a plain picture: the background is removed with `mask` polygons, or by using a PNG that
// already has a transparent background. Regions of motion are given as fractions of the original picture.

import { RAMP, CELL_W, CELL_H } from "./bust.js";
import { maskedBlur, stretch } from "./photo.js";

const WORK = 0.2; // em per working pixel (a character is 3 x 5 working pixels)
const CELL_PX_X = Math.round(CELL_W / WORK);
const CELL_PX_Y = Math.round(CELL_H / WORK);
const SUB_X = [-1, 0, 1];
const SUB_Y = [-1.6, 0, 1.6];
const GAMMA = 1.15;
const FLOOR = 0.14;
const SHARPEN = 1.6;
const SHARPEN_RADIUS = 1.4; // em
const ENTRANCE = 2.8; // seconds for the scene to assemble
const GLITCH = "01{}<>/;=+*#$%&";
const CODE = ["<", "/", ">", "{", "}", ";", "0", "1", "=", "(", ")"];

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const hash = (a, b = 0, c = 0) => {
  const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load scene image: ${url}`));
    img.src = url;
  });
}

// Regions of motion, as ellipses in fractions of the original picture
const DEFAULT_MOTION = {
  hands: { x: 0.46, y: 0.8, rx: 0.09, ry: 0.06 },
  forearm: { x: 0.6, y: 0.82, rx: 0.13, ry: 0.06 },
  head: { x: 0.68, y: 0.22, rx: 0.12, ry: 0.22 },
  torso: { x: 0.82, y: 0.58, rx: 0.12, ry: 0.28 },
};
const DEFAULT_CODE = { x: 0.3, y: 0.56, count: 7, rise: 14 };

export async function createScene(cfg, { reducedMotion = false } = {}) {
  const { image, columns = 110 } = cfg;
  // mask outlines can be given in pixels of the original picture (with maskSize) or as 0-1 fractions
  const mask = cfg.mask && cfg.maskSize
    ? cfg.mask.map((poly) => poly.map(([x, y]) => [x / cfg.maskSize[0], y / cfg.maskSize[1]]))
    : cfg.mask || null;
  const motion = { ...DEFAULT_MOTION, ...(cfg.motion || {}) };
  const code = { ...DEFAULT_CODE, ...(cfg.code || {}) };

  const img = await loadImage(image);
  const W0 = img.naturalWidth, H0 = img.naturalHeight;

  // 1) full-size copy of the picture, with the background cut away by the mask polygons (if any)
  const full = document.createElement("canvas");
  full.width = W0;
  full.height = H0;
  const fctx = full.getContext("2d", { willReadFrequently: true });
  fctx.drawImage(img, 0, 0);
  if (mask && mask.length) {
    const m = document.createElement("canvas");
    m.width = W0;
    m.height = H0;
    const mctx = m.getContext("2d");
    mctx.fillStyle = "#000";
    for (const poly of mask) {
      mctx.beginPath();
      poly.forEach(([px, py], i) => (i ? mctx.lineTo(px * W0, py * H0) : mctx.moveTo(px * W0, py * H0)));
      mctx.closePath();
      mctx.fill();
    }
    fctx.globalCompositeOperation = "destination-in";
    fctx.drawImage(m, 0, 0);
    fctx.globalCompositeOperation = "source-over";
  }

  // 2) crop to what is left
  const data = fctx.getImageData(0, 0, W0, H0).data;
  let x0 = W0, y0 = H0, x1 = -1, y1 = -1;
  for (let y = 0; y < H0; y++) {
    for (let x = 0; x < W0; x++) {
      if (data[(y * W0 + x) * 4 + 3] > 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("The scene image has no visible pixels");
  const crop = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };

  // 3) the width fills the character grid; the height follows, and the scene sits on the bottom row
  const wEm = columns * CELL_W;
  const scale = wEm / crop.w; // em per source pixel
  const hEm = crop.h * scale;
  const rows = Math.ceil(hEm / CELL_H);
  const ww = columns * CELL_PX_X, wh = rows * CELL_PX_Y;
  const destH = hEm / WORK, destY = wh - destH;

  const work = document.createElement("canvas");
  work.width = ww;
  work.height = wh;
  const wctx = work.getContext("2d", { willReadFrequently: true });
  wctx.drawImage(full, crop.x, crop.y, crop.w, crop.h, 0, 0 + destY, ww, destH);
  const px = wctx.getImageData(0, 0, ww, wh).data;

  // 4) brightness (with local contrast) and coverage maps
  const lum = new Float32Array(ww * wh);
  const cover = new Float32Array(ww * wh);
  const keep = new Uint8Array(ww * wh);
  for (let i = 0; i < ww * wh; i++) {
    lum[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
    cover[i] = px[i * 4 + 3] / 255;
    keep[i] = cover[i] > 0.5 ? 1 : 0;
  }
  const broad = maskedBlur(lum, keep, ww, wh, Math.round(SHARPEN_RADIUS / WORK));
  for (let i = 0; i < lum.length; i++) if (keep[i]) lum[i] += SHARPEN * (lum[i] - broad[i]);
  stretch(lum, keep);

  // 5) regions in working pixels
  const kx = ww / crop.w, ky = destH / crop.h;
  const toWork = (fx, fy) => [(fx * W0 - crop.x) * kx, destY + (fy * H0 - crop.y) * ky];
  const region = (r) => {
    const [cx, cy] = toWork(r.x, r.y);
    return { x: cx, y: cy, rx: r.rx * W0 * kx, ry: r.ry * H0 * ky };
  };
  const hands = region(motion.hands), forearm = region(motion.forearm);
  const head = region(motion.head), torso = region(motion.torso);
  const [codeX, codeY] = toWork(code.x, code.y);

  const FINGERS = 9;
  const fingerX = Array.from({ length: FINGERS }, (_, k) => hands.x - hands.rx + ((k + 0.5) * 2 * hands.rx) / FINGERS);
  const fingerSigma = ((2 * hands.rx) / FINGERS) * 1.1;
  const taps = new Float32Array(FINGERS);

  const weight = (x, y, e) => {
    const d = ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2;
    return d >= 1 ? 0 : ease(1 - d);
  };

  // Amplitudes in working pixels (one character is 5 pixels tall)
  const A_TAP = 7, A_ARM = 2.6, A_NOD = 3, A_LEAN = 2, A_BREATH = 2;

  const sample = (x, y, out) => {
    // bilinear sample of brightness and coverage
    if (x < 0 || y < 0 || x >= ww - 1 || y >= wh - 1) { out[0] = 0; out[1] = 0; return; }
    const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy;
    const i = iy * ww + ix;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    out[0] = lum[i] * w00 + lum[i + 1] * w10 + lum[i + ww] * w01 + lum[i + ww + 1] * w11;
    out[1] = cover[i] * w00 + cover[i + 1] * w10 + cover[i + ww] * w01 + cover[i + ww + 1] * w11;
  };

  const tmp = [0, 0];

  // One frame as text. t = seconds since the scene appeared.
  function render(t, still) {
    const cells = new Array(rows);
    for (let r = 0; r < rows; r++) cells[r] = new Array(columns).fill(" ");

    const p = still ? 1 : clamp(t / ENTRANCE);
    const slide = still ? 0 : (1 - ease(clamp(t / (ENTRANCE * 0.8)))) * 0.16 * wh;
    const frame = Math.floor(t * 20);

    // typing: every finger has its own rhythm, with pauses
    const env = still ? 0 : 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.16 * t);
    let avgTap = 0;
    for (let k = 0; k < FINGERS; k++) {
      const f = 2.4 + 0.37 * ((k * 7) % 5);
      const s = Math.sin(2 * Math.PI * (f * t + k * 0.618));
      taps[k] = still ? 0 : Math.pow(Math.max(0, s), 3);
      avgTap += taps[k] / FINGERS;
    }
    const nod = still ? 0 : Math.sin(2 * Math.PI * 0.42 * t + 1);
    const lean = still ? 0 : Math.sin(2 * Math.PI * 0.27 * t);
    const breath = still ? 0 : Math.sin(2 * Math.PI * 0.33 * t);
    const armSway = still ? 0 : Math.sin(2 * Math.PI * 3.1 * t);

    for (let r = 0; r < rows; r++) {
      const fromBottom = (rows - 1 - r) / rows;
      for (let c = 0; c < columns; c++) {
        const cx = (c + 0.5) * CELL_PX_X, cy = (r + 0.5) * CELL_PX_Y;

        let dx = 0, dy = slide;
        const hw = weight(cx, cy, hands);
        if (hw) {
          let s = 0;
          for (let k = 0; k < FINGERS; k++) {
            const g = Math.exp(-(((cx - fingerX[k]) / fingerSigma) ** 2));
            s += g * taps[k];
          }
          dy -= A_TAP * s * hw * env;
        }
        const aw = weight(cx, cy, forearm);
        if (aw) { dy -= A_ARM * avgTap * 3 * aw * env; dx += A_ARM * 0.5 * armSway * aw * env; }
        const hd = weight(cx, cy, head);
        if (hd) { dy += A_NOD * nod * hd; dx += A_LEAN * lean * hd; }
        const tw = weight(cx, cy, torso);
        if (tw) dy += A_BREATH * breath * tw;

        let sumL = 0, sumC = 0;
        for (let j = 0; j < SUB_Y.length; j++) {
          for (let i = 0; i < SUB_X.length; i++) {
            sample(cx + SUB_X[i] - dx, cy + SUB_Y[j] - dy, tmp);
            sumL += tmp[0] * tmp[1];
            sumC += tmp[1];
          }
        }
        const coverage = sumC / (SUB_X.length * SUB_Y.length);
        if (coverage < 0.45) continue;
        const b = FLOOR + (1 - FLOOR) * Math.pow(clamp(sumL / sumC), GAMMA);
        let ch = RAMP[1 + Math.floor(b * (RAMP.length - 2))];

        // entrance: assembles from the desk upward through a band of flickering glyphs
        if (p < 1) {
          const threshold = 0.6 * fromBottom + 0.2 * hash(r, c);
          if (p < threshold) continue;
          if (p < threshold + 0.14) ch = GLITCH[Math.floor(hash(r, c, frame) * GLITCH.length)];
        }
        cells[r][c] = ch;
      }
    }

    // code glyphs drifting up from the laptop
    if (!still && p >= 0.95) {
      const ox = Math.round(codeX / CELL_PX_X), oy = Math.round(codeY / CELL_PX_Y);
      for (let i = 0; i < code.count; i++) {
        const period = 3.6 + (i % 3) * 0.7;
        const raw = t / period + i * 0.37;
        const phase = raw - Math.floor(raw);
        if (phase < 0.05 || phase > 0.92) continue;
        const col = Math.round(ox + (i - code.count / 2) * 1.7 + Math.sin(phase * 6 + i) * 2);
        const row = Math.round(oy - phase * code.rise);
        if (row < 0 || row >= rows || col < 0 || col >= columns) continue;
        if (cells[row][col] !== " ") continue;
        cells[row][col] = phase > 0.7 ? "." : CODE[(i + Math.floor(raw)) % CODE.length];
      }
    }

    return cells.map((line) => line.join("")).join("\n") + "\n";
  }

  return {
    kind: "scene",
    cols: columns,
    rows,
    draw: (t) => (reducedMotion ? render(0, true) : render(t, false)),
  };
}
