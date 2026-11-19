// Answers. These are worked out from what is drawn, not typed in.
// Draw a launch arrow and the range, height and flight time appear. Hang a weight from two ropes and
// both tensions appear. While the simulation runs, "now" rows show the live values next to them.
//
// analyze(scene, g, env, topic, live) returns
//   groups   [{ id, title, rows: [{ label, value, unit, note, live, head }], notes: [] }]
//   paths    dashed predicted paths to draw on the canvas  [{ pts, color }]
//   marks    points to mark on the canvas                  [{ p, text }]
import { itemType } from "../core/itemTypes.js";
import { dist } from "../core/geometry.js";
import { blockPts, rampPts, wallEnds } from "../tools/objects/index.js";

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const unit = (v) => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

const row = (label, value, unitText = "", extra = {}) => ({ label, value, unit: unitText, ...extra });
const nameOf = (it) => it.label || `${itemType(it.type).title(it)} ${it.id}`;

const isBody = (it) => {
  const def = itemType(it.type);
  return Boolean(def && def.physics && it.type !== "ring" && def.physics(it).kind === "dynamic");
};
const halfH = (it) => (it.radius != null ? it.radius : it.type === "beam" ? it.thickness / 2 : it.h / 2);
const halfW = (it) => (it.radius != null ? it.radius : it.type === "beam" ? it.length / 2 : it.w / 2);
const velocity0 = (it) => {
  const a = rad(it.angle0 || 0);
  const s = it.speed0 || 0;
  return { x: s * Math.cos(a), y: s * Math.sin(a) };
};

// Which ids are tied to ropes, rods, springs or pins (they do not fly free)
function tiedSet(scene) {
  const tied = new Set();
  for (const it of scene.items) {
    if (it.type === "line" && ["rope", "rod", "spring"].includes(it.style)) {
      if (it.attachA) tied.add(it.attachA.id);
      if (it.attachB) tied.add(it.attachB.id);
    }
  }
  for (const s of scene.items) {
    if (s.type !== "support" || s.kind === "anchor") continue;
    for (const b of scene.items) if (isBody(b) && itemType(b.type).hitTest(b, s, 0.03)) tied.add(b.id);
  }
  return tied;
}

// Force lines that start on a body: [{ f: {x,y}, at: {x,y}, line }]
function appliedForces(scene, bodyId) {
  return scene.items
    .filter((l) => l.type === "line" && l.style === "force" && l.attachA && l.attachA.id === bodyId)
    .map((l) => {
      const u = unit({ x: l.b.x - l.a.x, y: l.b.y - l.a.y });
      const n = l.force ?? 10;
      return { f: { x: u.x * n, y: u.y * n }, at: l.a, line: l };
    });
}

const groundLevel = (env) => (env.ground && env.ground.on ? env.ground.y : null);

