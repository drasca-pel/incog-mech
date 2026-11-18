import { useCallback } from "react";
import { analyseSection, SHAPE_NAMES, SECTION_PRESETS, outline } from "../../engine/sections.js";
import { fix } from "../../engine/math.js";
import { Pane, Card, NumField, SelectField, Button, Results, Steps, Diagram, withDefaults, Notice } from "../kit.jsx";
import { C, boundsOf, fitWorld, grid, label, dot, line } from "../draw.js";

const copy = (o) => JSON.parse(JSON.stringify(o));
export const DEFAULT = { shapes: copy(SECTION_PRESETS.T), unit: "mm" };

const FIELDS = {
  rect: [["x", "x"], ["y", "y"], ["w", "width"], ["h", "height"]],
  triangle: [["x", "x"], ["y", "y"], ["b", "base"], ["h", "height"], ["a", "top offset"]],
  circle: [["x", "centre x"], ["y", "centre y"], ["r", "radius"]],
  ellipse: [["x", "centre x"], ["y", "centre y"], ["a", "half width"], ["b", "half height"]],
  semicircle: [["x", "x"], ["y", "y"], ["r", "radius"]],
  quarter: [["x", "corner x"], ["y", "corner y"], ["r", "radius"]],
};
const NEW = {
  rect: { type: "rect", x: 0, y: 0, w: 60, h: 40, sign: 1 },
  triangle: { type: "triangle", x: 0, y: 0, b: 60, h: 40, a: 0, sign: 1 },
  circle: { type: "circle", x: 30, y: 30, r: 20, sign: 1 },
  ellipse: { type: "ellipse", x: 30, y: 20, a: 30, b: 20, sign: 1 },
  semicircle: { type: "semicircle", x: 30, y: 0, r: 25, orient: "up", sign: 1 },
  quarter: { type: "quarter", x: 0, y: 0, r: 40, quad: 1, sign: 1 },
};

export const compute = (s) => analyseSection(s.shapes, s.unit);

export function drawSection(ctx, w, h, cam, s, r) {
  const pts = [{ x: 0, y: 0 }];
  s.shapes.forEach((sh) => outline(sh).forEach((p) => pts.push(p)));
  const tf = fitWorld(boundsOf(pts, 20, 0.3), w, h, cam, 70);
  grid(ctx, tf, s.unit);
  for (const sh of s.shapes) {
    const o = outline(sh);
    if (o.length < 3) continue;
    ctx.beginPath();
    o.forEach((p, i) => (i ? ctx.lineTo(tf.x(p.x), tf.y(p.y)) : ctx.moveTo(tf.x(p.x), tf.y(p.y))));
    ctx.closePath();
    if (sh.sign === -1) {
      ctx.fillStyle = C.fillHole; ctx.fill();
      ctx.setLineDash([6, 4]); ctx.strokeStyle = C.warn; ctx.lineWidth = 1.8; ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.fillStyle = C.fill; ctx.fill();
      ctx.strokeStyle = C.force; ctx.lineWidth = 1.8; ctx.stroke();
    }
  }
  if (!r.ok) {
    label(ctx, r.error || "", w / 2, 24, { color: C.warn, align: "center", bold: true, size: 12 });
    return;
  }
  for (const p of r.parts) dot(ctx, tf.x(p.cx), tf.y(p.cy), 3, p.sign < 0 ? C.warn : C.muted);
  const cx = tf.x(r.xbar), cy = tf.y(r.ybar);
  line(ctx, cx, 0, cx, h, "rgba(245,184,61,.55)", 1.3, [8, 5]);
  line(ctx, 0, cy, w, cy, "rgba(245,184,61,.55)", 1.3, [8, 5]);
  dot(ctx, cx, cy, 6, C.accent);
  ctx.strokeStyle = C.bg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.stroke();
  label(ctx, `centroid (${fix(r.xbar, 2)}, ${fix(r.ybar, 2)})`, cx + 12, cy - 14, { color: C.accent, bold: true, size: 12 });
}

