import { useState } from "react";
import Icon from "../core/icons.jsx";
import { findTools } from "../tools/index.js";

// Type a tool name to start it, like the AutoCAD command line.
// Up/Down choose a suggestion, Enter runs it, Tab completes, Esc clears.
export default function CommandBar({ message, onRun }) {
  const [text, setText] = useState("");
  const [sel, setSel] = useState(0);
  const matches = findTools(text).slice(0, 6);

  const run = (value) => {
    onRun(value);
    setText("");
    setSel(0);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Tab" && matches[sel]) {
      e.preventDefault();
      setText(matches[sel].name);
    } else if (e.key === "Enter") {
      run(matches[sel] ? matches[sel].id : text);
    } else if (e.key === "Escape") {
      setText("");
      e.target.blur();
    }
  };

  return (
    <div className="cmdbar">
      {matches.length > 0 && (
        <ul className="cmd-suggest">
          {matches.map((t, i) => (
            <li key={t.id} className={i === sel ? "on" : ""} onMouseDown={() => run(t.id)}>
              <Icon name={t.icon} size={16} />
              <span>{t.name}</span>
              <kbd>{t.tab}</kbd>
            </li>
          ))}
        </ul>
      )}
      <span className="cmd-label">Command</span>
      <input
        id="cmd-input"
        value={text}
        placeholder="Type a command, e.g. rope or angle   ( / to focus )"
        onChange={(e) => {
          setText(e.target.value);
          setSel(0);
        }}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoComplete="off"
      />
      <span className="cmd-msg">{message}</span>
    </div>
  );
}