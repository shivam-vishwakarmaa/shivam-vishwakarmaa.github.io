// Work: a big serif heading, filter chips, and the numbered project list.

import { esc, ext, rich, ICON, footerHTML } from "../ui.js";
import { revealIn } from "../reveal.js";

const chip = (text) => `<span class="mini-chip">${esc(text)}</span>`;

function card(project, index, order) {
  const categories = project.categories || [];
  const stack = project.stack || project.tags || [];
  const highlights = project.highlights || [];
  return `
    <article class="wk-card c${index % 5}" data-reveal style="--i:${order}">
      <h3><span class="num">${String(index).padStart(3, "0")}</span>${esc(project.title)}</h3>
      <p class="desc">${esc(project.description)}</p>
      ${highlights.length ? `<ul class="highlights">${highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
      ${categories.length ? `<div class="meta"><span class="label">Tags:</span>${categories.map(chip).join("")}</div>` : ""}
      ${stack.length ? `<div class="meta"><span class="label">Stack:</span>${stack.map(chip).join("")}</div>` : ""}
      ${project.github || project.live ? `
        <div class="card-links">
          ${project.github ? `<a class="link-anim" href="${esc(project.github)}"${ext(project.github)}>github ${ICON.external}</a>` : ""}
          ${project.live ? `<a class="link-anim" href="${esc(project.live)}"${ext(project.live)}>live ${ICON.external}</a>` : ""}
        </div>` : ""}
    </article>`;
}

export function workPage(site) {
  return (root) => {
    const work = site.work;
    const categories = [...new Set(work.projects.flatMap((p) => p.categories || []))];
    const selected = new Set();

    root.innerHTML = `
      <section class="page work-page">
        <div class="frame" data-reveal><h1 class="display">${rich(work.heading)}</h1></div>
        <div class="chips" data-reveal style="--i:1" role="group" aria-label="Filter projects">
          <button type="button" class="chip btn on" data-cat="*" aria-pressed="true">Everything</button>
          ${categories.map((c) => `<button type="button" class="chip btn" data-cat="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("")}
          <button type="button" class="chip btn clear" data-clear tabindex="-1">Clear Filters</button>
        </div>
        <div class="wk-grid"></div>
      </section>
      ${footerHTML(site)}`;

    const grid = root.querySelector(".wk-grid");
    const chips = root.querySelector(".chips");
    const everything = chips.querySelector('[data-cat="*"]');
    const clear = chips.querySelector("[data-clear]");

    const renderGrid = () => {
      const shown = work.projects
        .map((project, index) => ({ project, index }))
        .filter(({ project }) => !selected.size || (project.categories || []).some((c) => selected.has(c)));
      grid.innerHTML = shown.map(({ project, index }, order) => card(project, index, order)).join("");
      revealIn(grid);
    };

    const syncChips = () => {
      everything.classList.toggle("on", selected.size === 0);
      everything.setAttribute("aria-pressed", String(selected.size === 0));
      chips.querySelectorAll("[data-cat]:not([data-cat='*'])").forEach((el) => {
        const on = selected.has(el.dataset.cat);
        el.classList.toggle("on", on);
        el.setAttribute("aria-pressed", String(on));
      });
      clear.classList.toggle("show", selected.size > 0);
      clear.tabIndex = selected.size > 0 ? 0 : -1;
    };

    chips.addEventListener("click", (event) => {
      const el = event.target.closest(".chip");
      if (!el) return;
      if (el.hasAttribute("data-clear") || el.dataset.cat === "*") selected.clear();
      else if (selected.has(el.dataset.cat)) selected.delete(el.dataset.cat);
      else selected.add(el.dataset.cat);
      el.classList.remove("pop");
      void el.offsetWidth; // restart the pop animation
      el.classList.add("pop");
      syncChips();
      renderGrid();
    });

    renderGrid();
    return null;
  };
}
