import { useMemo, useState } from 'react';
import { checkAnswer, formatAnswerDisplay } from './utils/checkAnswer';
import { buildPassageHighlightSegments } from './utils/passageHighlight';

export default function QuestionReview({ question, index }) {
  const [showExplanation, setShowExplanation] = useState(false);

  const userAnswer = question?.your_answer ?? question?.user_answer ?? '';
  const correctAnswer = question?.correct_answer ?? '';
  const isCorrect = checkAnswer(userAnswer, correctAnswer);

  const explanation =
    String(question?.explanation || '').trim() || '\u0043h\u01B0a c\u00F3 gi\u1EA3i th\u00EDch.';
  const passageText = String(question?.passage_text || question?.passageText || '').trim();
  const passageReference = String(question?.passage_reference || question?.passageReference || '').trim();

  const highlightedSegments = useMemo(
    () => buildPassageHighlightSegments(passageText, passageReference),
    [passageText, passageReference]
  );

  return (
    <article className={`review-question-card ${isCorrect ? 'correct' : 'incorrect'}`}>
      <div className="review-question-head">
        <div>
          <p className="review-question-index">
            {`C\u00E2u ${question?.id || question?.question_number || index + 1}`}
          </p>
          <h4>{question?.question || question?.question_text || '(Ch\u01B0a c\u00F3 n\u1ED9i dung c\u00E2u h\u1ECFi)'}</h4>
        </div>
        <span className={`review-status ${isCorrect ? 'correct' : 'incorrect'}`}>
          {isCorrect ? '\u0110\u00FAng' : 'Sai'}
        </span>
      </div>

      <div className="review-answer-grid">
        <div className="review-answer-box your-answer">
          <p>{'C\u00E2u tr\u1EA3 l\u1EDDi c\u1EE7a b\u1EA1n'}</p>
          <strong>{formatAnswerDisplay(userAnswer)}</strong>
        </div>

        <div className="review-answer-box correct-answer">
          <p>{'\u0110\u00E1p \u00E1n \u0111\u00FAng'}</p>
          <strong>{formatAnswerDisplay(correctAnswer)}</strong>
        </div>
      </div>

      <button
        type="button"
        className="review-explain-btn"
        onClick={() => setShowExplanation((prev) => !prev)}
      >
        {'Gi\u1EA3i th\u00EDch'}
      </button>

      {showExplanation && (
        <div className="review-explanation-box">
          <p className="review-explanation-title">{'Gi\u1EA3i th\u00EDch'}</p>
          <p className="review-explanation-content">{explanation}</p>

          {passageText && (
            <div className="review-passage-block">
              <p className="review-passage-title">{'\u0110o\u1EA1n v\u0103n'}</p>
              <p className="review-passage-content">
                {highlightedSegments.map((segment, segmentIndex) =>
                  segment.highlight ? (
                    <mark key={`mark-${segmentIndex}`} className="review-passage-mark">
                      {segment.text}
                    </mark>
                  ) : (
                    <span key={`text-${segmentIndex}`}>{segment.text}</span>
                  )
                )}
              </p>

              {!passageReference && (
                <p className="review-passage-hint">
                  {'Ch\u01B0a c\u00F3 \u0111o\u1EA1n tham chi\u1EBFu cho c\u00E2u h\u1ECFi n\u00E0y.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
