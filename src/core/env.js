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
  air: { on: false, k: 0.5 }, // air resistance: force = -k x velocity
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
