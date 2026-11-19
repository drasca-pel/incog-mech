// Objects: block, ball, bob, beam, wheel, ring, ramp, wall and supports (anchor, pin, roller).
// Each one registers how it is drawn, hit, snapped to, edited and simulated.
// The "place" behaviour means: click to put the object where you click.
//
// physics(item)  tells the simulation what the object is made of.
// writeBack()    moves the object to where the simulation has put it.
import { registerItemType } from "../../core/itemTypes.js";
import { updateItem } from "../../core/scene.js";
import { dist, angleBetween, rotatePoint, pointInPolygon, pointAt, distToSegment } from "../../core/geometry.js";
const MONO = '"Cascadia Mono", Consolas, monospace';
const round2 = (n) => Math.round(n * 100) / 100;
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// ----- shared helpers -----
const toWorld = (it, pts) =>
  pts.map((p) => {
    const r = rotatePoint(p, it.rotation || 0);
    return { x: it.x + r.x, y: it.y + r.y };
  });

const rectLocal = (w, h) => [
  { x: -w / 2, y: -h / 2 },
  { x: w / 2, y: -h / 2 },
  { x: w / 2, y: h / 2 },
  { x: -w / 2, y: h / 2 },
];

function paintPoly(g, pts, selected, fill) {
  const { ctx } = g;
  const s = pts.map(g.toScreen);
  ctx.beginPath();
  s.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.strokeStyle = selected ? "#f5b83d" : "rgba(255,255,255,.4)";
  ctx.stroke();
  return s;
}

