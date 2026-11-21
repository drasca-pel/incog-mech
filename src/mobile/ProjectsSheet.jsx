import { useState } from "react";
import { formatWhen } from "../core/library.js";

// The list of saved projects: open, rename, copy, share and delete them
export default function ProjectsSheet({ entries, currentId, available, topicName, onSaveCurrent, onOpen, onRename, onDuplicate, onExport, onDelete, onImport }) {
  const [renaming, setRenaming] = useState(null); // { id, text }
  const [confirm, setConfirm] = useState(null); // id waiting for a second tap
  if (!available) return <p className="m-note">Saving is not available here. Your browser is blocking storage.</p>;
  return (
    <div className="m-projects">
      <div className="m-actions">
        <button className="m-btn primary" onClick={onSaveCurrent}>Save this project</button>
        <button className="m-btn" onClick={onImport}>Import a file</button>
      </div>
      {entries.length === 0 && <p className="m-empty">Nothing saved yet. Tap "Save this project" and it will be kept on this device, with the drawing of every topic in it.</p>}
      {entries.map((e) => (
        <article key={e.id} className={"m-project" + (e.id === currentId ? " current" : "")}>
          <button className="m-thumb" onClick={() => onOpen(e.id)} aria-label={`Open ${e.name}`}>
            {e.thumb ? <img src={e.thumb} alt="" /> : <span>{(e.name || "?").slice(0, 1).toUpperCase()}</span>}
          </button>
          <div className="m-info">
            {renaming && renaming.id === e.id ? (
              <input
                autoFocus
                value={renaming.text}
                onChange={(ev) => setRenaming({ id: e.id, text: ev.target.value })}
                onBlur={() => {
                  onRename(e.id, renaming.text);
                  setRenaming(null);
                }}
                onKeyDown={(ev) => ev.key === "Enter" && ev.currentTarget.blur()}
              />
            ) : (
              <strong onClick={() => onOpen(e.id)}>{e.name}</strong>
            )}
            <span>{topicName(e.topic)} · {e.items} object{e.items === 1 ? "" : "s"} · {formatWhen(e.updated)}</span>
            <div className="m-links">
              <button onClick={() => onOpen(e.id)}>Open</button>
              <button onClick={() => setRenaming({ id: e.id, text: e.name })}>Rename</button>
              <button onClick={() => onDuplicate(e.id)}>Copy</button>
              <button onClick={() => onExport(e.id)}>Share</button>
              <button
                className={confirm === e.id ? "danger" : ""}
                onClick={() => {
                  if (confirm === e.id) {
                    setConfirm(null);
                    onDelete(e.id);
                  } else setConfirm(e.id);
                }}
              >
                {confirm === e.id ? "Tap again" : "Delete"}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
