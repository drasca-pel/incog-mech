// Topic tools: ready-made pieces for one kind of problem. They place ordinary objects
// (balls, blocks, ropes, supports) with sensible values, so the same physics runs underneath.
// The launch tools are drawn like a CAD line: click the start, click the aim. The arrow length is the
// speed (1 m = 1 m/s), and you can drag the arrow tip afterwards.
import { registerItemType } from "../../core/itemTypes.js";
import { dist, angleBetween } from "../../core/geometry.js";

const round2 = (n) => Math.round(n * 100) / 100;

// ----- target: a bullseye the predicted path is checked against -----
registerItemType("target", {
  title: () => "Target",
  draw({ ctx, toScreen, scale }, it, selected) {
    const c = toScreen(it);
    const r = it.radius * scale;
    ctx.save();
    [1, 0.66, 0.33].forEach((k, i) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, r * k, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? "#ff8fab" : "#e6ebf5";
      ctx.fill();
    });
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? "#f5b83d" : "rgba(0,0,0,.5)";
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (it.label) {
      ctx.fillStyle = "#e6ebf5";
      ctx.font = '600 12px "Cascadia Mono", Consolas, monospace';
      ctx.textAlign = "center";
      ctx.fillText(it.label, c.x, c.y - r - 8);
    }
    ctx.restore();
  },
  hitTest: (it, p, tol) => dist(it, p) <= it.radius + tol,
  handles: () => [],
  moveHandle: (it) => it,
  moveBy: (it, dx, dy) => ({ ...it, x: it.x + dx, y: it.y + dy }),
  snapPoints: (it) => [{ x: it.x, y: it.y }],
  properties: (it) => [
    { id: "label", label: "Label", kind: "text", value: it.label || "", set: (i, v) => ({ ...i, label: v }) },
    { id: "radius", label: "Radius", unit: "m", kind: "number", value: it.radius, set: (i, v) => ({ ...i, radius: Math.max(0.05, v) }) },
    { id: "x", label: "Position x", unit: "m", kind: "number", value: it.x, set: (i, v) => ({ ...i, x: v }) },
    { id: "y", label: "Position y", unit: "m", kind: "number", value: it.y, set: (i, v) => ({ ...i, y: v }) },
  ],
});

// ----- helpers -----
const groundY = (ctx, fallback) => (ctx && ctx.env && ctx.env.ground && ctx.env.ground.on ? ctx.env.ground.y : fallback);
const block = (x, y, over = {}) => ({ type: "block", x, y, w: 1.2, h: 0.8, mass: 5, friction: 0.4, rotation: 0, label: "", ...over });
const rope = (a, b, label = "") => ({ type: "line", style: "rope", pattern: "solid", a, b, label });
const support = (kind, p) => ({ type: "support", kind, x: p.x, y: p.y, label: "" });
// A wall to mount things on: from (x, y), length metres at rotation degrees. The hatching is on its "left" or "right" side.
const mount = (x, y, length, rotation, side) => ({ type: "wall", x, y, length, rotation, side, friction: 0.4, label: "" });

const tool = (id, name, topic, group, behavior, prompt) => ({
  id, name, icon: id, tab: "Topic", topic, group, kind: "tool", ready: true, prompt, behavior,
});
const place = (id, name, topic, group, create, prompt) => tool(id, name, topic, group, { kind: "place", create }, prompt);
const aim = (id, name, topic, group, create, prompt) => tool(id, name, topic, group, { kind: "twoPoint", create }, prompt);

const AIM = "click where it starts, then click where it is aimed. Arrow length = speed (1 m = 1 m/s). Type a number for an exact speed. Shift locks 15°.";
const launch = (a, b) => ({ speed0: round2(dist(a, b)), angle0: round2(angleBetween(a, b)) });

