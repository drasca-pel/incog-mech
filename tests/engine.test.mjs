// Textbook checks for every calculator. Run with:  node tests/engine.test.mjs
import { resultant, momentAbout, solveConcurrent, hangingWeight, momentOf } from "../src/engine/forces.js";
import { analyseBeam } from "../src/engine/beam.js";
import { solveTruss, TRUSS_PRESETS } from "../src/engine/truss.js";
import { inclineBlock } from "../src/engine/friction.js";
import { analyseSection, shapeProps, inside, SECTION_PRESETS } from "../src/engine/sections.js";
import { projectile, maxRange, anglesForRange, projectileDrag, suvat, energySlope, collide, motionGraph } from "../src/engine/motion.js";
import { solveLinear } from "../src/engine/math.js";
import { ratios, velocityRatio, effortFor, lawOfMachine, machinePower, powerFromForce, outputPower } from "../src/engine/machines.js";

let pass = 0, fail = 0;
const close = (name, got, want, tol = 1e-6) => {
  const ok = Math.abs(got - want) <= tol * Math.max(1, Math.abs(want));
  if (ok) pass++; else { fail++; console.log(`  FAIL ${name}: got ${got}, expected ${want}`); }
};
const yes = (name, cond) => { if (cond) pass++; else { fail++; console.log(`  FAIL ${name}`); } };
const section = (t) => console.log(t);
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

section("Linear solver");
{ const x = solveLinear([[2, 1], [1, 3]], [5, 10]); close("x", x[0], 1); close("y", x[1], 3); yes("singular", solveLinear([[1, 2], [2, 4]], [1, 2]) === null); }

section("Resultant, resolution, moments, couples");
{
  let r = resultant([{ name: "F1", F: 100, angle: 0, x: 0, y: 0 }, { name: "F2", F: 100, angle: 90, x: 0, y: 0 }]);
  close("R", r.R, 141.42135624, 1e-8); close("theta", r.theta, 45, 1e-8);

  // three forces worked out by hand
  const F = [{ name: "A", F: 50, angle: 0, x: 0, y: 0 }, { name: "B", F: 80, angle: 90, x: 0, y: 0 }, { name: "C", F: 60, angle: 225, x: 0, y: 0 }];
  r = resultant(F);
  const rx = 50 + 60 * Math.cos(225 * Math.PI / 180), ry = 80 + 60 * Math.sin(225 * Math.PI / 180);
  close("Rx", r.Rx, rx); close("Ry", r.Ry, ry); close("R3", r.R, Math.hypot(rx, ry));
  close("theta3", r.theta, ((Math.atan2(ry, rx) * 180 / Math.PI) + 360) % 360);

  // 100 N downward at x = 5: moment about origin is -500 (clockwise), resultant crosses y = 0 at x = 5
  r = resultant([{ name: "W", F: 100, angle: 270, x: 5, y: 0 }]);
  close("moment", r.MO, -500); close("xInt", r.line.xInt, 5); close("d", r.line.d, 5);

  // a couple: two equal and opposite forces 2 m apart
  r = resultant([{ name: "a", F: 10, angle: 90, x: 1, y: 0 }, { name: "b", F: 10, angle: 270, x: -1, y: 0 }]);
  yes("couple kind", r.kind === "couple"); close("couple M", r.MO, 20); close("R=0", r.R, 0);

  // three equal forces 120 degrees apart
  r = resultant([0, 120, 240].map((a, i) => ({ name: "f" + i, F: 30, angle: a, x: 0, y: 0 })));
  yes("equilibrium", r.kind === "equilibrium");

  // an applied couple on top of a force
  r = resultant([{ name: "P", F: 10, angle: 90, x: 3, y: 0 }], [{ name: "C", M: -15 }]);
  close("force+couple", r.MO, 15);

  // Varignon's theorem on random systems: the moment of the resultant about ANY point equals the sum of moments
  for (let k = 0; k < 200; k++) {
    const forces = Array.from({ length: 1 + Math.floor(rnd() * 5) }, (_, i) => ({ name: "f" + i, F: rnd() * 100, angle: rnd() * 360, x: rnd() * 20 - 10, y: rnd() * 20 - 10 }));
    const couples = rnd() < 0.5 ? [{ name: "c", M: rnd() * 50 - 25 }] : [];
    const O = { x: rnd() * 6 - 3, y: rnd() * 6 - 3 };
    const res = resultant(forces, couples, O);
    if (res.kind !== "force") continue;
    // a point on the line of action of the resultant
    const pt = res.line.xInt !== null ? { x: res.line.xInt, y: 0 } : { x: 0, y: res.line.yInt };
    const P = { x: rnd() * 30 - 15, y: rnd() * 30 - 15 };
    const resF = { F: res.R, angle: res.theta, x: pt.x, y: pt.y };
    const mR = momentOf(resF, O) ;
    close("Varignon at O " + k, mR, res.MO, 1e-7);
    close("Varignon at P " + k, momentOf(resF, P), momentAbout(forces, couples, P), 1e-7);
  }
}

