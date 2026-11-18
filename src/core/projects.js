// A project is one workspace tab: its view, its gravity and its drawing (scene).
// Undo and redo keep earlier scenes in past and future. Step 3 adds saving to disk.
import { emptyScene } from "./scene.js";
import { newEnv, roomBounds } from "./env.js";

export const DEFAULT_VIEW = { x: 0, y: 0, scale: 50 }; // scale = pixels per metre
export const MIN_SCALE = 0.5; // 1%
export const MAX_SCALE = 20000; // 40000%

let counter = 0;

export function newProject(number) {
  counter += 1;
  return {
    id: `p${Date.now()}_${counter}`,
    name: `Project ${number}`,
    view: { ...DEFAULT_VIEW },
    gravity: 9.81, // m/s², editable per project
    env: newEnv(), // ground, limits and air resistance
    viewed: [], // values pinned on the drawing from the Results list
    scene: emptyScene(),
    past: [],
    future: [],
  };
}

// A view that shows the whole room (when it is closed on all four sides). size = { w, h } of the canvas in pixels.
export function fitRoom(env, size) {
  const r = roomBounds(env);
  if (!r || !size || (env.room && env.room.fit)) return { ...DEFAULT_VIEW };
  const pad = 40;
  const fit = Math.min((size.w - 2 * pad) / (r.right - r.left), (size.h - 2 * pad) / (r.top - r.bottom));
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));
  return { x: (-(r.left + r.right) / 2) * scale, y: ((r.top + r.bottom) / 2) * scale, scale };
}

// Zoom about the middle of the canvas by a factor (1.25 = in, 0.8 = out)
export function zoomView(view, factor) {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  const f = scale / view.scale;
  return { x: view.x * f, y: view.y * f, scale };
}