import { useCallback, useState } from "react";
import { collide } from "../../engine/motion.js";
import { fix } from "../../engine/math.js";
import { Pane, Card, NumField, Button, Results, Steps, Diagram, Segmented, useFrames, withDefaults, Notice } from "../kit.jsx";
import { C, boundsOf, fitWorld, grid, arrow, label, line } from "../draw.js";

export const DEFAULT = { m1: 2, u1: 5, m2: 3, u2: -1, e: 0.8, gap: 6 };

// Positions over time for the animation: before the bump they move at u1, u2; after it at v1, v2
export function track(s, r) {
  const hw1 = 0.5 + 0.2 * Math.cbrt(s.m1), hw2 = 0.5 + 0.2 * Math.cbrt(s.m2);
  const X2 = hw1 + hw2 + s.gap;
  const tc = s.u1 - s.u2 > 1e-9 ? s.gap / (s.u1 - s.u2) : Infinity;
  const end = Number.isFinite(tc) ? tc + 3 : 6;
  const at = (t) => {
    if (t <= tc) return { x1: s.u1 * t, x2: X2 + s.u2 * t, hit: false };
    const tt = t - tc;
    return { x1: s.u1 * tc + r.v1 * tt, x2: X2 + s.u2 * tc + r.v2 * tt, hit: true };
  };
  return { hw1, hw2, tc, end, at };
}

export function drawCollision(ctx, w, h, cam, s, r, tr, t) {
  const pts = [];
  for (let i = 0; i <= 40; i++) { const p = tr.at((tr.end * i) / 40); pts.push({ x: p.x1 - tr.hw1, y: 0 }, { x: p.x2 + tr.hw2, y: 0 }); }
  const tf = fitWorld(boundsOf(pts, 10, 0.2), w, h, cam, 60);
  grid(ctx, tf, "m");
  const gy = h * 0.66;
  line(ctx, 0, gy, w, gy, "#c7d2ee", 3);
  const p = tr.at(t);
  const box = (x, hw, color, name, vel) => {
    const px = tf.x(x), pw = hw * 2 * tf.s;
    ctx.fillStyle = color + "33"; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.fillRect(px - pw / 2, gy - pw, pw, pw); ctx.strokeRect(px - pw / 2, gy - pw, pw, pw);
    label(ctx, name, px, gy - pw / 2, { align: "center", bg: false, size: 12 });
    const len = vel * Math.min(14, 120 / Math.max(1, Math.abs(s.u1), Math.abs(s.u2), Math.abs(r.v1), Math.abs(r.v2)));
    arrow(ctx, px, gy - pw - 16, px + len, gy - pw - 16, { color, width: 3, head: 10 });
    label(ctx, `${fix(vel, 2)} m/s`, px + len / 2, gy - pw - 32, { color, align: "center", bold: true, size: 11.5 });
  };
  box(p.x1, tr.hw1, C.force, `${fix(s.m1, 1)} kg`, p.hit ? r.v1 : s.u1);
  box(p.x2, tr.hw2, C.result, `${fix(s.m2, 1)} kg`, p.hit ? r.v2 : s.u2);
  label(ctx, p.hit ? "after the collision" : "before the collision", w / 2, 22, { color: p.hit ? C.good : C.muted, align: "center", bold: true, size: 13 });
  if (!Number.isFinite(tr.tc)) label(ctx, "Body 1 is not catching up with body 2: no collision", w / 2, 46, { color: C.warn, align: "center", size: 12 });
}

export default function CollisionPane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const r = collide(s);
  const tr = track(s, r);
  const tt = Math.min(t, tr.end);
  useFrames(playing, (dt) => {
    const next = t + dt;
    if (next >= tr.end) { setT(tr.end); setPlaying(false); } else setT(next);
  });
  const draw = useCallback((ctx, w, h, cam) => drawCollision(ctx, w, h, cam, s, r, tr, tt), [JSON.stringify(s), tt]); // eslint-disable-line react-hooks/exhaustive-deps
  const kind = s.e >= 0.999 ? "perfectly elastic" : s.e <= 0.001 ? "perfectly inelastic (they stick together)" : "partly elastic";

  const inputs = (
    <>
      <Card title="Body 1 (left)">
        <NumField label="Mass m₁" unit="kg" value={s.m1} min={0} onChange={(m1) => { set({ m1: Math.max(0.001, m1) }); setT(0); }} />
        <NumField label="Velocity u₁" unit="m/s" value={s.u1} onChange={(u1) => { set({ u1 }); setT(0); }} />
      </Card>
      <Card title="Body 2 (right)">
        <NumField label="Mass m₂" unit="kg" value={s.m2} min={0} onChange={(m2) => { set({ m2: Math.max(0.001, m2) }); setT(0); }} />
        <NumField label="Velocity u₂" unit="m/s" value={s.u2} onChange={(u2) => { set({ u2 }); setT(0); }} />
        <p className="mk-help">Positive means moving right, negative means moving left.</p>
      </Card>
      <Card title="How bouncy?">
        <NumField label="Restitution e" value={s.e} min={0} max={1} onChange={(e) => { set({ e: Math.min(1, Math.max(0, e)) }); setT(0); }} hint="1 = perfectly elastic, 0 = they stick together" />
        <div className="mk-btnrow">
          <Button onClick={() => set({ e: 1 })}>Elastic (1)</Button>
          <Button onClick={() => set({ e: 0 })}>Stick together (0)</Button>
        </div>
        <p className="mk-help">This is a {kind} collision.</p>
      </Card>
    </>
  );
  const stage = (
    <>
      <div className="mk-toolbar">
        <Button primary onClick={() => { setT(0); setPlaying(true); }}>▶ Play</Button>
        <Button onClick={() => setPlaying(!playing)} disabled={tt >= tr.end}>{playing ? "❚❚ Pause" : "Resume"}</Button>
        <Button onClick={() => { setPlaying(false); setT(0); }}>⟲ Reset</Button>
      </div>
      <Diagram draw={draw} />
    </>
  );
  const answers = (
    <>
      {!r.approaching && <Notice kind="warn">With these velocities body 1 is not catching up with body 2, so they do not collide. The answers below show what would happen if they did.</Notice>}
      <Card title="Answers">
        <Results rows={[["Velocity after: body 1", fix(r.v1, 3), "m/s", true], ["Velocity after: body 2", fix(r.v2, 3), "m/s", true], ["Momentum before", fix(r.pBefore), "kg·m/s"], ["Momentum after", fix(r.pAfter), "kg·m/s"], ["Kinetic energy before", fix(r.KEbefore), "J"], ["Kinetic energy after", fix(r.KEafter), "J"], ["Energy lost", fix(r.KElost), "J"], ["Impulse on body 2", fix(r.impulse), "N·s"]]} />
      </Card>
      <Steps steps={r.steps} open />
    </>
  );
  return <Pane inputs={inputs} diagram={stage} results={answers} />;
}