section("Equilibrium of a particle (cables)");
{
  let s = hangingWeight(100, 45, 45);
  close("T1 45/45", s.T1, 70.7106781, 1e-7); close("T2 45/45", s.T2, 70.7106781, 1e-7);
  s = hangingWeight(100, 30, 60);
  close("T1 30/60", s.T1, 50, 1e-7); close("T2 30/60", s.T2, 86.6025404, 1e-7);
  // lamp 20 kg hung from two cables at 25 and 40 degrees: check both equilibrium equations directly
  s = hangingWeight(20 * 9.81, 25, 40);
  const fx = -s.T1 * Math.cos(25 * Math.PI / 180) + s.T2 * Math.cos(40 * Math.PI / 180);
  const fy = s.T1 * Math.sin(25 * Math.PI / 180) + s.T2 * Math.sin(40 * Math.PI / 180) - 20 * 9.81;
  close("lamp Fx", fx, 0, 1e-9); close("lamp Fy", fy, 0, 1e-9);
  yes("parallel cables", solveConcurrent([{ F: 10, angle: 270 }], 90, 90).ok === false);
}

section("Beams");
{
  const closes = (b, name) => { const e = b.at(b.samples.at(-1).x, true); close(name + " V closes", e.V, 0, 1e-9); close(name + " M closes", e.M, 0, 1e-9); };
  let b = analyseBeam({ L: 10, support: { type: "simple", a: 0, b: 10 }, loads: [{ type: "point", x: 4, P: 20 }] });
  close("A", b.result.A, 12); close("B", b.result.B, 8); close("Mmax", b.Mmax.v, 48); close("Mmax x", b.Mmax.x, 4, 1e-6); closes(b, "point");
  b = analyseBeam({ L: 8, support: { type: "simple", a: 0, b: 8 }, loads: [{ type: "udl", x1: 0, x2: 8, w: 5 }] });
  close("udl A", b.result.A, 20); close("udl B", b.result.B, 20); close("wL2/8", b.Mmax.v, 40); close("udl Mx", b.Mmax.x, 4, 1e-6); closes(b, "udl");
  b = analyseBeam({ L: 6, support: { type: "simple", a: 0, b: 6 }, loads: [{ type: "uvl", x1: 0, x2: 6, w1: 0, w2: 9 }] });
  close("tri A", b.result.A, 9); close("tri B", b.result.B, 18); close("tri Mmax", b.Mmax.v, (9 * 36) / (9 * Math.sqrt(3)), 1e-4); close("tri Mx", b.Mmax.x, 6 / Math.sqrt(3), 1e-4); closes(b, "tri");
  b = analyseBeam({ L: 3, support: { type: "cantilever", side: "left" }, loads: [{ type: "point", x: 3, P: 10 }] });
  close("cant V", b.result.V, 10); close("cant M", b.result.M, 30); close("cant hogging", b.Mmax.v, -30); closes(b, "cantilever");
  b = analyseBeam({ L: 4, support: { type: "cantilever", side: "right" }, loads: [{ type: "point", x: 1, P: 8 }] });
  close("right cant M", b.result.M, -24); close("right cant hogging", b.Mmax.v, -24); closes(b, "right cantilever");
  b = analyseBeam({ L: 8, support: { type: "simple", a: 0, b: 6 }, loads: [{ type: "point", x: 8, P: 10 }] });
  close("overhang B", b.result.B, 13.3333333, 1e-6); close("overhang A", b.result.A, -3.3333333, 1e-6); closes(b, "overhang");
  b = analyseBeam({ L: 4, support: { type: "simple", a: 0, b: 4 }, loads: [{ type: "moment", x: 2, M: 20 }] });
  close("couple A", b.result.A, 5); close("couple B", b.result.B, -5); closes(b, "couple");
  // random loadings always close (V and M return to zero at the far end) and reactions balance the loads
  for (let k = 0; k < 150; k++) {
    const L = 4 + rnd() * 10;
    const loads = [];
    for (let i = 0; i < 1 + Math.floor(rnd() * 3); i++) {
      const t = rnd();
      if (t < 0.34) loads.push({ type: "point", x: rnd() * L, P: rnd() * 30 - 5 });
      else if (t < 0.67) { const x1 = rnd() * L * 0.5; loads.push({ type: "udl", x1, x2: x1 + rnd() * (L - x1), w: rnd() * 10 }); }
      else { const x1 = rnd() * L * 0.5; loads.push({ type: "uvl", x1, x2: x1 + 0.1 + rnd() * (L - x1 - 0.1), w1: rnd() * 8, w2: rnd() * 8 }); }
      if (rnd() < 0.3) loads.push({ type: "moment", x: rnd() * L, M: rnd() * 40 - 20 });
    }
    const sup = rnd() < 0.5 ? { type: "simple", a: rnd() * L * 0.3, b: L * 0.6 + rnd() * L * 0.4 } : { type: "cantilever", side: rnd() < 0.5 ? "left" : "right" };
    const res = analyseBeam({ L, support: sup, loads });
    closes(res, "random " + k);
  }
}

