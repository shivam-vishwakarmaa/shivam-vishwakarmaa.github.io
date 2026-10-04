import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-400-italic.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/source-serif-4/latin-400.css";
import "@fontsource/source-serif-4/latin-600.css";
import "./style.css";

import site from "../site.config.js";
import { startGrain } from "./grain.js";
import { startRouter } from "./router.js";
import { esc, ext, ICON } from "./ui.js";
import { initSignatures } from "./signature.js";
import { aboutPage } from "./pages/about.js";
import { workPage } from "./pages/work.js";
import { skillsPage } from "./pages/skills.js";
import { contactPage } from "./pages/contact.js";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ctx = { reducedMotion };

// ── Header (it stays put while the pages change) ─────────────
const nav = site.nav
  .map((n) => `<a href="#/${esc(n.target)}" data-target="${esc(n.target)}">${esc(n.label)}</a>`)
  .join("");

document.getElementById("app").innerHTML = `
  <header class="nav">
    <button class="theme-toggle btn" type="button" aria-label="Toggle light and dark theme">
      <span class="icon-moon">${ICON.moon}</span><span class="icon-sun">${ICON.sun}</span>
    </button>
    <nav aria-label="Pages">${nav}</nav>
    <a class="gh" href="${esc(site.github.url)}"${ext(site.github.url)}>${ICON.github}<span>${esc(site.github.label)}</span>${ICON.external}</a>
  </header>
  <main id="page"></main>`;

// ── Theme ────────────────────────────────────────────────────
const root = document.documentElement;
let saved = null;
try { saved = localStorage.getItem("theme"); } catch {}
const preferred = site.theme.default === "system"
  ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
  : site.theme.default;
root.dataset.theme = saved === "light" || saved === "dark" ? saved : preferred;

const toggle = document.querySelector(".theme-toggle");
toggle.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch {}
  toggle.classList.remove("spin");
  void toggle.offsetWidth;
  toggle.classList.add("spin");
});

// ── Screen effects ───────────────────────────────────────────
const fx = site.effects;
for (const key of ["grain", "vignette", "scanlines", "flicker", "glow"]) {
  root.classList.toggle(`fx-${key}`, Boolean(fx[key]));
}
if (fx.grain) startGrain(document.getElementById("grain"), { fps: fx.grainFps });

// ── Scroll progress bar and back-to-top button ───────────────
const bar = Object.assign(document.createElement("div"), { id: "progress" });
const toTop = Object.assign(document.createElement("button"), { id: "to-top", type: "button", className: "btn" });
toTop.setAttribute("aria-label", "Back to top");
toTop.innerHTML = ICON.arrowUp;
document.body.append(bar, toTop);

const onScroll = () => {
  const max = root.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  toTop.classList.toggle("show", scrollY > 500);
};
addEventListener("scroll", onScroll, { passive: true });
toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }));

// ── Ripple on every button press ─────────────────────────────
document.addEventListener("pointerdown", (event) => {
  const button = event.target.closest(".btn");
  if (!button || button.disabled) return;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px`;
  button.append(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
});

// ── Pages ────────────────────────────────────────────────────
const links = [...document.querySelectorAll(".nav nav a")];
startRouter({
  root: document.getElementById("page"),
  home: "about",
  reducedMotion,
  routes: {
    about: aboutPage(site, ctx),
    work: workPage(site),
    skills: skillsPage(site),
    contact: contactPage(site, ctx),
  },
  onRoute: (name) => {
    links.forEach((a) => a.classList.toggle("active", a.dataset.target === name));
    document.body.dataset.page = name;
    initSignatures(document.getElementById("page"));
    onScroll();
  },
});
