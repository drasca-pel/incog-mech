import Resultant from "./Resultant.jsx";
import Particle from "./Particle.jsx";
import Beam from "./Beam.jsx";
import Truss from "./Truss.jsx";
import Friction from "./Friction.jsx";
import Sections from "./Sections.jsx";
import Machines from "./Machines.jsx";

// Everything here works on rigid bodies at rest, so it all shares one workspace.
export const STATICS_TOOLS = [
  { group: "Forces and moments", items: [["resultant", "Resultant, moments & couples", Resultant]] },
  {
    group: "Equilibrium",
    items: [
      ["particle", "Particle and cables", Particle],
      ["beam", "Beams: reactions, shear, bending", Beam],
      ["truss", "Trusses", Truss],
      ["friction", "Friction and slopes", Friction],
    ],
  },
  { group: "Shapes", items: [["sections", "Centroid and inertia", Sections]] },
  { group: "Machines", items: [["machines", "Machines: force, load, power", Machines]] },
];
export const STATICS_DEFAULT = "resultant";