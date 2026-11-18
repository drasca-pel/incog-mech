import { useCallback } from "react";
import { analyseBeam } from "../../engine/beam.js";
import { fix } from "../../engine/math.js";
import { Pane, Card, NumField, SelectField, Button, Results, Steps, Diagram, withDefaults, Notice } from "../kit.jsx";
import { C, label, arrow, line, arcArrow, pinSupport, rollerSupport, fixedWall, dot } from "../draw.js";

export const DEFAULT = {
  L: 10,
  support: { type: "simple", a: 0, b: 10 },
  loads: [
    { type: "point", x: 4, P: 20 },
    { type: "udl", x1: 6, x2: 10, w: 5 },
  ],
};

const LOAD_FIELDS = {
  point: [["x", "x (m)"], ["P", "P (kN ↓)"]],
  udl: [["x1", "from (m)"], ["x2", "to (m)"], ["w", "w (kN/m ↓)"]],
  uvl: [["x1", "from (m)"], ["x2", "to (m)"], ["w1", "w at start"], ["w2", "w at end"]],
  moment: [["x", "x (m)"], ["M", "M (kN·m ↺)"]],
};
const NEW_LOAD = {
  point: { type: "point", x: 5, P: 10 },
  udl: { type: "udl", x1: 2, x2: 6, w: 3 },
  uvl: { type: "uvl", x1: 0, x2: 6, w1: 0, w2: 6 },
  moment: { type: "moment", x: 5, M: 10 },
};

export function compute(s) {
  const loads = s.loads.filter((l) => {
    if (l.type === "udl" || l.type === "uvl") return l.x2 > l.x1;
    return true;
  });
  return analyseBeam({ L: s.L, support: s.support, loads });
}

function curve(ctx, rect, samples, key, color, title, X, extreme) {
  const { y, h } = rect;
  const vals = samples.map((p) => p[key]);
  const maxAbs = Math.max(1e-9, ...vals.map(Math.abs));
  const mid = y + h / 2;
  const k = (h / 2 - 16) / maxAbs;
  ctx.save();
  ctx.fillStyle = "rgba(18,26,44,.7)"; ctx.fillRect(rect.x, y, rect.w, h);
  line(ctx, rect.x, mid, rect.x + rect.w, mid, C.axis, 1);
  ctx.beginPath();
  ctx.moveTo(X(samples[0].x), mid);
  for (const p of samples) ctx.lineTo(X(p.x), mid - p[key] * k);
  ctx.lineTo(X(samples[samples.length - 1].x), mid);
  ctx.closePath();
  ctx.fillStyle = color + "33"; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
  samples.forEach((p, i) => (i ? ctx.lineTo(X(p.x), mid - p[key] * k) : ctx.moveTo(X(p.x), mid - p[key] * k)));
  ctx.stroke();
  ctx.restore();
  label(ctx, title, rect.x + 8, y + 11, { color, bold: true, size: 11.5, bg: false });
  if (extreme && Math.abs(extreme.v) > 1e-9) {
    dot(ctx, X(extreme.x), mid - extreme.v * k, 4, color);
    label(ctx, `${fix(extreme.v, 2)}`, X(extreme.x) + 7, mid - extreme.v * k + (extreme.v >= 0 ? -9 : 10), { color, bold: true, size: 11 });
  }
}

