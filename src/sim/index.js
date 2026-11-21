// The simulation. It turns the drawing into a physics world (Planck.js, a Box2D engine),
// runs it, and hands back a copy of the drawing with everything moved to where it is now.
//
// Item types describe their own physics with two optional functions:
//   physics(item)            -> { kind: "dynamic" | "static", x, y, angle, shape, mass, friction, torque, spin }
//   writeBack(item, pose)    -> the item moved to pose { x, y, angle, vx, vy, omega, dx, dy, maxY }
// shape is { kind: "box", w, h } | { kind: "circle", r } | { kind: "polygon", pts } | { kind: "edge", a, b }
//
// Connections are worked out here:
//   rope      cannot stretch. Its length is the distance between its ends when you press Play.
//   rod       rigid, pushes and pulls
//   spring    elastic (Hooke's law), with damping so it settles
//   force     a line starting on an object, pushing along its direction
//   pin       holds an object at a point but lets it turn
//   roller    holds an object at a point against up/down movement only
// Line ends that meet each other with no object between them become a small junction (a knot).
import { World, Vec2, Box, Circle, Polygon, Edge, RopeJoint, DistanceJoint, RevoluteJoint } from "planck";
import * as Planck from "planck";
import { itemType } from "../core/itemTypes.js";
import { dist } from "../core/geometry.js";
import { worldOfLocal } from "../core/joins.js";
import { newEnv } from "../core/env.js";

const DT = 1 / 120; // fixed time step in seconds
const VEL_ITERS = 40; // more iterations = steadier ropes and joints
const POS_ITERS = 20;
const ATTACH_TOL = 0.05; // metres
const ROLLER_REACH = 100; // a roller is a very long vertical rod, so it only holds up/down
const BIG = 500;
const TRAIL_EVERY = 4; // steps between trail points
const TRAIL_MAX = 1500;
const deg = (r) => (r * 180) / Math.PI;

function areaOf(shape) {
  if (shape.kind === "box") return shape.w * shape.h;
  if (shape.kind === "circle") return Math.PI * shape.r * shape.r;
  let a = 0;
  const p = shape.pts;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return Math.abs(a) / 2;
}

function planckShape(s) {
  if (s.kind === "box") return new Box(s.w / 2, s.h / 2);
  if (s.kind === "circle") return new Circle(s.r);
  if (s.kind === "edge") return new Edge(new Vec2(s.a.x, s.a.y), new Vec2(s.b.x, s.b.y));
  return new Polygon(s.pts.map((p) => new Vec2(p.x, p.y)));
}

// Collision groups. The room is its own group, so an object set to "not solid" still stops at the
// ground and walls even though it passes through other objects.
const THING = 0x0001;
const ROOM = 0x0002;

const CONNECTORS = new Set(["rope", "rod", "spring"]);

// The physics engine ignores bounces slower than 1 m/s, so slow collisions went dead. Lower that limit
// (a little for things under gravity, which would otherwise jitter, and almost to zero when there is no gravity).
function setBounceThreshold(v) {
  try {
    const key = "Settings";
    const S = Planck[key];
    if (S && typeof S === "object") S.velocityThreshold = v;
  } catch {
    // the default limit is fine
  }
}

