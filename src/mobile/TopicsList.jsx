// The topics as big tappable cards
export default function TopicsList({ topics, current, onPick }) {
  return (
    <div className="m-topics">
      {topics.map((t) => (
        <button key={t.id} className={"m-topic" + (t.id === current ? " on" : "")} onClick={() => onPick(t.id)}>
          <strong>{t.name}</strong>
          <span>{t.blurb}</span>
        </button>
      ))}
      <p className="m-note">Each topic keeps its own drawing. Switching back brings it back exactly as you left it.</p>
    </div>
  );
}
