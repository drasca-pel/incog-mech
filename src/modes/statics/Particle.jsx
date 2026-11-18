import { useCallback } from "react";
import { solveConcurrent, hangingWeight, components } from "../../engine/forces.js";
import { fix } from "../../engine/math.js";
import { Pane, Card, NumField, Button, Results, Steps, Diagram, Segmented, withDefaults, Notice } from "../kit.jsx";
import { C, fitWorld, boundsOf, arrow, label, dot, line } from "../draw.js";

export const DEFAULT = {
  mode: "hang",
  W: 500,
  alpha: 40,
  beta: 30,
  known: [{ F: 200, angle: 270 }],
  a1: 150,
  a2: 30,
};

export function compute(s) {
  if (s.mode === "hang") {
    const sol = hangingWeight(s.W, s.alpha, s.beta);
    return { sol, known: [{ name: "Weight W", F: s.W, angle: 270 }], dirs: [180 - s.alpha, s.beta] };
  }
  const known = s.known.map((f, i) => ({ name: `F${i + 1}`, ...f }));
  return { sol: solveConcurrent(known, s.a1, s.a2), known, dirs: [s.a1, s.a2] };
}

export function drawParticle(ctx, w, h, cam, s, c) {
  const { sol, known, dirs } = c;
  const vectors = known.map((f) => ({ name: f.name, F: f.F, angle: f.angle, color: C.force }));
  if (sol.ok) {
    vectors.push({ name: "T1", F: Math.abs(sol.T1), angle: dirs[0] + (sol.T1 < 0 ? 180 : 0), color: C.result, value: sol.T1 });
    vectors.push({ name: "T2", F: Math.abs(sol.T2), angle: dirs[1] + (sol.T2 < 0 ? 180 : 0), color: C.result, value: sol.T2 });
  }
  const maxF = Math.max(1e-9, ...vectors.map((v) => v.F));
  const tf = fitWorld({ x0: -2, x1: 2, y0: -2, y1: 2 }, w, h, cam, 50);
  const L = Math.min(w, h) * 0.34 * cam.zoom;
  const ox = w / 2 + cam.dx, oy = h / 2 + cam.dy;
  void tf;
  if (s.mode === "hang") {
    // the ceiling the cables hang from
    const top = oy - L * 1.15;
    line(ctx, ox - L * 1.6, top, ox + L * 1.6, top, C.muted, 3);
    for (let x = -L * 1.6; x <= L * 1.6; x += 10) line(ctx, ox + x, top, ox + x + 7, top - 8, C.faint, 1);
  }
  for (const v of vectors) {
    const len = (v.F / maxF) * L;
    const a = (v.angle * Math.PI) / 180;
    arrow(ctx, ox, oy, ox + Math.cos(a) * len, oy - Math.sin(a) * len, { color: v.color, width: 3, head: 12 });
    const tx = ox + Math.cos(a) * (len + 8), ty = oy - Math.sin(a) * (len + 8);
    const text = v.value !== undefined ? `${v.name} = ${fix(v.value, 2)} N` : `${v.name} = ${fix(v.F, 1)} N`;
    label(ctx, text, tx, ty - (Math.sin(a) >= 0 ? 8 : -8), { color: v.color, align: Math.cos(a) >= 0 ? "left" : "right", bold: true, size: 12.5 });
  }
  dot(ctx, ox, oy, 6, C.accent);
  label(ctx, "particle", ox + 10, oy + 14, { color: C.accent, size: 11 });
  void components;
}

export default function ParticlePane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const c = compute(s);
  const draw = useCallback((ctx, w, h, cam) => drawParticle(ctx, w, h, cam, s, c), [JSON.stringify(s)]); // eslint-disable-line react-hooks/exhaustive-deps
  const setKnown = (i, patch) => set({ known: s.known.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  const sol = c.sol;

  const inputs = (
    <>
      <Card title="What is the problem?">
        <Segmented value={s.mode} onChange={(mode) => set({ mode })} options={[["hang", "Weight on 2 cables"], ["general", "Any forces"]]} />
        <p className="mk-help">
          {s.mode === "hang"
            ? "A weight hangs from two cables. Find the pull in each cable."
            : "A particle in equilibrium with some known forces and two unknown forces whose directions are known."}
        </p>
      </Card>
      {s.mode === "hang" ? (
        <Card title="Weight and cables">
          <NumField label="Weight W" unit="N" value={s.W} onChange={(W) => set({ W })} hint="Weight = mass × 9.81" />
          <NumField label="Left cable angle α" unit="° above horizontal" value={s.alpha} onChange={(alpha) => set({ alpha: Math.min(89.9, Math.max(0.1, alpha)) })} />
          <NumField label="Right cable angle β" unit="° above horizontal" value={s.beta} onChange={(beta) => set({ beta: Math.min(89.9, Math.max(0.1, beta)) })} />
        </Card>
      ) : (
        <>
          <Card title="Known forces" actions={<Button onClick={() => set({ known: [...s.known, { F: 100, angle: 0 }] })}>+ Add</Button>}>
            <table className="mk-table">
              <thead><tr><th /><th>F (N)</th><th>angle (°)</th><th /></tr></thead>
              <tbody>
                {s.known.map((f, i) => (
                  <tr key={i}>
                    <td className="tag">F{i + 1}</td>
                    <td><NumField compact value={f.F} onChange={(F) => setKnown(i, { F })} /></td>
                    <td><NumField compact value={f.angle} onChange={(angle) => setKnown(i, { angle })} /></td>
                    <td><button className="mk-x" onClick={() => set({ known: s.known.filter((_, k) => k !== i) })} aria-label="Remove">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mk-help">Angle is anticlockwise from +x. A weight points down: 270°.</p>
          </Card>
          <Card title="Directions of the two unknown forces">
            <NumField label="T1 direction" unit="°" value={s.a1} onChange={(a1) => set({ a1 })} />
            <NumField label="T2 direction" unit="°" value={s.a2} onChange={(a2) => set({ a2 })} />
          </Card>
        </>
      )}
    </>
  );

  const answers = (
    <>
      {!sol.ok && <Notice kind="warn">The two unknown forces point along the same line, so they cannot be found separately. Change one of the directions.</Notice>}
      {sol.ok && (
        <Card title="Answers">
          <Results
            rows={[
              [s.mode === "hang" ? "Left cable T1" : "Unknown force T1", fix(sol.T1), "N", true],
              [s.mode === "hang" ? "Right cable T2" : "Unknown force T2", fix(sol.T2), "N", true],
              ["Check ΣFx", fix(sol.Sx + sol.T1 * Math.cos(((c.dirs[0]) * Math.PI) / 180) + sol.T2 * Math.cos((c.dirs[1] * Math.PI) / 180), 6), "N"],
              ["Check ΣFy", fix(sol.Sy + sol.T1 * Math.sin((c.dirs[0] * Math.PI) / 180) + sol.T2 * Math.sin((c.dirs[1] * Math.PI) / 180), 6), "N"],
            ]}
          />
          {(sol.T1 < 0 || sol.T2 < 0) && <p className="mk-help">A negative answer means that force actually points the opposite way. It is drawn that way.</p>}
        </Card>
      )}
      <Steps steps={sol.steps} />
    </>
  );
  return <Pane inputs={inputs} diagram={<Diagram draw={draw} />} results={answers} />;
}