export const topicTools = [
  // ---- projectile ----
  aim("launchBall", "Launch ball", "projectile", "Launch", (a, b) => ({ type: "ball", x: a.x, y: a.y, radius: 0.3, mass: 1, friction: 0.4, bounce: 0, label: "", ...launch(a, b) }), `Launch ball: ${AIM} The flight is predicted at once.`),
  aim("launchBlock", "Launch block", "projectile", "Launch", (a, b) => block(a.x, a.y, { w: 0.6, h: 0.6, mass: 2, ...launch(a, b) }), `Launch block: ${AIM}`),
  place("target", "Target", "projectile", "Mark", (p) => ({ type: "target", x: p.x, y: p.y, radius: 0.8, label: "" }), "Target: click to place. The answers say if the flight hits it and which angles would."),
  place("platform", "Platform", "projectile", "Mark", (p) => ({ type: "wall", x: p.x, y: p.y, length: 6, rotation: 0, side: "right", friction: 0.4, label: "" }), "Platform: click where its left end goes. Launch from its top, or land on it."),

  // ---- forces and friction ----
  place("slope", "Block on slope", "dynamics", "Place", (p, ctx) => {
    const gy = groundY(ctx, p.y);
    const angle = 30;
    const base = 5;
    const h = base * Math.tan((angle * Math.PI) / 180);
    const ramp = { type: "ramp", x: p.x, y: gy, base, angle, facing: "left", friction: 0.4, rotation: 0, label: "" };
    const t = 0.6;
    const c = { x: p.x + base * t, y: gy + h * t };
    const th = (angle * Math.PI) / 180;
    const b = block(c.x - Math.sin(th) * 0.405, c.y + Math.cos(th) * 0.405, { rotation: angle });
    return [ramp, b];
  }, "Block on slope: click where the foot of the slope goes. Change the angle and friction, and the answers follow."),
  place("pushed", "Pushed block", "dynamics", "Place", (p, ctx) => {
    const gy = groundY(ctx, p.y - 0.4);
    const b = block(p.x, gy + 0.401, { mass: 10 });
    return [b, { type: "line", style: "force", pattern: "solid", a: { x: b.x, y: b.y }, b: { x: b.x + 1.5, y: b.y }, label: "F", force: 60 }];
  }, "Pushed block: click along the floor. Select the force to change its size or direction."),

  // ---- collisions ----
  ...[
    ["cart", "Cart", 1, "Elastic"],
    ["sticky", "Sticky cart", 0, "Inelastic"],
  ].flatMap(([id, name, e, group]) => [
    aim(id, name, "collisions", group, (a, b) => block(a.x, a.y, { w: 1.2, h: 0.7, mass: 2, bounce: e, friction: 0, lockRotation: true, ...launch(a, b) }), `${name}: ${AIM}`),
    place(`${id}Rest`, `${name} at rest`, "collisions", group, (p) => block(p.x, p.y, { w: 1.2, h: 0.7, mass: 2, bounce: e, friction: 0, lockRotation: true }), `${name} at rest: click to place.`),
  ]),
  aim("puck", "Puck", "collisions", "Pucks", (a, b) => ({ type: "ball", x: a.x, y: a.y, radius: 0.35, mass: 1, friction: 0, bounce: 1, label: "", ...launch(a, b) }), `Puck: ${AIM}`),
  place("puckRest", "Puck at rest", "collisions", "Pucks", (p) => ({ type: "ball", x: p.x, y: p.y, radius: 0.35, mass: 1, friction: 0, bounce: 1, label: "" }), "Puck at rest: click to place."),

  // ---- statics ----
  place("hanging", "Hanging weight", "statics", "Set-ups", (p) => {
    const A = { x: p.x - 3, y: p.y + 2 };
    const B = { x: p.x + 2.5, y: p.y + 3 };
    return [
      mount(A.x, A.y - 1.4, 2.8, 90, "left"), // left wall, hatched on its outer side
      mount(B.x, B.y - 1.4, 2.8, 90, "right"), // right wall
      support("anchor", A), support("anchor", B),
      block(p.x, p.y, { mass: 10, label: "W", lockRotation: true }),
      rope(A, { x: p.x, y: p.y }, "T1"), rope(B, { x: p.x, y: p.y }, "T2"),
    ];
  }, "Hanging weight: click where the weight hangs. It hangs from two walls. Move the anchors or change the mass and the tensions update."),
  place("beamSupports", "Beam on supports", "statics", "Set-ups", (p) => {
    const L = 3;
    return [
      { type: "beam", x: p.x, y: p.y, length: 2 * L, thickness: 0.2, mass: 10, friction: 0.4, rotation: 0, label: "" },
      support("pin", { x: p.x - L, y: p.y }),
      support("roller", { x: p.x + L, y: p.y }),
      { type: "line", style: "force", pattern: "solid", a: { x: p.x + 1, y: p.y }, b: { x: p.x + 1, y: p.y - 1.5 }, label: "P", force: 50 },
    ];
  }, "Beam on supports: click the middle of the beam. Move the load or the supports and read the reactions."),

  // ---- energy ----
  place("pendulum", "Pendulum", "energy", "Set-ups", (p) => {
    const L = 3;
    const th = (40 * Math.PI) / 180;
    const bob = { x: p.x + L * Math.sin(th), y: p.y - L * Math.cos(th) };
    return [mount(p.x - 1.2, p.y, 2.4, 0, "left"), support("anchor", p), { type: "bob", x: bob.x, y: bob.y, radius: 0.3, mass: 2, friction: 0.4, label: "", bounce: 0 }, rope({ x: p.x, y: p.y }, bob)];
  }, "Pendulum: click the pivot. It hangs from a ceiling bar. Drag the bob to change the release angle."),
  place("springMass", "Spring and mass", "energy", "Set-ups", (p) => {
    const c = { x: p.x, y: p.y - 2.5 };
    return [mount(p.x - 1.2, p.y, 2.4, 0, "left"), support("anchor", p), block(c.x, c.y, { w: 0.8, h: 0.6, mass: 2, lockRotation: true }), { type: "line", style: "spring", pattern: "solid", a: { x: p.x, y: p.y }, b: c, label: "", k: 80, rest: 1.5, zeta: 0 }];
  }, "Spring and mass: click the top. The spring starts stretched and bounces without damping."),
];

// Which general tools sit beside each topic's own tools
export const COMMON = {};
