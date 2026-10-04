// Contact: the animated drawing on the left, a working message form on the right.

import { esc, ext, rich, ICON, footerHTML } from "../ui.js";
import { illustrationSVG } from "../illustration.js";
import { bindContactForm } from "../contact-form.js";

export function contactPage(site, ctx = {}) {
  return (root) => {
    const c = site.contact;

    root.innerHTML = `
      <section class="page contact-page">
        <div class="contact-grid">
          <div class="ill-wrap" data-reveal>${illustrationSVG({ reducedMotion: ctx.reducedMotion })}</div>
          <div class="contact-main">
            <h1 class="display md" data-reveal>${rich(c.heading)}</h1>
            <p class="sub-serif" data-reveal style="--i:1">${esc(c.subheading)}</p>

            <form class="c-form" novalidate data-reveal style="--i:2">
              <label class="sr-only" for="cf-name">Name</label>
              <input id="cf-name" name="name" type="text" placeholder="Name (if you have any)" autocomplete="name" maxlength="80" />
              <label class="sr-only" for="cf-email">Email</label>
              <input id="cf-email" name="email" type="email" placeholder="Email*" autocomplete="email" required maxlength="120" />
              <label class="sr-only" for="cf-message">Message</label>
              <textarea id="cf-message" name="message" placeholder="Message*" rows="5" required maxlength="3000"></textarea>
              <input class="trap" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
              <button class="send-btn btn" type="submit" data-state="idle">
                <span class="send-icon">${ICON.plane}</span><span class="lbl">Send</span>
              </button>
              <p class="form-status" role="status" aria-live="polite"></p>
            </form>

            <p class="c-note" data-reveal style="--i:3">${esc(c.note)}</p>
            <ul class="c-links" data-reveal style="--i:4">
              ${c.links.map((l) => `<li><a class="link-anim" href="${esc(l.url)}"${ext(l.url)}>${esc(l.label)}</a></li>`).join("")}
            </ul>
          </div>
        </div>
      </section>
      ${footerHTML(site)}`;

    return bindContactForm(root.querySelector(".c-form"), c.form, root.querySelector(".ill"));
  };
}
