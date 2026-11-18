import { useCallback, useState } from "react";
import { projectile, projectileDrag, maxRange, anglesForRange } from "../../engine/motion.js";
import { fix } from "../../engine/math.js";
import { Pane, Card, NumField, Button, Results, Steps, Diagram, Segmented, useFrames, withDefaults, Notice } from "../kit.jsx";
import { C, boundsOf, fitWorld, grid, arrow, label, dot, line, plot } from "../draw.js";

export const DEFAULT = {
  v0: 25, angle: 45, h0: 0, g: 9.81, m: 1,
  air: "none", k: 0.02,
  speed: 1, graph: "height", target: 40,
};

// The motion over time, with or without air resistance: { T, at(t) -> { x, y, vx, vy } }
export function makeTrack(s) {
  const ideal = projectile({ v0: s.v0, angle: s.angle, h0: s.h0, g: s.g });
  if (s.air === "none") return { ideal, drag: null, T: ideal.T, at: (t) => ({ ...ideal.pos(Math.min(t, ideal.T)), ...ideal.vel(Math.min(t, ideal.T)) }) };
  const drag = projectileDrag({ v0: s.v0, angle: s.angle, h0: s.h0, g: s.g, model: s.air, k: s.k });
  const path = drag.path;
  const at = (t) => {
    if (t >= drag.T) { const e = path[path.length - 1]; return { x: e.x, y: e.y, vx: e.vx, vy: e.vy }; }
    let lo = 0, hi = path.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path[mid].t <= t) lo = mid; else hi = mid; }
    const a = path[lo], b = path[hi], f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y), vx: a.vx + f * (b.vx - a.vx), vy: a.vy + f * (b.vy - a.vy) };
  };
  return { ideal, drag, T: drag.T, at };
}

const sample = (tr, n = 140) => Array.from({ length: n + 1 }, (_, i) => ({ t: (tr.T * i) / n, ...tr.at((tr.T * i) / n) }));

