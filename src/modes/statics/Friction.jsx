import { useCallback } from "react";
import { inclineBlock } from "../../engine/friction.js";
import { fix } from "../../engine/math.js";
import { Pane, Card, NumField, Results, Steps, Diagram, withDefaults, Notice } from "../kit.jsx";
import { C, arrow, label, line } from "../draw.js";

export const DEFAULT = { m: 100, theta: 30, mus: 0.3, muk: 0.2, P: 0, phi: 0, g: 9.81, frictionless: false };

export function compute(s) {
  const mus = s.frictionless ? 0 : s.mus;
  const muk = s.frictionless ? 0 : s.muk;
  return inclineBlock({ m: s.m, theta: s.theta, mus, muk, P: s.P, phi: s.phi, g: s.g });
}

export function drawFriction(ctx, w, h, s, r) {
  const th = (s.theta * Math.PI) / 180;
  const baseY = h * 0.82, x0 = w * 0.08;
  const len = Math.min(w * 0.82, (h * 0.66) / Math.max(Math.sin(th), 0.05));
  const x1 = x0 + len * Math.cos(th), y1 = baseY - len * Math.sin(th);
  // the slope
  ctx.fillStyle = "rgba(139,152,184,.14)"; ctx.strokeStyle = C.muted; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(x1, baseY); ctx.lineTo(x1, y1); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let t = 0.05; t < 1; t += 0.04) {
    const px = x0 + t * (x1 - x0), py = baseY - t * (baseY - y1);
    line(ctx, px, py, px - 8 * Math.sin(th), py + 8 * Math.cos(th) + 2, C.faint, 1);
  }
  // angle mark
  ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x0, baseY, 46, -th, 0); ctx.stroke();
  label(ctx, `θ = ${fix(s.theta, 1)}°`, x0 + 56, baseY - 12, { color: C.accent, size: 12 });

  // the block, sitting in the middle of the slope
  const u = { x: Math.cos(th), y: -Math.sin(th) }; // up the slope on screen
  const n = { x: -Math.sin(th), y: -Math.cos(th) }; // out of the slope
  const t = 0.52;
  const bx = x0 + t * (x1 - x0), by = baseY - t * (baseY - y1);
  const bw = 78, bh = 54;
  const cx = bx + n.x * (bh / 2), cy = by + n.y * (bh / 2);
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-th);
  ctx.fillStyle = "rgba(245,184,61,.2)"; ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh); ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
  ctx.restore();
  label(ctx, `${fix(s.m, 1)} kg`, cx, cy, { align: "center", bg: false, size: 12 });

  // forces: scaled so the largest is about 100 px
  const mags = [r.W, r.N, Math.abs(r.friction || 0), s.P];
  const k = 100 / Math.max(1e-9, ...mags);
  const dir = (vx, vy, mag, color, name, off = 0) => {
    if (mag < 1e-6) return;
    const len2 = Math.max(18, mag * k);
    arrow(ctx, cx, cy, cx + vx * len2, cy + vy * len2, { color, width: 3, head: 11 });
    label(ctx, `${name} = ${fix(mag, 1)} N`, cx + vx * (len2 + 6) + off, cy + vy * (len2 + 6) - 6, { color, align: vx >= 0 ? "left" : "right", bold: true, size: 11.5 });
  };
  dir(0, 1, r.W, C.force, "W");
  if (r.N > 0) dir(n.x, n.y, r.N, C.good, "N");
  const f = r.friction || 0;
  if (Math.abs(f) > 1e-6) dir(u.x * Math.sign(f), u.y * Math.sign(f), Math.abs(f), C.result, r.status === "at rest" ? "friction" : "kinetic friction");
  if (s.P > 1e-6) {
    const ph = (s.phi * Math.PI) / 180;
    dir(u.x * Math.cos(ph) + n.x * Math.sin(ph), u.y * Math.cos(ph) + n.y * Math.sin(ph), s.P, C.purple, "P");
  }
  const color = r.status === "at rest" ? C.good : r.status === "lifts off" ? C.warn : C.result;
  label(ctx, `Block ${r.status}`, w / 2, 24, { color, align: "center", bold: true, size: 14 });
}

export default function FrictionPane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const r = compute(s);
  const draw = useCallback((ctx, w, h) => drawFriction(ctx, w, h, s, r), [JSON.stringify(s)]); // eslint-disable-line react-hooks/exhaustive-deps
  const inputs = (
    <>
      <Card title="Block and slope">
        <NumField label="Mass" unit="kg" value={s.m} min={0} onChange={(m) => set({ m: Math.max(0.001, m) })} />
        <NumField label="Slope angle θ" unit="°" value={s.theta} onChange={(theta) => set({ theta: Math.min(89.9, Math.max(0, theta)) })} hint="0 is flat ground" />
        <NumField label="Gravity g" unit="m/s²" value={s.g} onChange={(g) => set({ g: Math.max(0.01, g) })} />
      </Card>
      <Card title="Friction">
        <label className="mk-check"><input type="checkbox" checked={s.frictionless} onChange={(e) => set({ frictionless: e.target.checked })} /> Smooth surface (ignore friction)</label>
        <NumField label="Static μs" value={s.mus} min={0} disabled={s.frictionless} onChange={(mus) => set({ mus: Math.max(0, mus) })} />
        <NumField label="Kinetic μk" value={s.muk} min={0} disabled={s.frictionless} onChange={(muk) => set({ muk: Math.max(0, muk) })} />
        <p className="mk-help">Tick "smooth surface" for questions that say frictionless, smooth or neglect friction.</p>
      </Card>
      <Card title="Applied force (push or pull)">
        <NumField label="Force P" unit="N" value={s.P} min={0} onChange={(P) => set({ P: Math.max(0, P) })} />
        <NumField label="Angle above the slope φ" unit="°" value={s.phi} onChange={(phi) => set({ phi: Math.min(89, Math.max(-89, phi)) })} />
        <p className="mk-help">P acts up the slope. φ = 0 means parallel to the slope.</p>
      </Card>
    </>
  );
  const answers = (
    <>
      <Card title="Answers">
        <Results
          rows={[
            ["Result", r.status, "", true],
            ["Normal force N", fix(r.N), "N"],
            ...(r.Fmax !== undefined ? [["Largest static friction", fix(r.Fmax), "N"]] : []),
            ...(r.status === "at rest" ? [["Friction holding it", fix(Math.abs(r.friction)), `N ${r.friction >= 0 ? "up" : "down"} the slope`, true]] : []),
            ...(r.status === "slides down" || r.status === "slides up" ? [["Acceleration", fix(r.accel, 3), "m/s²", true]] : []),
            ...(r.critical !== undefined ? [["Friction angle tan⁻¹ μs", fix(r.critical), "°"]] : []),
            ...(r.Pmin !== undefined && r.Pmin !== null ? [["Smallest P to stop it sliding down", fix(r.Pmin), "N"]] : []),
            ...(r.Pup !== undefined && r.Pup !== null ? [["P needed to start it sliding up", fix(r.Pup), "N"]] : []),
          ]}
        />
      </Card>
      <Steps steps={r.steps} />
    </>
  );
  return <Pane inputs={inputs} diagram={<Diagram draw={draw} fixed hint={false} />} results={answers} />;
}