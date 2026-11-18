import { useCallback } from "react";
import { ratios, velocityRatio, effortFor, lawOfMachine, machinePower, powerFromForce, outputPower, MACHINES } from "../../engine/machines.js";
import { fix } from "../../engine/math.js";
import { Pane, Card, NumField, SelectField, Segmented, Results, Steps, Diagram, withDefaults, Notice } from "../kit.jsx";
import { C, label, line, arrow, plot, dot } from "../draw.js";

export const DEFAULT = {
  view: "ratios",
  ratios: { load: 800, effort: 250, dE: 4, dL: 1 },
  vr: { type: "pulley", params: {}, load: 800, eff: 80 },
  law: { l1: 100, e1: 40, l2: 300, e2: 100, VR: 4, test: 500 },
  power: { effort: 250, load: 800, dE: 8, dL: 2, t: 10, F: 500, v: 3, Pin: 2000, eff: 85 },
};

// Everything worked out for the chosen view
export function compute(s) {
  if (s.view === "ratios") return { view: "ratios", r: ratios(s.ratios) };
  if (s.view === "vr") {
    const m = MACHINES[s.vr.type];
    const params = { ...m.defaults, ...s.vr.params };
    const v = velocityRatio(s.vr.type, params);
    const e = v.ok ? effortFor({ load: s.vr.load, VR: v.VR, eff: s.vr.eff }) : null;
    return { view: "vr", params, v, e };
  }
  if (s.view === "law") return { view: "law", r: lawOfMachine({ load: s.law.l1, effort: s.law.e1 }, { load: s.law.l2, effort: s.law.e2 }, s.law.VR) };
  return { view: "power", p: machinePower(s.power), f: powerFromForce({ F: s.power.F, v: s.power.v }), o: outputPower({ Pin: s.power.Pin, eff: s.power.eff }) };
}

// horizontal bars with values: items = [{ name, value, color }]
function bars(ctx, rect, items, unit, title) {
  const max = Math.max(1e-9, ...items.map((i) => Math.abs(i.value)));
  const bh = Math.min(46, (rect.h - 60) / items.length - 12);
  label(ctx, title, rect.x, rect.y + 14, { color: C.text, bold: true, size: 13, bg: false });
  items.forEach((it, i) => {
    const y = rect.y + 40 + i * (bh + 14);
    const len = (Math.abs(it.value) / max) * (rect.w - 190);
    ctx.fillStyle = it.color + "44"; ctx.fillRect(rect.x + 150, y, len, bh);
    ctx.strokeStyle = it.color; ctx.lineWidth = 2; ctx.strokeRect(rect.x + 150, y, len, bh);
    label(ctx, it.name, rect.x + 140, y + bh / 2, { color: C.muted, align: "right", size: 12, bg: false });
    label(ctx, `${fix(it.value, 2)} ${unit}`, rect.x + 158 + len, y + bh / 2, { color: it.color, bold: true, size: 12, bg: false });
  });
}