// ---------------------------------------------------------------- projectile
function projectile(ctx) {
  const { scene, g, env, liveOf } = ctx;
  const groups = [];
  const targets = scene.items.filter((i) => i.type === "target");
  for (const it of scene.items) {
    if (!isBody(it) || ctx.tied.has(it.id) || !(it.speed0 > 0)) continue;
    const v = velocity0(it);
    const r = halfH(it);
    const g0 = groundLevel(env);
    const rows = [];
    const notes = [];
    rows.push(row("Starts at", `x ${rnd(it.x)}, y ${rnd(it.y)}`, "m"));
    rows.push(row("Launch speed", it.speed0, "m/s"));
    rows.push(row("Launch angle", it.angle0 || 0, "°"));
    rows.push(row("Horizontal speed", v.x, "m/s"));
    rows.push(row("Vertical speed", v.y, "m/s"));
    if (env.air && env.air.on) notes.push("Air resistance is on. These answers ignore it; Play shows the real flight.");
    if (g <= 0) {
      notes.push("Gravity is off, so it moves in a straight line at constant speed.");
      groups.push({ id: `proj${it.id}`, title: `Projectile: ${nameOf(it)}`, rows, notes });
      continue;
    }
    const apexT = v.y > 0 ? v.y / g : 0;
    const apexH = (v.y > 0 ? (v.y * v.y) / (2 * g) : 0);
    rows.push(row("Time to highest point", apexT, "s"));
    rows.push(row("Greatest height above launch", apexH, "m", { head: true }));
    const yTop = it.y + apexH;
    let tEnd = Math.max(2 * apexT, 3);
    const pts = [];
    if (g0 != null) {
      const yg = g0 + r;
      const disc = v.y * v.y + 2 * g * (it.y - yg);
      if (disc >= 0) {
        const tf = (v.y + Math.sqrt(disc)) / g;
        tEnd = tf;
        const range = v.x * tf;
        const vyEnd = v.y - g * tf;
        rows.push(row("Time of flight", tf, "s", { head: true }));
        rows.push(row("Range (horizontal)", range, "m", { head: true }));
        rows.push(row("Lands at x", it.x + range, "m"));
        rows.push(row("Greatest height above ground", yTop - g0 - r, "m"));
        rows.push(row("Speed on landing", Math.hypot(v.x, vyEnd), "m/s"));
        rows.push(row("Angle on landing (below horizontal)", deg(Math.atan2(-vyEnd, Math.abs(v.x) || 1e-9)), "°"));
        ctx.marks.push({ p: { x: it.x + range, y: g0 }, text: `${rnd(range)} m` });
      } else {
        notes.push("It starts below the ground, so there is no flight.");
      }
    }
    const N = 90;
    for (let k = 0; k <= N; k++) {
      const t = (tEnd * k) / N;
      pts.push({ x: it.x + v.x * t, y: it.y + v.y * t - 0.5 * g * t * t });
    }
    ctx.paths.push({ pts, color: "#4cc9f0" });

    for (const tg of targets) {
      const hit = pts.reduce((m, p) => Math.min(m, dist(p, tg)), Infinity) - tg.radius - r;
      rows.push(row(`Flight vs ${nameOf(tg)}`, hit <= 0 ? "Hits" : `Misses by ${rnd(hit)} m`, ""));
      const dx = tg.x - it.x;
      const dy = tg.y - it.y;
      const s2 = it.speed0 * it.speed0;
      const disc = s2 * s2 - g * (g * dx * dx + 2 * dy * s2);
      if (Math.abs(dx) < 1e-6) continue;
      if (disc < 0) rows.push(row(`Angles that hit ${nameOf(tg)}`, "Out of reach at this speed", ""));
      else {
        const a1 = deg(Math.atan((s2 + Math.sqrt(disc)) / (g * Math.abs(dx))));
        const a2 = deg(Math.atan((s2 - Math.sqrt(disc)) / (g * Math.abs(dx))));
        const fix = (a) => (dx < 0 ? 180 - a : a);
        rows.push(row(`Angles that hit ${nameOf(tg)}`, `${rnd(fix(a2))}° or ${rnd(fix(a1))}°`, "", { head: true }));
      }
    }

    const live = liveOf(it.id);
    if (live && live.sim) {
      rows.push(row("Moved right now", live.sim.dx, "m", { live: true }));
      rows.push(row("Height above launch now", live.sim.dy, "m", { live: true }));
      rows.push(row("Speed now", Math.hypot(live.sim.vx, live.sim.vy), "m/s", { live: true }));
      rows.push(row("Highest so far (above launch)", live.sim.maxY - it.y, "m", { live: true }));
    }
    groups.push({ id: `proj${it.id}`, title: `Projectile: ${nameOf(it)}`, rows, notes });
  }
  return groups;
}

