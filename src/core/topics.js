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
  return { x: Math.round((fx - 0.5) * s.w), y: Math.round((fy - 0.5) * s.h), scale };
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
    view: view(14, 0.08, 0.86),
    also: ["ball", "block", "wall", "ramp"],
  },
  {
    id: "dynamics",
    name: "Forces and friction",
    blurb: "Floor and slopes. Push, pull and slide blocks.",
    gravity: 9.81,
    env: () => open({}),
    view: view(45, 0.2, 0.86),
    also: ["block", "ramp", "wall", "force", "rope", "spring"],
  },
  {
    id: "collisions",
    name: "Collisions",
    blurb: "A closed box with no gravity and no friction. How bouncy a wall is depends on the object that hits it.",
    gravity: 0,
    env: () =>
      open({
        ground: { on: true, y: -7, friction: 0, bounce: 0 },
        ceiling: { on: true, y: 7, bounce: 0 },
        left: { on: true, x: -13, bounce: 0 },
        right: { on: true, x: 13, bounce: 0 },
        friction: { on: false },
      }),
    view: view(34, 0.5, 0.5),
    also: ["block", "ball", "wall"],
  },
  {
    id: "statics",
    name: "Statics",
    blurb: "Things held still by ropes, supports and beams.",
    gravity: 9.81,
    env: () => open({}),
    view: view(45, 0.5, 0.86),
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
    view: view(36, 0.5, 0.86),
    also: ["ball", "block", "ramp", "rope", "spring", "anchor", "wall"],
  },
];

export const topicById = (id) => TOPICS.find((t) => t.id === id) || TOPICS[0];

// Each topic owns its own scene, view, environment, gravity and undo history.
// Switching topics saves the current workspace and restores the destination workspace.
const snapshot = (p) => ({
  view: p.view,
  gravity: p.gravity,
  env: p.env,
  viewed: p.viewed || [],
  scene: p.scene,
  past: p.past || [],
  future: p.future || [],
});

export function applyTopic(project, id, size) {
  const target = topicById(id);
  const currentId = project.topic || "sandbox";
  if (target.id === currentId) return project;

  const workspaces = { ...(project.workspaces || {}) };
  workspaces[currentId] = snapshot(project);

  const saved = workspaces[target.id];
  const restored = saved || {
    view: target.view(size),
    gravity: target.gravity,
    env: target.env(),
    viewed: [],
    scene: project.scene?.items ? { items: [], nextId: 1 } : project.scene,
    past: [],
    future: [],
  };

  workspaces[target.id] = restored;
  return { ...project, topic: target.id, ...restored, workspaces };
}