export function drawFlight(ctx, w, h, cam, s, tr, t) {
  const pts = sample(tr, 60).map((p) => ({ x: p.x, y: p.y }));
  pts.push({ x: 0, y: 0 }, { x: 0, y: s.h0 });
  if (tr.drag) for (let i = 0; i <= 40; i++) pts.push(tr.ideal.pos((tr.ideal.T * i) / 40));
  const tf = fitWorld(boundsOf(pts, 8, 0.2), w, h, cam, 64);
  grid(ctx, tf, "m");
  // the ground, with the earth below it
  const gy = tf.y(0);
  ctx.fillStyle = "rgba(139,152,184,.12)"; ctx.fillRect(0, gy, w, h - gy);
  line(ctx, 0, gy, w, gy, "#c7d2ee", 3);
  for (let x = 0; x < w; x += 16) line(ctx, x, gy, x - 8, gy + 9, C.faint, 1);
  // the launch platform
  if (s.h0 > 0) {
    ctx.fillStyle = "rgba(139,152,184,.25)"; ctx.strokeStyle = C.muted; ctx.lineWidth = 2;
    ctx.fillRect(tf.x(0) - 22, tf.y(s.h0), 22, gy - tf.y(s.h0)); ctx.strokeRect(tf.x(0) - 22, tf.y(s.h0), 22, gy - tf.y(s.h0));
  }
  // flight without air, for comparison
  const idealPts = Array.from({ length: 81 }, (_, i) => tr.ideal.pos((tr.ideal.T * i) / 80));
  ctx.strokeStyle = tr.drag ? C.faint : "rgba(245,184,61,.5)"; ctx.lineWidth = 1.6; ctx.setLineDash([6, 5]); ctx.beginPath();
  idealPts.forEach((p, i) => (i ? ctx.lineTo(tf.x(p.x), tf.y(p.y)) : ctx.moveTo(tf.x(p.x), tf.y(p.y))));
  ctx.stroke(); ctx.setLineDash([]);
  const all = sample(tr, 140);
  if (tr.drag) {
    ctx.strokeStyle = "rgba(245,184,61,.55)"; ctx.lineWidth = 1.8; ctx.setLineDash([6, 5]); ctx.beginPath();
    all.forEach((p, i) => (i ? ctx.lineTo(tf.x(p.x), tf.y(p.y)) : ctx.moveTo(tf.x(p.x), tf.y(p.y))));
    ctx.stroke(); ctx.setLineDash([]);
  }
  // the part already flown
  ctx.strokeStyle = C.accent; ctx.lineWidth = 3; ctx.beginPath();
  let started = false;
  for (const p of all) { if (p.t > t) break; if (started) ctx.lineTo(tf.x(p.x), tf.y(p.y)); else { ctx.moveTo(tf.x(p.x), tf.y(p.y)); started = true; } }
  const cur = tr.at(t);
  if (started) ctx.lineTo(tf.x(cur.x), tf.y(cur.y));
  ctx.stroke();

  // greatest height and landing point
  const top = tr.drag ? { x: tr.drag.path.reduce((b, p) => (p.y > b.y ? p : b), tr.drag.path[0]).x, y: tr.drag.H } : { x: tr.ideal.pos(tr.ideal.tUp).x, y: tr.ideal.H };
  line(ctx, tf.x(top.x), tf.y(top.y), tf.x(top.x), gy, C.good, 1.2, [4, 4]);
  dot(ctx, tf.x(top.x), tf.y(top.y), 4.5, C.good);
  label(ctx, `H = ${fix(top.y, 2)} m`, tf.x(top.x) + 8, tf.y(top.y) - 12, { color: C.good, bold: true, size: 12 });
  const R = tr.drag ? tr.drag.R : tr.ideal.R;
  dot(ctx, tf.x(R), gy, 5, C.result);
  label(ctx, `R = ${fix(R, 2)} m`, tf.x(R), gy - 14, { color: C.result, align: "center", bold: true, size: 12 });
  line(ctx, tf.x(0), gy + 22, tf.x(R), gy + 22, C.result, 1.4);
  line(ctx, tf.x(0), gy + 17, tf.x(0), gy + 27, C.result, 1.4);
  line(ctx, tf.x(R), gy + 17, tf.x(R), gy + 27, C.result, 1.4);

  // launch angle
  const th = (s.angle * Math.PI) / 180, lx = tf.x(0), ly = tf.y(s.h0);
  ctx.strokeStyle = C.accent; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(lx, ly, 34, -th, 0, th < 0); ctx.stroke();
  label(ctx, `${fix(s.angle, 1)}°`, lx + 42, ly - Math.max(6, 18 * Math.sin(th)) - 4, { color: C.accent, size: 11.5 });

  // the projectile and its velocity
  const bx = tf.x(cur.x), by = tf.y(cur.y);
  const sp = Math.hypot(cur.vx, cur.vy);
  const k = Math.min(3.2, 110 / Math.max(sp, 1e-9));
  arrow(ctx, bx, by, bx + cur.vx * k, by - cur.vy * k, { color: C.good, width: 2.6, head: 10 });
  arrow(ctx, bx, by, bx + cur.vx * k, by, { color: C.faint, width: 1.3, head: 6, dash: [3, 3] });
  arrow(ctx, bx, by, bx, by - cur.vy * k, { color: C.faint, width: 1.3, head: 6, dash: [3, 3] });
  dot(ctx, bx, by, 8, C.text);
  ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.stroke();
  label(ctx, `t = ${fix(t, 2)} s`, 12, 20, { color: C.text, bold: true, size: 13, bg: false });
  label(ctx, `speed ${fix(sp, 2)} m/s`, 12, 40, { color: C.good, size: 12, bg: false });
  if (tr.drag) label(ctx, "dashed grey = without air resistance", 12, 60, { color: C.faint, size: 11, bg: false });
}

