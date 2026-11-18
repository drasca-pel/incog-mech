// Centroid and moment of inertia of composite figures.
// A figure is a list of simple shapes. Each shape can ADD material (sign +1) or be a HOLE (sign -1).
//
// Shapes (x, y is the reference point, in any length unit you like, e.g. mm):
//   rect        x, y = bottom-left corner;  w, h
//   triangle    x, y = bottom-left corner;  b = base, h = height, a = how far the top corner is from the left end (a = 0 gives a right triangle)
//   circle      x, y = centre;  r
//   semicircle  x, y = middle of the flat side;  r;  orient = up | down | left | right (the way the curved side faces)
//   quarter     x, y = the corner (centre of the circle);  r;  quad = 1 | 2 | 3 | 4 (quadrant it fills)
//   ellipse     x, y = centre;  a = half-width, b = half-height
import { fix } from "./math.js";

const PI = Math.PI;

// Area, centroid and inertia about the shape's own centroid axes
export function shapeProps(s) {
  switch (s.type) {
    case "rect":
      return { A: s.w * s.h, cx: s.x + s.w / 2, cy: s.y + s.h / 2, Ixc: (s.w * s.h ** 3) / 12, Iyc: (s.h * s.w ** 3) / 12 };
    case "triangle": {
      const a = s.a ?? 0;
      return {
        A: (s.b * s.h) / 2,
        cx: s.x + (s.b + a) / 3,
        cy: s.y + s.h / 3,
        Ixc: (s.b * s.h ** 3) / 36,
        Iyc: ((s.h * s.b) / 36) * (s.b * s.b - a * s.b + a * a),
      };
    }
    case "circle":
      return { A: PI * s.r ** 2, cx: s.x, cy: s.y, Ixc: (PI * s.r ** 4) / 4, Iyc: (PI * s.r ** 4) / 4 };
    case "ellipse":
      return { A: PI * s.a * s.b, cx: s.x, cy: s.y, Ixc: (PI * s.a * s.b ** 3) / 4, Iyc: (PI * s.a ** 3 * s.b) / 4 };
    case "semicircle": {
      const d = (4 * s.r) / (3 * PI);
      const flat = (PI / 8 - 8 / (9 * PI)) * s.r ** 4; // about the centroidal axis parallel to the flat side
      const across = (PI * s.r ** 4) / 8; // about the centroidal axis at right angles to the flat side
      const o = s.orient || "up";
      const vertical = o === "up" || o === "down";
      return {
        A: (PI * s.r ** 2) / 2,
        cx: s.x + (o === "right" ? d : o === "left" ? -d : 0),
        cy: s.y + (o === "up" ? d : o === "down" ? -d : 0),
        Ixc: vertical ? flat : across,
        Iyc: vertical ? across : flat,
      };
    }
    case "quarter": {
      const d = (4 * s.r) / (3 * PI);
      const q = s.quad || 1;
      const sx = q === 1 || q === 4 ? 1 : -1;
      const sy = q === 1 || q === 2 ? 1 : -1;
      const I = (PI / 16 - 4 / (9 * PI)) * s.r ** 4;
      return { A: (PI * s.r ** 2) / 4, cx: s.x + sx * d, cy: s.y + sy * d, Ixc: I, Iyc: I };
    }
    default:
      return { A: 0, cx: 0, cy: 0, Ixc: 0, Iyc: 0 };
  }
}

export const SHAPE_NAMES = { rect: "Rectangle", triangle: "Triangle", circle: "Circle", semicircle: "Semicircle", quarter: "Quarter circle", ellipse: "Ellipse" };

// Is the point inside the shape? (Used to double-check the formulas by counting tiny squares.)
export function inside(s, px, py) {
  switch (s.type) {
    case "rect":
      return px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h;
    case "triangle": {
      if (py < s.y || py > s.y + s.h) return false;
      const t = (py - s.y) / s.h;
      const left = s.x + (s.a ?? 0) * t;
      const right = s.x + s.b + ((s.a ?? 0) - s.b) * t;
      return px >= left && px <= right;
    }
    case "circle":
      return (px - s.x) ** 2 + (py - s.y) ** 2 <= s.r ** 2;
    case "ellipse":
      return ((px - s.x) / s.a) ** 2 + ((py - s.y) / s.b) ** 2 <= 1;
    case "semicircle": {
      const dx = px - s.x, dy = py - s.y;
      if (dx * dx + dy * dy > s.r ** 2) return false;
      const o = s.orient || "up";
      return o === "up" ? dy >= 0 : o === "down" ? dy <= 0 : o === "right" ? dx >= 0 : dx <= 0;
    }
    case "quarter": {
      const dx = px - s.x, dy = py - s.y;
      if (dx * dx + dy * dy > s.r ** 2) return false;
      const q = s.quad || 1;
      return (q === 1 || q === 4 ? dx >= 0 : dx <= 0) && (q === 1 || q === 2 ? dy >= 0 : dy <= 0);
    }
    default:
      return false;
  }
}

