// Small maths helpers shared by all the calculators.
// Angles are in degrees everywhere the user sees them, and in radians inside the formulas.
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;

// Round for display. Never shows "-0".
export function fix(n, d = 2) {
  if (!Number.isFinite(n)) return "-";
  const r = Math.round(n * 10 ** d) / 10 ** d;
  return (Object.is(r, -0) || r === 0 ? 0 : r).toFixed(d);
}

// Angle 0 to 360 degrees
export const norm360 = (a) => ((a % 360) + 360) % 360;

// Solve A x = b by Gaussian elimination with partial pivoting. Returns null if the system is singular.
export function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  let scale = 0;
  for (const row of A) for (const v of row) scale = Math.max(scale, Math.abs(v));
  if (scale === 0) return null;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-10 * scale) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

// A "nice" step for grid lines, e.g. 1, 2, 5, 10, 20, 50...
export function niceStep(range, target = 6) {
  if (!(range > 0)) return 1;
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}