export function drawBeam(ctx, w, h, s, r) {
  const left = 64, right = w - 44;
  const X = (x) => left + (x / s.L) * (right - left);
  const beamY = Math.round(h * 0.27);
  const loads = s.loads;
  const maxP = Math.max(1e-9, ...loads.filter((l) => l.type === "point").map((l) => Math.abs(l.P)));
  const maxW = Math.max(1e-9, ...loads.filter((l) => l.type === "udl").map((l) => Math.abs(l.w)), ...loads.filter((l) => l.type === "uvl").flatMap((l) => [Math.abs(l.w1), Math.abs(l.w2)]));

  // the beam
  line(ctx, X(0), beamY, X(s.L), beamY, "#c7d2ee", 7);
  // supports
  if (s.support.type === "simple") {
    pinSupport(ctx, X(s.support.a), beamY + 3, 12);
    rollerSupport(ctx, X(s.support.b), beamY + 3, 12);
  } else {
    fixedWall(ctx, X(s.support.side === "right" ? s.L : 0), beamY, s.support.side === "right" ? "right" : "left", 30);
  }
  // loads
  for (const l of loads) {
    if (l.type === "point") {
      const len = 26 + 40 * (Math.abs(l.P) / maxP);
      const dir = l.P >= 0 ? 1 : -1;
      arrow(ctx, X(l.x), beamY - 4 - (dir > 0 ? len : 0), X(l.x), beamY - 4 - (dir > 0 ? 0 : len), { color: C.result, width: 2.8, head: 10 });
      label(ctx, `${fix(Math.abs(l.P), 2)} kN`, X(l.x), beamY - len - 16, { color: C.result, align: "center", size: 11.5 });
    } else if (l.type === "udl" || l.type === "uvl") {
      if (!(l.x2 > l.x1)) continue;
      const w1 = l.type === "udl" ? l.w : l.w1, w2 = l.type === "udl" ? l.w : l.w2;
      const hh = (v) => 8 + 32 * (Math.abs(v) / maxW);
      ctx.fillStyle = "rgba(255,122,89,.18)"; ctx.strokeStyle = C.result; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(X(l.x1), beamY - 4); ctx.lineTo(X(l.x1), beamY - 4 - hh(w1)); ctx.lineTo(X(l.x2), beamY - 4 - hh(w2)); ctx.lineTo(X(l.x2), beamY - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      const n = Math.max(2, Math.round((X(l.x2) - X(l.x1)) / 22));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = X(l.x1) + t * (X(l.x2) - X(l.x1)), v = w1 + (w2 - w1) * t;
        arrow(ctx, x, beamY - 4 - hh(v), x, beamY - 5, { color: C.result, width: 1.3, head: 5 });
      }
      label(ctx, l.type === "udl" ? `${fix(l.w, 2)} kN/m` : `${fix(w1, 1)} to ${fix(w2, 1)} kN/m`, (X(l.x1) + X(l.x2)) / 2, beamY - 4 - Math.max(hh(w1), hh(w2)) - 12, { color: C.result, align: "center", size: 11 });
    } else if (l.type === "moment") {
      arcArrow(ctx, X(l.x), beamY - 30, 16, l.M >= 0, C.accent);
      label(ctx, `${fix(Math.abs(l.M), 2)} kN·m`, X(l.x), beamY - 60, { color: C.accent, align: "center", size: 11 });
    }
  }
  // distances along the beam
  const marks = new Set([0, s.L, ...(s.support.type === "simple" ? [s.support.a, s.support.b] : []), ...loads.flatMap((l) => (l.x !== undefined ? [l.x] : [l.x1, l.x2]))]);
  for (const m of marks) {
    if (m < 0 || m > s.L) continue;
    line(ctx, X(m), beamY + 40, X(m), beamY + 46, C.faint, 1);
    label(ctx, fix(m, 2), X(m), beamY + 58, { color: C.faint, align: "center", size: 10.5, bg: false });
  }

  if (!r.ok) {
    label(ctx, r.error || "Check the inputs", w / 2, h * 0.65, { color: C.warn, align: "center", bold: true, size: 13 });
    return;
  }
  // reactions
  for (const q of r.reactions) {
    const up = q.Fy >= 0;
    const y0 = beamY + 78 - 4;
    arrow(ctx, X(q.x), up ? y0 + 28 : y0, X(q.x), up ? y0 - 6 : y0 + 22, { color: C.good, width: 2.6, head: 10 });
    label(ctx, `${q.name} = ${fix(Math.abs(q.Fy), 2)} kN ${up ? "↑" : "↓"}`, X(q.x), y0 + 44, { color: C.good, align: "center", bold: true, size: 11.5 });
    if (Math.abs(q.M) > 1e-9) label(ctx, `M = ${fix(Math.abs(q.M), 2)} kN·m ${q.M > 0 ? "↺" : "↻"}`, X(q.x), y0 + 60, { color: C.good, align: "center", bold: true, size: 11 });
  }
  const top = Math.round(h * 0.52);
  const each = Math.round((h - top - 6) / 2);
  curve(ctx, { x: 0, y: top, w, h: each - 4 }, r.samples, "V", C.force, "Shear force V (kN)", X, r.Vmax);
  curve(ctx, { x: 0, y: top + each, w, h: each - 4 }, r.samples, "M", C.purple, "Bending moment M (kN·m), sagging +", X, r.Mmax);
}

