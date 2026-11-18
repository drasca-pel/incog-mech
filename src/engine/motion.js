// Motion: projectiles, equations of motion, energy, and collisions.
import { rad, deg, fix, norm360 } from "./math.js";

// ---------------------------------------------------------------- projectile
// v0 launch speed (m/s), angle in degrees above horizontal, h0 launch height above the ground (m)
export function projectile({ v0, angle, h0 = 0, g = 9.81 }) {
  const th = rad(angle);
  const vx = v0 * Math.cos(th);
  const vy0 = v0 * Math.sin(th);
  const h = Math.max(0, h0);
  const tUp = vy0 > 0 ? vy0 / g : 0;
  const H = h + (vy0 > 0 ? (vy0 * vy0) / (2 * g) : 0);
  const T = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * h)) / g;
  const R = vx * T;
  const vyEnd = vy0 - g * T;
  const speedEnd = Math.hypot(vx, vyEnd);
  const impactAngle = deg(Math.atan2(-vyEnd, vx));
  const pos = (t) => ({ x: vx * t, y: h + vy0 * t - 0.5 * g * t * t });
  const vel = (t) => ({ vx, vy: vy0 - g * t });

  const steps = [];
  steps.push("Step 1: Split the launch velocity into horizontal and vertical parts.");
  steps.push(`  ux = v cos θ = ${fix(v0)} cos ${fix(angle)}° = ${fix(vx)} m/s,   uy = v sin θ = ${fix(v0)} sin ${fix(angle)}° = ${fix(vy0)} m/s`);
  steps.push("Step 2: Time to the top. Going up, the vertical speed falls to zero: t = uy / g.");
  steps.push(`  t_top = ${fix(vy0)} / ${fix(g)} = ${fix(tUp, 3)} s`);
  steps.push(`Step 3: Greatest height  H = h₀ + uy² / (2g) = ${fix(h)} + ${fix(vy0)}² / (2 × ${fix(g)}) = ${fix(H)} m`);
  steps.push(`Step 4: Time of flight. The height is zero when h₀ + uy t - ½ g t² = 0, so t = ${fix(T, 3)} s`);
  steps.push(`Step 5: Range  R = ux × T = ${fix(vx)} × ${fix(T, 3)} = ${fix(R)} m`);
  steps.push(`Step 6: Landing. Vertical speed = uy - g T = ${fix(vyEnd)} m/s, so it lands at ${fix(speedEnd)} m/s, ${fix(impactAngle)}° below the horizontal.`);
  return { vx, vy0, tUp, H, T, R, speedEnd, impactAngle, pos, vel, steps, v0, angle, h0: h, g };
}

// The launch angle that gives the longest range, and that range
export function maxRange({ v0, h0 = 0, g = 9.81 }) {
  const h = Math.max(0, h0);
  const angle = deg(Math.atan(v0 / Math.sqrt(v0 * v0 + 2 * g * h)));
  const R = (v0 / g) * Math.sqrt(v0 * v0 + 2 * g * h);
  return { angle, R };
}

