// Item types describe how a kind of drawn thing behaves. Each tool folder registers its own.
// The canvas and the properties panel only call these functions, so they never need to
// know what a rope or a block is.
//
// An item type provides:
//   title(item)                  name shown at the top of the properties panel
//   draw(g, item, selected)      g = { ctx, toScreen, scale }
//   hitTest(item, p, tol)        true if point p (metres) is on the item, tol in metres
//   handles(item)                [{ id, p }] points you can drag
//   moveHandle(item, id, p)      returns the item with that handle moved to p
//   moveBy(item, dx, dy)         returns the item shifted
//   snapPoints(item)             points other drawing snaps to
//   properties(item)             [{ id, label, unit, kind, value, set(item, value) }]
//                                kind = "number" | "text" | "choice" | "readout" | "button"
//   apply(scene, item, id, v)    optional: for things that change other items (angles, align)
//                                return the new scene, or null to use the property's own set()
//   physics(item)                optional: makes the item part of the simulation
//   writeBack(item, pose)        optional: moves the item to where the simulation put it
//   hookDefault                  optional: false = ropes tie at the clicked point, not the centre
//
// Anything with physics() automatically gets the shared properties:
// launch speed and angle, bounciness, solid, and pull from centre.
const types = {};

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const hookCentre = (it, def) => it.hookCentre ?? def.hookDefault ?? true;

function bodyProps(it, def) {
  const ph = def.physics(it);
  const num = (id, label, unit, value, set) => ({ id, label, unit, kind: "number", value, set });
  const out = [];
  if (ph.kind === "dynamic") {
    out.push(num("speed0", "Launch speed", "m/s", it.speed0 ?? 0, (i, v) => ({ ...i, speed0: Math.max(0, v) })));
    out.push(num("angle0", "Launch angle", "°", it.angle0 ?? 0, (i, v) => ({ ...i, angle0: v })));
  }
  out.push(num("bounce", "Bounciness", "", it.bounce ?? 0, (i, v) => ({ ...i, bounce: Math.min(1, Math.max(0, v)) })));
  out.push({
    id: "solid", label: "Solid (collides)", kind: "choice", options: YES_NO,
    value: it.solid === false ? "no" : "yes", set: (i, v) => ({ ...i, solid: v === "yes" }),
  });
  if (ph.kind === "dynamic") {
    out.push({
      id: "hookCentre", label: "Pull from centre", kind: "choice", options: YES_NO,
      value: hookCentre(it, def) ? "yes" : "no", set: (i, v) => ({ ...i, hookCentre: v === "yes" }),
    });
  }
  return out;
}

export function registerItemType(name, def) {
  if (def.physics) {
    const base = def.properties;
    def = { ...def, properties: (it) => [...base(it), ...bodyProps(it, def)] };
  }
  types[name] = def;
}

export function itemType(name) {
  return types[name];
}