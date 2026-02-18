function parseRightOption(option, index) {
  if (typeof option === 'object' && option !== null) {
    return {
      id: String(option.id || option.key || index + 1),
      text: String(option.text || ''),
    };
  }

  const raw = String(option || '').trim();
  const match = raw.match(/^([^.\):\-]+)[\.\):\-]\s*(.+)$/);

  if (match) {
    return { id: String(match[1]).trim(), text: String(match[2]).trim() };
  }

  return { id: String(index + 1), text: raw };
}

function normalizeLeftItems(group) {
  if (Array.isArray(group.left_items) && group.left_items.length > 0) {
    return group.left_items.map((item, index) => ({
      id: String(item.id ?? index + 1),
      text: String(item.text || ''),
    }));
  }

  if (Array.isArray(group.questions) && group.questions.length > 0) {
    return group.questions.map((question, index) => ({
      id: String(question.id ?? question.q_number ?? index + 1),
      text: String(question.question || question.text || ''),
    }));
  }

  return [];
}

function normalizeRightOptions(group) {
  if (Array.isArray(group.right_options) && group.right_options.length > 0) {
    return group.right_options.map(parseRightOption);
  }
  if (Array.isArray(group.headings) && group.headings.length > 0) {
    return group.headings.map((item, index) => parseRightOption(item, index));
  }
  if (Array.isArray(group.options) && group.options.length > 0) {
    return group.options.map((item, index) => parseRightOption(item, index));
  }
  return [];
}

export default function MatchingGroup({
  group,
  answers = {},
  setAnswer,
  readOnly = false,
}) {
  const leftItems = normalizeLeftItems(group);
  const rightOptions = normalizeRightOptions(group);
  const useOnce = Boolean(group.use_once);

  return (
    <div className="engine-group">
      {leftItems.map((item) => {
        const leftId = String(item.id);
        const selected = answers[leftId] || '';

        const usedByOthers = new Set(
          leftItems
            .filter((candidate) => String(candidate.id) !== leftId)
            .map((candidate) => answers[String(candidate.id)])
            .filter(Boolean)
            .map((value) => String(value))
        );

        const optionsForCurrentItem = rightOptions.filter((option) => {
          if (!useOnce) return true;
          if (selected && selected === option.id) return true;
          return !usedByOthers.has(option.id);
        });

        return (
          <div key={leftId} className="engine-matching-row">
            <div className="engine-matching-left">
              <strong>{leftId}.</strong> {item.text}
            </div>
            <div className="engine-matching-right">
              <select
                value={selected}
                onChange={(event) => setAnswer(leftId, event.target.value)}
                disabled={readOnly}
              >
                <option value="">Select...</option>
                {optionsForCurrentItem.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.id}. {option.text}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
