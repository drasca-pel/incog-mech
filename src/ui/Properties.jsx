import { useState } from "react";
import { itemType } from "../core/itemTypes.js";
import Results from "./Results.jsx";

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// Pressing Enter confirms: the box shows a tick for a moment and leaves the field
function useConfirm() {
  const [ok, setOk] = useState(false);
  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.target.blur();
    setOk(true);
    setTimeout(() => setOk(false), 900);
  };
  return [ok, onKeyDown];
}

// Number box that keeps what you type while the drawing updates live
function NumberField({ prop, onBegin, onEdit }) {
  const [text, setText] = useState(null);
  const [ok, onKeyDown] = useConfirm();
  const rounded = String(Math.round(prop.value * 1000) / 1000);
  return (
    <label className="field">
      <span className="field-top">
        <span>{prop.label}</span>
        <span className="unit">{ok ? "✓" : prop.unit}</span>
      </span>
      <input
        className="textin num"
        type="number"
        step="0.1"
        value={text ?? rounded}
        onFocus={() => {
          setText(rounded);
          onBegin();
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onEdit(prop.id, n);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setText(null)}
      />
    </label>
  );
}

// Right-hand panel: Properties of the selected object, and the Results list
export default function Properties({ open, onToggle, item, onBeginEdit, onEdit, tab, onTab, rows, viewed, onToggleView }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [ok, onKeyDown] = useConfirm();

  const def = item ? itemType(item.type) : null;
  const props = def ? def.properties(item) : [];
  const q = query.trim().toLowerCase();
  const matches = props.filter((p) => p.label.toLowerCase().includes(q));
  const prop = props.find((p) => p.id === picked) || null;

  const pick = (id) => {
    setPicked(id);
    setQuery("");
  };

  return (
    <aside className={"props" + (open ? "" : " collapsed")} aria-label="Properties">
      <button
        className="props-toggle"
        onClick={onToggle}
        title={open ? "Collapse panel" : "Expand panel"}
        aria-label={open ? "Collapse panel" : "Expand panel"}
      >
        {open ? "›" : "‹"}
      </button>

      {!open && <div className="props-vert">Properties</div>}

      {open && (
        <div className="ptabs-right" role="tablist">
          <button role="tab" aria-selected={tab === "props"} onClick={() => onTab("props")}>Properties</button>
          <button role="tab" aria-selected={tab === "results"} onClick={() => onTab("results")}>Results</button>
        </div>
      )}

      {open && tab === "results" && <Results rows={rows} viewed={viewed} onToggleView={onToggleView} />}

      {open && tab === "props" && !item && (
        <div className="props-body">
          <h3>Properties</h3>
          <p className="hint">Nothing selected. Select an object to see and change one property at a time.</p>
        </div>
      )}

      {open && tab === "props" && item && (
        <div className="props-body">
          <h3>{def.title(item)}</h3>
          <input
            className="textin"
            placeholder="Type a property, e.g. length"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && matches[0] && pick(matches[0].id)}
          />
          <div className="chips">
            {matches.map((p) => (
              <button key={p.id} className="chip-btn" aria-pressed={picked === p.id} onClick={() => pick(p.id)}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="editor">
            {!prop && <p className="hint">Pick a property above to change it.</p>}
            {prop && prop.kind === "number" && (
              <NumberField key={prop.id} prop={prop} onBegin={onBeginEdit} onEdit={onEdit} />
            )}
            {prop && prop.kind === "readout" && (
              <div className="field">
                <span className="field-top">
                  <span>{prop.label}</span>
                  <span className="unit">{prop.unit}</span>
                </span>
                <div className="readout num">{String(Math.round(prop.value * 1000) / 1000)}</div>
              </div>
            )}
            {prop && prop.kind === "button" && (
              <button className="btn wide" onClick={() => { onBeginEdit(); onEdit(prop.id, true); }}>
                {prop.label}
              </button>
            )}
            {prop && prop.kind === "text" && (
              <label className="field">
                <span className="field-top"><span>{prop.label}</span><span className="unit">{ok ? "✓" : ""}</span></span>
                <input
                  className="textin"
                  value={prop.value}
                  onFocus={onBeginEdit}
                  onChange={(e) => onEdit(prop.id, e.target.value)}
                  onKeyDown={onKeyDown}
                />
              </label>
            )}
            {prop && prop.kind === "choice" && (
              <label className="field">
                <span className="field-top"><span>{prop.label}</span></span>
                <select className="textin" value={prop.value} onChange={(e) => { onBeginEdit(); onEdit(prop.id, e.target.value); }}>
                  {prop.options.map((o) => {
                    const value = typeof o === "string" ? o : o.value;
                    const text = typeof o === "string" ? cap(o) : o.label;
                    return (
                      <option key={value} value={value}>{text}</option>
                    );
                  })}
                </select>
              </label>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}