section("Trusses");
{
  let t = solveTruss(TRUSS_PRESETS.triangle);
  yes("tri ok", t.ok);
  const r = Object.fromEntries(t.reactions.map((q) => [q.node + q.dir, q.value]));
  close("Ax", r["0x"], 0, 1e-9); close("Ay", r["0y"], 5); close("By", r["1y"], 5);
  close("AB", t.members[0].force, 10 / 3, 1e-6);
  close("BC", t.members[1].force, -5 / (3 / Math.hypot(2, 3)), 1e-6); close("AC", t.members[2].force, -5 / (3 / Math.hypot(2, 3)), 1e-6);
  yes("tri compression", t.members[2].kind === "compression");
  close("check sx", t.check.sx, 0, 1e-9); close("check sy", t.check.sy, 0, 1e-9); close("check sm", t.check.sm, 0, 1e-9);
  t = solveTruss(TRUSS_PRESETS.warren);
  yes("warren ok", t.ok);
  close("warren 0-3", t.members[2].force, -20 / (2.5 / Math.hypot(1.5, 2.5)), 1e-6);
  close("warren 0-1", t.members[0].force, (20 / (2.5 / Math.hypot(1.5, 2.5))) * (1.5 / Math.hypot(1.5, 2.5)), 1e-6);
  close("warren symmetry", t.members[2].force, t.members[5].force, 1e-9);
  close("warren sm", t.check.sm, 0, 1e-8);
  // top chord and its force by method of sections: cut 3-4, 3-1, 0-1 -> moment about joint 1
  close("warren 3-4", t.members[6].force, -(20 * 3 - 20 * 1.5) / 2.5 * 1 + 0, 1e-6 * 100);
  const bad = structuredClone(TRUSS_PRESETS.triangle); bad.members.push({ a: 0, b: 1 });
  yes("indeterminate", solveTruss(bad).state === "indeterminate");
  const weak = structuredClone(TRUSS_PRESETS.triangle); weak.members.pop();
  yes("mechanism", solveTruss(weak).state === "unstable");
  const noSupport = structuredClone(TRUSS_PRESETS.triangle); noSupport.supports = [{ node: 0, kind: "pin" }, { node: 1, kind: "rollerX" }];
  yes("bad supports unstable", solveTruss(noSupport).ok === false);
}

