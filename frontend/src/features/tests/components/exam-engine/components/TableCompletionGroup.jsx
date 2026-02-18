import { splitByPlaceholders } from '../utils/gapFillParser';

function buildCellMap(cells = []) {
  const map = new Map();
  cells.forEach((cell) => {
    const key = `${cell.row}:${cell.col}`;
    map.set(key, String(cell.content ?? ''));
  });
  return map;
}

function renderCellContent(rawContent, answers, setAnswer, readOnly = false) {
  const tokens = splitByPlaceholders(rawContent);

  return tokens.map((token, index) => {
    if (token.type === 'text') {
      return <span key={`text-${index}`}>{token.value}</span>;
    }

    return (
      <input
        key={`placeholder-${token.id}-${index}`}
        className="engine-table-input"
        value={answers[token.id] || ''}
        onChange={(event) => setAnswer(token.id, event.target.value)}
        disabled={readOnly}
        placeholder={token.id}
      />
    );
  });
}

export default function TableCompletionGroup({
  group,
  answers = {},
  setAnswer,
  readOnly = false,
}) {
  const rows = Number(group?.table?.rows || 0);
  const columns = Number(group?.table?.columns || 0);
  const cellMap = buildCellMap(group?.table?.cells || []);

  if (!rows || !columns) {
    return <div className="engine-empty">Table is not configured.</div>;
  }

  const matrix = Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, colIndex) => {
      const key = `${rowIndex}:${colIndex}`;
      return cellMap.get(key) ?? '';
    })
  );

  return (
    <div className="engine-group">
      <div className="engine-table-wrapper">
        <table className="engine-table">
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cellContent, colIndex) => (
                  <td key={`cell-${rowIndex}-${colIndex}`}>
                    {renderCellContent(cellContent, answers, setAnswer, readOnly)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