export default function BeamPane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const r = compute(s);
  const draw = useCallback((ctx, w, h) => drawBeam(ctx, w, h, s, r), [JSON.stringify(s)]); // eslint-disable-line react-hooks/exhaustive-deps
  const setLoad = (i, patch) => set({ loads: s.loads.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const sup = s.support;

  const inputs = (
    <>
      <Card title="Beam">
        <NumField label="Length" unit="m" value={s.L} min={0.1} onChange={(L) => set({ L: Math.max(0.1, L) })} />
        <SelectField
          label="Supports"
          value={sup.type === "simple" ? "simple" : sup.side === "right" ? "right" : "left"}
          onChange={(v) => set({ support: v === "simple" ? { type: "simple", a: 0, b: s.L } : { type: "cantilever", side: v } })}
          options={[["simple", "Pin and roller"], ["left", "Cantilever (fixed left)"], ["right", "Cantilever (fixed right)"]]}
        />
        {sup.type === "simple" && (
          <div className="mk-pair">
            <NumField label="Pin at" unit="m" value={sup.a} onChange={(a) => set({ support: { ...sup, a: Math.min(s.L, Math.max(0, a)) } })} />
            <NumField label="Roller at" unit="m" value={sup.b} onChange={(b) => set({ support: { ...sup, b: Math.min(s.L, Math.max(0, b)) } })} />
          </div>
        )}
      </Card>
      <Card
        title="Loads"
        actions={
          <select className="mk-select" value="" onChange={(e) => e.target.value && set({ loads: [...s.loads, { ...NEW_LOAD[e.target.value] }] })}>
            <option value="">+ Add load</option>
            <option value="point">Point load</option>
            <option value="udl">Uniform load</option>
            <option value="uvl">Triangular / varying</option>
            <option value="moment">Couple (moment)</option>
          </select>
        }
      >
        {s.loads.length === 0 && <p className="mk-help">No loads yet. Use "+ Add load".</p>}
        {s.loads.map((l, i) => (
          <div className="mk-load" key={i}>
            <div className="mk-load-head">
              <strong>{{ point: "Point load", udl: "Uniform load", uvl: "Varying load", moment: "Couple" }[l.type]}</strong>
              <button className="mk-x" onClick={() => set({ loads: s.loads.filter((_, k) => k !== i) })} aria-label="Remove load">×</button>
            </div>
            <div className="mk-grid2">
              {LOAD_FIELDS[l.type].map(([k, name]) => (
                <NumField key={k} label={name} value={l[k]} onChange={(v) => setLoad(i, { [k]: v })} />
              ))}
            </div>
          </div>
        ))}
        <p className="mk-help">Downward loads are positive. A positive couple turns anticlockwise.</p>
      </Card>
    </>
  );

  const answers = (
    <>
      {!r.ok && <Notice kind="warn">{r.error}</Notice>}
      {r.ok && (
        <Card title="Answers">
          <Results
            rows={[
              ...(sup.type === "simple"
                ? [["Pin reaction A", fix(r.result.A), "kN ↑", true], ["Roller reaction B", fix(r.result.B), "kN ↑", true]]
                : [["Support force", fix(r.result.V), "kN ↑", true], ["Fixed-end moment", fix(Math.abs(r.result.M)), `kN·m ${r.result.M >= 0 ? "anticlockwise" : "clockwise"}`, true]]),
              ["Total load", fix(r.totalW), "kN"],
              ["Largest shear", fix(r.Vmax.v), `kN at x = ${fix(r.Vmax.x)} m`],
              ["Largest bending moment", fix(r.Mmax.v), `kN·m at x = ${fix(r.Mmax.x)} m`],
            ]}
          />
        </Card>
      )}
      <Steps steps={r.steps} />
    </>
  );
  return <Pane inputs={inputs} diagram={<Diagram draw={draw} fixed hint={false} />} results={answers} />;
}