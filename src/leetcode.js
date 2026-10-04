// Your LeetCode graph as a real bubble shooter.
//   - every day of the past year is a bubble: hollow ring = no submissions, darker/brighter = more
//   - aim with the mouse (or drag on a phone), click to shoot, Space / right-click swaps the next bubble
//   - a shot sticks to the graph; 3+ connected bubbles of the same shade pop, and anything left hanging
//     with nothing holding it to the top falls away
//   - if the graph grows down to the red line, it's game over; clear everything to win
//   - when you're not playing, it plays itself (config: leetcode.demo)
// Data comes from `npm run sync` (src/leetcode-data.json).

import data from "./leetcode-data.json";
import { esc, rich } from "./ui.js";

const MAX_ROWS = 13; // rows 0..11 are playable, landing on the last row is game over
const DAYS = 7;
const ALPHA = [0, 0.3, 0.52, 0.76, 1]; // fill strength of each shade
const levelOf = (n) => (n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4);
const MAX_ANGLE = (75 * Math.PI) / 180;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const weeksFor = (w) => (w >= 900 ? 53 : w >= 520 ? 35 : 21);

const end = new Date(data.fetchedAt);
end.setUTCHours(0, 0, 0, 0);
const yearStart = new Date(end);
yearStart.setUTCDate(end.getUTCDate() - 364);
const yearTotal = Object.entries(data.days).reduce(
  (sum, [day, n]) => (day >= yearStart.toISOString().slice(0, 10) && day <= end.toISOString().slice(0, 10) ? sum + n : sum),
  0
);

const prettyDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

export function leetcodeHTML(site) {
  const lc = site.leetcode;
  return `
    <section class="lc" aria-labelledby="lc-title">
      <h2 class="lc-title serif-h" id="lc-title" data-reveal>${esc(lc.heading)}</h2>
      <p class="lc-sub" data-reveal style="--i:1">${rich(lc.subheading)}</p>
      <p class="lc-stats" data-reveal style="--i:2">
        <span><b>${yearTotal}</b> submissions in the past year</span>
        <span><b>${data.totalActiveDays}</b> active days</span>
        <span>max streak <b>${data.streak}</b></span>
      </p>
      <div class="lc-panel" data-reveal style="--i:3"><div class="lc-field">
        <canvas tabindex="0" aria-label="Bubble shooter made from my LeetCode graph. Move the mouse to aim, click to shoot. Arrow keys aim, space shoots."></canvas>
        <div class="lc-tip" hidden></div>
      </div></div>
      <div class="lc-bar">
        <p class="lc-score" aria-live="off"></p>
        <p class="lc-help">Aim with the mouse (or drag) · click to shoot · space swaps the next bubble</p>
        <button class="btn lc-rebuild" type="button">Rebuild</button>
      </div>
    </section>`;
}

