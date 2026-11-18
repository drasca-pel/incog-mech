// Line tools: line, dashed line, dotted line, rope, rod, spring, vector (with an arrow) and force.
// All of them are the same kind of item. The pattern (solid, dashed, dotted) can be
// changed afterwards in the properties panel.
import { registerItemType } from "../../core/itemTypes.js";
import { dist, angleBetween, pointAt, distToSegment } from "../../core/geometry.js";

const TYPES = ["line", "rope", "rod", "spring", "vector", "force", "hook"];
const PATTERNS = ["solid", "dashed", "dotted"];
const COLORS = { line: "#cdd6e6", rope: "#d9b779", rod: "#9fb0d0", hook: "#e8c97a", spring: "#7bd88f", vector: "#4cc9f0", force: "#ff8fab" };
const round2 = (n) => Math.round(n * 100) / 100;
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function seg(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

registerItemType("line", {
  title: (item) => cap(item.style),

  draw({ ctx, toScreen }, item, selected) {
    const a = toScreen(item.a);
    const b = toScreen(item.b);
    const color = COLORS[item.style] || "#e6ebf5";
    ctx.save();
    ctx.lineCap = "round";

    if (selected) {
      ctx.strokeStyle = "rgba(245,184,61,.35)";
      ctx.lineWidth = 10;
      seg(ctx, a, b);
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = item.style === "rod" ? 6 : item.style === "hook" ? 4 : 2.5;
    if (item.pattern === "dashed") ctx.setLineDash([10, 7]);
    else if (item.pattern === "dotted") ctx.setLineDash([0.1, 7]);
    if (item.style === "spring") {
      // a coil: zigzag across the line
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const lead = Math.min(14, len * 0.18);
      const coils = Math.max(4, Math.round((len - 2 * lead) / 14));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + ux * lead, a.y + uy * lead);
      for (let k = 1; k <= coils * 2; k++) {
        const t = lead + ((len - 2 * lead) * (k - 0.5)) / (coils * 2);
        const side = k % 2 ? 1 : -1;
        ctx.lineTo(a.x + ux * t - uy * 8 * side, a.y + uy * t + ux * 8 * side);
      }
      ctx.lineTo(b.x - ux * lead, b.y - uy * lead);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else {
      seg(ctx, a, b);
    }
    ctx.setLineDash([]);

    if (item.style === "hook") {
      // a massless arm: a dot at the object's centre and a ring where a rope or spring can be tied
      ctx.beginPath(); ctx.arc(a.x, a.y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.stroke();
    }
    if (item.style === "rope") {
      for (const p of [a, b]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (item.style === "vector" || item.style === "force") {
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.beginPath();
      ctx.moveTo(b.x + 3 * Math.cos(ang), b.y + 3 * Math.sin(ang));
      ctx.lineTo(b.x - 11 * Math.cos(ang - 0.42), b.y - 11 * Math.sin(ang - 0.42));
      ctx.lineTo(b.x - 11 * Math.cos(ang + 0.42), b.y - 11 * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
    }

    // Label beside the middle of the line. A force shows its size, a rope or rod shows its tension while playing.
    const shown = [item.label, item.style === "force" ? `${round2(item.force ?? 10)} N` : "", item.tension != null ? `${item.style === "rod" ? "F" : "T"} = ${round2(item.tension)} N` : "", item.spring ? `${round2(item.spring.force)} N` : ""]
      .filter(Boolean)
      .join("  ");
    if (shown) {
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      ctx.fillStyle = "#e6ebf5";
      ctx.font = '600 13px "Segoe UI", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(shown, (a.x + b.x) / 2 + nx * 18, (a.y + b.y) / 2 + ny * 18);
    }
    ctx.restore();
  },

  hitTest: (item, p, tol) => distToSegment(p, item.a, item.b) <= tol,
  handles: (item) => [
    { id: "a", p: item.a },
    { id: "b", p: item.b },
  ],
  moveHandle: (item, id, p) => ({ ...item, [id]: { x: p.x, y: p.y } }),
  moveBy: (item, dx, dy) => ({
    ...item,
    a: { x: item.a.x + dx, y: item.a.y + dy },
    b: { x: item.b.x + dx, y: item.b.y + dy },
  }),
  snapPoints: (item) => [item.a, item.b, { x: (item.a.x + item.b.x) / 2, y: (item.a.y + item.b.y) / 2 }],

  properties(item) {
    const length = dist(item.a, item.b);
    const angle = angleBetween(item.a, item.b);
    return [
      { id: "label", label: "Label", kind: "text", value: item.label || "", set: (it, v) => ({ ...it, label: v }) },
      {
        id: "length", label: "Length", unit: "m", kind: "number", value: length,
        set: (it, v) => ({ ...it, b: pointAt(it.a, Math.max(0.001, v), angleBetween(it.a, it.b)) }),
      },
      {
        id: "angle", label: "Direction", unit: "°", kind: "number", value: angle,
        set: (it, v) => ({ ...it, b: pointAt(it.a, dist(it.a, it.b), v) }),
      },
      { id: "pattern", label: "Pattern", kind: "choice", options: PATTERNS, value: item.pattern || "solid", set: (it, v) => ({ ...it, pattern: v }) },
      { id: "style", label: "Type", kind: "choice", options: TYPES, value: item.style, set: (it, v) => ({ ...it, style: v }) },
      ...(item.style === "force"
        ? [{ id: "force", label: "Force", unit: "N", kind: "number", value: item.force ?? 10, set: (it, v) => ({ ...it, force: Math.max(0, v) }) }]
        : []),
      ...(item.style === "spring"
        ? [
            { id: "k", label: "Stiffness", unit: "N/m", kind: "number", value: item.k ?? 200, set: (it, v) => ({ ...it, k: Math.max(0.001, v) }) },
            { id: "rest", label: "Natural length", unit: "m", kind: "number", value: item.rest ?? length, set: (it, v) => ({ ...it, rest: Math.max(0.001, v) }) },
            { id: "zeta", label: "Damping ratio", unit: "", kind: "number", value: item.zeta ?? 0.5, set: (it, v) => ({ ...it, zeta: Math.max(0, v) }) },
          ]
        : []),
      ...(item.spring
        ? [
            { id: "slen", label: "Length now", unit: "m", kind: "readout", value: item.spring.length },
            { id: "ext", label: "Extension (now − natural)", unit: "m", kind: "readout", value: item.spring.extension },
            { id: "sforce", label: "Spring force", unit: "N", kind: "readout", value: item.spring.force },
          ]
        : []),
      ...(item.tension != null
        ? [{ id: "tension", label: item.style === "rod" ? "Force in rod" : "Tension", unit: "N", kind: "readout", value: item.tension }]
        : []),
      { id: "startX", label: "Start x", unit: "m", kind: "number", value: item.a.x, set: (it, v) => ({ ...it, a: { ...it.a, x: v } }) },
      { id: "startY", label: "Start y", unit: "m", kind: "number", value: item.a.y, set: (it, v) => ({ ...it, a: { ...it.a, y: v } }) },
      { id: "endX", label: "End x", unit: "m", kind: "number", value: item.b.x, set: (it, v) => ({ ...it, b: { ...it.b, x: v } }) },
      { id: "endY", label: "End y", unit: "m", kind: "number", value: item.b.y, set: (it, v) => ({ ...it, b: { ...it.b, y: v } }) },
    ];
  },
});

// "twoPoint" means: click the start, click the end (or type a length and angle)
const lineTool = (id, name, style, pattern) => ({
  id,
  name,
  icon: id,
  tab: "Draw",
  group: "Lines",
  kind: "tool",
  ready: true,
  prompt: `${name}: click the start, then the end. Type a number for an exact length. Shift locks 15°. Enter finishes.`,
  behavior: {
    kind: "twoPoint",
    create: (a, b) => ({
      type: "line", style, pattern, a, b, label: "",
      ...(style === "force" ? { force: 10 } : {}),
      ...(style === "spring" ? { k: 200, rest: Math.hypot(b.x - a.x, b.y - a.y), zeta: 0.5 } : {}),
    }),
  },
});

export const lineTools = [
  lineTool("line", "Line", "line", "solid"),
  lineTool("dashed", "Dashed", "line", "dashed"),
  lineTool("dotted", "Dotted", "line", "dotted"),
  lineTool("rope", "Rope", "rope", "solid"),
  lineTool("rod", "Rod", "rod", "solid"),
  { ...lineTool("hook", "Hook", "hook", "solid"), prompt: "Hook: click the object, then click where the rope or spring should attach. The hook has no mass and no force of its own: it only moves the attach point away from the object." },
  lineTool("spring", "Spring", "spring", "solid"),
  lineTool("vector", "Vector", "vector", "solid"),
  { ...lineTool("force", "Force", "force", "solid"), group: "Forces" },
];