import { useCallback } from "react";
import { suvat, motionGraph } from "../../engine/motion.js";
import { fix } from "../../engine/math.js";
import { Pane, Card, NumField, Button, Results, Steps, Diagram, withDefaults, Notice } from "../kit.jsx";
import { C, plot, label } from "../draw.js";

export const DEFAULT = {
  vals: { s: 0, u: 5, v: 0, a: 2, t: 6 },
  known: { s: false, u: true, v: false, a: true, t: true },
  cursor: 0.5,
};
const NAMES = { s: ["Distance s", "m"], u: ["Starting speed u", "m/s"], v: ["Final speed v", "m/s"], a: ["Acceleration a", "m/s²"], t: ["Time t", "s"] };

export function compute(s) {
  const given = {};
  for (const k of Object.keys(NAMES)) if (s.known[k]) given[k] = s.vals[k];
  return suvat(given);
}

export function drawKinematics(ctx, w, h, s, r) {
  if (!r.ok) {
    label(ctx, "Tick exactly three quantities to see the graphs", w / 2, h / 2, { color: C.muted, align: "center", size: 13, bg: false });
    return;
  }
  const { u, a, t } = r.values;
  if (![u, a, t].every(Number.isFinite) || !(t > 0)) return;
  const pts = motionGraph({ u, a, t });
  const gap = 8, pw = (w - gap * 4) / 3;
  const cursor = s.cursor * t;
  const mk = (i, name, key, color, title) => plot(ctx, { x: gap + i * (pw + gap), y: 8, w: pw, h: h - 16 }, [{ name, color, pts: pts.map((p) => ({ x: p.t, y: p[key] })) }], { title, xLabel: "time (s)", cursor });
  mk(0, "s", "s", C.force, "Distance s (m)");
  mk(1, "v", "v", C.good, "Speed v (m/s)");
  mk(2, "a", "a", C.result, "Acceleration a (m/s²)");
}

export default function KinematicsPane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const r = compute(s);
  const draw = useCallback((ctx, w, h) => drawKinematics(ctx, w, h, s, r), [JSON.stringify(s)]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = Object.values(s.known).filter(Boolean).length;
  const tc = r.ok && Number.isFinite(r.values.t) ? s.cursor * r.values.t : 0;
  const at = r.ok && [r.values.u, r.values.a].every(Number.isFinite) ? { s: r.values.u * tc + 0.5 * r.values.a * tc * tc, v: r.values.u + r.values.a * tc } : null;

  const inputs = (
    <>
      <Card title="Tick any three you know">
        {Object.entries(NAMES).map(([k, [name, unit]]) => (
          <div className="mk-known" key={k}>
            <input type="checkbox" checked={s.known[k]} onChange={(e) => set({ known: { ...s.known, [k]: e.target.checked } })} aria-label={`${name} is known`} />
            {s.known[k] ? <NumField label={name} unit={unit} value={s.vals[k]} onChange={(v) => set({ vals: { ...s.vals, [k]: v } })} /> : <div className="mk-field"><span className="mk-label">{name}</span><span className="mk-control mk-found">{r.ok ? `${fix(r.values[k], 3)} ${unit}` : "?"}</span></div>}
          </div>
        ))}
        <p className="mk-help">{count === 3 ? "Three are ticked. The other two are worked out for you." : `${count} ticked. Tick exactly three.`}</p>
      </Card>
      <Card title="Quick examples">
        <div className="mk-btnrow">
          <Button onClick={() => set({ vals: { ...s.vals, u: 0, a: 9.81, t: 3 }, known: { s: false, u: true, v: false, a: true, t: true } })}>Dropped from rest</Button>
          <Button onClick={() => set({ vals: { ...s.vals, u: 20, a: -9.81, v: 0 }, known: { s: false, u: true, v: true, a: true, t: false } })}>Thrown straight up</Button>
          <Button onClick={() => set({ vals: { ...s.vals, u: 25, v: 0, s: 50 }, known: { s: true, u: true, v: true, a: false, t: false } })}>Braking to a stop</Button>
        </div>
        <p className="mk-help">Use a negative acceleration for slowing down, or for gravity when "up" is positive.</p>
      </Card>
    </>
  );

  const answers = (
    <>
      {!r.ok && <Notice kind="warn">{r.error}</Notice>}
      {r.ok && (
        <Card title="Answers">
          <Results rows={Object.entries(NAMES).map(([k, [name, unit]]) => [name, fix(r.values[k], 3), unit, r.found.includes(k)])} />
          {r.alt && r.alt.t > 0 && <p className="mk-help">There is a second answer: v = {fix(r.alt.v, 3)} m/s at t = {fix(r.alt.t, 3)} s (the return trip).</p>}
        </Card>
      )}
      {r.ok && (
        <Card title="Move along the journey">
          <input className="mk-range" type="range" min="0" max="1" step="0.005" value={s.cursor} onChange={(e) => set({ cursor: Number(e.target.value) })} />
          {at && <Results rows={[["Time", fix(tc, 3), "s"], ["Distance", fix(at.s, 3), "m"], ["Speed", fix(at.v, 3), "m/s"]]} />}
        </Card>
      )}
      <Steps steps={r.steps} open />
    </>
  );
  return <Pane inputs={inputs} diagram={<Diagram draw={draw} fixed hint={false} />} results={answers} />;
}