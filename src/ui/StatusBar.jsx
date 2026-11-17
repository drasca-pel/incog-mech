import { useState } from "react";
import Icon from "../core/icons.jsx";

const PRESETS = [
  ["Earth", 9.81],
  ["Rounded", 10],
  ["Moon", 1.62],
  ["Mars", 3.71],
  ["Jupiter", 24.79],
  ["Off", 0],
];

// Gravity box that keeps what you type while you type it
function GravityField({ value, onChange }) {
  const [text, setText] = useState(null);
  return (
    <input
      className="g-input"
      type="number"
      step="0.01"
      min="0"
      value={text ?? String(value)}
      onFocus={() => setText(String(value))}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n) && n >= 0) onChange(n);
      }}
      onBlur={() => setText(null)}
      aria-label="Gravity in metres per second squared"
    />
  );
}

export default function StatusBar({ grid, axes, snap, onToggle, cursor, zoom, onZoom, onZoomReset, gravity, onGravity, simStatus, simTime, onSim, envOpen, onEnvToggle }) {
  const preset = PRESETS.find(([, g]) => g === gravity);
  const fmt = (n) => (n + 0).toFixed(2);

  return (
    <footer className="statusbar">
      <div className="st-group">
        <button className="st-btn" aria-pressed={snap} onClick={() => onToggle("snap")} title="Snap to grid (F9)">
          Snap
        </button>
        <button className="st-btn" aria-pressed={grid} onClick={() => onToggle("grid")} title="Grid (F7)">
          Grid
        </button>
        <button className="st-btn" aria-pressed={axes} onClick={() => onToggle("axes")} title="X and Y axes (F8)">
          Axes
        </button>
      </div>
      <div className="st-coords">{cursor ? `x ${fmt(cursor.x)}   y ${fmt(cursor.y)} m` : "x --   y -- m"}</div>
      <div className="st-spacer" />
      <div className="st-group">
        <span>g</span>
        <GravityField value={gravity} onChange={onGravity} />
        <span>m/s²</span>
        <select
          className="st-select"
          value={preset ? String(preset[1]) : "custom"}
          onChange={(e) => e.target.value !== "custom" && onGravity(Number(e.target.value))}
          aria-label="Gravity preset"
        >
          {PRESETS.map(([name, g]) => (
            <option key={name} value={String(g)}>
              {name} ({g})
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </div>
            <button className="st-btn" aria-pressed={envOpen} onClick={onEnvToggle} title="Ground, limits and air resistance">
        Environment
      </button>
      <div className="st-group st-sim">
        {simStatus !== "idle" && <span className="st-time">t = {simTime.toFixed(2)} s</span>}
        <button disabled={simStatus === "playing"} onClick={() => onSim("play")} title="Play" aria-label="Play">
          <Icon name="play" size={14} />
        </button>
        <button disabled={simStatus !== "playing"} onClick={() => onSim("pause")} title="Pause" aria-label="Pause">
          <Icon name="pause" size={14} />
        </button>
        <button disabled={simStatus === "idle"} onClick={() => onSim("reset")} title="Reset to the start" aria-label="Reset">
          <Icon name="reset" size={14} />
        </button>
      </div>
      <div className="st-zoom">
        <button onClick={() => onZoom(0.8)} title="Zoom out (-)" aria-label="Zoom out">−</button>
        <button className="st-pct" onClick={onZoomReset} title="Back to 100%">{zoom}%</button>
        <button onClick={() => onZoom(1.25)} title="Zoom in (+)" aria-label="Zoom in">+</button>
      </div>
    </footer>
  );
}