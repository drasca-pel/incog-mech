// Simple machines: effort, load, mechanical advantage, velocity ratio, efficiency and power.
//
//   Effort (E)  the force you put in           Load (L)  the force the machine overcomes
//   MA  = L / E                                 mechanical advantage: how many times the machine multiplies your force
//   VR  = distance moved by effort / distance moved by load      velocity ratio: set by the shape of the machine
//   efficiency = MA / VR   (= work out / work in)   always less than 100% because of friction
import { fix, rad } from "./math.js";

// MA, VR and efficiency from what was measured
export function ratios({ load, effort, dE, dL }) {
  const steps = [];
  const MA = load / effort;
  const VR = dE / dL;
  const workIn = effort * dE;
  const workOut = load * dL;
  const eff = (MA / VR) * 100;
  const idealEffort = load / VR; // the effort needed if there were no friction
  steps.push("Step 1: Mechanical advantage  MA = Load / Effort.");
  steps.push(`  MA = ${fix(load)} / ${fix(effort)} = ${fix(MA, 3)}`);
  steps.push("Step 2: Velocity ratio  VR = distance moved by effort / distance moved by load.");
  steps.push(`  VR = ${fix(dE)} / ${fix(dL)} = ${fix(VR, 3)}`);
  steps.push("Step 3: Efficiency  η = MA / VR × 100%  (the same as work out / work in).");
  steps.push(`  η = ${fix(MA, 3)} / ${fix(VR, 3)} × 100 = ${fix(eff, 2)}%`);
  steps.push(`Step 4: Work in = Effort × distance = ${fix(effort)} × ${fix(dE)} = ${fix(workIn)} J. Work out = Load × distance = ${fix(load)} × ${fix(dL)} = ${fix(workOut)} J.`);
  steps.push(`  Work wasted against friction = ${fix(workIn - workOut)} J.`);
  steps.push(`Step 5: With no friction the effort would be Load / VR = ${fix(load)} / ${fix(VR, 3)} = ${fix(idealEffort)}. The extra ${fix(effort - idealEffort)} is spent overcoming friction.`);
  if (eff > 100.0001) steps.push("Warning: an efficiency over 100% is impossible. Check the numbers.");
  return { MA, VR, eff, workIn, workOut, workLost: workIn - workOut, idealEffort, frictionEffort: effort - idealEffort, steps };
}

export const MACHINES = {
  lever: { name: "Lever", fields: [["effortArm", "Effort arm", "m"], ["loadArm", "Load arm", "m"]], defaults: { effortArm: 2, loadArm: 0.5 }, vr: (p) => p.effortArm / p.loadArm, formula: "VR = effort arm / load arm" },
  pulley: { name: "Pulley system", fields: [["n", "Strings supporting the load", ""]], defaults: { n: 4 }, vr: (p) => p.n, formula: "VR = number of strings supporting the load" },
  wheelAxle: { name: "Wheel and axle", fields: [["R", "Wheel radius", "m"], ["r", "Axle radius", "m"]], defaults: { R: 0.3, r: 0.05 }, vr: (p) => p.R / p.r, formula: "VR = wheel radius / axle radius" },
  incline: { name: "Inclined plane", fields: [["length", "Length of slope", "m"], ["height", "Height raised", "m"]], defaults: { length: 10, height: 2 }, vr: (p) => p.length / p.height, formula: "VR = length of slope / height = 1 / sin θ" },
  screw: { name: "Screw jack", fields: [["a", "Handle radius", "m"], ["pitch", "Pitch of the screw", "m"]], defaults: { a: 0.4, pitch: 0.01 }, vr: (p) => (2 * Math.PI * p.a) / p.pitch, formula: "VR = 2π × handle radius / pitch" },
  gears: { name: "Gear pair", fields: [["driver", "Teeth on the driver gear", ""], ["driven", "Teeth on the driven gear", ""]], defaults: { driver: 20, driven: 60 }, vr: (p) => p.driven / p.driver, formula: "VR = teeth on driven gear / teeth on driver gear" },
};

