// Force systems in a plane: resultant, components, moments, couples, Varignon's theorem,
// and equilibrium of a particle.
//
// Conventions: a force is { name, F, angle, x, y }.
//  F      size in newtons (N)
//  angle  direction in degrees, measured anticlockwise from the +x direction
//  x, y   where it is applied (metres)
// A moment is positive when it turns anticlockwise. A couple is { name, M } in N·m (anticlockwise +).
import { rad, deg, fix, norm360, solveLinear } from "./math.js";

export const components = (F, angle) => ({ x: F * Math.cos(rad(angle)), y: F * Math.sin(rad(angle)) });

// Moment of one force about point P:  M = (x - px) Fy - (y - py) Fx
export function momentOf(force, P = { x: 0, y: 0 }) {
  const c = components(force.F, force.angle);
  return (force.x - P.x) * c.y - (force.y - P.y) * c.x;
}

export function quadrantText(theta) {
  const t = norm360(theta);
  if (t === 0 || t === 360) return "along +x";
  if (t === 90) return "along +y";
  if (t === 180) return "along -x";
  if (t === 270) return "along -y";
  return t < 90 ? "1st quadrant" : t < 180 ? "2nd quadrant" : t < 270 ? "3rd quadrant" : "4th quadrant";
}

// The resultant of a system of forces and couples, with the working shown step by step.
export function resultant(forces, couples = [], O = { x: 0, y: 0 }) {
  const steps = [];
  const terms = forces.map((f) => {
    const c = components(f.F, f.angle);
    return { name: f.name, Fx: c.x, Fy: c.y, M: momentOf(f, O) };
  });

  steps.push("Step 1: Resolve every force into x and y components (Fx = F cos θ, Fy = F sin θ).");
  forces.forEach((f, i) => {
    steps.push(`  ${f.name}: Fx = ${fix(f.F)} cos ${fix(f.angle)}° = ${fix(terms[i].Fx)} N,  Fy = ${fix(f.F)} sin ${fix(f.angle)}° = ${fix(terms[i].Fy)} N`);
  });

  const Rx = terms.reduce((s, t) => s + t.Fx, 0);
  const Ry = terms.reduce((s, t) => s + t.Fy, 0);
  const R = Math.hypot(Rx, Ry);
  steps.push("Step 2: Add the components.");
  steps.push(`  ΣFx = Rx = ${fix(Rx)} N,   ΣFy = Ry = ${fix(Ry)} N`);

  const tiny = 1e-9;
  const theta = R > tiny ? norm360(deg(Math.atan2(Ry, Rx))) : 0;
  if (R > tiny) {
    steps.push("Step 3: Size and direction of the resultant.");
    steps.push(`  R = √(Rx² + Ry²) = √(${fix(Rx)}² + ${fix(Ry)}²) = ${fix(R)} N`);
    steps.push(`  θ = tan⁻¹(Ry / Rx) = ${fix(theta)}° from +x (${quadrantText(theta)})`);
  } else {
    steps.push("Step 3: The forces add up to zero, so there is no resultant force.");
  }

  const coupleSum = couples.reduce((s, c) => s + c.M, 0);
  const forceMoment = terms.reduce((s, t) => s + t.M, 0);
  const MO = forceMoment + coupleSum;
  steps.push(`Step 4: Moments about O = (${fix(O.x)}, ${fix(O.y)}). Use M = x Fy - y Fx for each force (Varignon's theorem: the moment of the resultant equals the sum of the moments of the forces).`);
  forces.forEach((f, i) => steps.push(`  ${f.name}: M = ${fix(terms[i].M)} N·m`));
  couples.forEach((c) => steps.push(`  ${c.name || "Couple"}: M = ${fix(c.M)} N·m`));
  steps.push(`  ΣM_O = ${fix(MO)} N·m (${MO > 0 ? "anticlockwise" : MO < 0 ? "clockwise" : "zero"})`);

  let kind;
  let line = null;
  if (R <= tiny && Math.abs(MO) <= tiny) {
    kind = "equilibrium";
    steps.push("Step 5: R = 0 and ΣM = 0, so the system is in equilibrium.");
  } else if (R <= tiny) {
    kind = "couple";
    steps.push(`Step 5: R = 0 but ΣM ≠ 0, so the system is equivalent to a single couple of ${fix(MO)} N·m.`);
  } else {
    kind = "force";
    const d = Math.abs(MO) / R;
    // the line of action of R satisfies (x - Ox) Ry - (y - Oy) Rx = MO
    const xInt = Math.abs(Ry) > tiny ? O.x + (MO - O.y * Rx) / Ry : null; // where it crosses y = 0
    const yInt = Math.abs(Rx) > tiny ? O.y - (MO + O.x * Ry) / Rx : null; // where it crosses x = 0
    line = { d, xInt, yInt };
    steps.push(`Step 5: Where the resultant acts. R is ${fix(d)} m from O, and crosses the x-axis at ${xInt === null ? "never (it is parallel to x)" : `x = ${fix(xInt)} m`}${yInt === null ? "" : `, the y-axis at y = ${fix(yInt)} m`}.`);
  }

  return { Rx, Ry, R, theta, MO, coupleSum, forceMoment, terms, line, kind, steps, O };
}

// Sum of moments about any point P (used to check Varignon's theorem)
export function momentAbout(forces, couples, P) {
  return forces.reduce((s, f) => s + momentOf(f, P), 0) + couples.reduce((s, c) => s + c.M, 0);
}

// Equilibrium of a particle: some known forces, plus two unknown forces whose directions are known.
// Finds the sizes T1 and T2 (a negative answer means the force points the other way).
export function solveConcurrent(known, a1, a2) {
  const Sx = known.reduce((s, f) => s + components(f.F, f.angle).x, 0);
  const Sy = known.reduce((s, f) => s + components(f.F, f.angle).y, 0);
  const c1 = Math.cos(rad(a1)), s1 = Math.sin(rad(a1));
  const c2 = Math.cos(rad(a2)), s2 = Math.sin(rad(a2));
  const det = c1 * s2 - c2 * s1;
  const steps = [];
  steps.push(`Step 1: Known forces add to ΣFx = ${fix(Sx)} N, ΣFy = ${fix(Sy)} N.`);
  steps.push(`Step 2: Equilibrium needs ΣFx = 0 and ΣFy = 0:`);
  steps.push(`  T1 cos ${fix(a1)}° + T2 cos ${fix(a2)}° = ${fix(-Sx)}`);
  steps.push(`  T1 sin ${fix(a1)}° + T2 sin ${fix(a2)}° = ${fix(-Sy)}`);
  if (Math.abs(det) < 1e-9) {
    steps.push("The two unknown forces point along the same line, so they cannot be found separately.");
    return { ok: false, steps };
  }
  const T1 = (-Sx * s2 + Sy * c2) / det;
  const T2 = (-Sy * c1 + Sx * s1) / det;
  steps.push("Step 3: Solve the two equations together.");
  steps.push(`  T1 = ${fix(T1)} N,   T2 = ${fix(T2)} N`);
  if (T1 < 0 || T2 < 0) steps.push("  A negative answer means that force points the opposite way to the direction given.");
  return { ok: true, T1, T2, Sx, Sy, steps };
}

// A weight hanging from two cables. alpha and beta are the cable angles above the horizontal.
export function hangingWeight(W, alpha, beta) {
  const sol = solveConcurrent([{ name: "Weight", F: W, angle: 270 }], 180 - alpha, beta);
  return sol;
}