// The angle(s) that land at a given distance. Returns up to two angles, low and high.
export function anglesForRange({ v0, h0 = 0, g = 9.81, R }) {
  const best = maxRange({ v0, h0, g });
  if (R > best.R + 1e-9) return { angles: [], max: best };
  const range = (a) => projectile({ v0, angle: a, h0, g }).R;
  const bisect = (lo, hi, rising) => {
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const r = range(mid);
      if (rising ? r < R : r > R) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const out = [];
  if (range(0) <= R + 1e-9) out.push(bisect(0, best.angle, true));
  if (range(90) <= R + 1e-9) out.push(bisect(best.angle, 90, false));
  return { angles: out.sort((a, b) => a - b), max: best };
}

// Projectile with air resistance, by small time steps (Runge-Kutta).
// model: "linear" (drag = -k v)  or  "quadratic" (drag = -k |v| v). k is per kilogram of mass.
export function projectileDrag({ v0, angle, h0 = 0, g = 9.81, model = "quadratic", k = 0.02, dt = 0.002 }) {
  const th = rad(angle);
  const acc = (vx, vy) => {
    const f = model === "linear" ? k : k * Math.hypot(vx, vy);
    return { ax: -f * vx, ay: -g - f * vy };
  };
  let x = 0, y = Math.max(0, h0), vx = v0 * Math.cos(th), vy = v0 * Math.sin(th), t = 0;
  const path = [{ t, x, y, vx, vy }];
  let H = y;
  let Htime = 0;
  for (let n = 0; n < 2_000_000; n++) {
    const k1 = acc(vx, vy);
    const k2 = acc(vx + 0.5 * dt * k1.ax, vy + 0.5 * dt * k1.ay);
    const k3 = acc(vx + 0.5 * dt * k2.ax, vy + 0.5 * dt * k2.ay);
    const k4 = acc(vx + dt * k3.ax, vy + dt * k3.ay);
    const nvx = vx + (dt / 6) * (k1.ax + 2 * k2.ax + 2 * k3.ax + k4.ax);
    const nvy = vy + (dt / 6) * (k1.ay + 2 * k2.ay + 2 * k3.ay + k4.ay);
    const nx = x + (dt / 2) * (vx + nvx);
    const ny = y + (dt / 2) * (vy + nvy);
    if (ny <= 0) {
      const f = y / (y - ny || 1e-12); // where between the two steps it crossed the ground
      const tt = t + f * dt;
      path.push({ t: tt, x: x + f * (nx - x), y: 0, vx: vx + f * (nvx - vx), vy: vy + f * (nvy - vy) });
      return { path, T: tt, R: x + f * (nx - x), H, Htime, ok: true };
    }
    x = nx; y = ny; vx = nvx; vy = nvy; t += dt;
    if (y > H) { H = y; Htime = t; }
    if (n % 5 === 0) path.push({ t, x, y, vx, vy });
  }
  return { path, ok: false, T: t, R: x, H, Htime };
}

// ---------------------------------------------------------------- equations of motion (constant acceleration)
// Give any THREE of s (distance), u (start speed), v (end speed), a (acceleration), t (time); the other two are found.
export function suvat(given) {
  const known = ["s", "u", "v", "a", "t"].filter((k) => Number.isFinite(given[k]));
  if (known.length !== 3) return { ok: false, error: "Tick exactly three of the five quantities.", steps: [] };
  const { s, u, v, a, t } = given;
  const has = (...ks) => ks.every((k) => known.includes(k));
  const steps = [];
  let r = null;
  let alt = null;
  const eq = (text) => steps.push("  " + text);

  steps.push("Equations of motion (constant acceleration): v = u + a t,  s = (u + v) t / 2,  s = u t + ½ a t²,  s = v t - ½ a t²,  v² = u² + 2 a s");
  if (has("u", "a", "t")) { r = { v: u + a * t, s: u * t + 0.5 * a * t * t }; eq(`v = u + a t = ${fix(u)} + ${fix(a)} × ${fix(t)} = ${fix(r.v)}`); eq(`s = u t + ½ a t² = ${fix(r.s)}`); }
  else if (has("u", "v", "t")) { r = { a: (v - u) / t, s: ((u + v) * t) / 2 }; eq(`a = (v - u) / t = ${fix(r.a)}`); eq(`s = (u + v) t / 2 = ${fix(r.s)}`); }
  else if (has("u", "s", "t")) { const aa = (2 * (s - u * t)) / (t * t); r = { a: aa, v: u + aa * t }; eq(`s = u t + ½ a t²  gives  a = 2(s - u t) / t² = ${fix(r.a)}`); eq(`v = u + a t = ${fix(r.v)}`); }
  else if (has("v", "a", "t")) { const uu = v - a * t; r = { u: uu, s: v * t - 0.5 * a * t * t }; eq(`u = v - a t = ${fix(r.u)}`); eq(`s = v t - ½ a t² = ${fix(r.s)}`); }
  else if (has("v", "s", "t")) { const uu = (2 * s) / t - v; r = { u: uu, a: (v - uu) / t }; eq(`u = 2s / t - v = ${fix(r.u)}`); eq(`a = (v - u) / t = ${fix(r.a)}`); }
  else if (has("a", "s", "t")) { const uu = s / t - 0.5 * a * t; r = { u: uu, v: uu + a * t }; eq(`u = s / t - ½ a t = ${fix(r.u)}`); eq(`v = u + a t = ${fix(r.v)}`); }
  else if (has("u", "v", "a")) { if (a === 0) return { ok: false, error: "With a = 0 the time and distance cannot be found from speeds alone.", steps }; r = { t: (v - u) / a, s: (v * v - u * u) / (2 * a) }; eq(`t = (v - u) / a = ${fix(r.t)}`); eq(`s = (v² - u²) / 2a = ${fix(r.s)}`); }
  else if (has("u", "v", "s")) { if (u + v === 0) return { ok: false, error: "u + v = 0 gives no single time.", steps }; r = { a: (v * v - u * u) / (2 * s), t: (2 * s) / (u + v) }; eq(`a = (v² - u²) / 2s = ${fix(r.a)}`); eq(`t = 2s / (u + v) = ${fix(r.t)}`); }
  else if (has("u", "a", "s")) {
    const d = u * u + 2 * a * s;
    if (d < 0) return { ok: false, error: "No real answer: the object never travels that far with these values.", steps };
    const vv = Math.sqrt(d);
    r = { v: vv, t: a === 0 ? s / u : (vv - u) / a };
    alt = a === 0 ? null : { v: -vv, t: (-vv - u) / a };
    eq(`v² = u² + 2 a s = ${fix(d)}, so v = ±${fix(vv)}`); eq(`t = (v - u) / a = ${fix(r.t)}`);
    if (alt && alt.t > 0) eq(`The other root, v = ${fix(alt.v)} m/s at t = ${fix(alt.t)} s, is where it comes back past the same point on the return trip.`);
  } else if (has("v", "a", "s")) {
    const d = v * v - 2 * a * s;
    if (d < 0) return { ok: false, error: "No real answer for these values.", steps };
    const uu = Math.sqrt(d);
    r = { u: uu, t: a === 0 ? s / v : (v - uu) / a };
    eq(`u² = v² - 2 a s = ${fix(d)}, so u = ${fix(uu)}`); eq(`t = (v - u) / a = ${fix(r.t)}`);
  } else return { ok: false, error: "These three values do not fix the motion. Pick a different set of three.", steps };

  const all = { ...given, ...r };
  return { ok: true, values: { s: all.s, u: all.u, v: all.v, a: all.a, t: all.t }, found: Object.keys(r), alt, steps };
}

// Points of s, v and a against time for graphs
export function motionGraph({ u, a, t }, n = 120) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const tt = (t * i) / n;
    out.push({ t: tt, s: u * tt + 0.5 * a * tt * tt, v: u + a * tt, a });
  }
  return out;
}