// ---------------------------------------------------------------- block on a surface
function surfaceFor(scene, env, it) {
  const pts = blockPts(it);
  const c = { x: it.x, y: it.y };
  let best = null;
  const consider = (cand) => {
    if (!best || cand.gap < best.gap) best = cand;
  };
  const g0 = groundLevel(env);
  if (g0 != null) {
    const low = Math.min(...pts.map((p) => p.y));
    const gap = Math.abs(low - g0);
    if (gap < 0.12) consider({ kind: "ground", gap, t: { x: 1, y: 0 }, n: { x: 0, y: 1 }, mu: env.ground.friction ?? 0.5, name: "the ground" });
  }
  const lineSurface = (a, b, n, mu, name, kind, extra = {}) => {
    const d = { x: b.x - a.x, y: b.y - a.y };
    const L2 = dot(d, d) || 1;
    const tt = dot({ x: c.x - a.x, y: c.y - a.y }, d) / L2;
    if (tt < -0.05 || tt > 1.05) return;
    const foot = { x: a.x + d.x * tt, y: a.y + d.y * tt };
    const off = dot({ x: c.x - foot.x, y: c.y - foot.y }, n);
    const gap = Math.abs(off - it.h / 2);
    if (off < 0 || gap > 0.15) return;
    let t = unit(d);
    if (t.y > 1e-9 || (Math.abs(t.y) < 1e-9 && t.x < 0)) t = { x: -t.x, y: -t.y };
    if (Math.abs(t.y) < 1e-9) t = { x: 1, y: 0 };
    consider({ kind, gap, t, n, mu, name, foot, ...extra });
  };
  for (const o of scene.items) {
    if (o.type === "ramp") {
      const [a, b, top] = rampPts(o);
      let t = unit({ x: top.x - a.x, y: top.y - a.y });
      let n = { x: -t.y, y: t.x };
      if (dot({ x: b.x - a.x, y: b.y - a.y }, n) > 0) n = { x: -n.x, y: -n.y };
      lineSurface(a, top, n, o.friction ?? 0.4, nameOf(o), "ramp", { toe: a, top, angle: deg(Math.atan2(Math.abs(top.y - a.y), Math.abs(top.x - a.x))) });
    } else if (o.type === "wall") {
      const [a, b] = wallEnds(o);
      const tt = unit({ x: b.x - a.x, y: b.y - a.y });
      const left = { x: -tt.y, y: tt.x };
      const n = o.side === "left" ? { x: -left.x, y: -left.y } : left;
      lineSurface(a, b, n, o.friction ?? 0.4, nameOf(o), "wall");
    }
  }
  return best;
}

