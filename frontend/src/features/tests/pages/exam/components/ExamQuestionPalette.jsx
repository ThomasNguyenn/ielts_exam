export default function ExamQuestionPalette({
  items,
  onSelect,
}) {
  if (!items.length) {
    return <span className="exam-footer-empty">No question palette for this part.</span>;
  }

  return (
    <div className="footer-question-nav">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`footer-q-btn ${item.answered ? 'answered' : ''} ${item.active ? 'active' : ''}`}
          onClick={() => onSelect(item)}
          aria-label={item.ariaLabel}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
