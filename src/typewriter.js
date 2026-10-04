// Types out lines one character at a time, each behind a ">" prompt, with a blinking "_" cursor.
// Text is laid out in full from the start (the untyped part is just invisible), so nothing jumps around.

// "My name is *Kyle*" -> [{ text: "My name is ", em: false }, { text: "Kyle", em: true }]
export function parseInline(str) {
  const parts = [];
  const re = /\*([^*]+)\*/g;
  let last = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > last) parts.push({ text: str.slice(last, m.index), em: false });
    parts.push({ text: m[1], em: true });
    last = re.lastIndex;
  }
  if (last < str.length) parts.push({ text: str.slice(last), em: false });
  return parts;
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function typewriter(container, lines, { speedMs, instant }) {
  let timer = null;
  let stopped = false;
  // plain text for screen readers, animated copy hidden from them
  container.append(el("p", "sr-only", lines.map((l) => parseInline(l).map((p) => p.text).join("")).join(" ")));
  const stage = el("div");
  stage.setAttribute("aria-hidden", "true");
  container.append(stage);

  const cursor = el("span", "cursor", "_");

  const rows = lines.map((line) => {
    const row = el("p", "line");
    const prompt = el("span", "prompt", ">");
    prompt.style.visibility = "hidden";
    const body = el("span", "line-text");
    const segs = parseInline(line).map((part) => {
      const node = el(part.em ? "em" : "span");
      const typed = el("span");
      const rest = el("span", "untyped", part.text);
      node.append(typed, rest);
      body.append(node);
      return { text: part.text, typed, rest };
    });
    row.append(prompt, body);
    stage.append(row);
    return { prompt, body, segs };
  });

  const showAll = () => {
    for (const row of rows) {
      row.prompt.style.visibility = "visible";
      for (const s of row.segs) { s.typed.textContent = s.text; s.rest.textContent = ""; }
    }
    rows[rows.length - 1].body.append(cursor);
  };
  if (instant) { showAll(); return { stop() {} }; }

  let li = 0, si = 0, ci = 0;
  const begin = (i) => {
    rows[i].prompt.style.visibility = "visible";
    rows[i].body.prepend(cursor);
  };
  begin(0);

  const step = () => {
    if (stopped) return;
    const row = rows[li];
    const seg = row.segs[si];
    ci++;
    seg.typed.textContent = seg.text.slice(0, ci);
    seg.rest.textContent = seg.text.slice(ci);
    // keep the cursor right after the character just typed
    seg.typed.after(cursor);

    let delay = speedMs;
    if (ci >= seg.text.length) {
      ci = 0;
      si++;
      if (si >= row.segs.length) {
        si = 0;
        li++;
        if (li >= rows.length) return; // finished; cursor keeps blinking
        begin(li);
        delay = speedMs * 12; // short pause between lines
      }
    }
    timer = setTimeout(step, delay);
  };
  timer = setTimeout(step, 500);
  return { stop() { stopped = true; clearTimeout(timer); } };
}
