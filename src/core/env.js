// The environment of a project: ground, limits, air resistance. Saved with each project.
export const DEFAULT_ENV = {
  ground: { on: true, y: -5, friction: 0.5, bounce: 0 }, // things land here instead of falling forever
  ceiling: { on: false, y: 20, bounce: 0 },
  left: { on: false, x: -30 },
  right: { on: false, x: 30 },
  air: { on: false, k: 0.5 }, // air resistance: force = -k x velocity
};

export const newEnv = () => JSON.parse(JSON.stringify(DEFAULT_ENV));

// Change one setting, e.g. patchEnv(env, "ground", { y: -2 })
export const patchEnv = (env, part, patch) => ({ ...env, [part]: { ...env[part], ...patch } });