export function createSim(scene, gravity, envIn) {
  const env = envIn || newEnv();
  setBounceThreshold(gravity > 0 ? 0.25 : 0.02);
  const world = new World({ gravity: new Vec2(0, -gravity) });
  const ground = world.createBody();
  const recs = new Map(); // item id -> { body, item, kind, torque, trail, maxY, x0, y0 }
  const byId = new Map(scene.items.map((i) => [i.id, i]));
  const warnings = [];
  let acc = 0;
  let time = 0;
  let stepCount = 0;

  // ----- ground and limits -----
  const frictionless = env.friction && env.friction.on === false; // every surface is smooth
  const edge = (a, b, friction, restitution) =>
    ground.createFixture({ shape: new Edge(new Vec2(a.x, a.y), new Vec2(b.x, b.y)), friction: frictionless ? 0 : friction, restitution, filterCategoryBits: ROOM });
  if (env.ground.on) edge({ x: -BIG, y: env.ground.y }, { x: BIG, y: env.ground.y }, env.ground.friction, env.ground.bounce);
  if (env.ceiling.on) edge({ x: -BIG, y: env.ceiling.y }, { x: BIG, y: env.ceiling.y }, 0.3, env.ceiling.bounce);
  if (env.left.on) edge({ x: env.left.x, y: -BIG }, { x: env.left.x, y: BIG }, 0.3, env.left.bounce ?? 0.2);
  if (env.right.on) edge({ x: env.right.x, y: -BIG }, { x: env.right.x, y: BIG }, 0.3, env.right.bounce ?? 0.2);

  // ----- bodies -----
  for (const it of scene.items) {
    const def = itemType(it.type);
    const ph = def.physics && def.physics(it);
    if (!ph) continue;
    const body = world.createBody({
      type: ph.kind,
      position: new Vec2(ph.x, ph.y),
      angle: ph.angle || 0,
      angularVelocity: ph.spin || 0,
      fixedRotation: ph.kind === "dynamic" && Boolean(it.lockRotation), // carts and pucks stay upright
    });
    body.createFixture({
      shape: planckShape(ph.shape),
      density: ph.kind === "dynamic" ? Math.max(0.0001, ph.mass) / areaOf(ph.shape) : 0,
      friction: frictionless ? 0 : ph.friction ?? 0.4,
      restitution: it.bounce ?? 0,
      filterCategoryBits: THING,
      filterMaskBits: it.solid === false ? ROOM : 0xffff, // not solid: passes through other objects, but not the room
    });
    if (ph.kind === "dynamic" && it.speed0 > 0) {
      const a = ((it.angle0 || 0) * Math.PI) / 180;
      body.setLinearVelocity(new Vec2(it.speed0 * Math.cos(a), it.speed0 * Math.sin(a)));
    }
    recs.set(it.id, { body, item: it, kind: ph.kind, torque: ph.torque || 0, trail: [], maxY: ph.y, x0: ph.x, y0: ph.y });
  }

  // Anything that starts outside a closed room would sit on the wrong side of the walls
  const outside = (x, y) =>
    (env.left.on && x < env.left.x) || (env.right.on && x > env.right.x) ||
    (env.ground.on && y < env.ground.y) || (env.ceiling.on && y > env.ceiling.y);
  for (const rec of recs.values()) {
    if (rec.kind === "dynamic" && outside(rec.x0, rec.y0)) {
      const it = rec.item;
      warnings.push(`${it.label || `${itemType(it.type).title(it)} ${it.id}`} starts outside the room.`);
    }
  }

  // ----- finding what the end of a line is tied to -----
  const groundHold = (p) => ({ body: ground, local: new Vec2(p.x, p.y) });

  // Older or untied ends: look for an object or support at the point
  function attachGeom(p) {
    for (const it of scene.items) {
      if (it.type === "support" && dist(it, p) <= ATTACH_TOL) return groundHold(p);
    }
    let best = null;
    for (const rec of recs.values()) {
      if (rec.kind !== "dynamic") continue;
      for (const sp of itemType(rec.item.type).snapPoints(rec.item)) {
        const d = dist(sp, p);
        if (d <= ATTACH_TOL && (!best || d < best.d)) best = { rec, d, at: sp };
      }
    }
    if (best) return { body: best.rec.body, local: best.rec.body.getLocalPoint(new Vec2(best.at.x, best.at.y)) };
    for (const rec of [...recs.values()].reverse()) {
      if (rec.kind === "dynamic" && itemType(rec.item.type).hitTest(rec.item, p, 0.03)) {
        return { body: rec.body, local: rec.body.getLocalPoint(new Vec2(p.x, p.y)) };
      }
    }
    for (const rec of recs.values()) {
      if (rec.kind !== "static") continue;
      const def = itemType(rec.item.type);
      if (def.hitTest(rec.item, p, 0.03) || def.snapPoints(rec.item).some((sp) => dist(sp, p) <= ATTACH_TOL)) {
        return groundHold(p);
      }
    }
    return null;
  }

  function holdFor(line, end) {
    const rec = line[end === "a" ? "attachA" : "attachB"];
    if (rec) {
      const target = byId.get(rec.id);
      const r = recs.get(rec.id);
      if (target && r && r.kind === "dynamic") return { body: r.body, local: new Vec2(rec.lx, rec.ly) };
      if (target) return groundHold(worldOfLocal(target, { x: rec.lx, y: rec.ly }));
    }
    return attachGeom(line[end]);
  }

  // ----- ropes, rods and springs: collect the ends, then tie free ends that meet into knots -----
  const lines = scene.items.filter((i) => i.type === "line" && CONNECTORS.has(i.style));
  const holds = new Map(); // line id -> { A, B }
  const free = []; // line ends not tied to any object
  for (const it of lines) {
    const A = holdFor(it, "a");
    const B = holdFor(it, "b");
    holds.set(it.id, { A, B });
    if (!A) free.push({ it, end: "a", p: it.a });
    if (!B) free.push({ it, end: "b", p: it.b });
  }
  const knots = [];
  for (const f of free) {
    let k = knots.find((q) => dist(q.p, f.p) <= 0.03);
    if (!k) knots.push((k = { p: f.p, ends: [] }));
    k.ends.push(f);
  }
  for (const k of knots) {
    if (k.ends.length < 2) {
      const f = k.ends[0];
      warnings.push(`${f.it.label || `${f.it.style} ${f.it.id}`}: one end is not on an object or support.`);
      continue;
    }
    const body = world.createBody({ type: "dynamic", position: new Vec2(k.p.x, k.p.y) });
    body.createFixture({ shape: new Circle(0.03), density: 0.01 / (Math.PI * 0.03 * 0.03), filterMaskBits: 0 });
    const hold = { body, local: new Vec2(0, 0) };
    for (const f of k.ends) holds.get(f.it.id)[f.end === "a" ? "A" : "B"] = hold;
  }

  const links = []; // ropes and rods
  const springs = [];
  for (const it of lines) {
    const { A, B } = holds.get(it.id);
    if (!A || !B || (A.body === ground && B.body === ground)) continue;
    const pa = A.body.getWorldPoint(A.local);
    const pb = B.body.getWorldPoint(B.local);
    const length = Math.max(0.01, dist(pa, pb)); // taut from the start: the drawn lengths do not change the answer
    const def = { bodyA: A.body, bodyB: B.body, localAnchorA: A.local, localAnchorB: B.local };
    if (it.style === "rope") {
      links.push({ item: it, A, B, joint: world.createJoint(new RopeJoint({ ...def, maxLength: length })), force: 0 });
    } else if (it.style === "rod") {
      links.push({ item: it, A, B, joint: world.createJoint(new DistanceJoint({ ...def, length, frequencyHz: 0, dampingRatio: 0 })), force: 0 });
    } else {
      springs.push({ item: it, A, B, k: it.k ?? 200, rest: it.rest ?? length, zeta: it.zeta ?? 0.5, length, ext: 0, force: 0 });
    }
  }

  // ----- forces, pins and rollers -----
  const pushes = [];
  const supports = [];
  for (const it of scene.items) {
    if (it.type === "line" && it.style === "force") {
      const A = holdFor(it, "a");
      if (!A || A.body === ground) {
        warnings.push(`Force ${it.id}: it must start on a moving object.`);
        continue;
      }
      const len = dist(it.a, it.b) || 1;
      pushes.push({
        item: it, A, len,
        fx: ((it.b.x - it.a.x) / len) * (it.force ?? 10),
        fy: ((it.b.y - it.a.y) / len) * (it.force ?? 10),
      });
    } else if (it.type === "support" && (it.kind === "pin" || it.kind === "roller")) {
      const target = [...recs.values()]
        .reverse()
        .find((r) => r.kind === "dynamic" && (itemType(r.item.type).hitTest(r.item, it, 0.03) || itemType(r.item.type).snapPoints(r.item).some((sp) => dist(sp, it) <= ATTACH_TOL)));
      if (!target) {
        warnings.push(`${it.kind[0].toUpperCase() + it.kind.slice(1)} ${it.id}: nothing to hold at this point.`);
        continue;
      }
      const local = target.body.getLocalPoint(new Vec2(it.x, it.y));
      const joint =
        it.kind === "pin"
          ? world.createJoint(new RevoluteJoint({ bodyA: ground, bodyB: target.body, localAnchorA: new Vec2(it.x, it.y), localAnchorB: local }))
          : world.createJoint(
              new DistanceJoint({
                bodyA: ground, bodyB: target.body,
                localAnchorA: new Vec2(it.x, it.y - ROLLER_REACH), localAnchorB: local,
                length: ROLLER_REACH, frequencyHz: 0, dampingRatio: 0,
              })
            );
      supports.push({ item: it, joint, fx: 0, fy: 0 });
    }
  }

  // ----- running -----
  const smooth = (old, now) => old * 0.9 + now * 0.1; // steadies the readouts

  function springForces() {
    for (const s of springs) {
      const pa = s.A.body.getWorldPoint(s.A.local);
      const pb = s.B.body.getWorldPoint(s.B.local);
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const L = Math.hypot(dx, dy);
      s.length = L;
      s.ext = L - s.rest;
      if (L < 1e-6) continue;
      const ux = dx / L;
      const uy = dy / L;
      const va = s.A.body.getLinearVelocityFromWorldPoint(pa);
      const vb = s.B.body.getLinearVelocityFromWorldPoint(pb);
      const mA = s.A.body === ground ? Infinity : s.A.body.getMass();
      const mB = s.B.body === ground ? Infinity : s.B.body.getMass();
      const mEff = mA === Infinity ? mB : mB === Infinity ? mA : (mA * mB) / (mA + mB);
      const c = 2 * s.zeta * Math.sqrt(s.k * mEff); // damping so the spring settles
      const f = s.k * s.ext + c * ((vb.x - va.x) * ux + (vb.y - va.y) * uy);
      s.force = s.k * s.ext;
      if (s.A.body !== ground) s.A.body.applyForce(new Vec2(f * ux, f * uy), pa, true);
      if (s.B.body !== ground) s.B.body.applyForce(new Vec2(-f * ux, -f * uy), pb, true);
    }
  }

  function stepOnce() {
    for (const rec of recs.values()) {
      if (rec.kind !== "dynamic") continue;
      if (rec.torque) rec.body.applyTorque(rec.torque, true);
      if (env.air.on) {
        const v = rec.body.getLinearVelocity();
        rec.body.applyForce(new Vec2(-env.air.k * v.x, -env.air.k * v.y), rec.body.getPosition(), true);
        rec.body.applyTorque(-env.air.k * 0.3 * rec.body.getAngularVelocity(), true);
      }
    }
    for (const f of pushes) f.A.body.applyForce(new Vec2(f.fx, f.fy), f.A.body.getWorldPoint(f.A.local), true);
    springForces();
    world.step(DT, VEL_ITERS, POS_ITERS);
    time += DT;
    stepCount += 1;
    const inv = 1 / DT;
    for (const l of links) {
      const r = l.joint.getReactionForce(inv);
      l.force = smooth(l.force, Math.hypot(r.x, r.y));
    }
    for (const s of supports) {
      const r = s.joint.getReactionForce(inv);
      s.fx = smooth(s.fx, r.x);
      s.fy = smooth(s.fy, r.y);
    }
    for (const rec of recs.values()) {
      if (rec.kind !== "dynamic") continue;
      const p = rec.body.getPosition();
      if (p.y > rec.maxY) rec.maxY = p.y;
      if (stepCount % TRAIL_EVERY === 0 && rec.trail.length < TRAIL_MAX && rec.item.type !== "ring") rec.trail.push({ x: p.x, y: p.y });
    }
  }

  const world2 = (hold) => {
    const p = hold.body.getWorldPoint(hold.local);
    return { x: p.x, y: p.y };
  };

  return {
    warnings,
    get time() {
      return time;
    },

    // Advance by real elapsed seconds, in fixed steps
    advance(seconds) {
      acc += Math.min(seconds, 0.1);
      while (acc >= DT) {
        stepOnce();
        acc -= DT;
      }
    },

    // A copy of the drawing with everything where the simulation has put it
    snapshot() {
      const linkOf = new Map(links.map((l) => [l.item.id, l]));
      const springOf = new Map(springs.map((s) => [s.item.id, s]));
      const pushOf = new Map(pushes.map((f) => [f.item.id, f]));
      const supOf = new Map(supports.map((s) => [s.item.id, s]));
      const trails = {};
      const items = scene.items.map((it) => {
        const rec = recs.get(it.id);
        if (rec && rec.kind === "dynamic") {
          const p = rec.body.getPosition();
          const v = rec.body.getLinearVelocity();
          if (rec.trail.length) trails[it.id] = rec.trail;
          return itemType(it.type).writeBack(it, {
            x: p.x, y: p.y, angle: deg(rec.body.getAngle()),
            vx: v.x, vy: v.y, omega: rec.body.getAngularVelocity(),
            dx: p.x - rec.x0, dy: p.y - rec.y0, maxY: rec.maxY,
          });
        }
        const l = linkOf.get(it.id);
        if (l) return { ...it, a: world2(l.A), b: world2(l.B), tension: l.force };
        const sp = springOf.get(it.id);
        if (sp) {
          return {
            ...it,
            a: world2(sp.A),
            b: world2(sp.B),
            spring: { length: sp.length, extension: sp.ext, force: sp.force, rest: sp.rest },
          };
        }
        const f = pushOf.get(it.id);
        if (f) {
          const a = world2(f.A);
          return { ...it, a, b: { x: a.x + (f.fx / (it.force || 1)) * f.len, y: a.y + (f.fy / (it.force || 1)) * f.len } };
        }
        const s = supOf.get(it.id);
        if (s) return { ...it, reaction: { x: s.fx, y: s.fy } };
        return it;
      });
      return { ...scene, items, trails };
    },
  };
}