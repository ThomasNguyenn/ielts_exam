import { useEffect, useMemo, useState } from 'react';
import { extractPlaceholderIds } from '../utils/gapFillParser';

function ensureCell(cells, row, col) {
  const existing = cells.find((cell) => cell.row === row && cell.col === col);
  if (existing) return existing;
  return { row, col, content: '' };
}

function buildGrid(rows, columns, cells) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, col) => ensureCell(cells, row, col))
  );
}

export default function TeacherTableBuilder({
  value,
  onChange,
}) {
  const [rows, setRows] = useState(Number(value?.table?.rows || 2));
  const [columns, setColumns] = useState(Number(value?.table?.columns || 2));
  const [cells, setCells] = useState(() => {
    if (Array.isArray(value?.table?.cells) && value.table.cells.length > 0) {
      return value.table.cells;
    }

    return [
      { row: 0, col: 0, content: '' },
      { row: 0, col: 1, content: '' },
      { row: 1, col: 0, content: '' },
      { row: 1, col: 1, content: '' },
    ];
  });

  const [answers, setAnswers] = useState(Array.isArray(value?.answers) ? value.answers : []);

  const placeholderIds = useMemo(() => {
    const ids = new Set();
    cells.forEach((cell) => {
      extractPlaceholderIds(cell.content).forEach((id) => ids.add(id));
    });
    return Array.from(ids).sort((a, b) => Number(a) - Number(b));
  }, [cells]);

  useEffect(() => {
    setAnswers((prev) =>
      placeholderIds.map((id) => {
        const existing = prev.find((item) => String(item.id) === String(id));
        return existing || { id: Number(id), correct_answer: '' };
      })
    );
  }, [placeholderIds]);

  useEffect(() => {
    if (typeof onChange !== 'function') return;

    onChange({
      type: 'TABLE_COMPLETION',
      table: {
        rows,
        columns,
        cells: cells
          .filter((cell) => cell.row < rows && cell.col < columns)
          .map((cell) => ({ row: cell.row, col: cell.col, content: cell.content })),
      },
      answers,
    });
  }, [answers, cells, columns, onChange, rows]);

  const grid = buildGrid(rows, columns, cells);

  const updateCellContent = (row, col, content) => {
    setCells((prev) => {
      const next = [...prev];
      const index = next.findIndex((cell) => cell.row === row && cell.col === col);
      if (index === -1) {
        next.push({ row, col, content });
      } else {
        next[index] = { ...next[index], content };
      }
      return next;
    });
  };

  const addRow = () => setRows((prev) => prev + 1);
  const addColumn = () => setColumns((prev) => prev + 1);

  const updateAnswer = (id, correctAnswer) => {
    setAnswers((prev) =>
      prev.map((item) =>
        String(item.id) === String(id)
          ? { ...item, correct_answer: correctAnswer }
          : item
      )
    );
  };

  return (
    <div className="engine-teacher-builder">
      <div className="engine-builder-actions">
        <button type="button" onClick={addRow}>Add Row</button>
        <button type="button" onClick={addColumn}>Add Column</button>
      </div>

      <div className="engine-table-wrapper">
        <table className="engine-table">
          <tbody>
            {grid.map((row, rowIndex) => (
              <tr key={`builder-row-${rowIndex}`}>
                {row.map((cell, colIndex) => (
                  <td key={`builder-cell-${rowIndex}-${colIndex}`}>
                    <input
                      value={cell.content}
                      onChange={(event) => updateCellContent(rowIndex, colIndex, event.target.value)}
                      placeholder="Type text or [1]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="engine-answer-editor">
        <h4>Placeholder Answers</h4>
        {answers.length === 0 && <p className="engine-muted">No placeholders yet.</p>}
        {answers.map((item) => (
          <div key={String(item.id)} className="engine-answer-row">
            <label htmlFor={`answer-${item.id}`}>[{item.id}]</label>
            <input
              id={`answer-${item.id}`}
              value={item.correct_answer}
              onChange={(event) => updateAnswer(item.id, event.target.value)}
              placeholder="Correct answer"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
