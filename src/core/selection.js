// What can be selected: a drawn item (numeric id) or an angle at a corner (id starting "ang:").
import { computeAngles } from "./angles.js";

export const isAngleId = (id) => typeof id === "string" && id.startsWith("ang:");

export function findSelectable(scene, id) {
  if (id == null) return null;
  if (isAngleId(id)) {
    const a = computeAngles(scene).find((x) => x.key === id);
    return a ? { type: "angle", id, ...a } : null;
  }
  return scene.items.find((i) => i.id === id) || null;
}