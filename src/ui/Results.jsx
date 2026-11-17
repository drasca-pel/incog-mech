import { useState } from "react";

const round = (n) => String(Math.round(n * 1000) / 1000);

// Every value in the drawing, searchable. "View" pins a value on the drawing, where it stays live.
export default function Results({ rows, viewed, onToggleView }) {
  const [q, setQ] = useState("");
  const f = q.trim().toLowerCase();
  const shown = rows.filter((r) => !f || `${r.name} ${r.label}`.toLowerCase().includes(f));

  return (
    <div className="props-body">
      <h3>Results</h3>
      <input
        className="textin"
        placeholder="Search, e.g. tension, mass, angle, T1"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {rows.length === 0 && <p className="hint">Nothing to read yet. Draw something first.</p>}
      {rows.length > 0 && shown.length === 0 && <p className="hint">No match. Try another word, or label your lines (T1, T2...).</p>}
      <ul className="results">
        {shown.map((r) => (
          <li key={r.key}>
            <div className="r-main">
              <div className="r-name">{r.name}</div>
              <div className="r-label">
                {r.label}
                {r.live ? " (live)" : ""}
              </div>
            </div>
            <div className="r-val num">
              {round(r.value)} <span className="unit">{r.unit}</span>
            </div>
            <button
              className="chip-btn"
              aria-pressed={viewed.includes(r.key)}
              onClick={() => onToggleView(r.key)}
              title="Show this value on the drawing"
            >
              View
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}