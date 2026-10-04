// Skills: a three-line heading, a few sentences about me, big skill lists and a sticky index on the right.

import { esc, rich, footerHTML } from "../ui.js";

export function skillsPage(site) {
  return (root) => {
    const skills = site.skills;
    const lines = skills.heading;

    const blocks = skills.sections
      .map(
        (section, i) => `
        <section class="skill-block c${i % 5}" id="skill-${i}" data-reveal>
          <h2 class="serif-h">${esc(section.name)}</h2>
          <ul class="skill-items${section.lines ? " as-lines" : ""}">
            ${section.items.map((item, n) => `<li style="--i:${n}">${esc(item)}</li>`).join("")}
          </ul>
        </section>`
      )
      .join("");

    root.innerHTML = `
      <section class="page skills-page">
        <div class="frame" data-reveal>
          <h1 class="display tight">
            ${lines.map((l, i) => `<span class="ln">${i === lines.length - 1 ? `<span class="hl">${esc(l)}</span>` : esc(l)}</span>`).join("")}
          </h1>
        </div>
        <ul class="intro">
          ${skills.intro.map((text, i) => `<li data-reveal style="--i:${i}"><span>${rich(text)}</span></li>`).join("")}
        </ul>
        <div class="skills-layout">
          <div class="skills-main">${blocks}</div>
          <nav class="skills-index" aria-label="Skill sections">
            <ul>
              ${skills.sections.map((s, i) => `<li><a href="#skill-${i}" data-skill="${i}" class="idx-link">${esc(s.name)}</a></li>`).join("")}
            </ul>
          </nav>
        </div>
      </section>
      ${footerHTML(site)}`;

    const links = [...root.querySelectorAll(".idx-link")];
    const setActive = (i) => links.forEach((a) => a.classList.toggle("active", Number(a.dataset.skill) === i));
    setActive(0);

    // the index follows whichever block is in the middle of the screen
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number(entry.target.id.replace("skill-", "")));
        }
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    root.querySelectorAll(".skill-block").forEach((el) => observer.observe(el));

    const onClick = (event) => {
      const link = event.target.closest(".idx-link");
      if (!link) return;
      event.preventDefault();
      root.querySelector(`#skill-${link.dataset.skill}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    root.addEventListener("click", onClick);

    return () => {
      observer.disconnect();
      root.removeEventListener("click", onClick);
    };
  };
}
