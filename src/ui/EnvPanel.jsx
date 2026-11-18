import { useState } from "react";

// A number box that keeps what you type while you type it
function Num({ value, onChange, unit, step = 0.1 }) {
  const [text, setText] = useState(null);
  const shown = String(Math.round(value * 1000) / 1000);
  return (
    <span className="env-num">
      <input
        className="textin num"
        type="number"
        step={step}
        value={text ?? shown}
        onFocus={() => setText(shown)}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => setText(null)}
      />
      <span className="unit">{unit}</span>
    </span>
  );
}

function Row({ label, on, onToggle, children }) {
  return (
    <div className="env-row">
      <label className="env-check">
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} />
        <span>{label}</span>
      </label>
      <div className="env-fields">{children}</div>
    </div>
  );
}

// The room (ground, ceiling, walls), friction and air resistance for the simulation
export default function EnvPanel({ env, onChange, onClose }) {
  const fit = Boolean(env.room && env.room.fit);
  const friction = !env.friction || env.friction.on !== false;
  const standardRoom = () => {
    onChange("ground", { on: true, y: -5 });
    onChange("ceiling", { on: true, y: 5 });
    onChange("left", { on: true, x: -10 });
    onChange("right", { on: true, x: 10 });
  };
  const groundOnly = () => {
    onChange("ground", { on: true });
    onChange("ceiling", { on: false });
    onChange("left", { on: false });
    onChange("right", { on: false });
  };
  const allSides = () => {
    for (const part of ["ground", "ceiling", "left", "right"]) onChange(part, { on: true });
  };
  return (
    <div className="env-panel" role="dialog" aria-label="Environment">
      <div className="env-head">
        <strong>Environment</strong>
        <button className="ptab-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <h4 className="env-title">Room</h4>
      <div className="env-actions">
        <button onClick={fit ? allSides : standardRoom} title="Ground, ceiling and both walls">Closed room</button>
        <button onClick={groundOnly} title="Only the ground, everything else is open">Ground only</button>
      </div>
      <Row label="Keep the room at the screen edges" on={fit} onToggle={(on) => onChange("room", { fit: on })}>
        <span className="unit">{fit ? "does not zoom" : "fixed size in metres"}</span>
      </Row>
      <Row label="Ground" on={env.ground.on} onToggle={(on) => onChange("ground", { on })}>
        {!fit && <Num value={env.ground.y} unit="m high" onChange={(y) => onChange("ground", { y })} />}
        <Num value={env.ground.bounce} unit="bounce" step={0.05} onChange={(bounce) => onChange("ground", { bounce: Math.min(1, Math.max(0, bounce)) })} />
      </Row>
      <Row label="Ceiling" on={env.ceiling.on} onToggle={(on) => onChange("ceiling", { on })}>
        {!fit && <Num value={env.ceiling.y} unit="m high" onChange={(y) => onChange("ceiling", { y })} />}
      </Row>
      <Row label="Left wall" on={env.left.on} onToggle={(on) => onChange("left", { on })}>
        {!fit && <Num value={env.left.x} unit="m (x)" onChange={(x) => onChange("left", { x })} />}
      </Row>
      <Row label="Right wall" on={env.right.on} onToggle={(on) => onChange("right", { on })}>
        {!fit && <Num value={env.right.x} unit="m (x)" onChange={(x) => onChange("right", { x })} />}
      </Row>
      <p className="hint">
        {fit
          ? "The room edges stay at the edges of the screen, so zooming never moves them. Its size in metres is taken from the screen when you press Play, so zoom out first for a bigger room."
          : "The room has a fixed size in metres, so it zooms with everything else. Use Zoom fit (View tab) to see all of it."}
      </p>

      <h4 className="env-title">Resistance</h4>
      <Row label="Friction" on={friction} onToggle={(on) => onChange("friction", { on })}>
        {friction ? <Num value={env.ground.friction} unit="ground μ" step={0.05} onChange={(f) => onChange("ground", { friction: Math.max(0, f) })} /> : <span className="unit">all surfaces smooth</span>}
      </Row>
      <Row label="Air resistance" on={env.air.on} onToggle={(on) => onChange("air", { on })}>
        {env.air.on ? <Num value={env.air.k} unit="kg/s" step={0.1} onChange={(k) => onChange("air", { k: Math.max(0, k) })} /> : <span className="unit">ignored</span>}
      </Row>
      <p className="hint">Questions that say "neglect air resistance" or "smooth surface": turn the matching switch off. Air resistance pulls against the motion in proportion to the speed.</p>
    </div>
  );
}