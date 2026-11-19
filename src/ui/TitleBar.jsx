import { useState } from "react";
import { TOPICS } from "../core/topics.js";

// Brand and project tabs, like drawing tabs in AutoCAD.
// Double-click a tab to rename it.
export default function TitleBar({ projects, activeId, onSelect, onAdd, onClose, onRename, topic = "sandbox", onTopic }) {
  const [editing, setEditing] = useState(null);

  return (
    <header className="titlebar">
      <div className="brand">
        INCOG<span>Mechanics</span>
      </div>
      {onTopic && (
        <div className="modes" role="group" aria-label="Topic">
          {TOPICS.map((t) => (
            <button key={t.id} aria-pressed={topic === t.id} title={t.blurb} onClick={() => onTopic(t.id)}>{t.name}</button>
          ))}
        </div>
      )}
      <div className="ptabs" role="tablist" aria-label="Projects">
        {projects.map((p) => (
          <div
            key={p.id}
            role="tab"
            aria-selected={p.id === activeId}
            className="ptab"
            onClick={() => onSelect(p.id)}
            onDoubleClick={() => setEditing(p.id)}
          >
            {editing === p.id ? (
              <input
                autoFocus
                defaultValue={p.name}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  onRename(p.id, e.target.value);
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.target.blur();
                  if (e.key === "Escape") {
                    e.target.value = p.name;
                    e.target.blur();
                  }
                }}
              />
            ) : (
              <span>{p.name}</span>
            )}
            <button
              className="ptab-x"
              aria-label={`Close ${p.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(p.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button className="ptab-add" onClick={onAdd} title="New project" aria-label="New project">
          +
        </button>
      </div>
    </header>
  );
}