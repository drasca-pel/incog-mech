import { useCallback } from "react";
import { resultant, momentOf, momentAbout, quadrantText } from "../../engine/forces.js";
import { fix } from "../../engine/math.js";
import { Pane, Card, NumField, Button, Results, Steps, Diagram, withDefaults, Notice } from "../kit.jsx";
import { C, boundsOf, fitWorld, grid, arrow, label, dot, line, arcArrow } from "../draw.js";

export const DEFAULT = {
  forces: [
    { F: 100, angle: 30, x: 0, y: 0 },
    { F: 80, angle: 120, x: 3, y: 0 },
    { F: 60, angle: 250, x: 1, y: 2 },
  ],
  couples: [],
  O: { x: 0, y: 0 },
  P: { x: 4, y: 1 },
  showParts: true,
};

// Everything this tool works out, from what is typed in
export function compute(s) {
  const forces = s.forces.map((f, i) => ({ name: `F${i + 1}`, ...f }));
  const couples = s.couples.map((c, i) => ({ name: `C${i + 1}`, M: c.M }));
  const res = resultant(forces, couples, s.O);
  let foot = null;
  if (res.kind === "force") {
    const k = res.MO / (res.R * res.R);
    foot = { x: s.O.x + k * res.Ry, y: s.O.y - k * res.Rx };
  }
  let check = null;
  if (res.kind === "force") {
    const resF = { F: res.R, angle: res.theta, x: foot.x, y: foot.y };
    check = { viaResultant: momentOf(resF, s.P), viaForces: momentAbout(forces, couples, s.P) };
  } else {
    check = { viaResultant: res.kind === "couple" ? res.MO : 0, viaForces: momentAbout(forces, couples, s.P) };
  }
  return { forces, couples, res, foot, check };
}

export function drawResultant(ctx, w, h, cam, s, c) {
  const { forces, res, foot } = c;
  const pts = [s.O, s.P, ...forces.map((f) => ({ x: f.x, y: f.y }))];
  if (foot) pts.push(foot);
  const tf = fitWorld(boundsOf(pts, 6, 0.5), w, h, cam, 80);
  grid(ctx, tf, "m");
  const maxMag = Math.max(1e-9, res.R, ...forces.map((f) => f.F));
  const px = 120 / maxMag; // pixels per newton

  forces.forEach((f, i) => {
    const ax = tf.x(f.x), ay = tf.y(f.y);
    const dx = f.F * Math.cos((f.angle * Math.PI) / 180) * px, dy = -f.F * Math.sin((f.angle * Math.PI) / 180) * px;
    if (s.showParts) {
      arrow(ctx, ax, ay, ax + dx, ay, { color: C.faint, width: 1.3, head: 6, dash: [4, 3] });
      arrow(ctx, ax + dx, ay, ax + dx, ay + dy, { color: C.faint, width: 1.3, head: 6, dash: [4, 3] });
    }
    arrow(ctx, ax, ay, ax + dx, ay + dy, { color: C.force, width: 2.6 });
    dot(ctx, ax, ay, 3.5, C.force);
    label(ctx, `F${i + 1} = ${fix(f.F, 1)} N at ${fix(f.angle, 1)}°`, ax + dx + (dx >= 0 ? 6 : -6), ay + dy - 8, { color: C.force, align: dx >= 0 ? "left" : "right", size: 11.5 });
  });

  // the resultant, drawn along its line of action
  if (res.kind === "force" && foot) {
    const ux = res.Rx / res.R, uy = res.Ry / res.R;
    const fx = tf.x(foot.x), fy = tf.y(foot.y);
    line(ctx, fx - ux * 2000, fy + uy * 2000, fx + ux * 2000, fy - uy * 2000, "rgba(255,122,89,.35)", 1.2, [8, 5]);
    if (res.line.d > 1e-6) line(ctx, tf.x(s.O.x), tf.y(s.O.y), fx, fy, C.muted, 1.2, [3, 3]);
    arrow(ctx, fx, fy, fx + ux * res.R * px, fy - uy * res.R * px, { color: C.result, width: 4, head: 13 });
    label(ctx, `R = ${fix(res.R, 2)} N at ${fix(res.theta, 1)}°`, fx + ux * res.R * px + (ux >= 0 ? 8 : -8), fy - uy * res.R * px - 12, { color: C.result, align: ux >= 0 ? "left" : "right", bold: true, size: 12.5 });
    if (res.line.d > 1e-6) label(ctx, `d = ${fix(res.line.d, 2)} m`, (tf.x(s.O.x) + fx) / 2, (tf.y(s.O.y) + fy) / 2 + 12, { color: C.muted, align: "center", size: 11 });
  }
  // the point moments are taken about
  dot(ctx, tf.x(s.O.x), tf.y(s.O.y), 5, C.accent);
  label(ctx, "O", tf.x(s.O.x) + 9, tf.y(s.O.y) + 12, { color: C.accent, bold: true });
  if (res.kind === "couple") {
    arcArrow(ctx, tf.x(s.O.x), tf.y(s.O.y), 30, res.MO > 0, C.result);
    label(ctx, `couple ${fix(res.MO, 2)} N·m`, tf.x(s.O.x) + 40, tf.y(s.O.y) - 30, { color: C.result, bold: true });
  }
  if (res.kind === "equilibrium") label(ctx, "In equilibrium: R = 0 and ΣM = 0", w / 2, 24, { color: C.good, align: "center", bold: true, size: 13 });
}

