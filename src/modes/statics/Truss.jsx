import { useCallback } from "react";
import { solveTruss, TRUSS_PRESETS } from "../../engine/truss.js";
import { fix } from "../../engine/math.js";
import { Pane, Card, NumField, SelectField, Button, Results, Steps, Diagram, withDefaults, Notice } from "../kit.jsx";
import { C, boundsOf, fitWorld, grid, arrow, label, dot, line, pinSupport, rollerSupport } from "../draw.js";

const copy = (o) => JSON.parse(JSON.stringify(o));
export const DEFAULT = copy(TRUSS_PRESETS.triangle);

export const compute = (s) => solveTruss(s);

export function drawTruss(ctx, w, h, cam, s, r) {
  const tf = fitWorld(boundsOf(s.nodes, 4, 0.5), w, h, cam, 90);
  grid(ctx, tf, "m");
  const P = (i) => ({ x: tf.x(s.nodes[i].x), y: tf.y(s.nodes[i].y) });
  s.members.forEach((m, k) => {
    if (!s.nodes[m.a] || !s.nodes[m.b]) return;
    const a = P(m.a), b = P(m.b);
    const f = r.ok ? r.members[k] : null;
    const col = !f ? C.muted : f.kind === "tension" ? C.result : f.kind === "compression" ? C.force : C.faint;
    line(ctx, a.x, a.y, b.x, b.y, col, 4.5);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    label(ctx, f ? `${f.force > 0 ? "+" : ""}${fix(f.force, 2)}` : `${k + 1}`, mx, my - 11, { color: col === C.muted ? C.text : col, align: "center", bold: true, size: 11.5 });
  });
  // supports
  for (const sp of s.supports) {
    const p = s.nodes[sp.node] && P(sp.node);
    if (!p) continue;
    if (sp.kind === "pin") pinSupport(ctx, p.x, p.y + 4, 12);
    else rollerSupport(ctx, p.x, p.y + 4, 12);
  }
  // loads
  const maxL = Math.max(1e-9, ...s.loads.map((l) => Math.hypot(l.fx || 0, l.fy || 0)));
  for (const l of s.loads) {
    const p = s.nodes[l.node] && P(l.node);
    if (!p) continue;
    const mag = Math.hypot(l.fx || 0, l.fy || 0);
    if (mag < 1e-9) continue;
    const len = 30 + 50 * (mag / maxL);
    const ux = (l.fx || 0) / mag, uy = (l.fy || 0) / mag;
    arrow(ctx, p.x - ux * len, p.y + uy * len, p.x - ux * 8, p.y + uy * 8, { color: C.accent, width: 3, head: 11 });
    label(ctx, `${fix(mag, 2)} kN`, p.x - ux * len, p.y + uy * len - (uy < 0 ? -12 : 12), { color: C.accent, align: "center", size: 11.5 });
  }
  // reactions
  if (r.ok) {
    const maxR = Math.max(1e-9, ...r.reactions.map((q) => Math.abs(q.value)));
    for (const q of r.reactions) {
      if (Math.abs(q.value) < 1e-9) continue;
      const p = P(q.node);
      const len = 28 + 40 * (Math.abs(q.value) / maxR);
      const sgn = q.value >= 0 ? 1 : -1;
      if (q.dir === "y") {
        const y0 = p.y + 46;
        arrow(ctx, p.x + 26, sgn > 0 ? y0 : y0 - len, p.x + 26, sgn > 0 ? y0 - len : y0, { color: C.good, width: 2.6, head: 10 });
        label(ctx, `${fix(Math.abs(q.value), 2)} kN`, p.x + 32, y0 - len / 2, { color: C.good, bold: true, size: 11 });
      } else {
        arrow(ctx, p.x - sgn * len - sgn * 18, p.y + 40, p.x - sgn * 18, p.y + 40, { color: C.good, width: 2.6, head: 10 });
        label(ctx, `${fix(Math.abs(q.value), 2)} kN`, p.x - sgn * (len / 2 + 18), p.y + 54, { color: C.good, align: "center", bold: true, size: 11 });
      }
    }
  }
  // joints, drawn last so they sit on top
  s.nodes.forEach((n, i) => {
    const p = P(i);
    dot(ctx, p.x, p.y, 7, C.bg);
    ctx.strokeStyle = C.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.stroke();
    label(ctx, `${i + 1}`, p.x + 11, p.y - 12, { color: C.text, bold: true, size: 12, bg: false });
  });
  label(ctx, "orange = tension (+)   blue = compression (-)", 12, 16, { color: C.muted, size: 11, bg: false });
}