function dynamics(ctx) {
  const { scene, env, g, liveOf } = ctx;
  const groups = [];
  for (const it of scene.items) {
    if (it.type !== "block" || ctx.tied.has(it.id)) continue;
    const surf = surfaceFor(scene, env, it);
    const forces = appliedForces(scene, it.id);
    if (!surf && !forces.length) continue;
    const rows = [];
    const notes = [];
    const m = it.mass;
    const W = { x: 0, y: -m * g };
    let total = { ...W };
    for (const f of forces) total = { x: total.x + f.f.x, y: total.y + f.f.y };
    rows.push(row("Weight (mg)", m * g, "N"));
    for (const f of forces) rows.push(row(`Applied force${f.line.label ? ` ${f.line.label}` : ""}`, Math.hypot(f.f.x, f.f.y), "N"));
    if (!surf) {
      rows.push(row("Net force", Math.hypot(total.x, total.y), "N"));
      rows.push(row("Acceleration", Math.hypot(total.x, total.y) / m, "m/s²", { head: true }));
      notes.push("Not touching a surface yet, so nothing pushes back. Put it on the floor or a slope for friction answers.");
      groups.push({ id: `dyn${it.id}`, title: `Forces: ${nameOf(it)}`, rows, notes });
      continue;
    }
    const mu = env.friction && env.friction.on === false ? 0 : Math.sqrt(Math.max(0, (it.friction ?? 0.4) * surf.mu));
    const N = -dot(total, surf.n);
    const P = dot(total, surf.t);
    rows.push(row(`Resting on`, surf.name, ""));
    if (surf.kind === "ramp") rows.push(row("Slope angle", surf.angle, "°"));
    if (N <= 0) {
      rows.push(row("Normal force", 0, "N"));
      rows.push(row("Result", "It lifts off the surface", "", { head: true }));
      groups.push({ id: `dyn${it.id}`, title: `Forces: ${nameOf(it)}`, rows, notes });
      continue;
    }
    rows.push(row("Normal force (N)", N, "N", { head: true }));
    rows.push(row("Friction coefficient used (μ)", mu, ""));
    rows.push(row("Biggest friction it can give (μN)", mu * N, "N"));
    rows.push(row("Force along the surface", P, "N"));
    const v0 = velocity0(it);
    const vpar = dot(v0, surf.t);
    let a;
    let f;
    if ((it.speed0 || 0) > 1e-9 && Math.abs(vpar) > 1e-9) {
      const s = Math.sign(vpar);
      a = (P - s * mu * N) / m;
      f = mu * N;
      notes.push("It is launched, so sliding friction acts against its motion.");
    } else if (Math.abs(P) <= mu * N) {
      a = 0;
      f = Math.abs(P);
    } else {
      a = (P - Math.sign(P) * mu * N) / m;
      f = mu * N;
    }
    rows.push(row("Friction force", f, "N"));
    const flat = surf.kind === "ground" || Math.abs(surf.t.y) < 1e-9;
    const dirWord = (s) => (flat ? (s > 0 ? "to the right" : "to the left") : s > 0 ? "down the slope" : "up the slope");
    rows.push(row("Acceleration", Math.abs(a), "m/s²", { head: true }));
    rows.push(row("Result", Math.abs(a) < 1e-9 ? "Stays at rest" : `Speeds up ${dirWord(Math.sign(a) || Math.sign(P))}`, "", { head: true }));
    if (surf.kind === "ramp") {
      rows.push(row("Steepest slope before it slides (atan μ)", deg(Math.atan(mu)), "°"));
      if (a > 1e-9 && !(it.speed0 > 0)) {
        const L = -dot({ x: it.x - surf.toe.x, y: it.y - surf.toe.y }, surf.t);
        if (L > 0) {
          rows.push(row("Distance to the bottom", L, "m"));
          rows.push(row("Time to the bottom", Math.sqrt((2 * L) / a), "s"));
          rows.push(row("Speed at the bottom", Math.sqrt(2 * a * L), "m/s"));
        }
      }
    }
    const live = liveOf(it.id);
    if (live && live.sim) {
      rows.push(row("Speed now", Math.hypot(live.sim.vx, live.sim.vy), "m/s", { live: true }));
      rows.push(row("Moved right now", live.sim.dx, "m", { live: true }));
      rows.push(row("Moved up now", live.sim.dy, "m", { live: true }));
    }
    groups.push({ id: `dyn${it.id}`, title: `Forces: ${nameOf(it)}`, rows, notes });
  }
  return groups;
}

