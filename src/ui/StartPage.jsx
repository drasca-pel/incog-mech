// Shown when every project tab has been closed
export default function StartPage({ onNew }) {
  return (
    <div className="start">
      <h2>Start</h2>
      <p>Create a project, draw your diagram, then press Play.</p>
      <button className="start-card" onClick={onNew}>
        <span className="start-plus">+</span>
        <span>
          <strong>New project</strong>
          <small>Empty workspace, gravity 9.81 m/s²</small>
        </span>
      </button>
    </div>
  );
}