import { useState } from "react";
import { itemType } from "../core/itemTypes.js";
import Results from "./Results.jsx";
import Answers from "./Answers.jsx";

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
export default function Properties({ open, onToggle, item, onBeginEdit, onEdit, tab, onTab, rows, viewed, onToggleView, answers }) {
  const [, onKeyDown] = useConfirm();

  const def = item ? itemType(item.type) : null;
  const props = def ? def.properties(item) : [];

  const TABS = [["props", "Properties"], ["answers", "Answers"], ["results", "Results"]];

  // Closed: a small bar over the drawing. The drawing keeps the whole screen.
  if (!open) {
    return (
      <aside className="props closed" aria-label="Panel">
        {TABS.map(([id, name]) => (
          <button key={id} onClick={() => { onTab(id); onToggle(); }}>{name}</button>
        ))}
      </aside>
    );
  }

  return (
    <aside className="props" aria-label="Properties">
      <div className="ptabs-right" role="tablist">
        {TABS.map(([id, name]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => onTab(id)}>{name}</button>
        ))}
        <button className="props-toggle" onClick={onToggle} title="Close panel" aria-label="Close panel">×</button>
      </div>

      {tab === "answers" && <Answers answers={answers} />}

      {tab === "results" && <Results rows={rows} viewed={viewed} onToggleView={onToggleView} />}

      {tab === "props" && !item && (
        <div className="props-body">
          <h3>Properties</h3>
          <p className="hint">Nothing selected. Click an object to see and change its values.</p>
        </div>
      )}

      {tab === "props" && item && (
        <div className="props-body">
          <h3>{def.title(item)}</h3>
          {props.map((prop) => {
            if (prop.kind === "number") return <NumberField key={prop.id} prop={prop} onBegin={onBeginEdit} onEdit={onEdit} />;
            if (prop.kind === "readout")
              return (
                <div className="field" key={prop.id}>
                  <span className="field-top"><span>{prop.label}</span><span className="unit">{prop.unit}</span></span>
                  <div className="readout num">{String(Math.round(prop.value * 1000) / 1000)}</div>
                </div>
              );
            if (prop.kind === "button")
              return <button key={prop.id} className="btn wide" onClick={() => { onBeginEdit(); onEdit(prop.id, true); }}>{prop.label}</button>;
            if (prop.kind === "text")
              return (
                <label className="field" key={prop.id}>
                  <span className="field-top"><span>{prop.label}</span></span>
                  <input className="textin" value={prop.value} onFocus={onBeginEdit} onChange={(e) => onEdit(prop.id, e.target.value)} onKeyDown={onKeyDown} />
                </label>
              );
            return (
              <label className="field" key={prop.id}>
                <span className="field-top"><span>{prop.label}</span></span>
                <select className="textin" value={prop.value} onChange={(e) => { onBeginEdit(); onEdit(prop.id, e.target.value); }}>
                  {prop.options.map((o) => {
                    const value = typeof o === "string" ? o : o.value;
                    return <option key={value} value={value}>{typeof o === "string" ? cap(o) : o.label}</option>;
                  })}
                </select>
              </label>
            );
          })}
        </div>
      )}
    </aside>
  );
}
