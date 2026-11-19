const fmt = (v) => (typeof v === "number" ? String(Math.round(v * 1000) / 1000) : v);

// The answers worked out from the drawing. Rows marked "now" change live while the simulation runs.
export default function Answers({ answers }) {
  const groups = answers ? answers.groups : [];
  return (
    <div className="props-body">
      <h3>Answers</h3>
      {groups.length === 0 && (
        <p className="hint">Nothing to solve yet. Draw something with a topic tool, for example a launch ball, a block on a slope or a hanging weight, and its answers appear here.</p>
      )}
      {groups.map((g) => (
        <section className="ans-group" key={g.id}>
          <h4>{g.title}</h4>
          <ul className="results">
            {g.rows.map((r, i) => (
              <li key={i} className={r.live ? "live" : ""}>
                <div className="r-main"><div className="r-name">{r.label}</div></div>
                <div className="r-val num">{fmt(r.value)} <span className="unit">{r.unit}</span></div>
              </li>
            ))}
          </ul>
          {g.notes.map((n, i) => (
            <p className="hint small" key={i}>{n}</p>
          ))}
        </section>
      ))}
    </div>
  );
}
