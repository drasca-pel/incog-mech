// The tool catalog. The ribbon, the left bar and the command bar all build themselves
// from this list, so a new tool appears everywhere without editing any UI file.
//
// kind:  "tool"   = stays active until you pick another (Select, Pan, Rope...)
//        "action" = runs once (Undo, Zoom fit...)
//        "toggle" = switches something on or off (Grid, Snap)
// ready: false = shown in the ribbon but marked "coming soon"
import { lineTools } from "./line/index.js";
import { objectTools } from "./objects/index.js";
import "./angle/index.js"; // registers the angle item type

export const TABS = ["Home", "Draw", "Objects", "Constrain", "Analyze", "View"];

const tool = (id, name, tab, group, extra = {}) => ({
  id,
  name,
  icon: id,
  tab,
  group,
  kind: "action",
  ready: false,
  ...extra,
});

export const TOOLS = [
  // Home
  tool("save", "Save", "Home", "File", { ready: true, shortcut: "Ctrl+S" }),
  tool("saveAs", "Save as", "Home", "File", { ready: true, shortcut: "Ctrl+Shift+S" }),
  tool("open", "Open", "Home", "File", { ready: true, shortcut: "Ctrl+O" }),
  tool("select", "Select", "Home", "Pointer", { kind: "tool", ready: true, shortcut: "V", prompt: "Select: click an object to see its properties." }),
  tool("pan", "Pan", "Home", "Pointer", { kind: "tool", ready: true, shortcut: "H", prompt: "Pan: drag to move the view. The mouse wheel zooms." }),
  tool("undo", "Undo", "Home", "Edit", { ready: true, shortcut: "Ctrl+Z" }),
  tool("redo", "Redo", "Home", "Edit", { ready: true, shortcut: "Ctrl+Y" }),
  tool("delete", "Delete", "Home", "Edit", { ready: true, shortcut: "Del" }),
    tool("play", "Play", "Home", "Simulation", { ready: true }),
  tool("pause", "Pause", "Home", "Simulation", { ready: true }),
  tool("reset", "Reset", "Home", "Simulation", { ready: true }),
  // Draw
  ...lineTools,
    tool("results", "Results", "Analyze", "Results", { ready: true }),
  tool("dimension", "Dimension", "Draw", "Annotate", { kind: "tool" }),
  tool("angle", "Angle", "Draw", "Annotate", { kind: "tool" }),

  // Objects
  ...objectTools,

  // Constrain
  tool("join", "Join", "Constrain", "Connect"),
  tool("detach", "Detach", "Constrain", "Connect"),
  tool("fix", "Fix", "Constrain", "Connect"),
  tool("setAngle", "Set angle", "Constrain", "Dimensions"),
  tool("setLength", "Set length", "Constrain", "Dimensions"),
  tool("label", "Label", "Constrain", "Dimensions"),

  // Analyze
  tool("equilibrium", "Equilibrium", "Analyze", "Check"),
  tool("fbd", "Free body", "Analyze", "Check"),
  tool("viewValues", "View values", "Analyze", "Results"),
  tool("steps", "Solution", "Analyze", "Results"),

  // View
  tool("grid", "Grid", "View", "Display", { kind: "toggle", ready: true, shortcut: "F7" }),
  tool("axes", "Axes", "View", "Display", { kind: "toggle", ready: true, shortcut: "F8" }),
  tool("snap", "Snap", "View", "Display", { kind: "toggle", ready: true, shortcut: "F9" }),
  tool("zoomIn", "Zoom in", "View", "Zoom", { ready: true, shortcut: "+" }),
  tool("zoomOut", "Zoom out", "View", "Zoom", { ready: true, shortcut: "-" }),
  tool("zoomFit", "Zoom fit", "View", "Zoom", { ready: true }),
  tool("zoomReset", "Zoom 100%", "View", "Zoom", { ready: true }),
  tool("measure", "Measure", "View", "Inquiry", { kind: "tool" }),
];

// Command bar search: exact match first, then names that start with the text, then names containing it
export function findTools(text) {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const exact = TOOLS.filter((t) => t.id.toLowerCase() === q || t.name.toLowerCase() === q);
  const starts = TOOLS.filter(
    (t) => !exact.includes(t) && (t.name.toLowerCase().startsWith(q) || t.id.toLowerCase().startsWith(q))
  );
  const has = TOOLS.filter(
    (t) => !exact.includes(t) && !starts.includes(t) && t.name.toLowerCase().includes(q)
  );
  return [...exact, ...starts, ...has];
}