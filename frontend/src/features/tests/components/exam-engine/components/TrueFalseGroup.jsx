const OPTION_SET = {
  TFNG: ['TRUE', 'FALSE', 'NOT GIVEN'],
  YNNG: ['YES', 'NO', 'NOT GIVEN'],
};

export default function TrueFalseGroup({
  type = 'TFNG',
  questions = [],
  answers = {},
  setAnswer,
  readOnly = false,
}) {
  const options = OPTION_SET[type] || OPTION_SET.TFNG;

  return (
    <div className="engine-group">
      {questions.map((question) => {
        const questionId = String(question.id);
        const selectedValue = answers[questionId] || '';
        return (
          <div key={questionId} className="engine-question-block">
            <p className="engine-question-text">
              <strong>{questionId}.</strong> {question.question}
            </p>
            <div className="engine-option-row">
              {options.map((option) => (
                <label key={option} className="engine-option-label">
                  <input
                    type="radio"
                    name={`tfng-${questionId}`}
                    value={option}
                    checked={selectedValue === option}
                    onChange={() => setAnswer(questionId, option)}
                    disabled={readOnly}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
