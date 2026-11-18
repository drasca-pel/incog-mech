// The environment of a project: the room the simulation happens in, plus air resistance.
// Saved with each project.
//
// The room is a closed box: ground, ceiling and a wall on each side. It is fixed in the world
// (measured in metres), so zooming and panning only change what you see, never the room itself.
// Nothing can fall out of it or fly away from it.
export const DEFAULT_ENV = {
  ground: { on: true, y: -5, friction: 0.5, bounce: 0 },
  ceiling: { on: true, y: 5, bounce: 0 },
  left: { on: true, x: -10 },
  right: { on: true, x: 10 },
  air: { on: false, k: 0.5 }, // air resistance: force = -k x velocity. Off = ignore air resistance.
  friction: { on: true }, // off = every surface is smooth (frictionless)
  room: { fit: true }, // true = the room edges stay at the edges of the screen when you zoom
};

export const newEnv = () => JSON.parse(JSON.stringify(DEFAULT_ENV));

// Change one setting, e.g. patchEnv(env, "ground", { y: -2 })
export const patchEnv = (env, part, patch) => ({ ...env, [part]: { ...env[part], ...patch } });

// The room as { left, right, bottom, top } in metres, or null unless all four sides are on
export function roomBounds(env) {
  if (!(env.ground.on && env.ceiling.on && env.left.on && env.right.on)) return null;
  const b = { left: env.left.x, right: env.right.x, bottom: env.ground.y, top: env.ceiling.y };
  return b.right > b.left && b.top > b.bottom ? b : null;
}

// When the room follows the screen edges, work out where those edges are in metres right now.
// The simulation uses this at the moment you press Play. While it runs the room stays where it is.
export function liveEnv(env, view, size, inset = 18) {
  if (!env.room || !env.room.fit || !size) return env;
  const wx = (sx) => (sx - size.w / 2 - view.x) / view.scale;
  const wy = (sy) => (size.h / 2 + view.y - sy) / view.scale;
  return {
    ...env,
    room: { fit: false },
    ground: { ...env.ground, y: wy(size.h - inset) },
    ceiling: { ...env.ceiling, y: wy(inset) },
    left: { ...env.left, x: wx(inset) },
    right: { ...env.right, x: wx(size.w - inset) },
  };
}