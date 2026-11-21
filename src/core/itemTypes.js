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
    out.push({
      id: "lockRotation", label: "Keep upright (no spinning)", kind: "choice", options: YES_NO,
      value: it.lockRotation ? "yes" : "no", set: (i, v) => ({ ...i, lockRotation: v === "yes" }),
    });
  }
  return out;
}

// The launch arrow: 1 metre of arrow = 1 m/s. Drag its tip to set speed and direction.
const velTip = (it) => {
  const a = ((it.angle0 || 0) * Math.PI) / 180;
  return { x: it.x + it.speed0 * Math.cos(a), y: it.y + it.speed0 * Math.sin(a) };
};
const isBody = (def, it) => def.physics(it).kind === "dynamic";

function drawVelocity(g, it) {
  const { ctx } = g;
  const a = g.toScreen(it);
  const b = g.toScreen(velTip(it));
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.save();
  ctx.strokeStyle = "#4cc9f0";
  ctx.fillStyle = "#4cc9f0";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(b.x + 3 * Math.cos(ang), b.y + 3 * Math.sin(ang));
  ctx.lineTo(b.x - 11 * Math.cos(ang - 0.42), b.y - 11 * Math.sin(ang - 0.42));
  ctx.lineTo(b.x - 11 * Math.cos(ang + 0.42), b.y - 11 * Math.sin(ang + 0.42));
  ctx.closePath();
  ctx.fill();
  ctx.font = '600 12px "Cascadia Mono", Consolas, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(it.speed0 * 100) / 100} m/s  ${Math.round((it.angle0 || 0) * 10) / 10}°`, b.x + Math.cos(ang) * 8 - Math.sin(ang) * 18, b.y + Math.sin(ang) * 8 + Math.cos(ang) * 18);
  ctx.restore();
}

function withLaunchArrow(def) {
  return {
    ...def,
    draw(g, it, selected) {
      def.draw(g, it, selected);
      if (!it.sim && it.speed0 > 0 && isBody(def, it)) drawVelocity(g, it);
    },
    handles: (it) => [...def.handles(it), ...(it.speed0 > 0 && isBody(def, it) ? [{ id: "v", p: velTip(it) }] : [])],
    moveHandle(it, id, p) {
      if (id !== "v") return def.moveHandle(it, id, p);
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const speed = Math.hypot(dx, dy);
      if (speed < 0.01) return it;
      return { ...it, speed0: Math.round(speed * 1000) / 1000, angle0: Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360 * 100) / 100 };
    },
  };
}

export function registerItemType(name, def) {
  if (def.physics) {
    const base = def.properties;
    def = withLaunchArrow({ ...def, properties: (it) => [...base(it), ...bodyProps(it, def)] });
  }
  types[name] = def;
}

export function itemType(name) {
  return types[name];
}