// Drawing helpers for the diagrams. Pure functions that draw on a canvas 2D context.
import { niceStep } from "../engine/math.js";

export const C = {
  bg: "#0c111d", grid: "#18223a", axis: "#34426a", text: "#e6ebf5", muted: "#8793ae", faint: "#5d6a88",
  accent: "#f5b83d", force: "#5aa9ff", result: "#ff7a59", good: "#5fd38d", warn: "#ff6b6b", purple: "#c792ea",
  fill: "rgba(90,169,255,.22)", fillHole: "rgba(12,17,29,.95)",
};
export const MONO = '"Cascadia Mono", Consolas, monospace';
export const SANS = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';

export function clear(ctx, w, h) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
}

// Fit a region of the world (bounds = { x0, x1, y0, y1 }) into the canvas, keeping shapes undistorted.
// cam = { zoom, dx, dy } is the user's zoom and drag on top of that. Returns functions to convert world -> screen.
export function fitWorld(bounds, w, h, cam = { zoom: 1, dx: 0, dy: 0 }, pad = 56) {
  const bw = Math.max(bounds.x1 - bounds.x0, 1e-6);
  const bh = Math.max(bounds.y1 - bounds.y0, 1e-6);
  const s0 = Math.max(1e-9, Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh));
  const s = s0 * cam.zoom;
  const cx = (bounds.x0 + bounds.x1) / 2;
  const cy = (bounds.y0 + bounds.y1) / 2;
  return {
    s, cx, cy, w, h,
    x: (wx) => w / 2 + cam.dx + (wx - cx) * s,
    y: (wy) => h / 2 + cam.dy - (wy - cy) * s,
    wx: (sx) => cx + (sx - w / 2 - cam.dx) / s,
    wy: (sy) => cy - (sy - h / 2 - cam.dy) / s,
  };
}

// Make sure a region is never tiny, and add some room around it
export function boundsOf(points, minSpan = 4, margin = 0.12) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  if (!Number.isFinite(x0)) { x0 = -2; x1 = 2; y0 = -2; y1 = 2; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const sw = Math.max(x1 - x0, minSpan), sh = Math.max(y1 - y0, minSpan);
  return { x0: cx - (sw * (1 + margin)) / 2, x1: cx + (sw * (1 + margin)) / 2, y0: cy - (sh * (1 + margin)) / 2, y1: cy + (sh * (1 + margin)) / 2 };
}

const trim = (n) => String(Math.round(n * 1e6) / 1e6);

// Graph-paper grid with numbers along the edges
export function grid(ctx, tf, unit = "") {
  const { w, h } = tf;
  const step = niceStep(110 / tf.s, 1); // about 110 px per big square
  const x0 = Math.floor(tf.wx(0) / step) * step, x1 = Math.ceil(tf.wx(w) / step) * step;
  const y0 = Math.floor(tf.wy(h) / step) * step, y1 = Math.ceil(tf.wy(0) / step) * step;
  ctx.lineWidth = 1;
  ctx.font = `11px ${MONO}`;
  for (let x = x0, n = 0; x <= x1 + 1e-9 && n < 400; x += step, n++) {
    const sx = Math.round(tf.x(x)) + 0.5;
    ctx.strokeStyle = Math.abs(x) < 1e-9 ? C.axis : C.grid;
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
    ctx.fillStyle = C.faint; ctx.textAlign = "center"; ctx.fillText(trim(x), sx, h - 6);
  }
  for (let y = y0, n = 0; y <= y1 + 1e-9 && n < 400; y += step, n++) {
    const sy = Math.round(tf.y(y)) + 0.5;
    ctx.strokeStyle = Math.abs(y) < 1e-9 ? C.axis : C.grid;
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
    ctx.fillStyle = C.faint; ctx.textAlign = "left"; ctx.fillText(trim(y), 6, sy - 4);
  }
  if (unit) { ctx.fillStyle = C.faint; ctx.textAlign = "right"; ctx.fillText(unit, w - 8, 16); }
}

