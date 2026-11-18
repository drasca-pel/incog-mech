import Projectile from "./Projectile.jsx";
import Kinematics from "./Kinematics.jsx";
import Energy from "./Energy.jsx";
import Collision from "./Collision.jsx";

// Everything here changes with time, so it is its own workspace.
export const MOTION_TOOLS = [
  { group: "Flight", items: [["projectile", "Projectile", Projectile]] },
  { group: "Straight-line motion", items: [["kinematics", "Equations of motion and graphs", Kinematics]] },
  { group: "Energy and momentum", items: [["energy", "Work and energy", Energy], ["collision", "Collisions and momentum", Collision]] },
];
export const MOTION_DEFAULT = "projectile";