// a simple picture of each machine
function drawMachine(ctx, w, h, type, p) {
  const cx = w / 2, cy = h / 2;
  ctx.lineWidth = 3; ctx.strokeStyle = "#c7d2ee"; ctx.fillStyle = "rgba(139,152,184,.2)";
  if (type === "lever") {
    const total = p.effortArm + p.loadArm, S = Math.min(w * 0.7, 520) / total;
    const fx = cx - ((p.effortArm - p.loadArm) / 2) * S; // fulcrum position
    const lx = fx - p.effortArm * S, rx = fx + p.loadArm * S;
    line(ctx, lx, cy, rx, cy, "#c7d2ee", 7);
    ctx.beginPath(); ctx.moveTo(fx, cy + 4); ctx.lineTo(fx - 16, cy + 40); ctx.lineTo(fx + 16, cy + 40); ctx.closePath(); ctx.fill(); ctx.stroke();
    arrow(ctx, lx, cy - 70, lx, cy - 8, { color: C.force, width: 3.5, head: 12 });
    arrow(ctx, rx, cy - 8, rx, cy - 70, { color: C.result, width: 3.5, head: 12 });
    ctx.save(); ctx.translate(0, 0); ctx.restore();
    arrow(ctx, lx, cy - 70, lx, cy - 8, { color: C.force, width: 3.5, head: 12 });
    label(ctx, "effort", lx, cy - 82, { color: C.force, align: "center", bold: true });
    label(ctx, "load", rx, cy - 82, { color: C.result, align: "center", bold: true });
    label(ctx, `effort arm ${fix(p.effortArm, 2)} m`, (lx + fx) / 2, cy + 62, { color: C.force, align: "center" });
    label(ctx, `load arm ${fix(p.loadArm, 2)} m`, (fx + rx) / 2, cy + 82, { color: C.result, align: "center" });
    label(ctx, "fulcrum", fx, cy + 54, { color: C.muted, align: "center", size: 11 });
  } else if (type === "pulley") {
    const n = Math.max(1, Math.round(p.n)), top = cy - 110, bot = cy + 40;
    line(ctx, cx - 120, top - 6, cx + 120, top - 6, "#c7d2ee", 5);
    for (let i = 0; i < n; i++) { const x = cx - ((n - 1) * 20) + i * 40; line(ctx, x, top, x, bot, "#d9b779", 2.5); }
    ctx.fillStyle = "rgba(245,184,61,.25)"; ctx.strokeStyle = C.accent; ctx.fillRect(cx - n * 20 - 10, bot, n * 40 + 20, 40); ctx.strokeRect(cx - n * 20 - 10, bot, n * 40 + 20, 40);
    label(ctx, "load", cx, bot + 20, { align: "center", bg: false });
    arrow(ctx, cx + 140, top + 20, cx + 140, top + 110, { color: C.force, width: 3.5, head: 12 });
    label(ctx, "effort", cx + 140, top + 126, { color: C.force, align: "center", bold: true });
    label(ctx, `${n} string${n === 1 ? "" : "s"} support the load`, cx, bot + 70, { color: C.muted, align: "center" });
  } else if (type === "wheelAxle") {
    const R = 100, r = Math.max(8, Math.min(R - 10, (R * p.r) / p.R));
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(245,184,61,.3)"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = C.accent; ctx.stroke();
    line(ctx, cx + R, cy, cx + R, cy + 90, "#d9b779", 2.5); arrow(ctx, cx + R, cy + 60, cx + R, cy + 110, { color: C.force, width: 3.5, head: 12 });
    line(ctx, cx - r, cy, cx - r, cy + 90, "#d9b779", 2.5); arrow(ctx, cx - r, cy + 60, cx - r, cy + 110, { color: C.result, width: 3.5, head: 12 });
    label(ctx, "effort", cx + R, cy + 126, { color: C.force, align: "center", bold: true }); label(ctx, "load", cx - r, cy + 126, { color: C.result, align: "center", bold: true });
    label(ctx, `R = ${fix(p.R, 3)} m`, cx + R / 2, cy - 8, { color: C.force, align: "center", size: 11 }); label(ctx, `r = ${fix(p.r, 3)} m`, cx - r / 2, cy - 22, { color: C.result, align: "center", size: 11 });
  } else if (type === "incline") {
    const ang = Math.asin(Math.min(1, p.height / p.length)), L = Math.min(w * 0.7, 460), x0 = cx - (L * Math.cos(ang)) / 2, y0 = cy + (L * Math.sin(ang)) / 2;
    const x1 = x0 + L * Math.cos(ang), y1 = y0 - L * Math.sin(ang);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.closePath(); ctx.fill(); ctx.stroke();
    label(ctx, `slope ${fix(p.length, 2)} m`, (x0 + x1) / 2 - 20, (y0 + y1) / 2 - 22, { color: C.force, align: "center" });
    label(ctx, `height ${fix(p.height, 2)} m`, x1 + 10, (y0 + y1) / 2, { color: C.result });
    label(ctx, `${fix((ang * 180) / Math.PI, 1)}°`, x0 + 60, y0 - 10, { color: C.accent });
  } else if (type === "screw") {
    const a = Math.min(130, 60 + p.a * 120);
    ctx.beginPath(); ctx.arc(cx, cy, a, 0, Math.PI * 2); ctx.stroke(); line(ctx, cx, cy, cx + a, cy, C.force, 3.5);
    label(ctx, `handle radius ${fix(p.a, 3)} m`, cx + a / 2, cy - 14, { color: C.force, align: "center" });
    dot(ctx, cx, cy, 6, C.accent);
    label(ctx, `One turn lifts the load by the pitch, ${fix(p.pitch, 4)} m`, cx, cy + a + 28, { color: C.muted, align: "center" });
  } else {
    const t1 = Math.round(p.driver), t2 = Math.round(p.driven), r1 = 40 + Math.min(60, t1), r2 = 40 + Math.min(110, t2);
    const g = (x, y, r, t) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); for (let i = 0; i < Math.min(t, 36); i++) { const a = (i / Math.min(t, 36)) * Math.PI * 2; line(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8), "#c7d2ee", 3); } };
    const x1 = cx - (r1 + r2) / 2, x2 = x1 + r1 + r2 + 8;
    g(x1, cy, r1, t1); g(x2, cy, r2, t2);
    label(ctx, `driver ${t1} teeth`, x1, cy, { align: "center", color: C.force, bg: false }); label(ctx, `driven ${t2} teeth`, x2, cy, { align: "center", color: C.result, bg: false });
  }
}