section("Friction");
{
  let f = inclineBlock({ m: 100, theta: 30, mus: 0.3, muk: 0.2 });
  yes("slides", f.status === "slides down"); close("N", f.N, 981 * Math.cos(Math.PI / 6)); close("a", f.accel, (490.5 - 0.2 * 981 * Math.cos(Math.PI / 6)) / 100, 1e-9);
  f = inclineBlock({ m: 100, theta: 30, mus: 0.7, muk: 0.5 });
  yes("rest", f.status === "at rest"); close("friction", f.friction, 490.5, 1e-9);
  const base = inclineBlock({ m: 100, theta: 30, mus: 0.3, muk: 0.2 });
  close("Pmin", base.Pmin, 981 * (0.5 - 0.3 * Math.cos(Math.PI / 6)), 1e-9);
  yes("just holds", inclineBlock({ m: 100, theta: 30, mus: 0.3, muk: 0.2, P: base.Pmin + 1 }).status === "at rest");
  yes("just slips", inclineBlock({ m: 100, theta: 30, mus: 0.3, muk: 0.2, P: base.Pmin - 1 }).status === "slides down");
  close("Pup", base.Pup, 981 * (0.5 + 0.3 * Math.cos(Math.PI / 6)), 1e-9);
  yes("slips up", inclineBlock({ m: 100, theta: 30, mus: 0.3, muk: 0.2, P: base.Pup + 1 }).status === "slides up");
  yes("holds below", inclineBlock({ m: 100, theta: 30, mus: 0.3, muk: 0.2, P: base.Pup - 1 }).status === "at rest");
  f = inclineBlock({ m: 50, theta: 0, mus: 0.4, muk: 0.3, P: 150 });
  yes("flat at rest", f.status === "at rest"); close("flat friction", Math.abs(f.friction), 150);
  f = inclineBlock({ m: 50, theta: 0, mus: 0.4, muk: 0.3, P: 250 });
  yes("flat slides", f.status === "slides up"); close("flat a", f.accel, (250 - 0.3 * 490.5) / 50, 1e-9);
  close("critical angle", base.critical, (Math.atan(0.3) * 180) / Math.PI, 1e-9);
  yes("lift off", inclineBlock({ m: 1, theta: 0, mus: 0.5, muk: 0.4, P: 100, phi: 90 }).status === "lifts off");
}

section("Centroid and moment of inertia");
{
  let s = analyseSection([{ type: "rect", x: 0, y: 0, w: 6, h: 4 }]);
  close("rect cx", s.xbar, 3); close("rect cy", s.ybar, 2); close("rect Ix", s.Ix, 32); close("rect Iy", s.Iy, 72);
  s = analyseSection(SECTION_PRESETS.hole);
  close("hole A", s.A, 8000 - Math.PI * 400); close("hole cx", s.xbar, 50); close("hole Ix", s.Ix, (100 * 80 ** 3) / 12 - (Math.PI * 20 ** 4) / 4, 1e-9);
  // L-section: both legs 100 x 20 and 20 x 80
  s = analyseSection(SECTION_PRESETS.L);
  close("L A", s.A, 3600); close("L x", s.xbar, 116000 / 3600, 1e-9);
  s = analyseSection(SECTION_PRESETS.T);
  close("T A", s.A, 3600); close("T x", s.xbar, 50); close("T y", s.ybar, (2000 * 90 + 1600 * 40) / 3600, 1e-9);
  yes("error on negative area", analyseSection([{ type: "rect", x: 0, y: 0, w: 1, h: 1, sign: -1 }]).ok === false);

  // Check every shape's formulas against counting tiny squares (independent of the formulas)
  const shapes = [
    { type: "rect", x: 2, y: -1, w: 7, h: 3 },
    { type: "triangle", x: 0, y: 0, b: 10, h: 6, a: 0 },
    { type: "triangle", x: 1, y: 2, b: 8, h: 5, a: 4 },
    { type: "triangle", x: 0, y: 0, b: 6, h: 4, a: 11 },
    { type: "triangle", x: 0, y: 0, b: 6, h: 4, a: -3 },
    { type: "circle", x: 3, y: 4, r: 5 },
    { type: "ellipse", x: 1, y: 1, a: 6, b: 3 },
    ...["up", "down", "left", "right"].map((o) => ({ type: "semicircle", x: 2, y: 3, r: 6, orient: o })),
    ...[1, 2, 3, 4].map((q) => ({ type: "quarter", x: -1, y: 1, r: 7, quad: q })),
  ];
  for (const sh of shapes) {
    const p = shapeProps(sh);
    // count tiny squares inside a box around the shape (cell size 0.01 in the same units)
    const ext = Math.max(sh.r || 0, sh.w || 0, sh.b || 0, sh.a || 0, sh.h || 0, 10) + 6;
    const bx0 = (sh.x || 0) - ext, by0 = (sh.y || 0) - ext, h = 0.015, N = Math.ceil((2 * ext) / h);
    let A = 0, qx = 0, qy = 0;
    const pts = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = bx0 + (i + 0.5) * h, y = by0 + (j + 0.5) * h;
      if (inside(sh, x, y)) { A += h * h; qx += h * h * y; qy += h * h * x; pts.push([x, y]); }
    }
    const cx = qy / A, cy = qx / A;
    let Ix = 0, Iy = 0;
    for (const [x, y] of pts) { Ix += h * h * (y - cy) ** 2; Iy += h * h * (x - cx) ** 2; }
    const tag = `${sh.type}${sh.orient || sh.quad || sh.a || ""}`;
    close(`${tag} A`, p.A, A, 0.003); close(`${tag} cx`, p.cx, cx, 0.02); close(`${tag} cy`, p.cy, cy, 0.02);
    close(`${tag} Ixc`, p.Ixc, Ix, 0.006); close(`${tag} Iyc`, p.Iyc, Iy, 0.006);
  }

  // a whole composite figure with a hole, against counting squares
  const fig = [{ type: "rect", x: 0, y: 0, w: 100, h: 60, sign: 1 }, { type: "semicircle", x: 50, y: 60, r: 30, orient: "up", sign: 1 }, { type: "circle", x: 50, y: 30, r: 15, sign: -1 }, { type: "triangle", x: 100, y: 0, b: 40, h: 60, a: 0, sign: 1 }];
  const res = analyseSection(fig);
  const N = 1400, h = 180 / N;
  let A = 0, qx = 0, qy = 0; const pts = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = -20 + (i + 0.5) * h, y = -20 + (j + 0.5) * h;
    const w = fig.reduce((t, sh) => t + (inside(sh, x, y) ? sh.sign : 0), 0);
    if (w) { A += w * h * h; qx += w * h * h * y; qy += w * h * h * x; pts.push([x, y, w]); }
  }
  const cx = qy / A, cy = qx / A; let Ix = 0, Iy = 0;
  for (const [x, y, w] of pts) { Ix += w * h * h * (y - cy) ** 2; Iy += w * h * h * (x - cx) ** 2; }
  close("fig A", res.A, A, 0.003); close("fig x", res.xbar, cx, 0.003); close("fig y", res.ybar, cy, 0.003);
  close("fig Ix", res.Ix, Ix, 0.01); close("fig Iy", res.Iy, Iy, 0.01);
}

