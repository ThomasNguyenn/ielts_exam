import { splitByPlaceholders } from '../utils/gapFillParser';

function PlaceholderInput({ id, answers, setAnswer, readOnly = false }) {
  return (
    <input
      className="engine-gap-input"
      value={answers[id] || ''}
      onChange={(event) => setAnswer(id, event.target.value)}
      disabled={readOnly}
      placeholder={id}
    />
  );
}

export default function GapFillGroup({
  group,
  answers = {},
  setAnswer,
  readOnly = false,
}) {
  const hasPassageMode = typeof group.passage === 'string' && group.passage.length > 0;

  if (hasPassageMode) {
    const tokens = splitByPlaceholders(group.passage);

    return (
      <div className="engine-group">
        <p className="engine-gap-passage">
          {tokens.map((token, index) => {
            if (token.type === 'text') {
              return <span key={`text-${index}`}>{token.value}</span>;
            }

            return (
              <span key={`placeholder-${token.id}-${index}`} className="engine-inline-placeholder">
                <PlaceholderInput
                  id={token.id}
                  answers={answers}
                  setAnswer={setAnswer}
                  readOnly={readOnly}
                />
              </span>
            );
          })}
        </p>
      </div>
    );
  }

  const questions = Array.isArray(group.questions) ? group.questions : [];
  return (
    <div className="engine-group">
      {questions.map((question) => {
        const questionId = String(question.id);
        return (
          <div key={questionId} className="engine-question-block">
            <p className="engine-question-text">
              <strong>{questionId}.</strong> {question.question}
            </p>
            <PlaceholderInput
              id={questionId}
              answers={answers}
              setAnswer={setAnswer}
              readOnly={readOnly}
            />
          </div>
        );
      })}
    </div>
  );
}
