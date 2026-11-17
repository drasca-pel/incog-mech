// A project is one workspace tab: its view, its gravity and its drawing (scene).
// Undo and redo keep earlier scenes in past and future. Step 3 adds saving to disk.
import { emptyScene } from "./scene.js";
import { newEnv } from "./env.js";

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

// Zoom about the middle of the canvas by a factor (1.25 = in, 0.8 = out)
export function zoomView(view, factor) {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  const f = scale / view.scale;
  return { x: view.x * f, y: view.y * f, scale };
}