export default function TrussPane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const r = compute(s);
  const draw = useCallback((ctx, w, h, cam) => drawTruss(ctx, w, h, cam, s, r), [JSON.stringify(s)]); // eslint-disable-line react-hooks/exhaustive-deps
  const nodeOpts = s.nodes.map((_, i) => [String(i), `Joint ${i + 1}`]);
  const upd = (key, i, patch) => set({ [key]: s[key].map((o, k) => (k === i ? { ...o, ...patch } : o)) });
  const removeLastNode = () => {
    const n = s.nodes.length - 1;
    if (n < 1) return;
    set({
      nodes: s.nodes.slice(0, n),
      members: s.members.filter((m) => m.a < n && m.b < n),
      supports: s.supports.filter((q) => q.node < n),
      loads: s.loads.filter((l) => l.node < n),
    });
  };
  const load = (key) => setState(copy(TRUSS_PRESETS[key]));

  const inputs = (
    <>
      <Card title="Start from an example">
        <div className="mk-btnrow">
          <Button onClick={() => load("triangle")}>Triangle truss</Button>
          <Button onClick={() => load("warren")}>Warren truss</Button>
        </div>
      </Card>
      <Card title="Joints" actions={<><Button onClick={() => set({ nodes: [...s.nodes, { x: 0, y: 0 }] })}>+ Add</Button><Button onClick={removeLastNode} title="Remove the last joint">− Last</Button></>}>
        <table className="mk-table">
          <thead><tr><th /><th>x (m)</th><th>y (m)</th></tr></thead>
          <tbody>
            {s.nodes.map((n, i) => (
              <tr key={i}>
                <td className="tag">{i + 1}</td>
                <td><NumField compact value={n.x} onChange={(x) => upd("nodes", i, { x })} /></td>
                <td><NumField compact value={n.y} onChange={(y) => upd("nodes", i, { y })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Members" actions={<><Button onClick={() => s.nodes.length > 1 && set({ members: [...s.members, { a: 0, b: 1 }] })}>+ Add</Button><Button onClick={() => set({ members: s.members.slice(0, -1) })}>− Last</Button></>}>
        {s.members.map((m, i) => (
          <div className="mk-row" key={i}>
            <span className="tag">{i + 1}</span>
            <SelectField compact value={String(m.a)} options={nodeOpts} onChange={(v) => upd("members", i, { a: Number(v) })} />
            <span className="mk-unit">to</span>
            <SelectField compact value={String(m.b)} options={nodeOpts} onChange={(v) => upd("members", i, { b: Number(v) })} />
          </div>
        ))}
      </Card>
      <Card title="Supports" actions={<><Button onClick={() => set({ supports: [...s.supports, { node: 0, kind: "pin" }] })}>+ Add</Button><Button onClick={() => set({ supports: s.supports.slice(0, -1) })}>− Last</Button></>}>
        {s.supports.map((q, i) => (
          <div className="mk-row" key={i}>
            <SelectField compact value={String(q.node)} options={nodeOpts} onChange={(v) => upd("supports", i, { node: Number(v) })} />
            <SelectField compact value={q.kind} onChange={(kind) => upd("supports", i, { kind })} options={[["pin", "Pin"], ["rollerY", "Roller (up/down)"], ["rollerX", "Roller (sideways)"]]} />
          </div>
        ))}
      </Card>
      <Card title="Loads (kN)" actions={<><Button onClick={() => set({ loads: [...s.loads, { node: 0, fx: 0, fy: -10 }] })}>+ Add</Button><Button onClick={() => set({ loads: s.loads.slice(0, -1) })}>− Last</Button></>}>
        {s.loads.map((l, i) => (
          <div className="mk-row" key={i}>
            <SelectField compact value={String(l.node)} options={nodeOpts} onChange={(v) => upd("loads", i, { node: Number(v) })} />
            <span className="mk-unit">Fx</span><NumField compact value={l.fx} onChange={(fx) => upd("loads", i, { fx })} />
            <span className="mk-unit">Fy</span><NumField compact value={l.fy} onChange={(fy) => upd("loads", i, { fy })} />
          </div>
        ))}
        <p className="mk-help">Fx is positive to the right, Fy positive upward. A downward load is a negative Fy.</p>
      </Card>
    </>
  );

  const answers = (
    <>
      {!r.ok && <Notice kind="warn">{r.error}</Notice>}
      {r.ok && (
        <>
          <Card title="Member forces">
            <table className="mk-table results">
              <thead><tr><th>Member</th><th>Joints</th><th>Force (kN)</th><th /></tr></thead>
              <tbody>
                {r.members.map((m, i) => (
                  <tr key={i}>
                    <td className="tag">{i + 1}</td>
                    <td>{m.a + 1} - {m.b + 1}</td>
                    <td className={m.kind}>{fix(Math.abs(m.force), 2)}</td>
                    <td className={m.kind}>{m.kind === "zero" ? "zero force" : m.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Reactions">
            <Results rows={r.reactions.map((q) => [`Joint ${q.node + 1}, ${q.dir === "x" ? "horizontal" : "vertical"}`, fix(q.value), "kN"])} />
            <p className="mk-help">Check: ΣFx = {fix(r.check.sx, 4)}, ΣFy = {fix(r.check.sy, 4)}, ΣM = {fix(r.check.sm, 4)} (all zero when solved correctly).</p>
          </Card>
        </>
      )}
      <Steps steps={r.steps} />
    </>
  );
  return <Pane inputs={inputs} diagram={<Diagram draw={draw} />} results={answers} />;
}