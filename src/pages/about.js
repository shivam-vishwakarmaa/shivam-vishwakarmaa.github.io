// Home: the ASCII figure on the left, the typewriter text on the right, then the LeetCode bubble shooter.

import { startFace } from "../face.js";
import { typewriter } from "../typewriter.js";
import { leetcodeHTML, mountLeetcode } from "../leetcode.js";
import { footerHTML } from "../ui.js";

export function aboutPage(site, ctx) {
  return (root) => {
    root.innerHTML = `
      <section class="hero">
        <div class="face-wrap"><pre id="face" aria-hidden="true"></pre></div>
        <div class="about-text" id="typed"></div>
      </section>
      ${leetcodeHTML(site)}
      ${footerHTML(site)}`;

    const typer = typewriter(root.querySelector("#typed"), site.about.lines, {
      speedMs: site.about.typingSpeedMs,
      instant: ctx.reducedMotion,
    });
    const face = startFace(root.querySelector("#face"), site.face, { reducedMotion: ctx.reducedMotion });
    const game = mountLeetcode(root.querySelector(".lc"), site, { reducedMotion: ctx.reducedMotion });

    return () => {
      typer.stop();
      face.then((f) => f.stop());
      game();
    };
  };
}
