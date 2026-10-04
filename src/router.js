// Tiny hash router: #/about, #/work, #/skills, #/contact. Each page is its own screen,
// swapped in with the TV transition. A page is a function (root) => cleanup().

import { createTransition } from "./transition.js";
import { resetReveals, revealIn } from "./reveal.js";

export function startRouter({ root, routes, home, reducedMotion, onRoute }) {
  const transition = createTransition({ reducedMotion });
  let current = null;
  let cleanup = null;
  let busy = false;
  let pending = null;

  const wanted = () => {
    const name = location.hash.replace(/^#\/?/, "").split("?")[0];
    return routes[name] ? name : home;
  };

  async function go(name, first = false) {
    if (name === current) return;
    if (busy) { pending = name; return; }
    busy = true;

    const swap = () => {
      cleanup?.();
      resetReveals();
      root.innerHTML = "";
      window.scrollTo(0, 0);
      cleanup = routes[name](root) || null;
      current = name;
      onRoute(name);
    };

    await transition.play(root, swap, { first });
    revealIn(root);
    busy = false;

    if (pending && pending !== current) {
      const next = pending;
      pending = null;
      go(next);
    }
    pending = null;
  }

  addEventListener("hashchange", () => go(wanted()));
  go(wanted(), true);
}
