import Icon from "../core/icons.jsx";

// Quick tools that stay in reach on the left edge
const QUICK = ["select", "pan", "zoomFit", "measure"];

export default function LeftBar({ tools, activeTool, onActivate }) {
  return (
    <nav className="leftbar" aria-label="Quick tools">
      {QUICK.map((id) => {
        const t = tools.find((x) => x.id === id);
        if (!t) return null;
        return (
          <button
            key={id}
            className="lbtn"
            aria-pressed={t.kind === "tool" ? activeTool === id : undefined}
            title={`${t.name}${t.shortcut ? ` (${t.shortcut})` : ""}${t.ready ? "" : " - coming soon"}`}
            onClick={() => onActivate(t)}
          >
            <Icon name={t.icon} size={22} />
          </button>
        );
      })}
    </nav>
  );
}