export function drawFlightGraph(ctx, w, h, s, tr, t) {
  const a = sample(tr, 140);
  let series, title, yl;
  if (s.graph === "height") { series = [{ name: "height y", color: C.force, pts: a.map((p) => ({ x: p.t, y: p.y })) }, { name: "distance x", color: C.purple, pts: a.map((p) => ({ x: p.t, y: p.x })) }]; title = "Position against time (m)"; }
  else if (s.graph === "velocity") { series = [{ name: "vx", color: C.purple, pts: a.map((p) => ({ x: p.t, y: p.vx })) }, { name: "vy", color: C.force, pts: a.map((p) => ({ x: p.t, y: p.vy })) }, { name: "speed", color: C.good, pts: a.map((p) => ({ x: p.t, y: Math.hypot(p.vx, p.vy) })) }]; title = "Velocity against time (m/s)"; }
  else {
    const ke = a.map((p) => ({ x: p.t, y: 0.5 * s.m * (p.vx * p.vx + p.vy * p.vy) }));
    const pe = a.map((p) => ({ x: p.t, y: s.m * s.g * p.y }));
    series = [{ name: "kinetic", color: C.result, pts: ke }, { name: "potential", color: C.force, pts: pe }, { name: "total", color: C.good, pts: ke.map((p, i) => ({ x: p.x, y: p.y + pe[i].y })) }];
    title = "Energy against time (J)";
  }
  void yl;
  plot(ctx, { x: 4, y: 4, w: w - 8, h: h - 8 }, series, { title, xLabel: "time (s)", cursor: t });
}