export function mountLeetcode(root, site, { reducedMotion }) {
  const canvas = root.querySelector(".lc-field canvas");
  const field = root.querySelector(".lc-field");
  const tip = root.querySelector(".lc-tip");
  const scoreEl = root.querySelector(".lc-score");
  const ctx = canvas.getContext("2d");
  const demoEnabled = site.leetcode.demo !== false && !reducedMotion;

  // ── state ──
  let W = 0, H = 0, pitch = 0, R = 0, HIT = 0, STEP = 0, SPEED = 0, sx = 0, sy = 0, dpr = 1;
  let weeks = 0;
  let grid = [];
  let ammo = 0, next = 0;
  let aim = 0;
  let flying = null;
  let state = "play"; // play | over | won
  let overAt = 0;
  let score = 0, shots = 0, remaining = 0;
  let pops = [], falls = [], parts = [], pulses = [];
  let version = 0, traceCache = null;
  let lastInput = 0, demoPlan = null, demoAt = 0;
  let visible = false, everVisible = false;
  let fg = "#ececec", bg = "#080808";
  let palette = null; // one colour per shade in the light theme (set by --b0 ... --b4 in style.css); null = grayscale
  let raf = 0, last = 0, hoverPx = null;

  const now = () => performance.now() / 1000;
  const readColors = () => {
    const css = getComputedStyle(document.documentElement);
    fg = css.getPropertyValue("--fg").trim() || fg;
    bg = css.getPropertyValue("--bg").trim() || bg;
    const colors = [0, 1, 2, 3, 4].map((i) => css.getPropertyValue(`--b${i}`).trim());
    palette = colors.every(Boolean) ? colors : null;
  };

  // ── board ──
  function buildBoard() {
    const lastWeekStart = new Date(end);
    lastWeekStart.setUTCDate(end.getUTCDate() - end.getUTCDay());
    const first = new Date(lastWeekStart);
    first.setUTCDate(lastWeekStart.getUTCDate() - (weeks - 1) * 7);
    const t0 = now();
    const board = Array.from({ length: MAX_ROWS }, () => Array(weeks).fill(null));
    let n = 0;
    for (let c = 0; c < weeks; c++) {
      for (let r = 0; r < DAYS; r++) {
        const day = new Date(first);
        day.setUTCDate(first.getUTCDate() + c * 7 + r);
        if (day > end) continue;
        const iso = day.toISOString().slice(0, 10);
        const count = data.days[iso] || 0;
        board[r][c] = { level: levelOf(count), count, date: iso, born: reducedMotion ? -9 : t0 + 0.15 + c * 0.014 + r * 0.035 };
        n++;
      }
    }
    remaining = n;
    return board;
  }

  const presentLevels = () => {
    const seen = new Set();
    for (const row of grid) for (const b of row) if (b) seen.add(b.level);
    return [...seen];
  };
  const pickLevel = () => {
    const reachable = [];
    for (let c = 0; c < weeks; c++) {
      for (let r = MAX_ROWS - 1; r >= 0; r--) {
        if (grid[r]?.[c]) { reachable.push(grid[r][c].level); break; }
      }
    }
    if (reachable.length) return reachable[Math.floor(Math.random() * reachable.length)];
    const levels = presentLevels();
    return levels.length ? levels[Math.floor(Math.random() * levels.length)] : 0;
  };

  function rebuild() {
    grid = buildBoard();
    ammo = pickLevel();
    next = pickLevel();
    state = "play";
    flying = null;
    pops = []; falls = []; parts = []; pulses = [];
    score = 0; shots = 0;
    demoPlan = null;
    version++;
    updateScore(true);
  }

  // ── geometry ──
  const cx = (c) => (c + 0.5) * pitch;
  const cy = (r) => (r + 0.5) * pitch;

  function layout() {
    const w = Math.floor(field.clientWidth);
    if (!w) return false;
    const wk = weeksFor(w);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w;
    pitch = W / wk;
    R = pitch * 0.42;
    HIT = pitch * 0.84;
    STEP = pitch * 0.35;
    SPEED = Math.max(520, W * 0.75);
    H = Math.round(MAX_ROWS * pitch + pitch * 4.2);
    sx = W / 2;
    sy = H - pitch * 1.9;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    flying = null;
    if (wk !== weeks) { weeks = wk; rebuild(); }
    version++;
    return true;
  }

  // ── ray marching (used for the flying bubble, the aim line and the demo player) ──
  function bubbleNear(x, y) {
    const r0 = Math.floor(y / pitch), c0 = Math.floor(x / pitch);
    let best = null, bestD = HIT * HIT;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      if (r < 0 || r >= MAX_ROWS) continue;
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (c < 0 || c >= weeks || !grid[r][c]) continue;
        const d = (x - cx(c)) ** 2 + (y - cy(r)) ** 2;
        if (d < bestD) { bestD = d; best = { r, c }; }
      }
    }
    return best;
  }

  // moves p (x, y, dx, dy) by `dist`, bouncing off the side walls; returns true when it stopped (hit something)
  function advance(p, dist, onBounce) {
    let left = dist;
    while (left > 0) {
      const s = Math.min(STEP, left);
      p.x += p.dx * s; p.y += p.dy * s; left -= s;
      if (p.x < R) { p.x = 2 * R - p.x; p.dx = -p.dx; onBounce?.(p); }
      else if (p.x > W - R) { p.x = 2 * (W - R) - p.x; p.dx = -p.dx; onBounce?.(p); }
      if (p.y - R <= 0 || bubbleNear(p.x, p.y)) return true;
    }
    return false;
  }

  // the cell a bubble stopped at (x, y) will stick to: the nearest empty cell that touches the ceiling or another bubble
  function stickCell(x, y) {
    const r0 = Math.round(y / pitch - 0.5), c0 = Math.round(x / pitch - 0.5);
    let best = null, bestD = Infinity;
    for (let r = r0 - 2; r <= r0 + 2; r++) {
      if (r < 0 || r >= MAX_ROWS) continue;
      for (let c = c0 - 2; c <= c0 + 2; c++) {
        if (c < 0 || c >= weeks || grid[r][c]) continue;
        const held = r === 0 || grid[r - 1][c] || (r + 1 < MAX_ROWS && grid[r + 1][c]) || (c > 0 && grid[r][c - 1]) || (c + 1 < weeks && grid[r][c + 1]);
        if (!held) continue;
        const d = (x - cx(c)) ** 2 + (y - cy(r)) ** 2;
        if (d < bestD) { bestD = d; best = { r, c }; }
      }
    }
    return best;
  }

  function trace(angle) {
    if (traceCache && traceCache.angle === angle && traceCache.version === version) return traceCache;
    const p = { x: sx, y: sy, dx: Math.sin(angle), dy: -Math.cos(angle) };
    const points = [[p.x, p.y]];
    let guard = 0;
    while (guard++ < 40) {
      if (advance(p, W * 0.5, (q) => points.push([q.x, q.y]))) break;
    }
    points.push([p.x, p.y]);
    const cell = stickCell(p.x, p.y);
    traceCache = { angle, version, points, cell };
    return traceCache;
  }

  // ── board changes ──
  const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function flood(r, c, test) {
    const seen = new Set([r * 1000 + c]);
    const queue = [{ r, c, d: 0 }];
    const out = [];
    while (queue.length) {
      const cur = queue.shift();
      out.push(cur);
      for (const [dr, dc] of NEIGHBORS) {
        const nr = cur.r + dr, nc = cur.c + dc;
        if (nr < 0 || nr >= MAX_ROWS || nc < 0 || nc >= weeks) continue;
        const key = nr * 1000 + nc;
        if (seen.has(key) || !grid[nr][nc] || !test(grid[nr][nc])) continue;
        seen.add(key);
        queue.push({ r: nr, c: nc, d: cur.d + 1 });
      }
    }
    return out;
  }

  function burst(list, t0, delayStep) {
    for (const { r, c, d } of list) {
      const b = grid[r][c];
      const at = t0 + d * delayStep;
      pops.push({ x: cx(c), y: cy(r), level: b.level, at });
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2, v = pitch * (2 + Math.random() * 4);
        parts.push({ x: cx(c), y: cy(r), vx: Math.cos(a) * v, vy: Math.sin(a) * v - pitch * 2, at, life: 0.5 + Math.random() * 0.3, size: pitch * (0.08 + Math.random() * 0.08), level: b.level || 1 });
      }
      grid[r][c] = null;
    }
  }

  function land(p) {
    const cell = stickCell(p.x, p.y);
    if (!cell) return;
    const t = now();
    grid[cell.r][cell.c] = { level: p.level, count: -1, date: null, born: -9 };
    pulses.push({ r: cell.r, c: cell.c, at: t });
    version++;
    remaining++; // the shot is now part of the graph

    if (cell.r >= MAX_ROWS - 1) { state = "over"; overAt = t; updateScore(); return; }

    const level = p.level;
    const cluster = flood(cell.r, cell.c, (b) => b.level === level);
    if (cluster.length >= 3) {
      const maxD = Math.max(...cluster.map((q) => q.d));
      burst(cluster, t, 0.05);
      score += cluster.length;
      // anything no longer connected to the top row falls away
      const held = new Set();
      const queue = [];
      for (let c = 0; c < weeks; c++) if (grid[0][c]) { held.add(c); queue.push({ r: 0, c }); }
      while (queue.length) {
        const cur = queue.shift();
        for (const [dr, dc] of NEIGHBORS) {
          const nr = cur.r + dr, nc = cur.c + dc;
          if (nr < 0 || nr >= MAX_ROWS || nc < 0 || nc >= weeks || !grid[nr][nc]) continue;
          const key = nr * 1000 + nc;
          if (held.has(key)) continue;
          held.add(key);
          queue.push({ r: nr, c: nc });
        }
      }
      let dropped = 0;
      for (let r = 1; r < MAX_ROWS; r++) {
        for (let c = 0; c < weeks; c++) {
          if (!grid[r][c] || held.has(r * 1000 + c)) continue;
          falls.push({ x: cx(c), y: cy(r), vy: 0, level: grid[r][c].level, at: t + 0.05 * maxD + 0.2 + Math.random() * 0.15 });
          grid[r][c] = null;
          dropped++;
        }
      }
      score += dropped;
      remaining -= cluster.length + dropped;
    }
    // never hand out a shade that is no longer on the board
    const levels = presentLevels();
    if (!levels.includes(ammo)) ammo = pickLevel();
    if (!levels.includes(next)) next = pickLevel();
    if (!grid.some((row) => row.some(Boolean))) { state = "won"; overAt = t; }
    updateScore();
  }

  // the player's bubble is fired from the shooter; it was counted when it stuck (see land)
  function shoot() {
    if (flying || state !== "play") return;
    flying = { x: sx, y: sy, dx: Math.sin(aim), dy: -Math.cos(aim), level: ammo };
    ammo = next;
    next = pickLevel();
    shots++;
    updateScore();
  }

  function swap() {
    if (state !== "play" || flying) return;
    [ammo, next] = [next, ammo];
  }

  function updateScore(force) {
    const text = `Popped ${score} · Shots ${shots} · Bubbles left ${Math.max(0, remaining)}`;
    if (force || scoreEl.textContent !== text) scoreEl.textContent = text;
  }

  // ── the demo player ──
  function planShot() {
    let best = null;
    for (let deg = -74; deg <= 74; deg += 2.5) {
      const angle = (deg * Math.PI) / 180;
      const { cell } = trace(angle);
      if (!cell) continue;
      grid[cell.r][cell.c] = { level: ammo };
      const size = flood(cell.r, cell.c, (b) => b.level === ammo).length;
      grid[cell.r][cell.c] = null;
      const score = (size >= 3 ? 100 + size * 4 : 0) - cell.r * 3 - (cell.r >= MAX_ROWS - 3 ? 60 : 0) + Math.random() * 3;
      if (!best || score > best.score) best = { angle, score };
    }
    return best;
  }

  // ── drawing ──
  function bubble(x, y, level, scale = 1, alpha = 1) {
    if (scale <= 0 || alpha <= 0) return;
    const r = Math.max(0.5, R * scale);
    if (palette) {
      const color = palette[level];
      if (level === 0) {
        // no submissions that day: a soft hollow ring
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, pitch * 0.07);
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r - ctx.lineWidth / 2), 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = alpha * 0.22; // darker rim at the bottom edge gives it roundness
        ctx.strokeStyle = "#000";
        ctx.lineWidth = Math.max(1, pitch * 0.06);
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r - ctx.lineWidth / 2), 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        ctx.globalAlpha = alpha * 0.6; // shine
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.36, r * 0.34, r * 0.22, -0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = fg;
    ctx.fillStyle = fg;
    if (level === 0) {
      ctx.globalAlpha = alpha * 0.4;
      ctx.lineWidth = Math.max(1.2, pitch * 0.05);
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r - ctx.lineWidth / 2), 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.globalAlpha = alpha * ALPHA[level];
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = alpha * 0.28;
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // the red line
    const lineY = (MAX_ROWS - 1) * pitch;
    ctx.strokeStyle = palette ? "#ff5d73" : "#ff4d4d";
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([pitch * 0.3, pitch * 0.25]);
    ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(W, lineY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // bubbles on the board
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < weeks; c++) {
        const b = grid[r][c];
        if (!b) continue;
        let s = ease((t - b.born) / 0.4);
        const pulse = pulses.find((q) => q.r === r && q.c === c);
        if (pulse) { const k = (t - pulse.at) / 0.25; s = k < 1 ? 1 + 0.18 * Math.sin(k * Math.PI) : 1; }
        bubble(cx(c), cy(r), b.level, s);
      }
    }

    // bubbles waiting to pop, popping, and falling
    for (const p of pops) {
      if (t < p.at) { bubble(p.x, p.y, p.level); continue; }
      const k = (t - p.at) / 0.26;
      if (k >= 1) continue;
      bubble(p.x, p.y, p.level, 1 + 0.45 * ease(k), 1 - k);
      ctx.strokeStyle = palette ? palette[p.level] : fg;
      ctx.globalAlpha = (1 - k) * 0.6;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, R * (1 + 1.4 * ease(k)), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const f of falls) {
      bubble(f.x, f.y, f.level, 1, clamp(1 - (f.y - H * 0.6) / (H * 0.4), 0, 1));
    }
    for (const q of parts) {
      if (t < q.at) continue;
      const k = (t - q.at) / q.life;
      if (k >= 1) continue;
      ctx.fillStyle = palette ? palette[q.level || 1] : fg;
      ctx.globalAlpha = 1 - k;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;

    // aim line and where the bubble would stick
    if (state === "play") {
      const tr = trace(aim);
      ctx.strokeStyle = palette ? palette[ammo || 1] : fg;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = Math.max(1.5, pitch * 0.06);
      ctx.setLineDash([pitch * 0.16, pitch * 0.3]);
      ctx.lineCap = "round";
      ctx.beginPath();
      tr.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = "butt";
      if (tr.cell) {
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx(tr.cell.c), cy(tr.cell.r), R, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // shooter
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(2, pitch * 0.1);
    ctx.beginPath(); ctx.arc(sx, sy, pitch * 1.15, Math.PI * 0.04, Math.PI * 0.96); ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.lineCap = "round";
    ctx.lineWidth = pitch * 0.34;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.sin(aim) * pitch * 1.5, sy - Math.cos(aim) * pitch * 1.5); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.globalAlpha = 1;
    bubble(sx, sy, ammo);
    ctx.font = `${Math.max(10, pitch * 0.38)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.5;
    ctx.textAlign = "center";
    ctx.fillText("next", sx - pitch * 3.4, sy + pitch * 1.25);
    ctx.globalAlpha = 1;
    bubble(sx - pitch * 3.4, sy, next, 0.8);

    // the bubble in flight
    if (flying) bubble(flying.x, flying.y, flying.level);

    // game over / cleared
    if (state !== "play") {
      ctx.fillStyle = bg;
      ctx.globalAlpha = 0.72;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.font = `600 ${Math.max(22, pitch * 1.6)}px "Source Serif 4", serif`;
      ctx.fillText(state === "won" ? "Graph cleared!" : "Too many bubbles!", W / 2, H * 0.42);
      ctx.font = `${Math.max(12, pitch * 0.55)}px Inter, sans-serif`;
      ctx.globalAlpha = 0.75;
      ctx.fillText(`${score} popped in ${shots} shots · click to play again`, W / 2, H * 0.42 + pitch * 1.4);
      ctx.globalAlpha = 1;
    }
  }

  // ── main loop ──
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    if (!visible || !W) { last = ms; return; }
    const t = ms / 1000;
    const dt = Math.min(0.05, (ms - last) / 1000 || 0.016);
    last = ms;
    if (!everVisible) { everVisible = true; lastInput = t - 1.5; }

    const demoActive = demoEnabled && t - lastInput > 3;

    if (state === "play") {
      if (demoActive && !flying) {
        if (!demoPlan && t >= demoAt) demoPlan = planShot();
        if (demoPlan) {
          aim += (demoPlan.angle - aim) * Math.min(1, dt * 9);
          if (Math.abs(demoPlan.angle - aim) < 0.012) {
            aim = demoPlan.angle;
            shoot();
            demoPlan = null;
            demoAt = t + 0.9 + Math.random() * 0.5;
          }
        }
      }
      if (flying) {
        if (advance(flying, SPEED * dt)) { const p = flying; flying = null; land(p); }
      }
    } else if (demoActive && t - overAt > 2.6) {
      rebuild();
    }

    for (const f of falls) if (t >= f.at) { f.vy += pitch * 40 * dt; f.y += f.vy * dt; }
    for (const q of parts) if (t >= q.at) { q.vy += pitch * 14 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    if (falls.length || pops.length || parts.length || pulses.length) {
      falls = falls.filter((f) => f.y < H + pitch);
      pops = pops.filter((p) => t < p.at + 0.3);
      parts = parts.filter((q) => t < q.at + q.life);
      pulses = pulses.filter((q) => t < q.at + 0.3);
    }
    draw(t);
  }

  // ── input ──
  const toLocal = (e) => {
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) * (W / rect.width), (e.clientY - rect.top) * (H / rect.height)];
  };
  function aimAt(x, y) {
    aim = clamp(Math.atan2(x - sx, Math.max(pitch * 1.5, sy - y)), -MAX_ANGLE, MAX_ANGLE);
    lastInput = now();
    demoPlan = null;
  }
  const overNext = (x, y) => Math.hypot(x - (sx - pitch * 3.4), y - sy) < pitch * 1.1;

  function showTip(x, y, e) {
    const r = Math.floor(y / pitch), c = Math.floor(x / pitch);
    const b = r >= 0 && r < MAX_ROWS && c >= 0 && c < weeks ? grid[r][c] : null;
    if (!b || Math.hypot(x - cx(c), y - cy(r)) > R * 1.15 || state !== "play") { tip.hidden = true; return; }
    tip.textContent = b.date ? `${prettyDate(b.date)} · ${b.count === 0 ? "no submissions" : `${b.count} submission${b.count === 1 ? "" : "s"}`}` : "your shot";
    tip.hidden = false;
    const w = tip.offsetWidth;
    tip.style.left = `${clamp(x - w / 2, 0, W - w)}px`;
    tip.style.top = `${Math.max(0, y - pitch * 1.6)}px`;
  }

  const onMove = (e) => {
    const [x, y] = toLocal(e);
    aimAt(x, y);
    if (e.pointerType === "mouse") showTip(x, y, e);
  };
  const onDown = (e) => {
    const [x, y] = toLocal(e);
    if (e.pointerType !== "mouse") canvas.setPointerCapture?.(e.pointerId);
    aimAt(x, y);
  };
  const onUp = (e) => {
    const [x, y] = toLocal(e);
    lastInput = now();
    if (state !== "play") { rebuild(); return; }
    if (overNext(x, y)) { swap(); return; }
    aimAt(x, y);
    shoot();
  };
  const onKey = (e) => {
    lastInput = now();
    demoPlan = null;
    if (e.key === "ArrowLeft") aim = clamp(aim - 0.05, -MAX_ANGLE, MAX_ANGLE);
    else if (e.key === "ArrowRight") aim = clamp(aim + 0.05, -MAX_ANGLE, MAX_ANGLE);
    else if (e.key === " " || e.key === "Enter") state === "play" ? shoot() : rebuild();
    else if (e.key === "x" || e.key === "X" || e.key === "ArrowDown") swap();
    else return;
    e.preventDefault();
  };
  const onContext = (e) => { e.preventDefault(); swap(); lastInput = now(); };
  const onLeave = () => { tip.hidden = true; };

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("keydown", onKey);
  canvas.addEventListener("contextmenu", onContext);
  root.querySelector(".lc-rebuild").addEventListener("click", () => { rebuild(); lastInput = now(); });

  // ── setup ──
  readColors();
  const themeWatch = new MutationObserver(readColors);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const resize = new ResizeObserver(() => { layout(); });
  resize.observe(field);
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { threshold: 0.05 });
  io.observe(field);

  if (layout()) rebuild();
  else grid = buildBoard();
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    raf = -1;
    resize.disconnect();
    io.disconnect();
    themeWatch.disconnect();
  };
}