// ---------------------------------------------------------------- collisions
function collisions(ctx) {
  const { scene, g, liveOf } = ctx;
  const bodies = scene.items.filter((it) => isBody(it) && it.solid !== false && !ctx.tied.has(it.id));
  if (bodies.length < 1) return [];
  const rows = [];
  const notes = [];
  const vx = (it) => velocity0(it).x;
  const p0 = bodies.reduce((s, b) => ({ x: s.x + b.mass * velocity0(b).x, y: s.y + b.mass * velocity0(b).y }), { x: 0, y: 0 });
  const k0 = bodies.reduce((s, b) => s + 0.5 * b.mass * (b.speed0 || 0) ** 2, 0);
  rows.push(row("Momentum at start (x)", p0.x, "kg·m/s"));
  rows.push(row("Momentum at start (y)", p0.y, "kg·m/s"));
  rows.push(row("Kinetic energy at start", k0, "J"));

  const line = bodies.filter((b) => Math.abs(velocity0(b).y) < 1e-6).sort((a, b) => a.x - b.x);
  const pairs = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const L = line[i];
    const R = line[i + 1];
    if (Math.abs(L.y - R.y) > halfH(L) + halfH(R)) continue;
    const closing = vx(L) - vx(R);
    if (closing <= 1e-9) continue;
    const gap = R.x - halfW(R) - (L.x + halfW(L));
    pairs.push({ L, R, closing, time: Math.max(0, gap) / closing });
  }
  pairs.sort((a, b) => a.time - b.time);
  for (const { L, R, closing, time } of pairs) {
    const e = Math.max(L.bounce ?? 0, R.bounce ?? 0);
    const m1 = L.mass;
    const m2 = R.mass;
    const u1 = vx(L);
    const u2 = vx(R);
    const v1 = (m1 * u1 + m2 * u2 + m2 * e * (u2 - u1)) / (m1 + m2);
    const v2 = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / (m1 + m2);
    const kb = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
    const ka = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
    const tag = `${nameOf(L)} hits ${nameOf(R)}`;
    rows.push(row(tag, `in ${rnd(time)} s`, "", { head: true }));
    rows.push(row(`${nameOf(L)} after`, v1, "m/s", { head: true }));
    rows.push(row(`${nameOf(R)} after`, v2, "m/s", { head: true }));
    rows.push(row("Bounciness used (e)", e, ""));
    rows.push(row("Kinetic energy lost", kb - ka, "J"));
    rows.push(row(`Impulse on ${nameOf(L)}`, m1 * (v1 - u1), "N·s"));
    rows.push(row("Kind", e >= 0.999 ? "Elastic (no energy lost)" : e <= 0.001 ? "Perfectly inelastic (move together)" : "Partly elastic", ""));
    if (closing < 1.05) notes.push("The simulation ignores bounce below about 1 m/s of closing speed, so slow hits behave as perfectly inelastic there.");
  }
  if (!pairs.length) notes.push("No head-on collision found. Put two bodies on the same horizontal line, the left one moving faster toward the right one.");
  if (g > 0) notes.push("Gravity is on: friction and gravity are ignored in these predictions.");

  const live = bodies.map((b) => liveOf(b.id)).filter((b) => b && b.sim);
  if (live.length === bodies.length && live.length) {
    const p = live.reduce((s, b) => ({ x: s.x + b.mass * b.sim.vx, y: s.y + b.mass * b.sim.vy }), { x: 0, y: 0 });
    const k = live.reduce((s, b) => s + 0.5 * b.mass * (b.sim.vx ** 2 + b.sim.vy ** 2), 0);
    rows.push(row("Momentum now (x)", p.x, "kg·m/s", { live: true }));
    rows.push(row("Momentum now (y)", p.y, "kg·m/s", { live: true }));
    rows.push(row("Kinetic energy now", k, "J", { live: true }));
    live.forEach((b) => rows.push(row(`${nameOf(b)} speed now`, Math.hypot(b.sim.vx, b.sim.vy), "m/s", { live: true })));
    notes.push("Walls take momentum too, so the total changes when something bounces off a wall.");
  }
  return [{ id: "collision", title: "Momentum and collisions", rows, notes }];
}

// ---------------------------------------------------------------- statics
const worldOnBody = (line, end) => (end === "a" ? line.a : line.b);

