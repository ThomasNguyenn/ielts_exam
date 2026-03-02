function parseOption(option, index) {
  if (typeof option === 'object' && option !== null) {
    return {
      id: String(option.id || option.key || index + 1),
      text: String(option.text || ''),
    };
  }

  const raw = String(option || '').trim();
  const match = raw.match(/^([^.\):\-]+)[\.\):\-]\s*(.+)$/);

  if (match) {
    return {
      id: String(match[1]).trim(),
      text: String(match[2]).trim(),
    };
  }

  return {
    id: String(index + 1),
    text: raw,
  };
}

function getRowId(question, index) {
  return String(question?.id ?? question?.q_number ?? index + 1);
}

function getRowText(question) {
  return String(question?.question || question?.text || '');
}

function normalizeRows(group) {
  if (Array.isArray(group?.questions) && group.questions.length > 0) {
    return group.questions.map((question, index) => ({
      id: getRowId(question, index),
      text: getRowText(question),
    }));
  }

  if (Array.isArray(group?.left_items) && group.left_items.length > 0) {
    return group.left_items.map((item, index) => ({
      id: String(item.id ?? index + 1),
      text: String(item.text || ''),
    }));
  }

  return [];
}

function normalizeColumns(group) {
  const source = Array.isArray(group?.headings) && group.headings.length > 0
    ? group.headings
    : Array.isArray(group?.right_options) && group.right_options.length > 0
      ? group.right_options
      : (group?.options || []);

  return source.map(parseOption);
}

export default function MatchingInformationTableGroup({
  group,
  answers = {},
  setAnswer,
  readOnly = false,
}) {
  const rows = normalizeRows(group);
  const columns = normalizeColumns(group);
  const useOnce = Boolean(group?.use_once);

  if (rows.length === 0) {
    return <div className="engine-empty">Matching Information rows are empty.</div>;
  }

  if (columns.length === 0) {
    return <div className="engine-empty">Matching Information options are empty.</div>;
  }

  return (
    <div className="engine-matching-info-table-wrapper">
      <table className="engine-matching-info-table">
        <thead>
          <tr>
            <th className="engine-matching-info-row-header">Question</th>
            {columns.map((option) => (
              <th key={option.id} className="engine-matching-info-col-header">{option.id}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowId = String(row.id);
            const selected = String(answers[rowId] || '');
            const usedByOthers = new Set(
              rows
                .filter((candidate) => String(candidate.id) !== rowId)
                .map((candidate) => answers[String(candidate.id)])
                .filter(Boolean)
                .map((value) => String(value))
            );

            return (
              <tr key={rowId}>
                <td className="engine-matching-info-row-label">
                  <strong>{rowId}.</strong> {row.text}
                </td>
                {columns.map((option) => {
                  const isChecked = selected === option.id;
                  const isDisabled = readOnly || (useOnce && !isChecked && usedByOthers.has(option.id));
                  const inputId = `engine-mi-${rowId}-${option.id}`;

                  return (
                    <td key={`${rowId}-${option.id}`} className="engine-matching-info-cell">
                      <label
                        className={`engine-matching-info-cell-label ${isDisabled ? 'is-disabled' : ''}`}
                        htmlFor={inputId}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          className="engine-matching-info-checkbox"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={() => setAnswer(rowId, isChecked ? '' : option.id)}
                        />
                      </label>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