export default function ResultantPane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const c = compute(s);
  const { res } = c;
  const draw = useCallback((ctx, w, h, cam) => drawResultant(ctx, w, h, cam, s, c), [JSON.stringify(s)]); // eslint-disable-line react-hooks/exhaustive-deps

  const setForce = (i, patch) => set({ forces: s.forces.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  const kindText = res.kind === "equilibrium" ? "Equilibrium (R = 0, ΣM = 0)" : res.kind === "couple" ? "A single couple" : "A single force (the resultant)";

  const inputs = (
    <>
      <Card title="Forces" actions={<Button onClick={() => set({ forces: [...s.forces, { F: 50, angle: 0, x: 0, y: 0 }] })}>+ Add</Button>}>
        <table className="mk-table">
          <thead><tr><th /><th>F (N)</th><th>angle (°)</th><th>x (m)</th><th>y (m)</th><th /></tr></thead>
          <tbody>
            {s.forces.map((f, i) => (
              <tr key={i}>
                <td className="tag">F{i + 1}</td>
                {["F", "angle", "x", "y"].map((k) => (
                  <td key={k}><NumField compact value={f[k]} onChange={(v) => setForce(i, { [k]: v })} /></td>
                ))}
                <td><button className="mk-x" onClick={() => set({ forces: s.forces.filter((_, k) => k !== i) })} aria-label={`Remove F${i + 1}`}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mk-help">Angle is measured anticlockwise from the +x direction (0° points right, 90° points up). x and y say where the force is applied.</p>
      </Card>
      <Card title="Couples" actions={<Button onClick={() => set({ couples: [...s.couples, { M: 20 }] })}>+ Add</Button>}>
        {s.couples.length === 0 && <p className="mk-help">A couple is a pure turning effect. Positive turns anticlockwise.</p>}
        {s.couples.map((cp, i) => (
          <div className="mk-row" key={i}>
            <span className="tag">C{i + 1}</span>
            <NumField compact value={cp.M} onChange={(M) => set({ couples: s.couples.map((q, k) => (k === i ? { M } : q)) })} />
            <span className="mk-unit">N·m</span>
            <button className="mk-x" onClick={() => set({ couples: s.couples.filter((_, k) => k !== i) })} aria-label="Remove couple">×</button>
          </div>
        ))}
      </Card>
      <Card title="Take moments about">
        <div className="mk-pair">
          <NumField label="O  x" unit="m" value={s.O.x} onChange={(x) => set({ O: { ...s.O, x } })} />
          <NumField label="O  y" unit="m" value={s.O.y} onChange={(y) => set({ O: { ...s.O, y } })} />
        </div>
        <label className="mk-check"><input type="checkbox" checked={s.showParts} onChange={(e) => set({ showParts: e.target.checked })} /> Show x and y components</label>
      </Card>
    </>
  );

  const answers = (
    <>
      {s.forces.length === 0 && <Notice>Add a force to begin.</Notice>}
      <Card title="Resultant">
        <Results
          rows={[
            ["Rx = ΣFx", fix(res.Rx), "N"],
            ["Ry = ΣFy", fix(res.Ry), "N"],
            ["R", fix(res.R), "N", true],
            ["Direction θ", res.R > 1e-9 ? fix(res.theta) : "-", res.R > 1e-9 ? `° (${quadrantText(res.theta)})` : ""],
            ["ΣM about O", fix(res.MO), `N·m ${res.MO > 0 ? "anticlockwise" : res.MO < 0 ? "clockwise" : ""}`, true],
            ["System equals", kindText, ""],
            ...(res.line ? [["Line of action", `${fix(res.line.d)} m from O`, ""], ["Crosses x-axis", res.line.xInt === null ? "never" : `x = ${fix(res.line.xInt)}`, "m"], ["Crosses y-axis", res.line.yInt === null ? "never" : `y = ${fix(res.line.yInt)}`, "m"]] : []),
          ]}
        />
      </Card>
      <Card title="Check Varignon's theorem">
        <div className="mk-pair">
          <NumField label="P  x" unit="m" value={s.P.x} onChange={(x) => set({ P: { ...s.P, x } })} />
          <NumField label="P  y" unit="m" value={s.P.y} onChange={(y) => set({ P: { ...s.P, y } })} />
        </div>
        <Results rows={[["Moments of the forces added up", fix(c.check.viaForces), "N·m"], ["Moment of the resultant", fix(c.check.viaResultant), "N·m"]]} />
        <p className="mk-help">They match for any point P. That is Varignon's theorem: the moment of the resultant equals the sum of the moments of the forces.</p>
      </Card>
      <Steps steps={res.steps} />
    </>
  );
  return <Pane inputs={inputs} diagram={<Diagram draw={draw} />} results={answers} />;
}