export function drawMachines(ctx, w, h, s, c) {
  if (c.view === "ratios") {
    const r = c.r, e = s.ratios;
    bars(ctx, { x: 24, y: 10, w: w - 48, h: h - 10 }, [
      { name: "Work put in", value: r.workIn, color: C.force },
      { name: "Work got out", value: r.workOut, color: C.good },
      { name: "Wasted (friction)", value: Math.max(0, r.workLost), color: C.warn },
    ], "J", `Efficiency ${fix(r.eff, 1)}%   (MA ${fix(r.MA, 2)}, VR ${fix(r.VR, 2)})`);
    void e;
  } else if (c.view === "vr") {
    if (!c.v.ok) { label(ctx, c.v.error, w / 2, h / 2, { color: C.warn, align: "center", bold: true }); return; }
    drawMachine(ctx, w, h, s.vr.type, c.params);
    label(ctx, `VR = ${fix(c.v.VR, 3)}`, w / 2, 26, { color: C.accent, align: "center", bold: true, size: 16 });
  } else if (c.view === "law") {
    if (!c.r.ok) { label(ctx, c.r.error, w / 2, h / 2, { color: C.warn, align: "center", bold: true }); return; }
    const Lmax = Math.max(s.law.l1, s.law.l2, s.law.test) * 1.25 || 1;
    const line1 = [{ x: 0, y: c.r.c }, { x: Lmax, y: c.r.m * Lmax + c.r.c }];
    const ideal = [{ x: 0, y: 0 }, { x: Lmax, y: Lmax / s.law.VR }];
    plot(ctx, { x: 6, y: 6, w: w - 12, h: h - 12 }, [{ name: `E = ${fix(c.r.m, 3)} L + ${fix(c.r.c, 2)}`, color: C.accent, pts: line1 }, { name: "ideal E = L / VR", color: C.faint, pts: ideal }], { title: "Effort against load", xLabel: "load L" });
  } else {
    bars(ctx, { x: 24, y: 10, w: w - 48, h: h - 10 }, [
      { name: "Power in", value: c.p.Pin, color: C.force },
      { name: "Power out", value: c.p.Pout, color: C.good },
      { name: "Power wasted", value: Math.max(0, c.p.Plost), color: C.warn },
    ], "W", `Efficiency ${fix(c.p.eff, 1)}%`);
  }
}