// The velocity ratio of a machine from its shape
export function velocityRatio(type, p) {
  const m = MACHINES[type];
  if (!m) return { ok: false, error: "Unknown machine." };
  for (const [k] of m.fields) if (!(p[k] > 0)) return { ok: false, error: "Every size must be more than zero." };
  const VR = m.vr(p);
  const steps = [`${m.name}: ${m.formula}`];
  steps.push(`  VR = ${fix(VR, 3)}`);
  if (type === "incline") steps.push(`  The slope angle is sin⁻¹(height / length) = ${fix((Math.asin(Math.min(1, p.height / p.length)) * 180) / Math.PI, 2)}°`);
  return { ok: true, VR, formula: m.formula, steps };
}

// Effort needed for a load, given the velocity ratio and the efficiency (as a percentage)
export function effortFor({ load, VR, eff }) {
  const ideal = load / VR;
  const actual = eff > 0 ? ideal / (eff / 100) : Infinity;
  const steps = [
    `Ideal effort (no friction) = Load / VR = ${fix(load)} / ${fix(VR, 3)} = ${fix(ideal)}`,
    `Actual effort = ideal effort / efficiency = ${fix(ideal)} / ${fix(eff / 100, 3)} = ${fix(actual)}`,
  ];
  return { ideal, actual, steps };
}

// The law of a machine: effort = m × load + c, from two readings (load, effort).
// m tells how the effort grows with the load, c is the effort needed just to overcome friction.
export function lawOfMachine(r1, r2, VR) {
  if (Math.abs(r2.load - r1.load) < 1e-12) return { ok: false, error: "The two loads must be different." };
  const m = (r2.effort - r1.effort) / (r2.load - r1.load);
  const c = r1.effort - m * r1.load;
  const steps = [];
  steps.push("The law of a machine is a straight line: E = m L + c.");
  steps.push(`Step 1: Slope m = (E₂ - E₁) / (L₂ - L₁) = (${fix(r2.effort)} - ${fix(r1.effort)}) / (${fix(r2.load)} - ${fix(r1.load)}) = ${fix(m, 4)}`);
  steps.push(`Step 2: Intercept c = E₁ - m L₁ = ${fix(r1.effort)} - ${fix(m, 4)} × ${fix(r1.load)} = ${fix(c, 3)}`);
  steps.push(`  So the law is  E = ${fix(m, 4)} L ${c < 0 ? "-" : "+"} ${fix(Math.abs(c), 3)}`);
  const out = { ok: true, m, c, steps, at: (L) => ({ effort: m * L + c, eff: ((L / (m * L + c)) / VR) * 100 }) };
  if (VR > 0) {
    const maxEff = (1 / (m * VR)) * 100;
    steps.push(`Step 3: The efficiency gets closer to 1 / (m × VR) as the load grows, so the greatest possible efficiency is 1 / (${fix(m, 4)} × ${fix(VR, 3)}) = ${fix(maxEff, 2)}%.`);
    steps.push(`Step 4: The ideal slope would be 1 / VR = ${fix(1 / VR, 4)}. Here m is ${m >= 1 / VR ? "larger" : "smaller"}.${m < 1 / VR ? " That is impossible for a real machine: check the readings." : ""}`);
    out.maxEff = maxEff;
  }
  return out;
}

// Power of a machine over a time t
export function machinePower({ effort, load, dE, dL, t }) {
  const Pin = (effort * dE) / t;
  const Pout = (load * dL) / t;
  const steps = [
    "Power = work done / time.",
    `Step 1: Power put in = Effort × effort distance / time = ${fix(effort)} × ${fix(dE)} / ${fix(t)} = ${fix(Pin)} W`,
    `Step 2: Power got out = Load × load distance / time = ${fix(load)} × ${fix(dL)} / ${fix(t)} = ${fix(Pout)} W`,
    `Step 3: Power wasted = ${fix(Pin - Pout)} W. Efficiency = P out / P in = ${fix((Pout / Pin) * 100, 2)}%.`,
  ];
  return { Pin, Pout, Plost: Pin - Pout, eff: (Pout / Pin) * 100, steps };
}

// Power from a force and a speed  (P = F v), and from an engine's input power and efficiency
export function powerFromForce({ F, v }) {
  const P = F * v;
  return { P, steps: [`P = F × v = ${fix(F)} × ${fix(v)} = ${fix(P)} W (${fix(P / 745.7, 3)} horsepower)`] };
}
export function outputPower({ Pin, eff }) {
  const Pout = (Pin * eff) / 100;
  return { Pout, Plost: Pin - Pout, steps: [`Output power = input power × efficiency = ${fix(Pin)} × ${fix(eff / 100, 3)} = ${fix(Pout)} W`] };
}
void rad;