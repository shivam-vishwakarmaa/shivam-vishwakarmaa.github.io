// Scroll-reveal: anything marked data-reveal fades/slides in the first time it scrolls into view.
// Stagger a group by giving its children style="--i: N".

let observer = null;

function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
  }
  return observer;
}

export function revealIn(root) {
  root.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => getObserver().observe(el));
}

export function resetReveals() {
  observer?.disconnect();
  observer = null;
}