section("Projectile");
{
  let p = projectile({ v0: 20, angle: 45, h0: 0, g: 9.81 });
  close("R 20/45", p.R, 400 / 9.81, 1e-9); close("H 20/45", p.H, 200 / 9.81 / 2, 1e-9 + 0.0); close("T 20/45", p.T, (2 * 20 * Math.sin(Math.PI / 4)) / 9.81, 1e-9);
  p = projectile({ v0: 30, angle: 30, h0: 0 });
  close("R 30/30", p.R, (900 * Math.sin(Math.PI / 3)) / 9.81, 1e-9); close("H 30/30", p.H, (900 * 0.25) / (2 * 9.81), 1e-9); close("T 30/30", p.T, 3.0581, 1e-4);
  p = projectile({ v0: 20, angle: 0, h0: 50 });
  close("cliff T", p.T, Math.sqrt(100 / 9.81), 1e-9); close("cliff R", p.R, 20 * Math.sqrt(100 / 9.81), 1e-9); close("cliff speed", p.speedEnd, Math.sqrt(400 + 981), 1e-9);
  close("pos at T is ground", p.pos(p.T).y, 0, 1e-9); close("pos at T x", p.pos(p.T).x, p.R, 1e-9);
  const q = projectile({ v0: 25, angle: 60, h0: 10, g: 3.7 });
  close("apex height from pos", q.pos(q.tUp).y, q.H, 1e-9); close("landing from pos", q.pos(q.T).y, 0, 1e-8);
  const m = maxRange({ v0: 20, h0: 50 });
  close("max angle", m.angle, (Math.atan(20 / Math.sqrt(400 + 981)) * 180) / Math.PI, 1e-9);
  let bestA = 0, bestR = -1; for (let a = 0; a <= 90; a += 0.005) { const r = projectile({ v0: 20, angle: a, h0: 50 }).R; if (r > bestR) { bestR = r; bestA = a; } }
  close("max angle scan", bestA, m.angle, 0.001); close("max range scan", bestR, m.R, 1e-6);
  close("flat max angle", maxRange({ v0: 20, h0: 0 }).angle, 45, 1e-9);
  const ar = anglesForRange({ v0: 20, h0: 0, R: 30 });
  close("low angle", ar.angles[0], (Math.asin((9.81 * 30) / 400) * 90) / Math.PI, 1e-7); close("high angle", ar.angles[1], 90 - ar.angles[0], 1e-7);
  close("range at found angle", projectile({ v0: 20, angle: ar.angles[0], h0: 0 }).R, 30, 1e-7);
  yes("out of reach", anglesForRange({ v0: 20, h0: 0, R: 100 }).angles.length === 0);
  const d0 = projectileDrag({ v0: 20, angle: 45, h0: 0, k: 0, dt: 0.001 });
  close("drag k=0 range", d0.R, 400 / 9.81, 1e-3); close("drag k=0 height", d0.H, 200 / 9.81 / 2, 1e-3); close("drag k=0 time", d0.T, p.T * 0 + (2 * 20 * Math.sin(Math.PI / 4)) / 9.81, 1e-3);
  const d1 = projectileDrag({ v0: 20, angle: 45, h0: 0, k: 0.02, model: "quadratic" });
  yes("drag shortens range", d1.R < 400 / 9.81 && d1.R > 10); yes("drag lowers peak", d1.H < 10.19);
  const d2 = projectileDrag({ v0: 20, angle: 45, h0: 0, k: 0.3, model: "linear" });
  yes("linear drag shortens range", d2.R < 400 / 9.81);
}