export function arrow(ctx, x1, y1, x2, y2, { color = C.force, width = 2.2, head = 9, dash = null } = {}) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (!(L > 0.5)) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
  if (dash) ctx.setLineDash(dash);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hs = Math.min(head, L * 0.6);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * hs * 0.6, y2 - Math.sin(a) * hs * 0.6); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - hs * Math.cos(a - 0.38), y2 - hs * Math.sin(a - 0.38));
  ctx.lineTo(x2 - hs * Math.cos(a + 0.38), y2 - hs * Math.sin(a + 0.38));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function label(ctx, text, x, y, { color = C.text, align = "left", size = 12, bold = false, bg = true } = {}) {
  ctx.save();
  ctx.font = `${bold ? "600 " : ""}${size}px ${MONO}`;
  ctx.textAlign = align; ctx.textBaseline = "middle";
  if (bg) {
    const tw = ctx.measureText(text).width;
    const bx = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x;
    ctx.fillStyle = "rgba(12,17,29,.82)";
    ctx.fillRect(bx - 3, y - size / 2 - 2, tw + 6, size + 4);
  }
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.restore();
}

export function dot(ctx, x, y, r = 4, color = C.text) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

export function line(ctx, x1, y1, x2, y2, color = C.muted, width = 1.5, dash = null) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

// A curved arrow showing a moment or couple. ccw = anticlockwise on screen
export function arcArrow(ctx, cx, cy, r, ccw, color = C.accent) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.2;
  const a0 = ccw ? -Math.PI * 0.15 : Math.PI * 1.15;
  const a1 = ccw ? -Math.PI * 1.45 : Math.PI * -0.15 + Math.PI * 2 - Math.PI * 1.3;
  ctx.beginPath();
  if (ccw) ctx.arc(cx, cy, r, a0, a0 - Math.PI * 1.3, true);
  else ctx.arc(cx, cy, r, a0, a0 + Math.PI * 1.3, false);
  ctx.stroke();
  const end = ccw ? a0 - Math.PI * 1.3 : a0 + Math.PI * 1.3;
  const ex = cx + r * Math.cos(end), ey = cy + r * Math.sin(end);
  const tangent = ccw ? end - Math.PI / 2 : end + Math.PI / 2;
  const hs = 9;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - hs * Math.cos(tangent - 0.4), ey - hs * Math.sin(tangent - 0.4));
  ctx.lineTo(ex - hs * Math.cos(tangent + 0.4), ey - hs * Math.sin(tangent + 0.4));
  ctx.closePath(); ctx.fill();
  ctx.restore();
  void a1;
}

// Support symbols. (x, y) is the point where the beam rests.
export function pinSupport(ctx, x, y, s = 14) {
  ctx.save();
  ctx.fillStyle = "rgba(139,152,184,.25)"; ctx.strokeStyle = C.muted; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s, y + s * 1.5); ctx.lineTo(x + s, y + s * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  line(ctx, x - s * 1.4, y + s * 1.5, x + s * 1.4, y + s * 1.5, C.muted, 2);
  for (let i = -1; i <= 1; i++) line(ctx, x + i * s * 0.9, y + s * 1.5, x + i * s * 0.9 - 5, y + s * 1.5 + 7, C.faint, 1);
  ctx.restore();
}
export function rollerSupport(ctx, x, y, s = 14) {
  ctx.save();
  ctx.fillStyle = "rgba(139,152,184,.25)"; ctx.strokeStyle = C.muted; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s, y + s * 1.2); ctx.lineTo(x + s, y + s * 1.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - s * 0.5, y + s * 1.2 + 4, 3.5, 0, Math.PI * 2); ctx.arc(x + s * 0.5, y + s * 1.2 + 4, 3.5, 0, Math.PI * 2); ctx.stroke();
  line(ctx, x - s * 1.4, y + s * 1.2 + 8, x + s * 1.4, y + s * 1.2 + 8, C.muted, 2);
  ctx.restore();
}
// A fixed end: a wall with hatching. side "left" puts the wall to the left of x.
export function fixedWall(ctx, x, y, side = "left", s = 28) {
  const d = side === "left" ? -1 : 1;
  line(ctx, x, y - s, x, y + s, C.muted, 3);
  for (let i = -s; i <= s; i += 8) line(ctx, x, y + i, x + d * 9, y + i + 8, C.faint, 1);
}

// A small block with an optional label
export function block(ctx, cx, cy, w, h, color = C.accent, text = "") {
  ctx.save();
  ctx.fillStyle = "rgba(245,184,61,.2)"; ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h); ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
  if (text) label(ctx, text, cx, cy, { align: "center", bg: false, color: C.text });
}

