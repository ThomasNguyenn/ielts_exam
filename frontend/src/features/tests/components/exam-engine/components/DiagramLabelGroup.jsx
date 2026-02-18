import { splitByPlaceholders } from '../utils/gapFillParser';

function renderDiagramText(rawText, answers, setAnswer, readOnly = false) {
  const tokens = splitByPlaceholders(rawText);

  return tokens.map((token, index) => {
    if (token.type === 'text') {
      return <span key={`text-${index}`}>{token.value}</span>;
    }

    return (
      <input
        key={`placeholder-${token.id}-${index}`}
        className="engine-diagram-input"
        value={answers[token.id] || ''}
        onChange={(event) => setAnswer(token.id, event.target.value)}
        disabled={readOnly}
        placeholder={token.id}
      />
    );
  });
}

export default function DiagramLabelGroup({
  group,
  answers = {},
  setAnswer,
  readOnly = false,
}) {
  const items = Array.isArray(group.diagram_items) ? group.diagram_items : [];

  if (items.length === 0) {
    return <div className="engine-empty">Diagram items are empty.</div>;
  }

  return (
    <div className="engine-group">
      <ol className="engine-diagram-list">
        {items.map((item, index) => (
          <li key={String(item.id)} className="engine-diagram-item">
            <div className="engine-diagram-content">
              {renderDiagramText(String(item.text || ''), answers, setAnswer, readOnly)}
            </div>
            {index < items.length - 1 && (
              <div className="engine-diagram-arrow" aria-hidden="true">
                <span className="engine-diagram-line" />
                <span className="engine-diagram-arrow-icon">v</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