// The outline of a shape as a list of points, for drawing
export function outline(s) {
  const arc = (cx, cy, rx, ry, a0, a1, n = 48) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
    });
  switch (s.type) {
    case "rect":
      return [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }];
    case "triangle":
      return [{ x: s.x, y: s.y }, { x: s.x + s.b, y: s.y }, { x: s.x + (s.a ?? 0), y: s.y + s.h }];
    case "circle":
      return arc(s.x, s.y, s.r, s.r, 0, 2 * PI);
    case "ellipse":
      return arc(s.x, s.y, s.a, s.b, 0, 2 * PI);
    case "semicircle": {
      const o = s.orient || "up";
      const a0 = o === "up" ? 0 : o === "down" ? PI : o === "right" ? -PI / 2 : PI / 2;
      return arc(s.x, s.y, s.r, s.r, a0, a0 + PI);
    }
    case "quarter": {
      const q = s.quad || 1;
      const a0 = ((q - 1) * PI) / 2;
      return [{ x: s.x, y: s.y }, ...arc(s.x, s.y, s.r, s.r, a0, a0 + PI / 2, 24)];
    }
    default:
      return [];
  }
}

// The centroid and inertia of the whole figure, with the working shown.
export function analyseSection(shapes, unit = "mm") {
  const steps = [];
  const parts = shapes.map((s) => ({ s, sign: s.sign === -1 ? -1 : 1, ...shapeProps(s) }));
  const A = parts.reduce((t, p) => t + p.sign * p.A, 0);
  if (!(A > 1e-12)) return { ok: false, error: "The total area must be more than zero. Check the sizes, and that holes are smaller than the material.", steps };

  const Qy = parts.reduce((t, p) => t + p.sign * p.A * p.cx, 0); // first moment about the y-axis
  const Qx = parts.reduce((t, p) => t + p.sign * p.A * p.cy, 0); // first moment about the x-axis
  const xbar = Qy / A;
  const ybar = Qx / A;

  // second moments about the centroid, by the parallel-axis theorem  I = Ic + A d²
  const Ix = parts.reduce((t, p) => t + p.sign * (p.Ixc + p.A * (p.cy - ybar) ** 2), 0);
  const Iy = parts.reduce((t, p) => t + p.sign * (p.Iyc + p.A * (p.cx - xbar) ** 2), 0);
  // second moments about the x and y axes through the origin
  const IxO = parts.reduce((t, p) => t + p.sign * (p.Ixc + p.A * p.cy ** 2), 0);
  const IyO = parts.reduce((t, p) => t + p.sign * (p.Iyc + p.A * p.cx ** 2), 0);

  steps.push(`Step 1: Split the figure into simple shapes (holes count as negative area). Lengths are in ${unit}.`);
  parts.forEach((p, i) => {
    steps.push(`  ${i + 1}. ${SHAPE_NAMES[p.s.type]}${p.sign < 0 ? " (hole)" : ""}: A = ${fix(p.sign * p.A)},  centroid (${fix(p.cx)}, ${fix(p.cy)}),  A·x = ${fix(p.sign * p.A * p.cx)},  A·y = ${fix(p.sign * p.A * p.cy)}`);
  });
  steps.push(`Step 2: Total area A = ΣA = ${fix(A)} ${unit}²`);
  steps.push(`Step 3: Centroid. x̄ = Σ(A x) / A = ${fix(Qy)} / ${fix(A)} = ${fix(xbar)} ${unit},   ȳ = Σ(A y) / A = ${fix(Qx)} / ${fix(A)} = ${fix(ybar)} ${unit}`);
  steps.push("Step 4: Moment of inertia about the centroid, using the parallel-axis theorem I = I_own + A d² for each part, then adding (subtracting for holes).");
  parts.forEach((p, i) => {
    steps.push(`  ${i + 1}. Ix: ${fix(p.Ixc)} + ${fix(p.A)} × (${fix(p.cy - ybar)})² = ${fix(p.Ixc + p.A * (p.cy - ybar) ** 2)}`);
  });
  steps.push(`  Ix = ${fix(Ix)} ${unit}⁴,   Iy = ${fix(Iy)} ${unit}⁴`);
  steps.push(`Step 5: Polar moment J = Ix + Iy = ${fix(Ix + Iy)} ${unit}⁴. Radii of gyration: kx = √(Ix/A) = ${fix(Math.sqrt(Ix / A))} ${unit}, ky = √(Iy/A) = ${fix(Math.sqrt(Iy / A))} ${unit}.`);

  return { ok: true, A, xbar, ybar, Qx, Qy, Ix, Iy, IxO, IyO, J: Ix + Iy, kx: Math.sqrt(Ix / A), ky: Math.sqrt(Iy / A), parts, steps };
}

export const SECTION_PRESETS = {
  T: [
    { type: "rect", x: 0, y: 80, w: 100, h: 20, sign: 1 },
    { type: "rect", x: 40, y: 0, w: 20, h: 80, sign: 1 },
  ],
  L: [
    { type: "rect", x: 0, y: 0, w: 100, h: 20, sign: 1 },
    { type: "rect", x: 0, y: 20, w: 20, h: 80, sign: 1 },
  ],
  hole: [
    { type: "rect", x: 0, y: 0, w: 100, h: 80, sign: 1 },
    { type: "circle", x: 50, y: 40, r: 20, sign: -1 },
  ],
  house: [
    { type: "rect", x: 0, y: 0, w: 80, h: 60, sign: 1 },
    { type: "triangle", x: 0, y: 60, b: 80, h: 30, a: 40, sign: 1 },
  ],
};