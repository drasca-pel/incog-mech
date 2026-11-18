// A block on a slope (or flat ground when the slope is 0) with friction and a pull or push.
// theta  slope angle in degrees        m  mass (kg)        g  gravity
// mus, muk  static and kinetic friction coefficients
// P  applied force (N), acting along the slope pointing UP the slope, tilted away from the surface by phi degrees
import { rad, deg, fix } from "./math.js";

export function inclineBlock({ m, theta, mus, muk, P = 0, phi = 0, g = 9.81 }) {
  const th = rad(theta);
  const ph = rad(phi);
  const W = m * g;
  const Wpar = W * Math.sin(th); // pulls the block down the slope
  const Wper = W * Math.cos(th); // presses the block into the slope
  const Ppar = P * Math.cos(ph); // up the slope
  const Pper = P * Math.sin(ph); // away from the surface
  const N = Wper - Pper;
  const steps = [];

  steps.push("Step 1: Weight W = m g and its two parts relative to the slope.");
  steps.push(`  W = ${fix(m)} × ${fix(g)} = ${fix(W)} N`);
  steps.push(`  Down the slope: W sin θ = ${fix(Wpar)} N,   into the slope: W cos θ = ${fix(Wper)} N`);

  if (N <= 0) {
    steps.push(`Step 2: The pull lifts the block off the surface (normal force would be ${fix(N)} N), so there is no friction.`);
    return { status: "lifts off", N: 0, W, Wpar, Wper, steps, friction: 0, accel: null };
  }
  steps.push(`Step 2: Normal force from perpendicular equilibrium: N = W cos θ - P sin φ = ${fix(N)} N`);

  const Fmax = mus * N;
  const net = Wpar - Ppar; // positive: tends to slide down the slope
  steps.push(`Step 3: Largest friction the surface can give (static): F_max = μs N = ${fix(mus, 3)} × ${fix(N)} = ${fix(Fmax)} N`);
  steps.push(`Step 4: Force along the slope trying to move the block (down positive): W sin θ - P cos φ = ${fix(net)} N`);

  const critical = deg(Math.atan(mus));
  const frictionAngle = critical;
  let status;
  let friction;
  let accel = 0;
  if (Math.abs(net) <= Fmax + 1e-9) {
    status = "at rest";
    friction = net; // positive: friction acts up the slope
    steps.push(`Step 5: Friction needed to hold it, ${fix(Math.abs(net))} N, is not more than F_max = ${fix(Fmax)} N. The block stays at rest.`);
    steps.push(`  The friction force is ${fix(Math.abs(net))} N acting ${net >= 0 ? "up" : "down"} the slope. Friction is only ${fix(Fmax > 0 ? (Math.abs(net) / Fmax) * 100 : 0, 0)}% of its limit.`);
  } else if (net > 0) {
    status = "slides down";
    const Fk = muk * N;
    accel = (net - Fk) / m;
    friction = Fk;
    steps.push(`Step 5: Needed friction ${fix(net)} N is more than F_max = ${fix(Fmax)} N, so the block slides down the slope.`);
    steps.push(`  Kinetic friction F_k = μk N = ${fix(Fk)} N, a = (${fix(net)} - ${fix(Fk)}) / ${fix(m)} = ${fix(accel, 3)} m/s²`);
  } else {
    status = "slides up";
    const Fk = muk * N;
    accel = (-net - Fk) / m;
    friction = -Fk;
    steps.push(`Step 5: The pull up the slope beats weight plus F_max, so the block slides up the slope.`);
    steps.push(`  Kinetic friction F_k = μk N = ${fix(Fk)} N, a = (${fix(-net)} - ${fix(Fk)}) / ${fix(m)} = ${fix(accel, 3)} m/s²`);
  }

  // Force needed to just stop it sliding down, and to just start it sliding up
  const holdDen = Math.cos(ph) + mus * Math.sin(ph);
  const pushDen = Math.cos(ph) - mus * Math.sin(ph);
  const Pmin = holdDen > 1e-9 ? Math.max(0, (W * (Math.sin(th) - mus * Math.cos(th))) / holdDen) : null;
  const Pup = pushDen > 1e-9 ? (W * (Math.sin(th) + mus * Math.cos(th))) / pushDen : null;
  steps.push(`Step 6: Tilting the slope past tan⁻¹ μs = ${fix(critical)}° makes a block with no pull slide on its own (friction angle).`);
  if (Pmin !== null) steps.push(`  Smallest pull that stops it sliding down: ${fix(Pmin)} N.`);
  if (Pup !== null) steps.push(`  Pull needed to start it sliding up: ${fix(Pup)} N.`);

  return { status, N, W, Wpar, Wper, Fmax, friction, accel, critical, frictionAngle, Pmin, Pup, steps };
}