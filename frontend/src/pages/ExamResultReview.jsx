import { useState } from 'react';

/** Result Review Component - Shows detailed question-by-question review */
export default function ExamResultReview({ submitted }) {
  const [expandedItems, setExpandedItems] = useState(new Set());

  const toggleExpand = (index) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const questionReview = submitted.question_review || [];

  const getHeadingText = (q) => {
    if (!q.headings || !q.correct_answer) return q.correct_answer;
    const headingObj = q.headings.find((h) => h.id === q.correct_answer);
    return headingObj ? `${q.correct_answer}. ${headingObj.text}` : q.correct_answer;
  };

  const getYourHeadingText = (q) => {
    if (!q.headings || !q.your_answer) return q.your_answer || '(No answer)';
    const headingObj = q.headings.find((h) => h.id === q.your_answer);
    return headingObj ? `${q.your_answer}. ${headingObj.text}` : q.your_answer;
  };

  const getSummaryOptionText = (q, answerId) => {
    if (!q.options || !answerId) return answerId || '(No answer)';
    const optionObj = q.options.find((o) => o.id === answerId);
    return optionObj ? `${answerId}. ${optionObj.text}` : answerId;
  };

  const normalizeForReview = (val) => {
    if (!val) return '';
    const n = val.trim().toLowerCase().replace(/\s+/g, ' ');
    const mapping = { not: 'not given', ng: 'not given' };
    return mapping[n] || n;
  };

  const getOptionClass = (opt, q, dynamicLabel) => {
    const normUser = normalizeForReview(q.your_answer);
    const normCorrect = normalizeForReview(q.correct_answer);

    const normOptText = normalizeForReview(opt.text);
    const normOptLabel = normalizeForReview(dynamicLabel || opt.label);
    const normOptRealLabel = normalizeForReview(opt.label);

    const isYourAnswer = (normUser === normOptText) || (normUser === normOptLabel) || (normUser === normOptRealLabel);
    const isStoredCorrect = (normCorrect === normOptText) || (normCorrect === normOptLabel) || (normCorrect === normOptRealLabel);

    if (isYourAnswer) {
      if (q.is_correct) return 'result-option result-option--correct';
      return 'result-option result-option--wrong';
    }

    if (isStoredCorrect && !q.is_correct) {
      return 'result-option result-option--correct';
    }

    return 'result-option';
  };

  const getResultIcon = (isCorrect) => (isCorrect
    ? <span className="result-icon result-icon--correct">OK</span>
    : <span className="result-icon result-icon--wrong">X</span>);

  const getQuestionTypeLabel = (type) => {
    const labels = {
      mult_choice: 'Multiple Choice',
      true_false_notgiven: 'True/False/Not Given',
      yes_no_notgiven: 'Yes/No/Not Given',
      gap_fill: 'Gap Fill',
      matching_headings: 'Matching Headings',
      matching_features: 'Matching Features',
      matching_information: 'Matching Information',
      summary_completion: 'Summary Completion',
      listening_map: 'Map Labeling',
    };
    return labels[type] || 'Question';
  };

  return (
    <div className="result-review">
      <h3 className="result-review-title">Question Review ({questionReview.length})</h3>

      <div className="result-accordion">
        {questionReview.map((q, index) => {
          const isExpanded = expandedItems.has(index);
          return (
            <div key={index} className={`result-item ${q.is_correct ? 'result-item--correct' : 'result-item--wrong'}`}>
              <button
                className="result-item-header"
                onClick={() => toggleExpand(index)}
                aria-expanded={isExpanded}
              >
                <div className="result-item-info">
                  {getResultIcon(q.is_correct)}
                  <span className="result-question-number">Question {q.question_number}</span>
                  <span className="result-question-type">{getQuestionTypeLabel(q.type)}</span>
                  <span className="result-item-status">
                    {q.is_correct ? 'Correct' : 'Incorrect'}
                  </span>
                </div>
                <span className={`result-expand-icon ${isExpanded ? 'expanded' : ''}`}>v</span>
              </button>

              {isExpanded && (
                <div className="result-item-details">
                  <div className="result-question-text">
                    <p className="result-label">Question:</p>
                    <p>{q.question_text}</p>
                  </div>

                  {(q.type === 'mult_choice' || q.type === 'true_false_notgiven' || q.type === 'yes_no_notgiven') && (
                    <div className="result-options">
                      <p className="result-label">Options:</p>
                      {(q.options || []).filter((o) => o.text).map((opt, oi) => {
                        const dynamicLabel = opt.label || String.fromCharCode(65 + oi);
                        return (
                          <div key={oi} className={getOptionClass(opt, q, dynamicLabel)}>
                            <span className="option-label">{opt.label}.</span>
                            <span className="option-text">{opt.text}</span>
                            {(() => {
                              const normUser = normalizeForReview(q.your_answer);
                              const normCorrect = normalizeForReview(q.correct_answer);
                              const normOptText = normalizeForReview(opt.text);
                              const normOptLabel = normalizeForReview(dynamicLabel);
                              const normOptRealLabel = normalizeForReview(opt.label);

                              const isYourAnswer = (normUser === normOptText) || (normUser === normOptLabel) || (normUser === normOptRealLabel);
                              const isStoredCorrect = (normCorrect === normOptText) || (normCorrect === normOptLabel) || (normCorrect === normOptRealLabel);

                              if (isYourAnswer) return <span className="your-badge">(Your answer)</span>;
                              if (isStoredCorrect && !q.is_correct) return <span className="correct-badge">(Correct)</span>;
                              return null;
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'gap_fill' && (
                    <div className="result-gap-answer">
                      <p className="result-label">Your Answer:</p>
                      <p className="answer-text">{q.your_answer || '(No answer)'}</p>
                      <p className="result-label">Correct Answer:</p>
                      <p className="correct-text">{q.correct_answer || '(No correct answer)'}</p>
                    </div>
                  )}

                  {q.type === 'summary_completion' && (
                    <div className="result-gap-answer">
                      <p className="result-label">Your Answer:</p>
                      <p className="answer-text">
                        {q.options && q.options.length > 0
                          ? getSummaryOptionText(q, q.your_answer)
                          : (q.your_answer || '(No answer)')}
                      </p>
                      <p className="result-label">Correct Answer:</p>
                      <p className="correct-text">
                        {q.options && q.options.length > 0
                          ? getSummaryOptionText(q, q.correct_answer)
                          : (q.correct_answer || '(No correct answer)')}
                      </p>
                    </div>
                  )}

                  {(q.type === 'matching_headings' || q.type === 'matching_features' || q.type === 'matching_information') && (
                    <div className="result-matching-answer">
                      <p className="result-label">Your Answer:</p>
                      <p className="answer-text">{getYourHeadingText(q)}</p>
                      <p className="result-label">Correct Answer:</p>
                      <p className="correct-text">{getHeadingText(q)}</p>
                    </div>
                  )}

                  {q.explanation && (
                    <div className="result-explanation">
                      <p className="result-label">Explanation:</p>
                      <p>{q.explanation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
