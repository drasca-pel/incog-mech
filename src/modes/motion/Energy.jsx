import { useCallback } from "react";
import { energySlope } from "../../engine/motion.js";
import { fix, rad } from "../../engine/math.js";
import { Pane, Card, NumField, Results, Steps, Diagram, withDefaults } from "../kit.jsx";
import { C, label, line, plot } from "../draw.js";

export const DEFAULT = { m: 2, theta: 30, d: 10, mu: 0.2, v0: 0, g: 9.81, frictionless: false };

export const compute = (s) => energySlope({ m: s.m, theta: s.theta, d: s.d, mu: s.frictionless ? 0 : s.mu, v0: s.v0, g: s.g });

export function drawEnergy(ctx, w, h, s, r) {
  const th = rad(s.theta);
  // top half: the slope with the block at its start and end
  const top = h * 0.5;
  const x0 = w * 0.1, baseY = top - 14;
  const len = Math.min(w * 0.8, (top - 50) / Math.max(Math.sin(th), 0.08), w * 0.8 / Math.max(Math.cos(th), 0.2));
  const x1 = x0 + len * Math.cos(th), y1 = baseY - len * Math.sin(th);
  ctx.fillStyle = "rgba(139,152,184,.14)"; ctx.strokeStyle = C.muted; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(x1, baseY); ctx.lineTo(x1, y1); ctx.closePath(); ctx.fill(); ctx.stroke();
  const frac = r.stops && r.stopDistance ? r.stopDistance / s.d : 1;
  const block = (t, text, alpha) => {
    const px = x1 - t * (x1 - x0) * 0.9 - 0.04 * (x1 - x0), py = y1 + t * (baseY - y1) * 0.9 + 0.04 * (baseY - y1);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-th); ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(245,184,61,.3)"; ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.fillRect(-18, -26, 36, 26); ctx.strokeRect(-18, -26, 36, 26);
    ctx.restore();
    label(ctx, text, px - 4, py - 38, { color: C.accent, align: "center", size: 11 });
  };
  block(0, "start", 0.55);
  block(Math.min(1, frac), r.stops ? "stops" : "end", 1);
  label(ctx, `h = ${fix(s.d * Math.sin(th), 2)} m`, x1 + 6, (y1 + baseY) / 2, { color: C.muted, size: 11 });

  // bottom half: energy against distance
  const n = 80;
  const dist = r.stops && r.stopDistance ? r.stopDistance : s.d;
  const mu = s.frictionless ? 0 : s.mu;
  const KE = [], PE = [], TOT = [];
  for (let i = 0; i <= n; i++) {
    const x = (dist * i) / n;
    const ke = 0.5 * s.m * s.v0 * s.v0 + s.m * s.g * Math.sin(th) * x - mu * s.m * s.g * Math.cos(th) * x;
    const pe = s.m * s.g * Math.sin(th) * (s.d - x);
    KE.push({ x, y: Math.max(0, ke) }); PE.push({ x, y: pe }); TOT.push({ x, y: Math.max(0, ke) + pe });
  }
  plot(ctx, { x: 4, y: top + 4, w: w - 8, h: h - top - 8 }, [{ name: "kinetic", color: C.result, pts: KE }, { name: "potential", color: C.force, pts: PE }, { name: "total", color: C.good, pts: TOT }], { title: "Energy along the slope (J)", xLabel: "distance travelled (m)" });
  void line;
}

export default function EnergyPane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const r = compute(s);
  const draw = useCallback((ctx, w, h) => drawEnergy(ctx, w, h, s, r), [JSON.stringify(s)]); // eslint-disable-line react-hooks/exhaustive-deps
  const inputs = (
    <>
      <Card title="Block on a slope">
        <NumField label="Mass" unit="kg" value={s.m} min={0} onChange={(m) => set({ m: Math.max(0.001, m) })} />
        <NumField label="Slope angle" unit="°" value={s.theta} onChange={(theta) => set({ theta: Math.min(90, Math.max(0, theta)) })} hint="90° is free fall" />
        <NumField label="Distance along the slope" unit="m" value={s.d} min={0} onChange={(d) => set({ d: Math.max(0, d) })} />
        <NumField label="Starting speed" unit="m/s" value={s.v0} min={0} onChange={(v0) => set({ v0: Math.max(0, v0) })} />
        <NumField label="Gravity g" unit="m/s²" value={s.g} onChange={(g) => set({ g: Math.max(0.01, g) })} />
      </Card>
      <Card title="Friction">
        <label className="mk-check"><input type="checkbox" checked={s.frictionless} onChange={(e) => set({ frictionless: e.target.checked })} /> Smooth slope (ignore friction)</label>
        <NumField label="Kinetic friction μk" value={s.mu} min={0} disabled={s.frictionless} onChange={(mu) => set({ mu: Math.max(0, mu) })} />
        <p className="mk-help">With a smooth slope, energy is conserved: kinetic gained equals potential lost. Use 90° and a smooth slope for a falling object.</p>
      </Card>
    </>
  );
  const answers = (
    <>
      <Card title="Answers">
        <Results
          rows={[
            ["Potential energy lost", fix(r.PEloss), "J"],
            ["Work against friction", fix(r.Wf), "J"],
            ["Starting kinetic energy", fix(r.KE0), "J"],
            ["Final kinetic energy", fix(r.KE), "J", true],
            ["Final speed", r.stops ? "stops first" : fix(r.v, 3), r.stops ? "" : "m/s", true],
            ...(r.stops ? [["Stops after", r.stopDistance !== null ? fix(r.stopDistance, 3) : "-", "m"]] : []),
          ]}
        />
      </Card>
      <Steps steps={r.steps} open />
    </>
  );
  return <Pane inputs={inputs} diagram={<Diagram draw={draw} fixed hint={false} />} results={answers} />;
}