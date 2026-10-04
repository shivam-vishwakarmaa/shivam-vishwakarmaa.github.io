// Turns your signature picture (dark ink on any light background, or a transparent PNG) into a clean mask,
// so it is drawn in the page's text colour: white on the dark theme, black on the light theme.

const cache = new Map(); // url -> Promise<{ url, ratio } | null>

function load(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load signature: ${src}`));
    img.src = src;
  });
}

async function makeMask(src) {
  const img = await load(src);
  const scale = Math.min(1, 900 / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;

  // a picture with a transparent background already is a mask; otherwise dark pixels are the ink
  const transparentBackground = d[3] < 10 && d[(w - 1) * 4 + 3] < 10;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let a;
      if (transparentBackground) a = d[i + 3] / 255;
      else {
        const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        a = Math.min(1, Math.max(0, (205 - lum) / 90)); // paper and faint grid lines vanish, ink stays
      }
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(a * 255);
      if (a > 0.15) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  ctx.putImageData(image, 0, 0);

  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { url: out.toDataURL("image/png"), ratio: out.width / out.height };
}

export function initSignatures(root) {
  root.querySelectorAll(".signature[data-src]").forEach(async (el) => {
    const src = new URL(el.dataset.src.replace(/^\/+/, ""), document.baseURI).href;
    if (!cache.has(src)) cache.set(src, makeMask(src).catch((err) => (console.warn(err.message), null)));
    const mask = await cache.get(src);
    if (!mask) { el.remove(); return; }
    el.style.setProperty("--sig", `url(${mask.url})`);
    el.style.aspectRatio = String(mask.ratio);
    el.classList.add("ready");
  });
}
