// Angle at a corner. These are drawn automatically wherever lines meet (see core/angles.js).
// Selecting one and typing a new value turns the line that was drawn later,
// so the line you drew first stays where it is.
import { registerItemType } from "../../core/itemTypes.js";
import { updateItem } from "../../core/scene.js";
import { pointAt } from "../../core/geometry.js";

registerItemType("angle", {
  title: () => "Angle",
  properties: (item) => [
    { id: "angle", label: "Angle", unit: "°", kind: "number", value: item.sweep },
  ],
  apply(scene, item, propId, value) {
    if (propId !== "angle") return scene;
    const sweep = Math.min(179.9, Math.max(0.1, value));
    const moverIsSecond = item.second.id > item.first.id;
    const mover = moverIsSecond ? item.second : item.first;
    const newAngle = moverIsSecond ? item.first.ang + sweep : item.second.ang - sweep;
    const far = mover.end === "a" ? "b" : "a";
    return updateItem(scene, mover.id, (it) => ({ ...it, [far]: pointAt(item.vertex, mover.len, newAngle) }));
  },
}); 