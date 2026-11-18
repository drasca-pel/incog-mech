// Pin-jointed trusses, solved by joint equilibrium.
// nodes:    [{ x, y }]
// members:  [{ a, b }]               node numbers (0, 1, 2...) at each end
// supports: [{ node, kind }]         kind: "pin" (holds x and y), "rollerY" (holds y only), "rollerX" (holds x only)
// loads:    [{ node, fx, fy }]       external forces on joints
// Member force: positive = tension (pulling the joints together), negative = compression.
import { solveLinear, fix } from "./math.js";

export function solveTruss({ nodes, members, supports, loads }) {
  const j = nodes.length;
  const m = members.length;
  const steps = [];
  const unk = []; // reaction unknowns: { node, dir: "x" | "y" }
  for (const s of supports) {
    if (s.kind === "pin") unk.push({ node: s.node, dir: "x" }, { node: s.node, dir: "y" });
    else if (s.kind === "rollerX") unk.push({ node: s.node, dir: "x" });
    else unk.push({ node: s.node, dir: "y" });
  }
  const r = unk.length;
  steps.push(`Step 1: Count. Joints j = ${j}, members m = ${m}, support reactions r = ${r}. A truss that is solved by statics needs m + r = 2j (here ${m + r} and ${2 * j}).`);

  for (const mem of members) {
    if (mem.a === mem.b || !nodes[mem.a] || !nodes[mem.b]) return { ok: false, error: "A member joins a missing joint, or joins a joint to itself.", steps };
  }
  if (m + r < 2 * j) return { ok: false, state: "unstable", error: "Not enough members or supports: the truss is a mechanism and would collapse.", steps };
  if (m + r > 2 * j) return { ok: false, state: "indeterminate", error: "Too many members or supports: the truss is statically indeterminate, so statics alone cannot solve it.", steps };

  // Joint equations: for each joint, sum of x forces = 0 and sum of y forces = 0
  const A = Array.from({ length: 2 * j }, () => new Array(m + r).fill(0));
  const b = new Array(2 * j).fill(0);
  const geom = members.map((mem) => {
    const p = nodes[mem.a], q = nodes[mem.b];
    const L = Math.hypot(q.x - p.x, q.y - p.y);
    return { L, ux: (q.x - p.x) / L, uy: (q.y - p.y) / L };
  });
  if (geom.some((g) => !(g.L > 1e-9))) return { ok: false, error: "A member has zero length.", steps };
  members.forEach((mem, k) => {
    // a tension in the member pulls joint a toward b, and joint b toward a
    A[2 * mem.a][k] += geom[k].ux;
    A[2 * mem.a + 1][k] += geom[k].uy;
    A[2 * mem.b][k] -= geom[k].ux;
    A[2 * mem.b + 1][k] -= geom[k].uy;
  });
  unk.forEach((u, i) => {
    A[2 * u.node + (u.dir === "x" ? 0 : 1)][m + i] += 1;
  });
  for (const l of loads) {
    b[2 * l.node] -= l.fx || 0;
    b[2 * l.node + 1] -= l.fy || 0;
  }
  const x = solveLinear(A, b);
  if (!x) return { ok: false, state: "unstable", error: "The supports and members are arranged so the truss can move (unstable geometry). Check the supports.", steps };

  const forces = members.map((mem, k) => {
    const f = Math.abs(x[k]) < 1e-9 ? 0 : x[k];
    return { ...mem, force: f, L: geom[k].L, kind: f > 1e-9 ? "tension" : f < -1e-9 ? "compression" : "zero" };
  });
  const reactions = unk.map((u, i) => ({ ...u, value: Math.abs(x[m + i]) < 1e-9 ? 0 : x[m + i] }));

  // check the whole truss is in balance
  const sx = loads.reduce((s, l) => s + (l.fx || 0), 0) + reactions.filter((q) => q.dir === "x").reduce((s, q) => s + q.value, 0);
  const sy = loads.reduce((s, l) => s + (l.fy || 0), 0) + reactions.filter((q) => q.dir === "y").reduce((s, q) => s + q.value, 0);
  let sm = 0;
  for (const l of loads) sm += nodes[l.node].x * (l.fy || 0) - nodes[l.node].y * (l.fx || 0);
  for (const q of reactions) sm += q.dir === "y" ? nodes[q.node].x * q.value : -nodes[q.node].y * q.value;

  steps.push("Step 2: Write ΣFx = 0 and ΣFy = 0 at every joint (a member in tension pulls on the joint along the member). Solving them all together gives every member force and every reaction.");
  reactions.forEach((q) => steps.push(`  Reaction at joint ${q.node + 1} (${q.dir === "x" ? "horizontal" : "vertical"}): ${fix(q.value)}`));
  steps.push("Step 3: Member forces (+ tension, - compression).");
  forces.forEach((f, k) => steps.push(`  Member ${k + 1} (joint ${f.a + 1} to ${f.b + 1}, length ${fix(f.L)} m): ${fix(f.force)}  ${f.kind}`));
  steps.push(`Step 4: Check the whole truss: ΣFx = ${fix(sx)}, ΣFy = ${fix(sy)}, ΣM = ${fix(sm)}. All should be zero.`);

  return { ok: true, members: forces, reactions, check: { sx, sy, sm }, steps };
}

export const TRUSS_PRESETS = {
  triangle: {
    nodes: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }],
    members: [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 0, b: 2 }],
    supports: [{ node: 0, kind: "pin" }, { node: 1, kind: "rollerY" }],
    loads: [{ node: 2, fx: 0, fy: -10 }],
  },
  warren: {
    nodes: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 6, y: 0 }, { x: 1.5, y: 2.5 }, { x: 4.5, y: 2.5 }],
    members: [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 0, b: 3 }, { a: 3, b: 1 }, { a: 1, b: 4 }, { a: 4, b: 2 }, { a: 3, b: 4 }],
    supports: [{ node: 0, kind: "pin" }, { node: 2, kind: "rollerY" }],
    loads: [{ node: 3, fx: 0, fy: -20 }, { node: 4, fx: 0, fy: -20 }],
  },
};