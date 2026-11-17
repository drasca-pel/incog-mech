// The Results list: every quantity in the drawing that can be read, so you can search for the one
// you need (tension of T1, mass of the block, angle between two ropes...) and pin it on the drawing.
import { itemType } from "./itemTypes.js";
import { computeAngles } from "./angles.js";

const HIDE = new Set(["x", "y", "startX", "startY", "endX", "endY"]); // coordinates stay in the properties panel
const nameOf = (it) => (it.label ? it.label : `${itemType(it.type).title(it)} ${it.id}`);

export function collectResults(scene) {
  const rows = [];
  for (const it of scene.items) {
    const def = itemType(it.type);
    const name = nameOf(it);
    for (const p of def.properties(it)) {
      if ((p.kind !== "number" && p.kind !== "readout") || HIDE.has(p.id)) continue;
      rows.push({ key: `${it.id}|${p.id}`, name, label: p.label, unit: p.unit || "", value: p.value, live: p.kind === "readout" });
    }
  }
  const lineName = (id) => {
    const it = scene.items.find((i) => i.id === id);
    return it ? nameOf(it) : `#${id}`;
  };
  for (const a of computeAngles(scene)) {
    rows.push({
      key: `${a.key}|angle`,
      name: `Angle between ${lineName(a.first.id)} and ${lineName(a.second.id)}`,
      label: "Angle",
      unit: "°",
      value: a.sweep,
      live: false,
    });
  }
  return rows;
}

// Where to pin the value on the drawing
function labelPoint(it) {
  if (it.a && it.b) return { x: (it.a.x + it.b.x) / 2, y: (it.a.y + it.b.y) / 2 };
  return { x: it.x, y: it.y };
}

// Look up a pinned value again (so it stays live)
export function resolvePinned(scene, rows, key) {
  const row = rows.find((r) => r.key === key);
  if (!row) return null;
  const idPart = key.split("|")[0];
  if (idPart.startsWith("ang:")) {
    const a = computeAngles(scene).find((x) => x.key === idPart);
    return a ? { row, point: a.vertex } : null;
  }
  const it = scene.items.find((i) => String(i.id) === idPart);
  return it ? { row, point: labelPoint(it) } : null;
}