export default function SectionsPane({ state, setState }) {
  const s = withDefaults(DEFAULT, state);
  const set = (patch) => setState({ ...s, ...patch });
  const r = compute(s);
  const draw = useCallback((ctx, w, h, cam) => drawSection(ctx, w, h, cam, s, r), [JSON.stringify(s)]); // eslint-disable-line react-hooks/exhaustive-deps
  const setShape = (i, patch) => set({ shapes: s.shapes.map((sh, k) => (k === i ? { ...sh, ...patch } : sh)) });
  const u = s.unit;

  const inputs = (
    <>
      <Card title="Start from an example">
        <div className="mk-btnrow">
          <Button onClick={() => set({ shapes: copy(SECTION_PRESETS.T) })}>T-section</Button>
          <Button onClick={() => set({ shapes: copy(SECTION_PRESETS.L) })}>L-section</Button>
          <Button onClick={() => set({ shapes: copy(SECTION_PRESETS.hole) })}>Plate with hole</Button>
          <Button onClick={() => set({ shapes: copy(SECTION_PRESETS.house) })}>House shape</Button>
        </div>
        <label className="mk-field"><span className="mk-label">Length unit</span><span className="mk-control"><input className="mk-num" value={s.unit} maxLength={4} onChange={(e) => set({ unit: e.target.value })} /></span></label>
      </Card>
      <Card
        title="Shapes"
        actions={
          <select className="mk-select" value="" onChange={(e) => e.target.value && set({ shapes: [...s.shapes, { ...NEW[e.target.value] }] })}>
            <option value="">+ Add shape</option>
            {Object.entries(SHAPE_NAMES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        }
      >
        {s.shapes.map((sh, i) => (
          <div className="mk-load" key={i}>
            <div className="mk-load-head">
              <strong>{i + 1}. {SHAPE_NAMES[sh.type]}</strong>
              <span>
                <SelectField compact value={sh.sign === -1 ? "hole" : "add"} onChange={(v) => setShape(i, { sign: v === "hole" ? -1 : 1 })} options={[["add", "Material"], ["hole", "Hole"]]} />
                <button className="mk-x" onClick={() => set({ shapes: s.shapes.filter((_, k) => k !== i) })} aria-label="Remove shape">×</button>
              </span>
            </div>
            <div className="mk-grid2">
              {FIELDS[sh.type].map(([k, name]) => <NumField key={k} label={name} value={sh[k] ?? 0} onChange={(v) => setShape(i, { [k]: v })} />)}
              {sh.type === "semicircle" && <SelectField label="Curved side" value={sh.orient || "up"} onChange={(orient) => setShape(i, { orient })} options={[["up", "Up"], ["down", "Down"], ["left", "Left"], ["right", "Right"]]} />}
              {sh.type === "quarter" && <SelectField label="Quadrant" value={String(sh.quad || 1)} onChange={(q) => setShape(i, { quad: Number(q) })} options={[["1", "Upper right"], ["2", "Upper left"], ["3", "Lower left"], ["4", "Lower right"]]} />}
            </div>
          </div>
        ))}
        <p className="mk-help">x, y is the lower-left corner for rectangles and triangles. "Top offset" is how far the top corner of a triangle sits from its left end (0 gives a right triangle).</p>
      </Card>
    </>
  );

  const answers = (
    <>
      {!r.ok && <Notice kind="warn">{r.error}</Notice>}
      {r.ok && (
        <>
          <Card title="Centroid">
            <Results rows={[["Area A", fix(r.A, 2), `${u}²`, true], ["Centroid x̄", fix(r.xbar, 3), u, true], ["Centroid ȳ", fix(r.ybar, 3), u, true], ["First moment Qx = ΣAy", fix(r.Qx, 2), `${u}³`], ["First moment Qy = ΣAx", fix(r.Qy, 2), `${u}³`]]} />
          </Card>
          <Card title="Moment of inertia (second moment of area)">
            <Results
              rows={[
                ["Ix about the centroid", fix(r.Ix, 2), `${u}⁴`, true],
                ["Iy about the centroid", fix(r.Iy, 2), `${u}⁴`, true],
                ["Polar J = Ix + Iy", fix(r.J, 2), `${u}⁴`],
                ["Radius of gyration kx", fix(r.kx, 3), u],
                ["Radius of gyration ky", fix(r.ky, 3), u],
                ["Ix about the x-axis (through O)", fix(r.IxO, 2), `${u}⁴`],
                ["Iy about the y-axis (through O)", fix(r.IyO, 2), `${u}⁴`],
              ]}
            />
          </Card>
        </>
      )}
      <Steps steps={r.steps} />
    </>
  );
  return <Pane inputs={inputs} diagram={<Diagram draw={draw} />} results={answers} />;
}