export default function ProjectilePane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tr = makeTrack(s);
  const tt = Math.min(t, tr.T);
  useFrames(playing, (dt) => {
    const next = t + dt * s.speed;
    if (next >= tr.T) { setT(tr.T); setPlaying(false); } else setT(next);
  });
  const draw = useCallback((ctx, w, h, cam) => drawFlight(ctx, w, h, cam, s, tr, tt), [JSON.stringify(s), tt]); // eslint-disable-line react-hooks/exhaustive-deps
  const drawG = useCallback((ctx, w, h) => drawFlightGraph(ctx, w, h, s, tr, tt), [JSON.stringify(s), tt]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = maxRange({ v0: s.v0, h0: s.h0, g: s.g });
  const forRange = anglesForRange({ v0: s.v0, h0: s.h0, g: s.g, R: s.target });
  const now = tr.at(tt);
  const speedNow = Math.hypot(now.vx, now.vy);
  const launch = () => { setT(0); setPlaying(true); };
  const id = tr.ideal;

  const inputs = (
    <>
      <Card title="Launch">
        <NumField label="Launch speed" unit="m/s" value={s.v0} min={0} onChange={(v0) => { set({ v0: Math.max(0, v0) }); setT(0); }} />
        <NumField label="Launch angle" unit="° above horizontal" value={s.angle} onChange={(angle) => { set({ angle: Math.min(90, Math.max(-90, angle)) }); setT(0); }} />
        <NumField label="Launch height" unit="m above ground" value={s.h0} min={0} onChange={(h0) => { set({ h0: Math.max(0, h0) }); setT(0); }} />
        <NumField label="Gravity g" unit="m/s²" value={s.g} onChange={(g) => { set({ g: Math.max(0.01, g) }); setT(0); }} hint="9.81 on Earth, 3.7 on Mars, 1.62 on the Moon" />
        <NumField label="Mass (for energy)" unit="kg" value={s.m} min={0} onChange={(m) => set({ m: Math.max(0.001, m) })} />
      </Card>
      <Card title="Air resistance">
        <Segmented value={s.air} onChange={(air) => { set({ air }); setT(0); }} options={[["none", "Ignore it"], ["linear", "Linear"], ["quadratic", "Quadratic"]]} />
        {s.air !== "none" && <NumField label="Drag k (per kg)" value={s.k} min={0} onChange={(k) => { set({ k: Math.max(0, k) }); setT(0); }} hint={s.air === "linear" ? "drag force = k m v" : "drag force = k m v²"} />}
        <p className="mk-help">Most exam questions say "neglect air resistance": leave this on <b>Ignore it</b>. Linear drag ∝ v, quadratic ∝ v². The grey dashed path always shows the flight without air.</p>
      </Card>
      <Card title="Best angles">
        <Button onClick={() => { set({ angle: Math.round(best.angle * 1000) / 1000 }); setT(0); }}>Use the angle for maximum range ({fix(best.angle, 2)}°)</Button>
        <p className="mk-help">Maximum range here is {fix(best.R, 2)} m.</p>
        <NumField label="Hit a target at distance" unit="m" value={s.target} min={0} onChange={(target) => set({ target: Math.max(0, target) })} />
        {forRange.angles.length === 0 ? (
          <Notice kind="warn">Out of reach: the longest range at this speed is {fix(best.R, 2)} m.</Notice>
        ) : (
          <div className="mk-btnrow">
            {forRange.angles.map((a, i) => <Button key={i} onClick={() => { set({ angle: Math.round(a * 1000) / 1000 }); setT(0); }}>{i === 0 ? "Low" : "High"} angle {fix(a, 2)}°</Button>)}
          </div>
        )}
      </Card>
    </>
  );

  const stage = (
    <>
      <div className="mk-toolbar">
        <Button primary onClick={launch}>▶ Launch</Button>
        <Button onClick={() => setPlaying(!playing)} disabled={tt >= tr.T}>{playing ? "❚❚ Pause" : "Resume"}</Button>
        <Button onClick={() => { setPlaying(false); setT(0); }}>⟲ Reset</Button>
        <Segmented value={String(s.speed)} onChange={(v) => set({ speed: Number(v) })} options={[["0.25", "0.25×"], ["0.5", "0.5×"], ["1", "1×"], ["2", "2×"]]} />
      </div>
      <Diagram draw={draw} />
    </>
  );

  const answers = (
    <>
      <Card title={s.air === "none" ? "Answers" : "Answers (with air resistance)"}>
        <Results
          rows={
            s.air === "none"
              ? [["Time of flight", fix(id.T, 3), "s", true], ["Range R", fix(id.R, 2), "m", true], ["Greatest height H", fix(id.H, 2), "m above the ground", true], ["Time to the top", fix(id.tUp, 3), "s"], ["Landing speed", fix(id.speedEnd, 2), "m/s"], ["Landing angle", fix(id.impactAngle, 1), "° below horizontal"]]
              : [["Time of flight", fix(tr.drag.T, 3), `s  (without air ${fix(id.T, 3)})`, true], ["Range R", fix(tr.drag.R, 2), `m  (without air ${fix(id.R, 2)})`, true], ["Greatest height H", fix(tr.drag.H, 2), `m  (without air ${fix(id.H, 2)})`, true]]
          }
        />
      </Card>
      <Card title="Right now">
        <Results rows={[["Time", fix(tt, 3), "s"], ["Distance x", fix(now.x, 2), "m"], ["Height y", fix(now.y, 2), "m"], ["vx", fix(now.vx, 2), "m/s"], ["vy", fix(now.vy, 2), "m/s"], ["Speed", fix(speedNow, 2), "m/s"], ["Kinetic energy", fix(0.5 * s.m * speedNow * speedNow, 2), "J"], ["Potential energy", fix(s.m * s.g * now.y, 2), "J"]]} />
      </Card>
      <Card title="Graph" actions={<Segmented value={s.graph} onChange={(graph) => set({ graph })} options={[["height", "Position"], ["velocity", "Velocity"], ["energy", "Energy"]]} />}>
        <div className="mk-graph"><Diagram draw={drawG} fixed hint={false} /></div>
      </Card>
      <Steps steps={id.steps} title={s.air === "none" ? "Solution, step by step" : "Working for the case without air resistance"} />
    </>
  );
  return <Pane inputs={inputs} diagram={stage} results={answers} />;
}