function particle(ctx) {
  const { scene, g } = ctx;
  const groups = [];
  for (const body of scene.items) {
    if (!isBody(body) || body.type === "beam") continue;
    const links = scene.items.filter(
      (l) => l.type === "line" && (l.style === "rope" || l.style === "rod") && ((l.attachA && l.attachA.id === body.id) || (l.attachB && l.attachB.id === body.id))
    );
    if (!links.length) continue;
    const ropes = [];
    let ok = true;
    for (const l of links) {
      const end = l.attachA && l.attachA.id === body.id ? "a" : "b";
      const far = end === "a" ? "b" : "a";
      const farAttach = far === "a" ? l.attachA : l.attachB;
      const farItem = farAttach && scene.items.find((i) => i.id === farAttach.id);
      if (farItem && isBody(farItem)) ok = false;
      const P = worldOnBody(l, end);
      const F = worldOnBody(l, far);
      ropes.push({ l, u: unit({ x: F.x - P.x, y: F.y - P.y }), name: l.label || `${l.style} ${l.id}` });
    }
    const title = `Equilibrium: ${nameOf(body)}`;
    if (!ok) {
      groups.push({ id: `eq${body.id}`, title, rows: [], notes: ["This body hangs from another moving body. Press Play and read the tensions from the ropes."] });
      continue;
    }
    let F = { x: 0, y: -body.mass * g };
    for (const f of appliedForces(scene, body.id)) F = { x: F.x + f.f.x, y: F.y + f.f.y };
    const rows = [row("Weight (mg)", body.mass * g, "N"), row("All other forces together", Math.hypot(F.x, F.y), "N")];
    const notes = [];
    const angleOf = (u) => deg(Math.atan2(Math.abs(u.y), Math.abs(u.x)));
    if (ropes.length === 1) {
      const { u } = ropes[0];
      const T = -dot(F, u);
      const off = Math.abs(cross(u, F));
      if (off > 0.01 * (Math.hypot(F.x, F.y) || 1) || T < 0) notes.push("One rope cannot hold this still: the pull is not in line with the rope, so it swings or goes slack.");
      else rows.push(row(`Tension ${ropes[0].name}`, T, "N", { head: true }));
    } else if (ropes.length === 2) {
      const [r1, r2] = ropes;
      const det = r1.u.x * r2.u.y - r2.u.x * r1.u.y;
      if (Math.abs(det) < 1e-6) notes.push("The two ropes are along the same line, so the tensions cannot be found uniquely.");
      else {
        const T1 = (-F.x * r2.u.y + F.y * r2.u.x) / det;
        const T2 = (-r1.u.x * F.y + r1.u.y * F.x) / det;
        rows.push(row(`Tension ${r1.name}`, T1, "N", { head: true }));
        rows.push(row(`Tension ${r2.name}`, T2, "N", { head: true }));
        rows.push(row(`${r1.name} angle from horizontal`, angleOf(r1.u), "°"));
        rows.push(row(`${r2.name} angle from horizontal`, angleOf(r2.u), "°"));
        if (T1 < -1e-6 || T2 < -1e-6) notes.push("A negative tension means that rope would have to push. It goes slack, so use a rod there.");
      }
    } else {
      notes.push("More than two ropes: the tensions are not fixed by balance alone. Play shows how they share the load.");
    }
    notes.push("Assumes every rope and force acts through one point on the body.");
    groups.push({ id: `eq${body.id}`, title, rows, notes });
  }
  return groups;
}

function beams(ctx) {
  const { scene, g } = ctx;
  const groups = [];
  for (const bm of scene.items) {
    if (bm.type !== "beam") continue;
    const def = itemType("beam");
    const sup = scene.items
      .filter((s) => s.type === "support" && s.kind !== "anchor" && def.hitTest(bm, s, 0.03))
      .sort((a, b) => a.x - b.x || (a.kind === "pin" ? -1 : 1));
    if (sup.length < 2) continue;
    let [S1, S2] = sup;
    if (S1.kind === "roller" && S2.kind === "pin") [S1, S2] = [S2, S1];
    const loads = [{ f: { x: 0, y: -bm.mass * g }, at: { x: bm.x, y: bm.y }, name: "Beam weight" }];
    for (const f of appliedForces(scene, bm.id)) loads.push({ f: f.f, at: f.at, name: f.line.label || "Applied force" });
    const sum = loads.reduce((s, l) => ({ x: s.x + l.f.x, y: s.y + l.f.y }), { x: 0, y: 0 });
    const mom = loads.reduce((s, l) => s + cross({ x: l.at.x - S1.x, y: l.at.y - S1.y }, l.f), 0);
    const d = { x: S2.x - S1.x, y: S2.y - S1.y };
    const rows = loads.map((l) => row(l.name, Math.hypot(l.f.x, l.f.y), "N"));
    const notes = [];
    const title = `Beam: ${nameOf(bm)}`;
    if (Math.abs(d.x) < 1e-6) {
      groups.push({ id: `beam${bm.id}`, title, rows, notes: ["The two supports are straight above each other, so the reactions cannot be found by balance alone."] });
      continue;
    }
    const R2y = -mom / d.x;
    const R1 = { x: -sum.x, y: -sum.y - R2y };
    const nm = (s) => (s.label ? s.label : `${s.kind[0].toUpperCase() + s.kind.slice(1)} ${s.id}`);
    if (S1.kind === "pin") rows.push(row(`${nm(S1)} reaction x`, R1.x, "N", { head: true }));
    rows.push(row(`${nm(S1)} reaction y`, R1.y, "N", { head: true }));
    rows.push(row(`${nm(S2)} reaction y`, R2y, "N", { head: true }));
    if (S1.kind === "roller" && Math.abs(sum.x) > 1e-6) notes.push("Nothing holds the beam sideways (no pin), so it slides.");
    if (S1.kind === "pin" && S2.kind === "pin") notes.push("Two pins share the sideways force in no fixed way. It is all shown on the left one.");
    groups.push({ id: `beam${bm.id}`, title, rows, notes });
  }
  return groups;
}

