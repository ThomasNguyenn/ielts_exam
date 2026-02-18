function parseOption(option, index) {
  if (typeof option === 'object' && option !== null) {
    return {
      key: String(option.key || option.id || String.fromCharCode(65 + index)),
      label: String(option.label || String.fromCharCode(65 + index)).toUpperCase(),
      text: String(option.text || ''),
    };
  }

  const raw = String(option || '').trim();
  const match = raw.match(/^([A-Za-z])[\.\):\-]\s*(.+)$/);
  if (match) {
    return {
      key: match[1].toUpperCase(),
      label: match[1].toUpperCase(),
      text: match[2],
    };
  }

  return {
    key: String.fromCharCode(65 + index),
    label: String.fromCharCode(65 + index),
    text: raw,
  };
}

function normalizeSelectedValue(value, mode) {
  if (mode === 'multi') {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  }
  return String(value || '');
}

function shouldDisableMultiOption(selectedValues, optionLabel, requiredCount) {
  if (!requiredCount || requiredCount <= 0) return false;
  const alreadySelected = selectedValues.includes(optionLabel);
  if (alreadySelected) return false;
  return selectedValues.length >= requiredCount;
}

export default function MultipleChoice({
  mode = 'single',
  questions = [],
  answers = {},
  setAnswer,
  readOnly = false,
}) {
  const isMultiMode = mode === 'multi';

  return (
    <div className="engine-group">
      {questions.map((question) => {
        const questionId = String(question.id);
        const options = (question.options || []).map(parseOption);
        const requiredCount = Number(question.required_count) || null;
        const selected = normalizeSelectedValue(answers[questionId], mode);

        const handleChange = (optionLabel) => {
          if (!isMultiMode) {
            setAnswer(questionId, optionLabel);
            return;
          }

          setAnswer(questionId, (prevSelected) => {
            const current = Array.isArray(prevSelected) ? prevSelected : [];
            const hasOption = current.includes(optionLabel);
            if (hasOption) {
              return current.filter((item) => item !== optionLabel);
            }
            if (requiredCount && current.length >= requiredCount) {
              return current;
            }
            return [...current, optionLabel];
          });
        };

        return (
          <div key={questionId} className="engine-question-block">
            <p className="engine-question-text">
              <strong>{questionId}.</strong> {question.question}
            </p>

            {isMultiMode && requiredCount ? (
              <p className="engine-question-hint">Choose {requiredCount} letters.</p>
            ) : null}

            <div className="engine-option-column">
              {options.map((option) => {
                const checked = isMultiMode
                  ? selected.includes(option.label) || selected.includes(option.text)
                  : selected === option.label || selected === option.text;

                const disabled = readOnly || (
                  isMultiMode
                  && shouldDisableMultiOption(selected, option.label, requiredCount)
                );

                return (
                  <label key={option.key} className="engine-option-label">
                    <input
                      type={isMultiMode ? 'checkbox' : 'radio'}
                      name={`mc-${mode}-${questionId}`}
                      value={option.label}
                      checked={checked}
                      onChange={() => handleChange(option.label)}
                      disabled={disabled}
                    />
                    <span>
                      <strong>{option.label}.</strong> {option.text}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
