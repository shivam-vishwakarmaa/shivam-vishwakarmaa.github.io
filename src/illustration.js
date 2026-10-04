// The contact page drawing: a night sky, a mailbox on a post with a bird on top, and paper planes looping
// in along a dotted flight path. Hand-drawn style line art that draws itself in, then loops.
// It reacts to the form (classes set by contact-form.js):
//   .lit      a field is focused   -> the mailbox door swings open
//   .sending  message is on its way -> an envelope keeps flying toward the box
//   .sent     delivered              -> envelope drops in, the flag pops up, sparks burst
// Everything is CSS (see "the mailbox drawing" in style.css) except the planes, which use SVG motion paths.

const FLIGHT =
  "M-40 235 C10 120 130 60 205 105 C275 148 245 238 170 226 C105 216 112 128 178 140 C240 152 175 322 246 346";

const STARS = [[205, 58], [300, 96], [425, 62], [510, 140], [55, 255], [495, 262], [150, 40], [372, 150]];
const SPARKS = [[250, 296, -26, -30], [330, 246, 0, -40], [446, 286, 34, -26], [474, 364, 40, 6], [262, 424, -30, 30], [410, 258, 20, -36]];

export function illustrationSVG({ reducedMotion = false } = {}) {
  let i = 0;
  const d = (cls = "") => `class="draw ${cls}" pathLength="1" style="--i:${i++}"`;
  const star = ([x, y], n) =>
    `<g class="star" style="--s:${n}"><path ${d()} d="M${x} ${y - 7} L${x} ${y + 7}"/><path ${d()} d="M${x - 7} ${y} L${x + 7} ${y}"/></g>`;
  const plane = (begin, cls) => `
    <g class="ill-plane ${cls}" opacity="0">
      <g transform="scale(1.1)">
        <path class="plane-body" d="M26 0 L-22 -15 L-8 0 L-22 11 Z"/>
        <path d="M-8 0 L26 0 M-8 0 L-13 9"/>
      </g>
      <animateMotion dur="7s" begin="${begin}" repeatCount="indefinite" rotate="auto" path="${FLIGHT}"/>
      <animate attributeName="opacity" dur="7s" begin="${begin}" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.04;0.93;1"/>
    </g>`;

  return `
<svg class="ill" viewBox="0 0 560 680" role="img" aria-label="A mailbox with a bird on top, waiting for messages while paper planes fly toward it" fill="none">
  <defs>
    <linearGradient id="sky-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c9bcff"/><stop offset="0.55" stop-color="#ffc8d8"/><stop offset="1" stop-color="#ffe2a8"/>
    </linearGradient>
  </defs>
  <ellipse class="t-sky" cx="280" cy="340" rx="268" ry="302" fill="url(#sky-g)"/>
  <circle class="halo" cx="120" cy="115" r="70"/>

  <!-- moon and stars -->
  <path ${d("t-moon")} d="M124 72 A46 46 0 1 0 152 150 A37 37 0 1 1 124 72 Z"/>
  <circle ${d()} cx="90" cy="130" r="5"/>
  <circle ${d()} cx="108" cy="152" r="3"/>
  ${STARS.map(star).join("")}

  <!-- clouds -->
  <g class="cloud" style="--k:1"><path ${d("t-cloud")} d="M300 190 C284 190 284 166 304 166 C304 146 334 144 342 162 C354 152 376 162 370 180 C388 180 388 202 370 202 L308 202 C302 202 300 196 300 190 Z"/></g>
  <g class="cloud" style="--k:-1"><path ${d("t-cloud")} d="M40 372 C28 372 28 354 43 354 C43 340 66 338 72 351 C82 344 98 351 94 364 C106 364 106 380 94 380 L46 380 C42 380 40 376 40 372 Z"/></g>

  <!-- flight path of the paper planes -->
  <path class="trail" d="${FLIGHT}"/>
  ${reducedMotion ? "" : plane("3.4s", "p1") + plane("6.9s", "p2")}

  <!-- ground -->
  <path class="t-ground" d="M20 641 C90 636 170 646 250 641 S400 636 480 642 S530 640 545 638 L545 672 L20 672 Z"/>
  <path ${d()} d="M20 641 C90 636 170 646 250 641 S400 636 480 642 S530 640 545 638"/>
  <path ${d()} d="M60 641 L56 626 M66 641 L68 622 M74 641 L80 630"/>
  <path ${d()} d="M480 641 L476 624 M487 641 L490 620 M494 641 L502 630"/>

  <!-- post -->
  <rect class="t-post" x="338" y="402" width="24" height="239"/>
  <path ${d()} d="M338 402 L338 641"/>
  <path ${d()} d="M362 402 L362 641"/>
  <path ${d()} d="M316 641 C326 626 374 626 384 641"/>

  <!-- mailbox -->
  <g class="mailbox">
    <path ${d("t-box")} d="M250 292 L400 292 C430 292 450 312 450 346 L450 402 L250 402"/>
    <path ${d()} d="M270 322 C322 315 392 315 436 324"/>
    <path ${d()} d="M270 380 L438 380"/>
    <path ${d("t-badge")} d="M330 338 h58 v36 h-58 Z"/>
    <path ${d()} d="M330 338 L359 360 L388 338"/>
    <g class="m-door">
      <ellipse ${d("t-door")} cx="250" cy="347" rx="24" ry="55"/>
      <ellipse ${d("t-hole")} cx="250" cy="347" rx="15" ry="44"/>
      <circle ${d()} cx="246" cy="347" r="4"/>
    </g>

    <g class="flag">
      <path ${d()} d="M428 330 L428 246"/>
      <path ${d("t-flag")} d="M428 246 L480 246 L480 278 L428 278"/>
      <circle ${d()} cx="428" cy="330" r="5"/>
    </g>
  </g>

  <!-- the bird -->
  <g class="bird">
    <path ${d("t-bird")} d="M310 278 C310 266 322 262 332 266 C340 270 344 278 338 286 C332 292 316 292 310 284 Z"/>
    <path ${d()} d="M312 276 L294 268 L298 282"/>
    <g class="bird-head">
      <circle ${d("t-bird2")} cx="343" cy="266" r="8.5"/>
      <path ${d("t-beak")} d="M351 264 L361 268 L351 271"/>
      <circle class="solid" cx="346" cy="264" r="1.9"/>
    </g>
  </g>

  <!-- delivery effects -->
  <g transform="translate(222 340)"><g class="env">
    <rect class="plane-body" x="-22" y="-15" width="44" height="30" rx="3"/>
    <path d="M-22 -15 L0 3 L22 -15"/>
  </g></g>
  ${SPARKS.map(([x, y, dx, dy], n) => `<g transform="translate(${x} ${y})"><g class="spark s${n % 5}" style="--dx:${dx}px;--dy:${dy}px;--n:${n}"><path d="M0 -9 L0 9 M-9 0 L9 0 M-5 -5 L5 5 M5 -5 L-5 5"/></g></g>`).join("")}
</svg>`;
}
