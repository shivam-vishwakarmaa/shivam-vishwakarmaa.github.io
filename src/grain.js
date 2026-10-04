// TV-static grain. Two random-noise tiles are generated once (mostly-dark for the dark theme,
// mostly-light for the light theme, so the noise adds texture without greying the screen), then a
// full-screen layer jumps the tile around at `fps` using a stepped CSS animation. Cheap on the GPU
// and never stops moving.

const TILE = 400;
const KEYFRAMES = 10;

function makeTile(valueOf) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(TILE, TILE);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = valueOf(Math.random());
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return `url(${canvas.toDataURL("image/png")})`;
}

export function startGrain(el, { fps }) {
  // r^3 piles most pixels near black with a few bright flecks, like static on a dark screen
  el.style.setProperty("--grain-dark", makeTile((r) => 255 * r * r * r));
  el.style.setProperty("--grain-light", makeTile((r) => 255 - 255 * r * r * r));
  el.style.setProperty("--grain-duration", `${KEYFRAMES / fps}s`);
}