// ---------------------------------------------------------------- energy on a slope (or free fall when theta = 90)
// A block moves distance d down a slope of angle theta with kinetic friction mu, starting at speed v0.
export function energySlope({ m, theta, d, mu = 0, v0 = 0, g = 9.81 }) {
  const th = rad(theta);
  const KE0 = 0.5 * m * v0 * v0;
  const drop = d * Math.sin(th);
  const PEloss = m * g * drop;
  const Wf = mu * m * g * Math.cos(th) * d;
  const KE = KE0 + PEloss - Wf;
  const steps = [];
  steps.push("Work-energy: KE at the end = KE at the start + (potential energy lost) - (work done against friction).");
  steps.push(`  Height dropped = d sin θ = ${fix(d)} × sin ${fix(theta)}° = ${fix(drop, 3)} m`);
  steps.push(`  Potential energy lost = m g h = ${fix(m)} × ${fix(g)} × ${fix(drop, 3)} = ${fix(PEloss)} J`);
  steps.push(`  Work against friction = μ m g cos θ × d = ${fix(Wf)} J`);
  steps.push(`  Starting KE = ½ m v₀² = ${fix(KE0)} J`);
  if (KE < -1e-9) {
    const decel = m * g * (mu * Math.cos(th) - Math.sin(th));
    const stop = decel > 0 ? KE0 / decel : null;
    steps.push(`  The energy runs out: friction wins and the block stops${stop !== null ? ` after ${fix(stop)} m` : ""}.`);
    return { ok: true, stops: true, stopDistance: stop, KE0, PEloss, Wf, KE: 0, v: 0, steps };
  }
  const v = Math.sqrt((2 * KE) / m);
  steps.push(`  Final KE = ${fix(KE0)} + ${fix(PEloss)} - ${fix(Wf)} = ${fix(KE)} J,  so  v = √(2 KE / m) = ${fix(v)} m/s`);
  return { ok: true, stops: false, KE0, PEloss, Wf, KE, v, steps };
}

// ---------------------------------------------------------------- collisions in a straight line
// e = coefficient of restitution: 1 = perfectly elastic, 0 = the two stick together
export function collide({ m1, u1, m2, u2, e }) {
  const M = m1 + m2;
  const v1 = (m1 * u1 + m2 * u2 - m2 * e * (u1 - u2)) / M;
  const v2 = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / M;
  const KEbefore = 0.5 * m1 * u1 * u1 + 0.5 * m2 * u2 * u2;
  const KEafter = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const pBefore = m1 * u1 + m2 * u2;
  const pAfter = m1 * v1 + m2 * v2;
  const impulse = m2 * (v2 - u2); // impulse on body 2 (equal and opposite on body 1)
  const steps = [];
  steps.push("Step 1: Momentum is conserved: m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂.");
  steps.push(`  Total momentum = ${fix(m1)}(${fix(u1)}) + ${fix(m2)}(${fix(u2)}) = ${fix(pBefore)} kg·m/s`);
  steps.push("Step 2: Restitution: v₂ - v₁ = e (u₁ - u₂).");
  steps.push(`  v₂ - v₁ = ${fix(e, 2)} × ${fix(u1 - u2)} = ${fix(e * (u1 - u2))}`);
  steps.push("Step 3: Solve the two equations together.");
  steps.push(`  v₁ = ${fix(v1)} m/s,   v₂ = ${fix(v2)} m/s`);
  steps.push(`Step 4: Kinetic energy before = ${fix(KEbefore)} J, after = ${fix(KEafter)} J, lost = ${fix(KEbefore - KEafter)} J (${KEbefore > 0 ? fix(((KEbefore - KEafter) / KEbefore) * 100, 1) : "0"}%).`);
  steps.push(`Step 5: Impulse on body 2 = m₂(v₂ - u₂) = ${fix(impulse)} N·s (equal and opposite on body 1).`);
  const approaching = u1 - u2 > 0;
  if (!approaching) steps.push("Note: with these velocities body 1 is not catching up with body 2, so they would not collide.");
  return { v1, v2, KEbefore, KEafter, KElost: KEbefore - KEafter, pBefore, pAfter, impulse, approaching, steps };
}