// Line graph(s) of values against a horizontal quantity.
// rect = { x, y, w, h } on the canvas;  series = [{ name, color, pts: [{ x, y }] }]
// opts: { xLabel, yLabel, cursor (x value to mark), title }
export function plot(ctx, rect, series, opts = {}) {
  const { x, y, w, h } = rect;
  const pts = series.flatMap((s) => s.pts).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  let xmin = Math.min(...pts.map((p) => p.x), 0), xmax = Math.max(...pts.map((p) => p.x), 1e-9);
  let ymin = Math.min(...pts.map((p) => p.y), 0), ymax = Math.max(...pts.map((p) => p.y), 1e-9);
  if (!pts.length) { xmin = 0; xmax = 1; ymin = 0; ymax = 1; }
  if (ymax - ymin < 1e-9) { ymax += 1; ymin -= 1; }
  const padY = (ymax - ymin) * 0.08;
  ymax += padY; if (ymin < 0) ymin -= padY;
  const L = x + 44, R = x + w - 10, T = y + 24, B = y + h - 26;
  const sx = (v) => L + ((v - xmin) / (xmax - xmin || 1)) * (R - L);
  const sy = (v) => B - ((v - ymin) / (ymax - ymin || 1)) * (B - T);
  ctx.save();
  ctx.fillStyle = "rgba(18,26,44,.7)"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.font = `10.5px ${MONO}`;
  const yStep = niceStep(ymax - ymin, 4), xStep = niceStep(xmax - xmin, 5);
  for (let v = Math.ceil(ymin / yStep) * yStep, n = 0; v <= ymax && n < 40; v += yStep, n++) {
    ctx.strokeStyle = Math.abs(v) < 1e-9 ? C.axis : C.grid;
    ctx.beginPath(); ctx.moveTo(L, sy(v)); ctx.lineTo(R, sy(v)); ctx.stroke();
    ctx.fillStyle = C.faint; ctx.textAlign = "right"; ctx.fillText(trim(Math.round(v * 1e4) / 1e4), L - 4, sy(v) + 3);
  }
  for (let v = Math.ceil(xmin / xStep) * xStep, n = 0; v <= xmax + 1e-9 && n < 40; v += xStep, n++) {
    ctx.strokeStyle = C.grid;
    ctx.beginPath(); ctx.moveTo(sx(v), T); ctx.lineTo(sx(v), B); ctx.stroke();
    ctx.fillStyle = C.faint; ctx.textAlign = "center"; ctx.fillText(trim(Math.round(v * 1e4) / 1e4), sx(v), B + 12);
  }
  for (const s of series) {
    const ok = s.pts.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (ok.length < 2) continue;
    ctx.strokeStyle = s.color || C.force; ctx.lineWidth = 2; ctx.beginPath();
    ok.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.stroke();
  }
  if (opts.cursor !== undefined && opts.cursor >= xmin && opts.cursor <= xmax) {
    ctx.strokeStyle = C.accent; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(sx(opts.cursor), T); ctx.lineTo(sx(opts.cursor), B); ctx.stroke(); ctx.setLineDash([]);
    for (const s of series) {
      // mark the value of each curve at the cursor
      let best = null;
      for (const p of s.pts) if (best === null || Math.abs(p.x - opts.cursor) < Math.abs(best.x - opts.cursor)) best = p;
      if (best) dot(ctx, sx(best.x), sy(best.y), 3.5, s.color || C.force);
    }
  }
  ctx.fillStyle = C.text; ctx.font = `600 11.5px ${MONO}`; ctx.textAlign = "left";
  if (opts.title) ctx.fillText(opts.title, L, y + 14);
  let lx = R;
  ctx.textAlign = "right";
  for (const s of [...series].reverse()) {
    if (!s.name) continue;
    ctx.fillStyle = s.color || C.force; ctx.fillText(s.name, lx, y + 14);
    lx -= ctx.measureText(s.name).width + 14;
  }
  ctx.fillStyle = C.faint; ctx.textAlign = "center"; ctx.font = `10.5px ${MONO}`;
  if (opts.xLabel) ctx.fillText(opts.xLabel, (L + R) / 2, y + h - 4);
  ctx.restore();
}