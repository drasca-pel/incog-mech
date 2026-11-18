import { useState } from "react";

// Brand and project tabs, like drawing tabs in AutoCAD.
// Double-click a tab to rename it.
export default function TitleBar({ projects, activeId, onSelect, onAdd, onClose, onRename, mode = "sandbox", onMode }) {
  const [editing, setEditing] = useState(null);

  return (
    <header className="titlebar">
      <div className="brand">
        INCOG<span>Mechanics</span>
      </div>
      {onMode && (
        <div className="modes" role="group" aria-label="Workspace">
          {[["sandbox", "Sandbox"], ["statics", "Statics"], ["motion", "Motion"]].map(([id, name]) => (
            <button key={id} aria-pressed={mode === id} onClick={() => onMode(id)}>{name}</button>
          ))}
        </div>
      )}
      {mode === "sandbox" && (
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
      )}
    </header>
  );
}