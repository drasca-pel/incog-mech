// Joins: a line end that sits on an object stays tied to it.
// A tied end is stored as attachA / attachB = { id, lx, ly }: the object and the point on it
// (measured in the object's own frame), so it follows the object when the object moves or turns.
// Bodies (block, ball, bob, wheel) are tied at their centre unless "Pull from centre" is set to No,
// so the pull goes through the centre of mass and nothing swings to one side.
import { itemType, hookCentre } from "./itemTypes.js";
import { dist, rotatePoint } from "./geometry.js";

const TOL = 0.02; // metres

const isBody = (it, def) => Boolean(def && def.physics && def.physics(it).kind === "dynamic");

export const worldOfLocal = (it, l) => {
  const r = rotatePoint(l, it.rotation || 0);
  return { x: it.x + r.x, y: it.y + r.y };
};
export const localOfWorld = (it, p) => rotatePoint({ x: p.x - it.x, y: p.y - it.y }, -(it.rotation || 0));

// What is at point p? Returns an attach record or null.
export function findAttach(scene, p, skipId) {
  for (let i = scene.items.length - 1; i >= 0; i--) {
    const it = scene.items[i];
    if (it.type === "line" || it.id === skipId) continue;
    const def = itemType(it.type);
    if (!def || !def.snapPoints) continue;
    const hit = def.snapPoints(it).find((sp) => dist(sp, p) <= TOL);
    if (!hit) continue;
    const local = isBody(it, def) && hookCentre(it, def) ? { x: 0, y: 0 } : localOfWorld(it, hit);
    return { id: it.id, lx: local.x, ly: local.y };
  }
  return null;
}

// Move every tied line end to where its object is now
export function applyJoins(scene) {
  const byId = new Map(scene.items.map((i) => [i.id, i]));
  const items = scene.items.map((it) => {
    if (it.type !== "line" || (!it.attachA && !it.attachB)) return it;
    let out = it;
    for (const [key, end] of [["attachA", "a"], ["attachB", "b"]]) {
      const rec = out[key];
      if (!rec) continue;
      const target = byId.get(rec.id);
      if (!target) {
        const { [key]: _gone, ...rest } = out;
        out = rest;
        continue;
      }
      out = { ...out, [end]: worldOfLocal(target, { x: rec.lx, y: rec.ly }) };
    }
    return out;
  });
  return { ...scene, items };
}

// Work out again what each end of a line is tied to
export function rejoin(scene, line) {
  const out = { ...line };
  for (const [key, end] of [["attachA", "a"], ["attachB", "b"]]) {
    const att = findAttach(scene, line[end], line.id);
    if (att) out[key] = att;
    else delete out[key];
  }
  return out;
}

// Call after any change. changedId is the item that was just edited, if any.
export function settle(scene, changedId) {
  const changed = scene.items.find((i) => i.id === changedId);
  let s = scene;
  if (changed && changed.type === "line") {
    s = { ...scene, items: scene.items.map((i) => (i.id === changedId ? rejoin(scene, i) : i)) };
  }
  return applyJoins(s);
}