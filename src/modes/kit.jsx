import { useEffect, useRef, useState } from "react";
import { clear } from "./draw.js";

// ---------- inputs ----------

// A number box that keeps what you type while you type it, and only passes on real numbers.
export function NumField({ label, unit, value, onChange, step = "any", min, max, hint, compact = false, disabled = false, width }) {
  const [text, setText] = useState(null);
  const shown = Number.isFinite(value) ? String(Math.round(value * 1e6) / 1e6) : "";
  const input = (
    <input
      className="mk-num"
      style={width ? { width } : undefined}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      value={text ?? shown}
      onFocus={() => setText(shown)}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setText(null)}
    />
  );
  if (compact) return input;
  return (
    <label className="mk-field" title={hint}>
      <span className="mk-label">{label}</span>
      <span className="mk-control">
        {input}
        {unit && <span className="mk-unit">{unit}</span>}
      </span>
    </label>
  );
}

export function SelectField({ label, value, options, onChange, compact = false }) {
  const sel = (
    <select className="mk-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, text]) => (
        <option key={v} value={v}>{text}</option>
      ))}
    </select>
  );
  if (compact) return sel;
  return (
    <label className="mk-field">
      <span className="mk-label">{label}</span>
      <span className="mk-control">{sel}</span>
    </label>
  );
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="mk-seg" role="tablist">
      {options.map(([v, text]) => (
        <button key={v} role="tab" aria-selected={v === value} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

export function Button({ children, onClick, primary = false, title, disabled }) {
  return (
    <button className={"mk-btn" + (primary ? " primary" : "")} onClick={onClick} title={title} disabled={disabled}>{children}</button>
  );
}

export function Card({ title, children, actions }) {
  return (
    <section className="mk-card">
      {(title || actions) && (
        <header>
          <h3>{title}</h3>
          <div>{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}

// Answers as a tidy list: rows = [[name, value, unit, optional emphasis]]
export function Results({ rows }) {
  return (
    <dl className="mk-results">
      {rows.map(([name, value, unit, big], i) => (
        <div key={i} className={big ? "big" : ""}>
          <dt>{name}</dt>
          <dd>
            {value}
            {unit && <span> {unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// The step-by-step working
export function Steps({ steps, title = "Solution, step by step", open = false }) {
  if (!steps || !steps.length) return null;
  return (
    <details className="mk-steps" open={open}>
      <summary>{title}</summary>
      <div>
        {steps.map((line, i) => (
          <p key={i} className={line.startsWith("  ") ? "sub" : line.startsWith("Step") || line.startsWith("Equations") || line.startsWith("Work-energy") ? "head" : ""}>
            {line.trim()}
          </p>
        ))}
      </div>
    </details>
  );
}

export function Notice({ kind = "info", children }) {
  return <p className={"mk-notice " + kind}>{children}</p>;
}

// ---------- the drawing area ----------
// draw(ctx, w, h, cam) is called whenever it changes. The mouse wheel zooms, dragging moves,
// and a double click fits everything again. cam = { zoom, dx, dy } is passed to fitWorld().
export function Diagram({ draw, hint = true, fixed = false }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [size, setSize] = useState({ w: 640, h: 420 });
  const [cam, setCam] = useState({ zoom: 1, dx: 0, dy: 0 });
  const drag = useRef(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: Math.max(80, el.clientWidth), h: Math.max(80, el.clientHeight) });
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clear(ctx, size.w, size.h);
    draw(ctx, size.w, size.h, cam);
  }, [draw, size, cam]);

  const onWheel = (e) => {
    if (fixed) return;
    const r = canvas.current.getBoundingClientRect();
    const px = e.clientX - r.left - size.w / 2;
    const py = e.clientY - r.top - size.h / 2;
    const f = Math.exp(-e.deltaY * 0.0015);
    setCam((c) => {
      const zoom = Math.min(40, Math.max(0.2, c.zoom * f));
      const k = zoom / c.zoom;
      return { zoom, dx: px - (px - c.dx) * k, dy: py - (py - c.dy) * k };
    });
  };
  const down = (e) => {
    if (fixed) return;
    drag.current = { x: e.clientX, y: e.clientY, dx: cam.dx, dy: cam.dy };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current;
    if (d) setCam((c) => ({ ...c, dx: d.dx + e.clientX - d.x, dy: d.dy + e.clientY - d.y }));
  };
  const up = () => {
    drag.current = null;
  };

  return (
    <div className="mk-diagram" ref={wrap}>
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h }}
        onWheel={onWheel}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => setCam({ zoom: 1, dx: 0, dy: 0 })}
      />
      {hint && !fixed && <div className="mk-hint">scroll to zoom · drag to move · double-click to fit</div>}
    </div>
  );
}

// ---------- animation ----------
// Calls tick(secondsSinceLastFrame) every frame while "running" is true
export function useFrames(running, tick) {
  const fn = useRef(tick);
  fn.current = tick;
  useEffect(() => {
    if (!running) return undefined;
    let raf;
    let last = performance.now();
    const loop = (now) => {
      fn.current(Math.min(0.1, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

// Join saved values with defaults, so older saves keep working
export const withDefaults = (defaults, saved) => ({ ...defaults, ...(saved && typeof saved === "object" ? saved : {}) });

// Where a pane lays out its parts: inputs on the left, the drawing on top, answers below
export function Pane({ inputs, diagram, results }) {
  return (
    <div className="mk-pane">
      <div className="mk-inputs">{inputs}</div>
      <div className="mk-main">
        <div className="mk-canvas">{diagram}</div>
        <div className="mk-answers">{results}</div>
      </div>
    </div>
  );
}