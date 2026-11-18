// A workspace: a list of tools on the left, and the chosen tool filling the rest.
// Each tool keeps its own typed-in values, which are saved with the rest of the app.
export default function Workspace({ title, blurb, tools, defaultTool, data, onData }) {
  const flat = tools.flatMap((g) => g.items);
  const current = flat.find(([id]) => id === data.tool) || flat.find(([id]) => id === defaultTool) || flat[0];
  const [id, , Pane] = current;
  const panes = data.panes || {};
  return (
    <div className="mk-workspace">
      <nav className="mk-rail" aria-label={title}>
        <div className="mk-rail-title">
          <strong>{title}</strong>
          <span>{blurb}</span>
        </div>
        {tools.map((g) => (
          <div key={g.group} className="mk-rail-group">
            <h4>{g.group}</h4>
            {g.items.map(([tid, name]) => (
              <button key={tid} aria-current={tid === id} onClick={() => onData({ ...data, tool: tid })}>
                {name}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="mk-stage" key={id}>
        <Pane state={panes[id]} setState={(next) => onData({ ...data, tool: id, panes: { ...panes, [id]: next } })} />
      </div>
    </div>
  );
}