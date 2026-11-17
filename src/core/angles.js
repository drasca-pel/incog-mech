// Angles at corners are worked out from the drawing, never stored.
// Wherever two or more lines meet at the same point, each neighbouring pair gets an angle.
import { dist, angleBetween } from "./geometry.js";

const JOIN_TOL = 0.02; // metres: line ends closer than this count as joined

const make = (c, f, s, sweep) => ({
  key: `ang:${f.id}:${s.id}`,
  vertex: c.p,
  first: f, // the line the angle starts from; the angle opens counterclockwise to second
  second: s,
  start: f.ang,
  sweep,
});

export function computeAngles(scene) {
  const ends = [];
  for (const it of scene.items) {
    if (it.type !== "line") continue;
    ends.push({ id: it.id, end: "a", p: it.a, far: it.b });
    ends.push({ id: it.id, end: "b", p: it.b, far: it.a });
  }

  const clusters = [];
  for (const e of ends) {
    let c = clusters.find((k) => dist(k.p, e.p) <= JOIN_TOL);
    if (!c) {
      c = { p: { x: e.p.x, y: e.p.y }, members: [] };
      clusters.push(c);
    }
    c.members.push(e);
  }

  const out = [];
  for (const c of clusters) {
    const dirs = c.members
      .map((m) => ({ id: m.id, end: m.end, ang: angleBetween(c.p, m.far), len: dist(c.p, m.far) }))
      .filter((d) => d.len > 1e-6)
      .sort((x, y) => x.ang - y.ang);
    const n = dirs.length;
    if (n < 2) continue;

    if (n === 2) {
      let [f, s] = dirs;
      let sweep = s.ang - f.ang;
      if (sweep > 180) {
        [f, s] = [s, f];
        sweep = 360 - sweep;
      }
      if (sweep > 0.05 && Math.abs(sweep - 180) > 0.05) out.push(make(c, f, s, sweep));
      continue;
    }

    for (let i = 0; i < n; i++) {
      const f = dirs[i];
      const s = dirs[(i + 1) % n];
      const sweep = (s.ang - f.ang + 360) % 360;
      if (sweep > 0.05 && sweep <= 180.0001) out.push(make(c, f, s, sweep));
    }
  }
  return out;
}