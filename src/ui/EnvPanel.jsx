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

// The room (ground, ceiling, walls) and air resistance for the simulation
export default function EnvPanel({ env, onChange, onClose }) {
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
  return (
    <div className="env-panel" role="dialog" aria-label="Environment">
      <div className="env-head">
        <strong>Environment</strong>
        <button className="ptab-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="env-actions">
        <button onClick={standardRoom} title="Ground, ceiling and both walls, 20 m wide and 10 m tall">Standard closed room</button>
        <button onClick={groundOnly} title="Only the ground, everything else is open">Ground only</button>
      </div>

      <Row label="Ground" on={env.ground.on} onToggle={(on) => onChange("ground", { on })}>
        <Num value={env.ground.y} unit="m high" onChange={(y) => onChange("ground", { y })} />
        <Num value={env.ground.bounce} unit="bounce" step={0.05} onChange={(bounce) => onChange("ground", { bounce: Math.min(1, Math.max(0, bounce)) })} />
        <Num value={env.ground.friction} unit="friction μ" step={0.05} onChange={(friction) => onChange("ground", { friction: Math.max(0, friction) })} />
      </Row>
      <Row label="Ceiling" on={env.ceiling.on} onToggle={(on) => onChange("ceiling", { on })}>
        <Num value={env.ceiling.y} unit="m high" onChange={(y) => onChange("ceiling", { y })} />
      </Row>
      <Row label="Left wall" on={env.left.on} onToggle={(on) => onChange("left", { on })}>
        <Num value={env.left.x} unit="m (x)" onChange={(x) => onChange("left", { x })} />
      </Row>
      <Row label="Right wall" on={env.right.on} onToggle={(on) => onChange("right", { on })}>
        <Num value={env.right.x} unit="m (x)" onChange={(x) => onChange("right", { x })} />
      </Row>
      <Row label="Air resistance" on={env.air.on} onToggle={(on) => onChange("air", { on })}>
        <Num value={env.air.k} unit="kg/s" step={0.1} onChange={(k) => onChange("air", { k: Math.max(0, k) })} />
      </Row>
      <p className="hint">The room stays where it is in the world, so zooming and moving the view never change it. Use Zoom fit (View tab) to see all of it.</p>
      <p className="hint">Air resistance slows everything in proportion to its speed. Turn it on to stop swinging and settle faster.</p>
    </div>
  );
}