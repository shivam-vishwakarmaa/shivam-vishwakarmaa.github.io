import { defineConfig } from "vite";
import site from "./site.config.js";

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Injects title/description from site.config.js into index.html at build time (good for SEO)
const injectMeta = () => ({
  name: "inject-site-meta",
  transformIndexHtml: (html) =>
    html
      .replaceAll("%SITE_TITLE%", esc(`${site.name} - ${site.role}`))
      .replaceAll("%SITE_DESCRIPTION%", esc(site.description))
      .replaceAll("%SITE_NAME%", esc(site.name)),
});

export default defineConfig({
  base: "./", // works on GitHub Pages, Netlify, or any folder
  plugins: [injectMeta()],
});
