// Small 2D helpers. Points are { x, y } in metres, y pointing up.
// Angles are in degrees, counterclockwise from the +x direction (0 = right, 90 = up).
export const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export const angleBetween = (a, b) =>
  (((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) + 360) % 360;

export const pointAt = (a, length, angleDeg) => {
  const r = (angleDeg * Math.PI) / 180;
  return { x: a.x + length * Math.cos(r), y: a.y + length * Math.sin(r) };
};

export function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Round the direction from a to b to the nearest step (degrees), keeping the length
export function constrainAngle(a, b, step = 15) {
  const angle = Math.round(angleBetween(a, b) / step) * step;
  return pointAt(a, dist(a, b), angle);
}

export const rotatePoint = (p, deg) => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

// True if point p is inside the polygon pts (list of { x, y })
export function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}