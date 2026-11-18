import { useState } from "react";
import Icon from "../core/icons.jsx";
import { TABS } from "../tools/index.js";

// Tabs and tool groups. Everything shown here comes from the tool catalog.
// The arrow at the right collapses the tool panel to give the drawing more room.
export default function Ribbon({ tools, activeTool, toggles, onActivate }) {
  const [tab, setTab] = useState("Home");
  const [collapsed, setCollapsed] = useState(false);
  const inTab = tools.filter((t) => t.tab === tab);
  const groups = [...new Set(inTab.map((t) => t.group))];

  return (
    <section className="ribbon">
      <div className="ribbon-tabs" role="tablist">
        {TABS.filter((name) => tools.some((t) => t.tab === name)).map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={name === tab}
            onClick={() => {
              setTab(name);
              setCollapsed(false);
            }}
          >
            {name}
          </button>
        ))}
        <button
          className="ribbon-collapse"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Show tools" : "Hide tools for more drawing space"}
          aria-label={collapsed ? "Show tools" : "Hide tools"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={collapsed ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} />
          </svg>
        </button>
      </div>
      {!collapsed && (
        <div className="ribbon-panel">
          {groups.map((group) => (
            <div className="rgroup" key={group}>
              <div className="rtools">
                {inTab
                  .filter((t) => t.group === group)
                  .map((t) => {
                    const on = t.kind === "tool" ? activeTool === t.id : t.kind === "toggle" ? toggles[t.id] : false;
                    const tip = `${t.name}${t.shortcut ? ` (${t.shortcut})` : ""}${t.ready ? "" : " - coming soon"}`;
                    return (
                      <button
                        key={t.id}
                        className={"rbtn" + (t.ready ? "" : " soon")}
                        aria-pressed={t.kind === "action" ? undefined : on}
                        title={tip}
                        onClick={() => onActivate(t)}
                      >
                        <Icon name={t.icon} size={22} />
                        <span>{t.name}</span>
                      </button>
                    );
                  })}
              </div>
              <div className="rlabel">{group}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}