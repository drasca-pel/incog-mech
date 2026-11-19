// Topics: each one sets up the room, the view and gravity for one kind of problem,
// and decides which topic tools appear in the ribbon. The drawing itself is never touched.
// "sandbox" is the free mode: the standard room and every general tool.
import { newEnv } from "./env.js";

const open = (over) => ({
  ...newEnv(),
  room: { fit: false },
  ground: { on: true, y: 0, friction: 0.5, bounce: 0 },
  ceiling: { on: false, y: 30, bounce: 0 },
  left: { on: false, x: -30 },
  right: { on: false, x: 30 },
  air: { on: false, k: 0.5 },
  friction: { on: true },
  ...over,
});

// origin: where (0,0) sits on screen as a fraction of the canvas width and height
const view = (scale, fx = 0.5, fy = 0.5) => (size) => {
  const s = size || { w: 1000, h: 600 };
  return { x: (fx - 0.5) * s.w, y: (fy - 0.5) * s.h, scale };
};

export const TOPICS = [
  {
    id: "sandbox",
    name: "Sandbox",
    blurb: "Free drawing with every general tool.",
    gravity: 9.81,
    env: () => newEnv(),
    view: () => ({ x: 0, y: 0, scale: 50 }),
    also: [],
  },
  {
    id: "projectile",
    name: "Projectile",
    blurb: "Open sky and a ground at y = 0. Launch things and read the flight.",
    gravity: 9.81,
    env: () => open({}),
    view: view(14, 0.1, 0.8),
    also: ["ball", "block", "wall", "ramp"],
  },
  {
    id: "dynamics",
    name: "Forces and friction",
    blurb: "Floor and slopes. Push, pull and slide blocks.",
    gravity: 9.81,
    env: () => open({}),
    view: view(45, 0.2, 0.8),
    also: ["block", "ramp", "wall", "force", "rope", "spring"],
  },
  {
    id: "collisions",
    name: "Collisions",
    blurb: "Air track: no gravity, no friction, walls at both ends.",
    gravity: 0,
    env: () =>
      open({
        ground: { on: false, y: -6, friction: 0, bounce: 0 },
        left: { on: true, x: -13 },
        right: { on: true, x: 13 },
        friction: { on: false },
      }),
    view: view(40, 0.5, 0.5),
    also: ["block", "ball", "wall"],
  },
  {
    id: "statics",
    name: "Statics",
    blurb: "Things held still by ropes, supports and beams.",
    gravity: 9.81,
    env: () => open({ ground: { on: true, y: -7, friction: 0.5, bounce: 0 } }),
    view: view(45, 0.5, 0.5),
    also: ["rope", "rod", "anchor", "pin", "roller", "force", "block", "beam", "ring"],
  },
  {
    id: "energy",
    name: "Energy",
    blurb: "Pendulums, springs and falling things. Energy is tracked live.",
    gravity: 9.81,
    env: () =>
      open({
        left: { on: true, x: -12 },
        right: { on: true, x: 12 },
      }),
    view: view(45, 0.5, 0.85),
    also: ["ball", "block", "ramp", "rope", "spring", "anchor", "wall"],
  },
];

export const topicById = (id) => TOPICS.find((t) => t.id === id) || TOPICS[0];

// Put a project into a topic: room, view and gravity change, the drawing stays
export function applyTopic(project, id, size) {
  const t = topicById(id);
  const prev = topicById(project.topic);
  const gravity = t.gravity !== 9.81 ? t.gravity : prev.gravity !== 9.81 ? 9.81 : project.gravity;
  return { ...project, topic: t.id, env: t.env(), view: t.view(size), gravity, viewed: [] };
}
