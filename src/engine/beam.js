// Beams: support reactions, shear force and bending moment.
//
// Loads (downward forces are positive):
//   { type: "point",  x, P }               point load P (N or kN) at x
//   { type: "udl",    x1, x2, w }          uniform load w per metre between x1 and x2
//   { type: "uvl",    x1, x2, w1, w2 }     load that changes steadily from w1 at x1 to w2 at x2 (triangle if one end is 0)
//   { type: "moment", x, M }               applied couple, anticlockwise positive
// Supports:
//   { type: "simple", a, b }               pin at x = a, roller at x = b (beam may overhang)
//   { type: "cantilever", side: "left" | "right" }   fixed end
// Bending moment is positive when the beam sags (bends like a smile).
import { fix } from "./math.js";

// A distributed load replaced by one force at its centre: { W, x }
function lump(l) {
  const len = l.x2 - l.x1;
  if (l.type === "udl") return { W: l.w * len, x: (l.x1 + l.x2) / 2 };
  const W = ((l.w1 + l.w2) / 2) * len;
  const s = l.w1 + l.w2;
  const xbar = Math.abs(s) < 1e-12 ? len / 2 : (len * (l.w1 + 2 * l.w2)) / (3 * s);
  return { W, x: l.x1 + xbar };
}

// Load intensity at position x for a distributed load
const intensity = (l, x) => (l.type === "udl" ? l.w : l.w1 + ((l.w2 - l.w1) * (x - l.x1)) / (l.x2 - l.x1));

// The part of a distributed load that lies to the left of position x: { W, x } (force and where it acts)
function leftPart(l, x) {
  if (x <= l.x1) return { W: 0, x: l.x1 };
  const x2 = Math.min(x, l.x2);
  const part = l.type === "udl" ? { ...l, x2 } : { ...l, x2, w2: intensity(l, x2) };
  return lump(part);
}

export function analyseBeam({ L, support, loads }) {
  const steps = [];
  const point = loads.filter((l) => l.type === "point");
  const dist = loads.filter((l) => l.type === "udl" || l.type === "uvl");
  const couples = loads.filter((l) => l.type === "moment");

  // every load as a single force somewhere: { W, x }
  const forces = [...point.map((l) => ({ W: l.P, x: l.x })), ...dist.map(lump)];
  const totalW = forces.reduce((s, f) => s + f.W, 0);
  const sumWx = forces.reduce((s, f) => s + f.W * f.x, 0);
  const sumM = couples.reduce((s, c) => s + c.M, 0); // anticlockwise

  steps.push("Step 1: Replace each spread-out load by one force at its centre (UDL: w × length at the middle; triangle: area at one third of its base from the big end).");
  forces.forEach((f, i) => steps.push(`  Load ${i + 1}: ${fix(f.W)} acting at x = ${fix(f.x)} m`));
  steps.push(`  Total downward load = ${fix(totalW)}`);

  const reactions = []; // { x, Fy (up), M (anticlockwise) }
  let result;
  if (support.type === "simple") {
    const { a, b } = support;
    if (Math.abs(b - a) < 1e-9) return { ok: false, error: "The two supports are at the same place.", steps };
    // moments about A (anticlockwise positive): B (b - a) - Σ W (x - a) + Σ M = 0
    const B = (sumWx - a * totalW - sumM) / (b - a);
    const A = totalW - B;
    steps.push(`Step 2: Moments about the pin A (x = ${fix(a)}): B × ${fix(b - a)} = ${fix(sumWx - a * totalW)}${sumM ? ` - (${fix(sumM)})` : ""}`);
    steps.push(`  Roller reaction B = ${fix(B)}`);
    steps.push(`Step 3: Vertical forces: A + B = total load, so A = ${fix(totalW)} - ${fix(B)} = ${fix(A)}`);
    reactions.push({ x: a, Fy: A, M: 0, name: "A" }, { x: b, Fy: B, M: 0, name: "B" });
    result = { A, B };
  } else {
    const left = support.side !== "right";
    const xs = left ? 0 : L;
    // moments about the fixed end: M_fixed - Σ W (x - xs) + Σ M = 0
    const Mfix = sumWx - xs * totalW - sumM;
    steps.push(`Step 2: Vertical force at the fixed end = total load = ${fix(totalW)}.`);
    steps.push(`Step 3: Moments about the fixed end give the fixed-end moment M = ${fix(Mfix)} (${Mfix >= 0 ? "anticlockwise" : "clockwise"} on the beam).`);
    reactions.push({ x: xs, Fy: totalW, M: Mfix, name: "Fixed end" });
    result = { V: totalW, M: Mfix };
  }

  // Shear V(x) and bending moment M(x), looking at the left part of the beam.
  // 'after' includes loads exactly at x, 'before' does not.
  const at = (x, after) => {
    const inc = (px) => (after ? px <= x + 1e-12 : px < x - 1e-12);
    let V = 0;
    let M = 0;
    for (const r of reactions) if (inc(r.x)) { V += r.Fy; M += r.Fy * (x - r.x) - r.M; }
    for (const l of point) if (inc(l.x)) { V -= l.P; M -= l.P * (x - l.x); }
    for (const l of dist) {
      const p = leftPart(l, x);
      V -= p.W;
      M -= p.W * (x - p.x);
    }
    for (const c of couples) if (inc(c.x)) M -= c.M;
    return { V, M };
  };

  // sample points, with each point load / support / couple visited just before and just after
  const marks = [...new Set([0, L, ...reactions.map((r) => r.x), ...point.map((p) => p.x), ...couples.map((c) => c.x), ...dist.flatMap((d) => [d.x1, d.x2])])]
    .filter((x) => x >= 0 && x <= L)
    .sort((p, q) => p - q);
  const N = 400;
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const x = (L * i) / N;
    if (marks.some((m) => Math.abs(m - x) < 1e-12)) continue;
    samples.push({ x, ...at(x, true) });
  }
  for (const m of marks) {
    samples.push({ x: m, ...at(m, false), jump: "before" });
    samples.push({ x: m, ...at(m, true), jump: "after" });
  }
  samples.sort((p, q) => p.x - q.x || (p.jump === "before" ? -1 : 1) - (q.jump === "before" ? -1 : 1));

  // The largest bending moment occurs where the shear is zero, so refine around those points.
  let Vmax = { v: 0, x: 0 };
  let Mmax = { v: 0, x: 0 };
  const consider = (p) => {
    if (Math.abs(p.V) > Math.abs(Vmax.v) + 1e-12) Vmax = { v: p.V, x: p.x };
    if (Math.abs(p.M) > Math.abs(Mmax.v) + 1e-12) Mmax = { v: p.M, x: p.x };
  };
  samples.forEach(consider);
  for (let i = 0; i + 1 < samples.length; i++) {
    const p = samples[i], q = samples[i + 1];
    if (p.V * q.V < 0 && q.x - p.x > 1e-9) {
      let lo = p.x, hi = q.x;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (at(mid, true).V * p.V > 0) lo = mid; else hi = mid;
      }
      const x = (lo + hi) / 2;
      consider({ x, ...at(x, true) });
    }
  }
  steps.push(`Step 4: Shear and bending moment along the beam (sagging positive). Largest shear = ${fix(Vmax.v)} at x = ${fix(Vmax.x)} m. Largest bending moment = ${fix(Mmax.v)} at x = ${fix(Mmax.x)} m.`);

  return { ok: true, reactions, result, samples, Vmax, Mmax, totalW, steps, at };
}