// Page transition: an old-TV "channel change".
//   out: black bars close in from the top and bottom, leaving one bright line, which shrinks to a dot
//   (the page is swapped behind the black)
//   in:  the dot stretches into a line, the bars open up, and the new page arrives with an RGB glitch
// Everything is a few Web Animations on four tiny elements, so it stays smooth.

const html = document.documentElement;

export function createTransition({ reducedMotion }) {
  const tv = document.createElement("div");
  tv.id = "tv";
  tv.setAttribute("aria-hidden", "true");
  tv.innerHTML = `<div class="tv-top"></div><div class="tv-bottom"></div><div class="tv-line"></div>`;
  document.body.append(tv);
  const top = tv.querySelector(".tv-top");
  const bottom = tv.querySelector(".tv-bottom");
  const line = tv.querySelector(".tv-line");

  const run = (el, keyframes, options) => el.animate(keyframes, { fill: "both", ...options }).finished;
  const cleanup = () => {
    for (const el of [top, bottom, line]) el.getAnimations().forEach((a) => a.cancel());
    tv.classList.remove("on");
    html.classList.remove("noise-burst");
  };

  const glitch = (page) =>
    page.animate(
      [
        { transform: "none", filter: "none" },
        { transform: "translateX(-18px) skewX(4deg)", filter: "drop-shadow(7px 0 rgba(255,0,70,.85)) drop-shadow(-7px 0 rgba(0,225,255,.85))", offset: 0.12 },
        { transform: "translateX(12px) skewX(-3deg)", filter: "drop-shadow(-5px 0 rgba(255,0,70,.8)) drop-shadow(5px 0 rgba(0,225,255,.8))", offset: 0.28 },
        { transform: "translateX(-6px)", filter: "drop-shadow(3px 0 rgba(255,0,70,.7)) drop-shadow(-3px 0 rgba(0,225,255,.7))", offset: 0.45 },
        { transform: "translateX(3px)", filter: "drop-shadow(-2px 0 rgba(255,0,70,.5)) drop-shadow(2px 0 rgba(0,225,255,.5))", offset: 0.7 },
        { transform: "none", filter: "none" },
      ],
      { duration: 460, easing: "steps(12, end)" }
    );

  // swap() replaces the page content; page is the element that holds it
  async function play(page, swap, { first = false } = {}) {
    if (reducedMotion) {
      swap();
      await page.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }).finished;
      return;
    }

    tv.classList.add("on");
    html.classList.add("noise-burst");

    if (first) {
      // boot: start fully black with the dot, as if the TV has just been switched on
      top.style.transform = bottom.style.transform = "scaleY(1)";
      line.style.opacity = "1";
      line.style.transform = "scaleX(0.02)";
    } else {
      await Promise.all([
        run(top, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { duration: 280, easing: "cubic-bezier(.7,0,.9,.5)" }),
        run(bottom, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { duration: 280, easing: "cubic-bezier(.7,0,.9,.5)" }),
        run(line, [{ opacity: 0, transform: "scaleX(1)" }, { opacity: 0, transform: "scaleX(1)", offset: 0.55 }, { opacity: 1, transform: "scaleX(1)" }], { duration: 280 }),
      ]);
      await run(
        line,
        [
          { transform: "scaleX(1)", opacity: 1, filter: "brightness(1)" },
          { transform: "scaleX(0.02)", opacity: 1, filter: "brightness(2.5)" },
        ],
        { duration: 180, easing: "cubic-bezier(.6,0,.9,.4)" }
      );
    }

    swap();

    await run(
      line,
      [
        { transform: "scaleX(0.02)", opacity: 1 },
        { transform: "scaleX(1)", opacity: 1 },
      ],
      { duration: 160, easing: "cubic-bezier(.2,.7,.2,1)" }
    );
    glitch(page);
    await Promise.all([
      run(top, [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], { duration: 360, easing: "cubic-bezier(.2,.75,.2,1)" }),
      run(bottom, [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], { duration: 360, easing: "cubic-bezier(.2,.75,.2,1)" }),
      run(line, [{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 360 }),
    ]);
    top.style.transform = bottom.style.transform = "";
    line.style.opacity = line.style.transform = "";
    cleanup();
  }

  return { play };
}