export default function MachinesPane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const c = compute(s);
  const draw = useCallback((ctx, w, h) => drawMachines(ctx, w, h, s, c), [JSON.stringify(s)]); // eslint-disable-line react-hooks/exhaustive-deps
  const sub = (key, patch) => set({ [key]: { ...s[key], ...patch } });
  const m = MACHINES[s.vr.type];
  const params = { ...m.defaults, ...s.vr.params };

  let inputs, answers;
  if (s.view === "ratios") {
    const r = c.r, v = s.ratios;
    inputs = (
      <Card title="What you measured">
        <NumField label="Load" unit="N" value={v.load} min={0} onChange={(load) => sub("ratios", { load: Math.max(0.001, load) })} hint="The force the machine overcomes (the weight lifted)" />
        <NumField label="Effort" unit="N" value={v.effort} min={0} onChange={(effort) => sub("ratios", { effort: Math.max(0.001, effort) })} hint="The force you put in" />
        <NumField label="Distance moved by the effort" unit="m" value={v.dE} min={0} onChange={(dE) => sub("ratios", { dE: Math.max(0.001, dE) })} />
        <NumField label="Distance moved by the load" unit="m" value={v.dL} min={0} onChange={(dL) => sub("ratios", { dL: Math.max(0.001, dL) })} />
        <p className="mk-help">Mechanical advantage tells how much the machine multiplies your force. Velocity ratio tells how much further you move than the load. Efficiency compares the two.</p>
      </Card>
    );
    answers = (
      <>
        <Card title="Answers">
          <Results rows={[["Mechanical advantage MA", fix(r.MA, 3), "", true], ["Velocity ratio VR", fix(r.VR, 3), "", true], ["Efficiency η", fix(r.eff, 2), "%", true], ["Work put in", fix(r.workIn), "J"], ["Work got out", fix(r.workOut), "J"], ["Work wasted", fix(r.workLost), "J"], ["Effort with no friction", fix(r.idealEffort), "N"]]} />
        </Card>
        {r.eff > 100.0001 && <Notice kind="warn">An efficiency above 100% is impossible. Check the load, effort and distances.</Notice>}
        <Steps steps={r.steps} open />
      </>
    );
  } else if (s.view === "vr") {
    inputs = (
      <>
        <Card title="Which machine?">
          <SelectField label="Machine" value={s.vr.type} onChange={(type) => sub("vr", { type, params: {} })} options={Object.entries(MACHINES).map(([k, x]) => [k, x.name])} />
          {m.fields.map(([k, name, unit]) => <NumField key={k} label={name} unit={unit} value={params[k]} min={0} onChange={(val) => sub("vr", { params: { ...params, [k]: Math.max(0.0001, val) } })} />)}
          <p className="mk-help">{m.formula}</p>
        </Card>
        <Card title="Load and efficiency">
          <NumField label="Load to move" unit="N" value={s.vr.load} min={0} onChange={(load) => sub("vr", { load: Math.max(0.001, load) })} />
          <NumField label="Efficiency of the machine" unit="%" value={s.vr.eff} min={0} max={100} onChange={(eff) => sub("vr", { eff: Math.min(100, Math.max(0.1, eff)) })} />
        </Card>
      </>
    );
    answers = (
      <>
        {!c.v.ok && <Notice kind="warn">{c.v.error}</Notice>}
        {c.v.ok && (
          <Card title="Answers">
            <Results rows={[["Velocity ratio VR", fix(c.v.VR, 3), "", true], ["Effort with no friction", fix(c.e.ideal), "N"], ["Actual effort at this efficiency", fix(c.e.actual), "N", true], ["Mechanical advantage", fix(s.vr.load / c.e.actual, 3), ""]]} />
          </Card>
        )}
        {c.v.ok && <Steps steps={[...c.v.steps, ...c.e.steps]} open />}
      </>
    );
  } else if (s.view === "law") {
    const v = s.law, r = c.r;
    inputs = (
      <>
        <Card title="Two readings from an experiment">
          <div className="mk-pair"><NumField label="Load 1 (N)" value={v.l1} onChange={(l1) => sub("law", { l1 })} /><NumField label="Effort 1 (N)" value={v.e1} onChange={(e1) => sub("law", { e1 })} /></div>
          <div className="mk-pair"><NumField label="Load 2 (N)" value={v.l2} onChange={(l2) => sub("law", { l2 })} /><NumField label="Effort 2 (N)" value={v.e2} onChange={(e2) => sub("law", { e2 })} /></div>
          <NumField label="Velocity ratio of the machine" value={v.VR} min={0} onChange={(VR) => sub("law", { VR: Math.max(0.001, VR) })} />
          <NumField label="Find the effort for a load of" unit="N" value={v.test} onChange={(test) => sub("law", { test })} />
        </Card>
      </>
    );
    answers = (
      <>
        {!r.ok && <Notice kind="warn">{r.error}</Notice>}
        {r.ok && (
          <Card title="Law of the machine  E = mL + c">
            <Results rows={[["Slope m", fix(r.m, 4), "", true], ["Constant c (effort lost to friction)", fix(r.c, 3), "N", true], [`Effort for ${fix(v.test)} N`, fix(r.at(v.test).effort), "N"], [`Efficiency at ${fix(v.test)} N`, fix(r.at(v.test).eff, 2), "%"], ["Greatest possible efficiency", r.maxEff !== undefined ? fix(r.maxEff, 2) : "-", "%"]]} />
          </Card>
        )}
        {r.ok && <Steps steps={r.steps} open />}
      </>
    );
  } else {
    const v = s.power;
    inputs = (
      <>
        <Card title="A machine doing work over time">
          <NumField label="Effort" unit="N" value={v.effort} onChange={(effort) => sub("power", { effort: Math.max(0.001, effort) })} />
          <NumField label="Load" unit="N" value={v.load} onChange={(load) => sub("power", { load: Math.max(0.001, load) })} />
          <NumField label="Effort distance" unit="m" value={v.dE} onChange={(dE) => sub("power", { dE: Math.max(0.001, dE) })} />
          <NumField label="Load distance" unit="m" value={v.dL} onChange={(dL) => sub("power", { dL: Math.max(0.001, dL) })} />
          <NumField label="Time taken" unit="s" value={v.t} min={0} onChange={(t) => sub("power", { t: Math.max(0.001, t) })} />
        </Card>
        <Card title="Quick power sums">
          <div className="mk-pair"><NumField label="Force (N)" value={v.F} onChange={(F) => sub("power", { F })} /><NumField label="Speed (m/s)" value={v.v} onChange={(vv) => sub("power", { v: vv })} /></div>
          <div className="mk-pair"><NumField label="Input power (W)" value={v.Pin} onChange={(Pin) => sub("power", { Pin })} /><NumField label="Efficiency (%)" value={v.eff} onChange={(eff) => sub("power", { eff: Math.min(100, Math.max(0, eff)) })} /></div>
        </Card>
      </>
    );
    answers = (
      <>
        <Card title="Machine power">
          <Results rows={[["Power put in", fix(c.p.Pin), "W", true], ["Power got out", fix(c.p.Pout), "W", true], ["Power wasted", fix(c.p.Plost), "W"], ["Efficiency", fix(c.p.eff, 2), "%"]]} />
        </Card>
        <Card title="Quick sums">
          <Results rows={[[`P = F × v`, fix(c.f.P), "W"], ["Same in horsepower", fix(c.f.P / 745.7, 3), "hp"], ["Output power at this efficiency", fix(c.o.Pout), "W"], ["Power lost", fix(c.o.Plost), "W"]]} />
        </Card>
        <Steps steps={[...c.p.steps, ...c.f.steps, ...c.o.steps]} open />
      </>
    );
  }

  const top = (
    <Card title="Machines: force, load and efficiency">
      <Segmented value={s.view} onChange={(view) => set({ view })} options={[["ratios", "Ratios"], ["vr", "Velocity ratio"], ["law", "Law of machine"], ["power", "Power"]]} />
    </Card>
  );
  return <Pane inputs={<>{top}{inputs}</>} diagram={<Diagram draw={draw} fixed hint={false} />} results={answers} />;
}