section("Equations of motion");
{
  let r = suvat({ u: 0, a: 9.81, t: 2 }); close("s", r.values.s, 19.62); close("v", r.values.v, 19.62);
  r = suvat({ u: 20, v: 0, s: 40 }); close("a", r.values.a, -5); close("t", r.values.t, 4);
  r = suvat({ u: 10, a: 2, s: 24 }); close("v", r.values.v, 14); close("t", r.values.t, 2);
  yes("needs three", suvat({ u: 1, a: 2 }).ok === false);
  // every choice of three quantities gives numbers that satisfy the equations
  const names = ["s", "u", "v", "a", "t"];
  for (let k = 0; k < 150; k++) {
    const u = rnd() * 20, a = rnd() * 8 + 0.5, t = rnd() * 10 + 0.5; const v = u + a * t, s = u * t + 0.5 * a * t * t;
    const all = { s, u, v, a, t };
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let l = j + 1; l < 5; l++) {
      const given = { [names[i]]: all[names[i]], [names[j]]: all[names[j]], [names[l]]: all[names[l]] };
      const res = suvat(given);
      if (!res.ok) { fail++; console.log("  FAIL suvat subset", Object.keys(given), res.error); continue; }
      const q = res.values;
      const e1 = Math.abs(q.v - (q.u + q.a * q.t)), e2 = Math.abs(q.s - (q.u * q.t + 0.5 * q.a * q.t * q.t));
      if (e1 < 1e-6 * (1 + Math.abs(q.v)) && e2 < 1e-6 * (1 + Math.abs(q.s))) pass++; else { fail++; console.log("  FAIL suvat residual", Object.keys(given), q); }
    }
  }
  const g = motionGraph({ u: 2, a: 3, t: 4 }); close("graph end s", g.at(-1).s, 2 * 4 + 1.5 * 16); close("graph end v", g.at(-1).v, 14);
}

section("Energy");
{
  let e = energySlope({ m: 2, theta: 30, d: 10, mu: 0 }); close("v frictionless", e.v, Math.sqrt(2 * 9.81 * 10 * 0.5), 1e-9);
  e = energySlope({ m: 2, theta: 30, d: 10, mu: 0.2 }); close("v friction", e.v, Math.sqrt(2 * 9.81 * 10 * (0.5 - 0.2 * Math.cos(Math.PI / 6))), 1e-9);
  e = energySlope({ m: 1, theta: 10, d: 100, mu: 0.5, v0: 5 }); yes("stops", e.stops); close("stop distance", e.stopDistance, 12.5 / (9.81 * (0.5 * Math.cos(Math.PI / 18) - Math.sin(Math.PI / 18))), 1e-9);
  e = energySlope({ m: 3, theta: 90, d: 20, mu: 0 }); close("free fall 20 m", e.v, Math.sqrt(2 * 9.81 * 20), 1e-9);
  close("energy conserved", e.KE, e.PEloss, 1e-9);
}