function text(ctx, str, x, y, color = "rgba(255,255,255,.95)") {
  ctx.fillStyle = color;
  ctx.font = `600 12px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(str, x, y);
  ctx.textBaseline = "alphabetic";
}

// Mass in the middle, label above
function caption(g, it, screenPts, centre) {
  const c = g.toScreen(centre);
  if (it.mass != null) text(g.ctx, `${round2(it.mass)} kg`, c.x, c.y);
  if (it.label) {
    const top = Math.min(...screenPts.map((p) => p.y));
    text(g.ctx, it.label, c.x, top - 12, "#e6ebf5");
  }
}

const prop = (id, label, kind, value, set, extra = {}) => ({ id, label, kind, value, set, ...extra });
const numP = (id, label, unit, value, set) => prop(id, label, "number", value, set, { unit });
const readout = (id, label, unit, value) => ({ id, label, unit, kind: "readout", value });
const massP = (it) => numP("mass", "Mass", "kg", it.mass, (i, v) => ({ ...i, mass: Math.max(0.001, v) }));
const frictionP = (it) =>
  numP("friction", "Friction μ", "", it.friction ?? 0.4, (i, v) => ({ ...i, friction: Math.max(0, v) }));
const common = (it, withRotation = true) => [
  prop("label", "Label", "text", it.label || "", (i, v) => ({ ...i, label: v })),
  numP("x", "Position x", "m", it.x, (i, v) => ({ ...i, x: v })),
  numP("y", "Position y", "m", it.y, (i, v) => ({ ...i, y: v })),
  ...(withRotation ? [numP("rotation", "Rotation", "°", it.rotation || 0, (i, v) => ({ ...i, rotation: v }))] : []),
];

// Live values, only present while the simulation is running
const simProps = (it, withSpin = false) =>
  it.sim
    ? [
        readout("speed", "Speed", "m/s", Math.hypot(it.sim.vx, it.sim.vy)),
        readout("vx", "Velocity x", "m/s", it.sim.vx),
        readout("vy", "Velocity y", "m/s", it.sim.vy),
                readout("dx", "Moved right", "m", it.sim.dx),
        readout("dy", "Moved up", "m", it.sim.dy),
        readout("maxY", "Highest point", "m", it.sim.maxY),
        ...(withSpin ? [readout("omega", "Angular speed", "rad/s", it.sim.omega)] : []),
      ]
    : [];

const movable = {
  handles: () => [],
  moveHandle: (it) => it,
  moveBy: (it, dx, dy) => ({ ...it, x: it.x + dx, y: it.y + dy }),
};

// How a dynamic object is moved by the simulation
const poseTo = (withRotation) => (it, pose) => ({
  ...it,
  x: pose.x,
  y: pose.y,
  ...(withRotation ? { rotation: pose.angle } : {}),
    sim: { vx: pose.vx, vy: pose.vy, omega: pose.omega, dx: pose.dx, dy: pose.dy, maxY: pose.maxY },
});

const dyn = (it, shape, extra = {}) => ({
  kind: "dynamic",
  x: it.x,
  y: it.y,
  angle: rad(it.rotation || 0),
  shape,
  mass: it.mass,
  friction: it.friction ?? 0.4,
  ...extra,
});

// ----- block -----
export const blockPts = (it) => toWorld(it, rectLocal(it.w, it.h));

// "Align to slope": turn the block to match the nearest ramp slope or wall, and rest it on the open side
function alignOnSurface(scene, it) {
  let best = null;
  for (const o of scene.items) {
    let a;
    let b;
    let n = null; // the open side: where the block should sit
    if (o.type === "ramp") {
      const p = rampPts(o);
      [a, b] = [p[0], p[2]];
      const t = angleBetween(a, b);
      const left = { x: -Math.sin(rad(t)), y: Math.cos(rad(t)) };
      // the open side is away from the right-angle corner
      n = (p[1].x - a.x) * left.x + (p[1].y - a.y) * left.y > 0 ? { x: -left.x, y: -left.y } : left;
    } else if (o.type === "wall") {
      [a, b] = wallEnds(o);
      const t = angleBetween(a, b);
      const left = { x: -Math.sin(rad(t)), y: Math.cos(rad(t)) };
      n = o.side === "left" ? { x: -left.x, y: -left.y } : left; // the hatched side is solid
    } else {
      continue;
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((it.x - a.x) * dx + (it.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const c = { x: a.x + t * dx, y: a.y + t * dy };
    const d = dist(c, it);
    if (!best || d < best.d) best = { c, n, d };
  }
  if (!best) return null;
  const lift = it.h / 2 + 0.005;
  const rotation = (deg(Math.atan2(best.n.y, best.n.x)) - 90 + 360) % 360;
  return { ...it, rotation, x: best.c.x + best.n.x * lift, y: best.c.y + best.n.y * lift };
}

registerItemType("block", {
  title: () => "Block",
  draw(g, it, selected) {
    const s = paintPoly(g, blockPts(it), selected, "rgba(79,120,214,.88)");
    caption(g, it, s, it);
  },
  hitTest: (it, p) => pointInPolygon(p, blockPts(it)),
  snapPoints(it) {
    const c = blockPts(it);
    return [...c, mid(c[0], c[1]), mid(c[1], c[2]), mid(c[2], c[3]), mid(c[3], c[0]), { x: it.x, y: it.y }];
  },
  properties: (it) => [
    massP(it),
    numP("w", "Width", "m", it.w, (i, v) => ({ ...i, w: Math.max(0.01, v) })),
    numP("h", "Height", "m", it.h, (i, v) => ({ ...i, h: Math.max(0.01, v) })),
    frictionP(it),
    ...common(it),
    { id: "align", label: "Align to slope", kind: "button" },
    ...simProps(it, true),
  ],
  apply(scene, it, propId) {
    if (propId !== "align") return null;
    const moved = alignOnSurface(scene, it);
    return moved ? updateItem(scene, it.id, () => moved) : scene;
  },
  physics: (it) => dyn(it, { kind: "box", w: it.w, h: it.h }),
  writeBack: poseTo(true),
  ...movable,
});

// ----- ball and bob (a bob is a ball with a hook on top for a rope) -----
const HOOK = 0.07; // metres above the top of a bob
const ballDef = {
  title: () => "Ball",
  draw(g, it, selected) {
    const { ctx } = g;
    const c = g.toScreen(it);
    ctx.beginPath();
    ctx.arc(c.x, c.y, it.radius * g.scale, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(79,120,214,.88)";
    ctx.fill();
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? "#f5b83d" : "rgba(255,255,255,.4)";
    ctx.stroke();
    caption(g, it, [{ x: c.x, y: c.y - it.radius * g.scale }], it);
  },
  hitTest: (it, p) => dist(it, p) <= it.radius,
  snapPoints: (it) => [
    { x: it.x, y: it.y },
    { x: it.x + it.radius, y: it.y },
    { x: it.x - it.radius, y: it.y },
    { x: it.x, y: it.y + it.radius },
    { x: it.x, y: it.y - it.radius },
  ],
  properties: (it) => [
    massP(it),
    numP("radius", "Radius", "m", it.radius, (i, v) => ({ ...i, radius: Math.max(0.01, v) })),
    frictionP(it),
    ...common(it, false),
    ...simProps(it),
  ],
  physics: (it) => dyn(it, { kind: "circle", r: it.radius }, { angle: 0 }),
  writeBack: poseTo(false),
  ...movable,
};
registerItemType("ball", ballDef);

registerItemType("bob", {
  ...ballDef,
  title: () => "Bob",
  draw(g, it, selected) {
    ballDef.draw(g, it, selected);
    // the hook: a small ring above the bob
    const { ctx } = g;
    const top = g.toScreen({ x: it.x, y: it.y + it.radius });
    const hook = g.toScreen({ x: it.x, y: it.y + it.radius + HOOK });
    ctx.beginPath();
    ctx.arc(hook.x, hook.y, Math.max(4, (hook.y - top.y) * -0.5), 0, Math.PI * 2);
    ctx.strokeStyle = "#e6ebf5";
    ctx.lineWidth = 2;
    ctx.stroke();
  },
  snapPoints: (it) => [{ x: it.x, y: it.y + it.radius + HOOK }, ...ballDef.snapPoints(it)],
});

// ----- beam -----
const beamPts = (it) => toWorld(it, rectLocal(it.length, it.thickness));
registerItemType("beam", {
  title: () => "Beam",
    hookDefault: false, // loads and ropes act where you put them on a beam, not at its centre
  draw(g, it, selected) {
    const s = paintPoly(g, beamPts(it), selected, "rgba(176,140,100,.92)");
    caption(g, it, s, it);
  },
  hitTest: (it, p) => pointInPolygon(p, beamPts(it)),
  snapPoints(it) {
    const [l, r] = toWorld(it, [{ x: -it.length / 2, y: 0 }, { x: it.length / 2, y: 0 }]);
    return [l, r, { x: it.x, y: it.y }, ...beamPts(it)];
  },
  properties: (it) => [
    massP(it),
    numP("length", "Length", "m", it.length, (i, v) => ({ ...i, length: Math.max(0.01, v) })),
    numP("thickness", "Thickness", "m", it.thickness, (i, v) => ({ ...i, thickness: Math.max(0.01, v) })),
    frictionP(it),
    ...common(it),
    ...simProps(it, true),
  ],
  physics: (it) => dyn(it, { kind: "box", w: it.length, h: it.thickness }),
  writeBack: poseTo(true),
  ...movable,
});

// ----- wheel: turns about its centre. Pin it at the centre to make a fixed axle. -----
registerItemType("wheel", {
  title: () => "Wheel",
  draw(g, it, selected) {
    const { ctx } = g;
    const c = g.toScreen(it);
    const r = it.radius * g.scale;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(79,120,214,.7)";
    ctx.fill();
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? "#f5b83d" : "rgba(255,255,255,.45)";
    ctx.stroke();
    // spokes turn with the wheel so you can see it rotate
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const a = -rad((it.rotation || 0) + k * 90);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#e6ebf5";
    ctx.fill();
    if (it.label) text(ctx, it.label, c.x, c.y - r - 12, "#e6ebf5");
    text(ctx, `${round2(it.mass)} kg`, c.x, c.y + r + 14, "rgba(255,255,255,.8)");
    if (it.torque) text(ctx, `τ ${round2(it.torque)} N·m`, c.x, c.y + r + 30, "#f5b83d");
  },
  hitTest: (it, p) => dist(it, p) <= it.radius,
  snapPoints: (it) => {
    const rim = [0, 90, 180, 270].map((a) => pointAt({ x: it.x, y: it.y }, it.radius, a + (it.rotation || 0)));
    return [{ x: it.x, y: it.y }, ...rim];
  },
  properties: (it) => [
    massP(it),
    numP("radius", "Radius", "m", it.radius, (i, v) => ({ ...i, radius: Math.max(0.01, v) })),
    numP("torque", "Torque", "N·m", it.torque || 0, (i, v) => ({ ...i, torque: v })),
    numP("spin", "Starting spin", "rad/s", it.spin || 0, (i, v) => ({ ...i, spin: v })),
    frictionP(it),
    ...common(it),
    ...simProps(it, true),
  ],
  physics: (it) => dyn(it, { kind: "circle", r: it.radius }, { torque: it.torque || 0, spin: it.spin || 0 }),
  writeBack: poseTo(true),
  ...movable,
});

// ----- ring (a junction where ropes meet) -----
registerItemType("ring", {
  title: () => "Ring",
  draw(g, it, selected) {
    const { ctx } = g;
    const c = g.toScreen(it);
    ctx.beginPath();
    ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#0e1424";
    ctx.fill();
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? "#f5b83d" : "#e6ebf5";
    ctx.stroke();
    if (it.label) text(ctx, it.label, c.x, c.y - 18, "#e6ebf5");
  },
  hitTest: (it, p, tol) => dist(it, p) <= tol * 1.6,
  snapPoints: (it) => [{ x: it.x, y: it.y }],
  properties: (it) => [
    numP("mass", "Mass", "kg", it.mass ?? 0.05, (i, v) => ({ ...i, mass: Math.max(0.001, v) })),
    ...common(it, false),
    ...simProps(it),
  ],
  physics: (it) => dyn(it, { kind: "circle", r: 0.05 }, { mass: it.mass ?? 0.05, angle: 0 }),
  writeBack: poseTo(false),
  ...movable,
});

// ----- ramp: a right-angled triangle -----
// x, y is the bottom corner of the base. angle is the sloping angle at the bottom of the slope.
// facing "left": the slope looks up and to the left. facing "right": the mirror image.
const rampLocal = (it) => {
  const h = it.base * Math.tan(rad(it.angle));
  return it.facing === "left"
    ? [{ x: 0, y: 0 }, { x: it.base, y: 0 }, { x: it.base, y: h }]
    : [{ x: it.base, y: 0 }, { x: 0, y: 0 }, { x: 0, y: h }];
};
export const rampPts = (it) => toWorld(it, rampLocal(it));
registerItemType("ramp", {
  title: () => "Ramp",
  draw(g, it, selected) {
    const { ctx } = g;
    const pts = rampPts(it); // [toe, right-angle corner, top]
    const s = paintPoly(g, pts, selected, "rgba(120,140,180,.32)");

    // little square at the right-angle corner
    const k = 12;
    const c = s[1];
    const u = { x: s[0].x - c.x, y: s[0].y - c.y };
    const v = { x: s[2].x - c.x, y: s[2].y - c.y };
    const ul = Math.hypot(u.x, u.y) || 1;
    const vl = Math.hypot(v.x, v.y) || 1;
    ctx.beginPath();
    ctx.moveTo(c.x + (u.x / ul) * k, c.y + (u.y / ul) * k);
    ctx.lineTo(c.x + (u.x / ul + v.x / vl) * k, c.y + (u.y / ul + v.y / vl) * k);
    ctx.lineTo(c.x + (v.x / vl) * k, c.y + (v.y / vl) * k);
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // slope angle near the toe
    const toe = pts[0];
    const centroid = { x: (pts[0].x + pts[1].x + pts[2].x) / 3, y: (pts[0].y + pts[1].y + pts[2].y) / 3 };
    const t = g.toScreen({ x: toe.x + (centroid.x - toe.x) * 0.42, y: toe.y + (centroid.y - toe.y) * 0.42 });
    text(ctx, `${round2(it.angle)}°`, t.x, t.y, "#f5b83d");
    if (it.label) text(ctx, it.label, (s[0].x + s[1].x + s[2].x) / 3, Math.min(...s.map((p) => p.y)) - 12, "#e6ebf5");
  },
  hitTest: (it, p) => pointInPolygon(p, rampPts(it)),
  snapPoints(it) {
    const [a, b, c] = rampPts(it);
    return [a, b, c, mid(a, b), mid(b, c), mid(a, c)];
  },
  properties: (it) => [
    numP("angle", "Angle (slope)", "°", it.angle, (i, v) => ({ ...i, angle: Math.min(89, Math.max(1, v)) })),
    numP("base", "Base", "m", it.base, (i, v) => ({ ...i, base: Math.max(0.01, v) })),
    numP("height", "Height", "m", it.base * Math.tan(rad(it.angle)), (i, v) => ({
      ...i,
      angle: Math.min(89, Math.max(1, deg(Math.atan2(Math.max(0.001, v), i.base)))),
    })),
    prop("facing", "Direction", "choice", it.facing, (i, v) => ({ ...i, facing: v }), {
      options: [
        { value: "left", label: "Slope faces left" },
        { value: "right", label: "Slope faces right" },
      ],
    }),
    frictionP(it),
    ...common(it),
  ],
  physics: (it) => ({
    kind: "static",
    x: it.x,
    y: it.y,
    angle: rad(it.rotation || 0),
    shape: { kind: "polygon", pts: rampLocal(it) },
    friction: it.friction ?? 0.4,
  }),
  ...movable,
});

// ----- wall: a surface line with hatching on one side. Lay it flat to make a floor. -----
export const wallEnds = (it) => [{ x: it.x, y: it.y }, pointAt({ x: it.x, y: it.y }, it.length, it.rotation)];
registerItemType("wall", {
  title: () => "Wall",
  draw(g, it, selected) {
    const { ctx } = g;
    const [a, b] = wallEnds(it).map(g.toScreen);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const sign = it.side === "left" ? 1 : -1;
    // screen y points down, so the left-hand normal of a world direction flips
    const n = { x: d.y * sign, y: -d.x * sign };

    ctx.save();
    ctx.lineCap = "round";
    if (selected) {
      ctx.strokeStyle = "rgba(245,184,61,.35)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#9aa8c7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(154,168,199,.7)";
    for (let t = 6; t < len; t += 12) {
      const px = a.x + d.x * t;
      const py = a.y + d.y * t;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + n.x * 9 - d.x * 7, py + n.y * 9 - d.y * 7);
      ctx.stroke();
    }
    ctx.restore();
    if (it.label) text(ctx, it.label, (a.x + b.x) / 2 - n.x * 16, (a.y + b.y) / 2 - n.y * 16, "#e6ebf5");
  },
  hitTest(it, p, tol) {
    const [a, b] = wallEnds(it);
    return distToSegment(p, a, b) <= tol;
  },
  snapPoints(it) {
    const [a, b] = wallEnds(it);
    return [a, b, mid(a, b)];
  },
  properties: (it) => [
    numP("length", "Length", "m", it.length, (i, v) => ({ ...i, length: Math.max(0.01, v) })),
    prop("side", "Hatched side", "choice", it.side, (i, v) => ({ ...i, side: v }), {
      options: [
        { value: "left", label: "Left of the direction" },
        { value: "right", label: "Right of the direction" },
      ],
    }),
    frictionP(it),
    ...common(it),
  ],
  physics(it) {
    const [a, b] = wallEnds(it);
    return { kind: "static", x: 0, y: 0, angle: 0, shape: { kind: "edge", a, b }, friction: it.friction ?? 0.4 };
  },
  ...movable,
});

// ----- supports: anchor, pin, roller (x, y is the point the support holds) -----
const r1 = (n) => String(Math.round(n * 10) / 10);
registerItemType("support", {
  title: (it) => it.kind[0].toUpperCase() + it.kind.slice(1),
  draw(g, it, selected) {
    const { ctx } = g;
    const c = g.toScreen(it);
    ctx.save();
    ctx.strokeStyle = "#e6ebf5";
    ctx.fillStyle = "#0e1424";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    if (selected) {
      ctx.strokeStyle = "rgba(245,184,61,.35)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = "#e6ebf5";
      ctx.lineWidth = 2;
    }
    const hatch = (x, y, w, dir) => {
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
      ctx.lineWidth = 1.2;
      for (let hx = x - w + 4; hx < x + w; hx += 8) {
        ctx.beginPath();
        ctx.moveTo(hx, y);
        ctx.lineTo(hx - 5, y + dir * 7);
        ctx.stroke();
      }
      ctx.lineWidth = 2;
    };
    if (it.kind === "anchor") {
      hatch(c.x, c.y - 16, 16, -1);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 16);
      ctx.lineTo(c.x, c.y - 5);
      ctx.stroke();
    } else if (it.kind === "pin") {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x - 12, c.y + 20);
      ctx.lineTo(c.x + 12, c.y + 20);
      ctx.closePath();
      ctx.stroke();
      hatch(c.x, c.y + 20, 18, 1);
    } else {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x - 11, c.y + 14);
      ctx.lineTo(c.x + 11, c.y + 14);
      ctx.closePath();
      ctx.stroke();
      for (const dx of [-6, 6]) {
        ctx.beginPath();
        ctx.arc(c.x + dx, c.y + 18, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      hatch(c.x, c.y + 22, 18, 1);
    }
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (it.label) text(ctx, it.label, c.x, c.y - 30, "#e6ebf5");
    // reaction force from the simulation
    if (it.reaction) {
      const { x, y } = it.reaction;
      const str = it.kind === "pin" ? `Rx ${r1(x)}  Ry ${r1(y)} N` : `R ${r1(Math.hypot(x, y))} N`;
      text(ctx, str, c.x, c.y + 44, "#5ad1a0");
    }
  },
  hitTest: (it, p, tol) => dist(it, p) <= tol * 2.6,
  snapPoints: (it) => [{ x: it.x, y: it.y }],
  properties: (it) => [
    prop("kind", "Support type", "choice", it.kind, (i, v) => ({ ...i, kind: v }), {
      options: [
        { value: "anchor", label: "Anchor (fixed point)" },
        { value: "pin", label: "Pin" },
        { value: "roller", label: "Roller" },
      ],
    }),
    ...common(it, false),
    ...(it.reaction
      ? [
          readout("rx", "Reaction x", "N", it.reaction.x),
          readout("ry", "Reaction y", "N", it.reaction.y),
          readout("r", "Reaction", "N", Math.hypot(it.reaction.x, it.reaction.y)),
        ]
      : []),
  ],
  ...movable,
});

// ----- tools -----
const place = (id, name, group, create) => ({
  id,
  name,
  icon: id,
  tab: "Objects",
  group,
  kind: "tool",
  ready: true,
  prompt: `${name}: click to place it. Enter finishes.`,
  behavior: { kind: "place", create },
});

const support = (kind) => (p) => ({ type: "support", kind, x: p.x, y: p.y, label: "" });

export const objectTools = [
  place("block", "Block", "Bodies", (p) => ({ type: "block", x: p.x, y: p.y, w: 1.2, h: 0.8, mass: 5, friction: 0.4, rotation: 0, label: "" })),
  place("ball", "Ball", "Bodies", (p) => ({ type: "ball", x: p.x, y: p.y, radius: 0.4, mass: 2, friction: 0.4, label: "" })),
  place("bob", "Bob", "Bodies", (p) => ({ type: "bob", x: p.x, y: p.y, radius: 0.3, mass: 5, friction: 0.4, label: "" })),
  place("beam", "Beam", "Bodies", (p) => ({ type: "beam", x: p.x, y: p.y, length: 4, thickness: 0.2, mass: 10, friction: 0.4, rotation: 0, label: "" })),
  place("wheel", "Wheel", "Bodies", (p) => ({ type: "wheel", x: p.x, y: p.y, radius: 0.5, mass: 2, torque: 0, spin: 0, friction: 0.6, rotation: 0, label: "" })),
  place("ring", "Ring", "Bodies", (p) => ({ type: "ring", x: p.x, y: p.y, mass: 0.05, label: "" })),
  place("ramp", "Ramp", "Surfaces", (p) => ({ type: "ramp", x: p.x, y: p.y, base: 4, angle: 30, facing: "left", friction: 0.4, rotation: 0, label: "" })),
  place("wall", "Wall", "Surfaces", (p) => ({ type: "wall", x: p.x, y: p.y, length: 3, rotation: 90, side: "left", friction: 0.4, label: "" })),
  place("anchor", "Anchor", "Supports", support("anchor")),
  place("pin", "Pin", "Supports", support("pin")),
  place("roller", "Roller", "Supports", support("roller")),
];