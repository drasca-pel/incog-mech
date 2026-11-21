import { useEffect, useState } from "react";
import Icon from "../core/icons.jsx";
import Sheet from "./Sheet.jsx";

// The phone layout: a top bar, the drawing taking the whole screen, a tool strip and bottom navigation.
// In landscape the tool strip becomes a rail down the left side and sheets slide in from the right.
// App builds the pieces (canvas, panels) and decides which sheet is open; this only arranges them.
export default function MobileShell({
  landscape, projectName, topicName, simStatus, simTime, message,
  canUndo, canRedo, onUndo, onRedo, onPlay, onPause, onReset,
  tools, activeTool, onActivate,
  canvas, answerChips, selBar,
  sheet, onSheet,
  panelNode, envNode, topicsNode, projectsNode, menuNode, settingsNode, helpNode,
}) {
  const playing = simStatus === "playing";
  const [hintShown, setHintShown] = useState(true);
  useEffect(() => {
    setHintShown(true);
    const t = setTimeout(() => setHintShown(false), 6000);
    return () => clearTimeout(t);
  }, [message]);

  const strip = tools.filter((t) => t.kind === "tool");
  const groups = [];
  for (const t of tools.filter((x) => x.kind !== "tool" || true)) {
    if (["play", "pause", "reset", "undo", "redo"].includes(t.id)) continue;
    const key = t.group || t.tab || "Tools";
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, items: [] }));
    g.items.push(t);
  }
  const close = () => onSheet(null);
  const sideSheet = landscape ? "right" : "bottom";

  return (
    <div className={"m-app " + (landscape ? "landscape" : "portrait")}>
      <header className="m-top">
        <button className="m-iconbtn" onClick={() => onSheet("menu")} aria-label="Menu">
          <Icon name="menu" size={22} />
        </button>
        <button className="m-title" onClick={() => onSheet("projects")} aria-label="My projects">
          <strong>{projectName}</strong>
          <span>{topicName}{simStatus !== "idle" ? ` · ${Math.round(simTime * 100) / 100} s` : ""}</span>
        </button>
        <button className="m-iconbtn" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
          <Icon name="undo" size={21} />
        </button>
        <button className="m-iconbtn" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
          <Icon name="redo" size={21} />
        </button>
        <button className="m-iconbtn m-reset" onClick={onReset} disabled={simStatus === "idle"} aria-label="Reset the simulation">
          <Icon name="reset" size={21} />
        </button>
        <button className={"m-play" + (playing ? " on" : "")} onClick={playing ? onPause : onPlay} aria-label={playing ? "Pause" : "Play"}>
          <Icon name={playing ? "pause" : "play"} size={24} />
        </button>
      </header>

      <main className="m-stage">
        {canvas}
        <div className="m-overlay-top">
          {selBar}
          {message && hintShown && (
            <button className="m-hint" onClick={() => setHintShown(false)}>{message}</button>
          )}
        </div>
        {answerChips}
      </main>

      <nav className="m-dock" aria-label="Tools">
        <div className="m-strip">
          {strip.map((t) => (
            <button key={t.id} className={"m-tool" + (activeTool === t.id ? " on" : "")} onClick={() => onActivate(t)} aria-pressed={activeTool === t.id}>
              <Icon name={t.icon} size={24} />
              <span>{t.name}</span>
            </button>
          ))}
        </div>
        <div className="m-nav">
          <button onClick={() => onSheet("toolbox")} aria-current={sheet === "toolbox"}><Icon name="toolbox" size={22} /><span>Tools</span></button>
          <button onClick={() => onSheet("props")} aria-current={sheet === "props"}><Icon name="sliders" size={22} /><span>Properties</span></button>
          <button onClick={() => onSheet("answers")} aria-current={sheet === "answers"}><Icon name="answers" size={22} /><span>Answers</span></button>
          <button onClick={() => onSheet("topics")} aria-current={sheet === "topics"}><Icon name="topic" size={22} /><span>Topic</span></button>
          <button onClick={() => onSheet("settings")} aria-current={sheet === "settings"}><Icon name="grid" size={22} /><span>View</span></button>
        </div>
      </nav>

      <Sheet open={sheet === "toolbox"} title="All tools" onClose={close} side={sideSheet} tall>
        {groups.map((g) => (
          <div className="m-group" key={g.key}>
            <h3>{g.key}</h3>
            <div className="m-grid">
              {g.items.map((t) => (
                <button
                  key={t.id}
                  className={"m-cell" + (activeTool === t.id ? " on" : "")}
                  onClick={() => {
                    onActivate(t);
                    close();
                  }}
                >
                  <Icon name={t.icon} size={26} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </Sheet>
      <Sheet open={sheet === "props" || sheet === "answers"} title="Properties and answers" onClose={close} side={sideSheet} tall>{panelNode}</Sheet>
      <Sheet open={sheet === "topics"} title="Choose a topic" onClose={close} side={sideSheet}>{topicsNode}</Sheet>
      <Sheet open={sheet === "settings"} title="View and environment" onClose={close} side={sideSheet} tall>{settingsNode}{envNode}</Sheet>
      <Sheet open={sheet === "projects"} title="My projects" onClose={close} side={sideSheet} tall>{projectsNode}</Sheet>
      <Sheet open={sheet === "menu"} title="Menu" onClose={close} side="left">{menuNode}</Sheet>
      <Sheet open={sheet === "help"} title="How to use it" onClose={close} side={sideSheet}>{helpNode}</Sheet>
    </div>
  );
}