section("Collisions");
{
  let c = collide({ m1: 2, u1: 5, m2: 2, u2: 0, e: 1 }); close("swap v1", c.v1, 0, 1e-9); close("swap v2", c.v2, 5);
  c = collide({ m1: 2, u1: 3, m2: 1, u2: 0, e: 0 }); close("stick v1", c.v1, 2); close("stick v2", c.v2, 2); close("lost", c.KElost, 3);
  for (let k = 0; k < 200; k++) {
    const m1 = rnd() * 9 + 0.5, m2 = rnd() * 9 + 0.5, u1 = rnd() * 20 - 5, u2 = rnd() * 10 - 15, e = rnd();
    const r = collide({ m1, u1, m2, u2, e });
    close("momentum " + k, r.pAfter, r.pBefore, 1e-9); close("restitution " + k, r.v2 - r.v1, e * (u1 - u2), 1e-9); yes("no energy gain " + k, r.KElost > -1e-9);
  }
  c = collide({ m1: 1, u1: 4, m2: 3, u2: 0, e: 1 }); close("elastic KE kept", c.KEafter, c.KEbefore, 1e-9);
}

section("Machines: force, load, velocity ratio, efficiency, power");
{
  // a 4-string pulley lifting 800 N with 250 N of effort, effort moving 4 m while the load rises 1 m
  let r = ratios({ load: 800, effort: 250, dE: 4, dL: 1 });
  close("MA", r.MA, 3.2); close("VR", r.VR, 4); close("efficiency", r.eff, 80, 1e-9);
  close("work in", r.workIn, 1000); close("work out", r.workOut, 800); close("work lost", r.workLost, 200); close("ideal effort", r.idealEffort, 200); close("friction effort", r.frictionEffort, 50);
  close("efficiency = work out / work in", r.eff, (r.workOut / r.workIn) * 100, 1e-9);
  close("lever VR", velocityRatio("lever", { effortArm: 2, loadArm: 0.5 }).VR, 4);
  close("pulley VR", velocityRatio("pulley", { n: 5 }).VR, 5);
  close("wheel and axle VR", velocityRatio("wheelAxle", { R: 0.3, r: 0.05 }).VR, 6, 1e-9);
  close("incline VR", velocityRatio("incline", { length: 10, height: 2 }).VR, 5);
  close("incline VR = 1/sin30", velocityRatio("incline", { length: 10, height: 5 }).VR, 1 / Math.sin(Math.PI / 6), 1e-9);
  close("screw jack VR", velocityRatio("screw", { a: 0.4, pitch: 0.01 }).VR, (2 * Math.PI * 0.4) / 0.01, 1e-9);
  close("gear VR", velocityRatio("gears", { driver: 20, driven: 60 }).VR, 3);
  yes("bad size rejected", velocityRatio("lever", { effortArm: 0, loadArm: 1 }).ok === false);
  let e = effortFor({ load: 800, VR: 4, eff: 80 }); close("ideal effort", e.ideal, 200); close("actual effort", e.actual, 250);
  // the law of a machine E = 0.3 L + 10, found from two readings, for a machine with VR 4
  const law = lawOfMachine({ load: 100, effort: 40 }, { load: 300, effort: 100 }, 4);
  close("law m", law.m, 0.3, 1e-12); close("law c", law.c, 10, 1e-9); close("effort at 500 N", law.at(500).effort, 160, 1e-9);
  close("efficiency at 300 N", law.at(300).eff, 75, 1e-9); close("max efficiency", law.maxEff, (1 / (0.3 * 4)) * 100, 1e-9);
  yes("same loads rejected", lawOfMachine({ load: 5, effort: 1 }, { load: 5, effort: 2 }, 4).ok === false);
  // efficiency really does rise toward the maximum
  yes("efficiency rises with load", law.at(5000).eff > law.at(300).eff && law.at(5000).eff < law.maxEff);
  let p = machinePower({ effort: 250, load: 800, dE: 8, dL: 2, t: 10 });
  close("power in", p.Pin, 200); close("power out", p.Pout, 160); close("power lost", p.Plost, 40); close("power efficiency", p.eff, 80, 1e-9);
  close("P = F v", powerFromForce({ F: 500, v: 3 }).P, 1500); close("output power", outputPower({ Pin: 2000, eff: 85 }).Pout, 1700); close("lost power", outputPower({ Pin: 2000, eff: 85 }).Plost, 300);
}

console.log(`\n${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
