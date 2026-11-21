import { useEffect, useState } from "react";

const Switch = ({ label, on, onChange }) => (
  <label className="m-switch">
    <span>{label}</span>
    <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
    <i aria-hidden="true" />
  </label>
);

// View switches, gravity, and which layout to use
export default function SettingsPanel({ grid, axes, snap, onToggle, gravity, onGravity, onZoomFit, layoutOverride, onLayout, showLayout = true }) {
  const [g, setG] = useState(String(gravity));
  useEffect(() => setG(String(Math.round(gravity * 1000) / 1000)), [gravity]);
  return (
    <div className="m-settings">
      <h3>View</h3>
      <Switch label="Grid" on={grid} onChange={() => onToggle("grid")} />
      <Switch label="Axes" on={axes} onChange={() => onToggle("axes")} />
      <Switch label="Snap to points" on={snap} onChange={() => onToggle("snap")} />
      <button className="m-btn" onClick={onZoomFit}>Fit the drawing to the screen</button>
      <h3>Gravity</h3>
      <label className="m-field">
        <span>g (m/s²)</span>
        <input
          inputMode="decimal"
          value={g}
          onChange={(e) => {
            setG(e.target.value);
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n) && n >= 0) onGravity(n);
          }}
        />
      </label>
      <div className="m-chips">
        {[["Earth", 9.81], ["Moon", 1.62], ["Mars", 3.71], ["None", 0]].map(([n, v]) => (
          <button key={n} className={"m-chip" + (Math.abs(gravity - v) < 1e-9 ? " on" : "")} onClick={() => onGravity(v)}>{n}</button>
        ))}
      </div>
      {showLayout && (
        <>
          <h3>Screen layout</h3>
          <div className="m-seg" role="group" aria-label="Screen layout">
            {[["auto", "Automatic"], ["phone", "Phone"], ["desktop", "Desktop"]].map(([v, n]) => (
              <button key={v} aria-pressed={layoutOverride === v} onClick={() => onLayout(v)}>{n}</button>
            ))}
          </div>
          <p className="m-note">Automatic uses the phone layout on a phone and the desktop layout on a computer. Both rotate to portrait or landscape.</p>
        </>
      )}
    </div>
  );
}