// ---------------------------------------------------------------- energy
function energy(ctx) {
  const { scene, g, env, liveOf } = ctx;
  const groups = [];
  const ref = groundLevel(env);
  const level = (it) => it.y - halfH(it) - (ref != null ? ref : -halfH(it));
  const pe = (it) => it.mass * g * level(it);
  const bodies = scene.items.filter((b) => isBody(b));

  // pendulums and springs: a rope or spring from a support to one body
  const lines = scene.items.filter((l) => l.type === "line" && (l.style === "rope" || l.style === "spring"));
  const info = (l) => {
    const sa = l.attachA && scene.items.find((i) => i.id === l.attachA.id);
    const sb = l.attachB && scene.items.find((i) => i.id === l.attachB.id);
    if (sa && sa.type === "support" && sb && isBody(sb)) return { support: sa, body: sb };
    if (sb && sb.type === "support" && sa && isBody(sa)) return { support: sb, body: sa };
    return null;
  };
  const shown = new Set();
  for (const l of lines) {
    const k = info(l);
    if (!k) continue;
    const { support: S, body: b } = k;
    const L = dist(S, b);
    const rows = [];
    const notes = [];
    if (l.style === "rope") {
      const cos = Math.max(-1, Math.min(1, (S.y - b.y) / (L || 1)));
      const th = Math.acos(cos);
      const T0 = 2 * Math.PI * Math.sqrt(L / Math.max(g, 1e-9));
      const v0 = b.speed0 || 0;
      const vmax = Math.sqrt(v0 * v0 + 2 * g * L * (1 - cos));
      rows.push(row("Rope length", L, "m"));
      rows.push(row("Release angle from vertical", deg(th), "°"));
      if (g > 0) {
        rows.push(row("Period", T0 * (1 + (th * th) / 16 + (11 * th ** 4) / 3072), "s", { head: true }));
        rows.push(row("Fastest speed (at the bottom)", vmax, "m/s", { head: true }));
        rows.push(row("Biggest tension (at the bottom)", b.mass * (g + (vmax * vmax) / L), "N", { head: true }));
        rows.push(row("Energy given up falling to the bottom", b.mass * g * L * (1 - cos), "J"));
      }
      notes.push("Swing numbers assume a rope that stays taut and no air resistance.");
      groups.push({ id: `pend${b.id}`, title: `Pendulum: ${nameOf(b)}`, rows, notes });
    } else {
      const rest = l.rest ?? L;
      const x0 = L - rest;
      rows.push(row("Stretch at start", x0, "m"));
      rows.push(row("Spring force at start", l.k * x0, "N"));
      rows.push(row("Energy stored in the spring", 0.5 * l.k * x0 * x0, "J"));
      rows.push(row("Period of bouncing", 2 * Math.PI * Math.sqrt(b.mass / l.k), "s", { head: true }));
      const vertical = Math.abs(S.x - b.x) < 0.02 * L;
      if (vertical && g > 0) {
        const xeq = (b.mass * g) / l.k;
        rows.push(row("Rests at a stretch of", xeq, "m", { head: true }));
        rows.push(row("Fastest speed", Math.abs(x0 - xeq) * Math.sqrt(l.k / b.mass), "m/s", { head: true }));
        rows.push(row("Lowest point below the support", rest + xeq + Math.abs(x0 - xeq), "m"));
      }
      if ((l.zeta ?? 0.5) > 0) notes.push("Damping is on, so the bouncing dies away. Set the damping ratio to 0 to keep it going.");
      groups.push({ id: `spr${b.id}`, title: `Spring: ${nameOf(b)}`, rows, notes });
    }
    shown.add(b.id);
  }

  // whole-system energy
  const springs = scene.items.filter((l) => l.type === "line" && l.style === "spring");
  const springE = (list) => list.reduce((s, l) => s + 0.5 * (l.k ?? 200) * ((l.spring ? l.spring.extension : dist(l.a, l.b) - (l.rest ?? dist(l.a, l.b))) ** 2), 0);
  const E0 = bodies.reduce((s, b) => s + 0.5 * b.mass * (b.speed0 || 0) ** 2 + pe(b), 0) + springE(springs);
  const rows = [];
  const notes = [];
  for (const b of bodies) {
    if (ctx.tied.has(b.id)) continue;
    const h = level(b);
    rows.push(row(`${nameOf(b)} height above ground`, h, "m"));
    rows.push(row(`${nameOf(b)} potential energy`, pe(b), "J"));
    if ((b.speed0 || 0) > 0) rows.push(row(`${nameOf(b)} kinetic energy`, 0.5 * b.mass * b.speed0 ** 2, "J"));
    if (ref != null && h >= 0 && g > 0) rows.push(row(`${nameOf(b)} speed reaching the ground`, Math.sqrt((b.speed0 || 0) ** 2 + 2 * g * h), "m/s", { head: true }));
  }
  rows.push(row("Total mechanical energy at start", E0, "J", { head: true }));
  const live = bodies.map((b) => liveOf(b.id)).filter((b) => b && b.sim);
  if (live.length && live.length === bodies.length) {
    const now = live.reduce((s, b) => s + 0.5 * b.mass * (b.sim.vx ** 2 + b.sim.vy ** 2) + pe(b), 0) + springE(ctx.liveSprings);
    rows.push(row("Kinetic energy now", live.reduce((s, b) => s + 0.5 * b.mass * (b.sim.vx ** 2 + b.sim.vy ** 2), 0), "J", { live: true }));
    rows.push(row("Potential energy now", live.reduce((s, b) => s + pe(b), 0), "J", { live: true }));
    rows.push(row("Total now", now, "J", { live: true, head: true }));
    rows.push(row("Lost since the start", E0 - now, "J", { live: true }));
    notes.push("Energy is lost to friction, air resistance and bounces that are not perfectly elastic.");
  }
  if (bodies.length) groups.push({ id: "energy", title: "Energy", rows, notes });
  return groups;
}

const rnd = (n) => Math.round(n * 100) / 100;

const BY_TOPIC = {
  projectile: [projectile],
  dynamics: [dynamics],
  collisions: [collisions],
  statics: [particle, beams],
  energy: [energy],
  sandbox: [projectile, dynamics, particle, beams],
};

export function analyze(scene, g, env, topic, live) {
  const liveItems = live ? new Map(live.items.map((i) => [i.id, i])) : null;
  const ctx = {
    scene,
    g,
    env,
    tied: tiedSet(scene),
    paths: [],
    marks: [],
    liveOf: (id) => (liveItems ? liveItems.get(id) : null),
    liveSprings: live ? live.items.filter((l) => l.type === "line" && l.style === "spring") : [],
  };
  const groups = [];
  for (const fn of BY_TOPIC[topic] || BY_TOPIC.sandbox) groups.push(...fn(ctx));
  const shown = groups.filter((gr) => gr.rows.length || gr.notes.length);
  return { groups: shown, paths: ctx.paths, marks: ctx.marks };
}
