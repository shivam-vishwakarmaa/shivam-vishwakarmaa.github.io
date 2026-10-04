// Drives the ASCII figure on the home page. Picks what to draw, sizes the <pre>, animates it,
// and returns { stop } so leaving the page stops all the work.
//   mode "scene"       a photo of you working at a laptop (see scene.js), falls back to the portrait
//   mode "photo"       your face, rotating in 3D (see photo.js), falls back to the bust
//   mode "placeholder" a generic 3D bust

import { renderBust, CELL_W } from "./bust.js";
import { createPhotoRenderer } from "./photo.js";

const FPS = 30;
const drawerCache = new Map(); // preparing a picture is slow, so do it once per session

async function buildScene(face, reducedMotion) {
  const { createScene } = await import("./scene.js");
  return createScene(
    { ...face.scene, image: new URL(face.scene.image.replace(/^\/+/, ""), document.baseURI).href },
    { reducedMotion }
  );
}

async function buildPhoto(face, reducedMotion) {
  const { columns: cols, rows } = face;
  const photoUrl = new URL(face.photo.replace(/^\/+/, ""), document.baseURI).href;
  const photo = await createPhotoRenderer(photoUrl, {
    cols, rows, cutoff: face.photoCutoff, invert: face.photoInvert,
    landmarks: face.photoLandmarks, centerX: face.photoCenterX,
  });
  const radiansPerSecond = (Math.PI * 2) / face.spinSecondsPerTurn;
  const swing = (face.photoSwingDegrees * Math.PI) / 180;
  return {
    cols, rows,
    draw: (t) => {
      if (reducedMotion) return photo.render(0);
      return photo.render(face.photoRotation === "swing" ? swing * Math.sin(t * 0.8) : t * radiansPerSecond);
    },
  };
}

function buildBust(face, reducedMotion) {
  const { columns: cols, rows } = face;
  const radiansPerSecond = (Math.PI * 2) / face.spinSecondsPerTurn;
  return { cols, rows, draw: (t) => renderBust(cols, rows, reducedMotion ? 0.35 : t * radiansPerSecond) };
}

async function getDrawer(face, reducedMotion) {
  const key = `${face.mode}|${reducedMotion}`;
  if (drawerCache.has(key)) return drawerCache.get(key);

  let drawer = null;
  if (face.mode === "scene" && face.scene) {
    try { drawer = await buildScene(face, reducedMotion); }
    catch (err) { console.warn(`${err.message}. Falling back to the portrait.`); }
  }
  if (!drawer && (face.mode === "scene" || face.mode === "photo")) {
    try { drawer = await buildPhoto(face, reducedMotion); }
    catch (err) { console.warn(`${err.message}. Falling back to the placeholder face.`); }
  }
  if (!drawer) drawer = buildBust(face, reducedMotion);

  drawerCache.set(key, drawer);
  return drawer;
}

export async function startFace(pre, face, { reducedMotion }) {
  const drawer = await getDrawer(face, reducedMotion);
  const { cols } = drawer;
  pre.closest(".hero")?.setAttribute("data-kind", drawer.kind || "portrait");
  let stopped = false;
  const observers = [];

  // Scale the text so exactly `cols` characters fill the container's width
  const fit = () => {
    const w = pre.parentElement?.clientWidth;
    if (w) pre.style.fontSize = `${w / (cols * CELL_W)}px`;
  };
  fit();
  const resize = new ResizeObserver(fit);
  resize.observe(pre.parentElement);
  observers.push(resize);

  const start = performance.now();
  pre.textContent = drawer.draw(0);
  if (reducedMotion) return { stop() { observers.forEach((o) => o.disconnect()); } };

  let visible = true;
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  io.observe(pre);
  observers.push(io);

  let last = 0;
  const tick = (now) => {
    if (stopped) return;
    requestAnimationFrame(tick);
    if (!visible || now - last < 1000 / FPS) return;
    last = now;
    pre.textContent = drawer.draw((now - start) / 1000);
  };
  requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      observers.forEach((o) => o.disconnect());
    },
  };
}
