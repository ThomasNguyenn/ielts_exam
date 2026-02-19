import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import StepContent from '../exam/StepContent';

const fixedTrueFalseOptions = [
  { label: 'A', text: 'TRUE' },
  { label: 'B', text: 'FALSE' },
  { label: 'C', text: 'NOT GIVEN' },
];

const fixedYesNoOptions = [
  { label: 'A', text: 'YES' },
  { label: 'B', text: 'NO' },
  { label: 'C', text: 'NOT GIVEN' },
];

function normalizeValue(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function toScalar(value) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function resolveChoiceText(slot, rawAnswer) {
  const scalar = toScalar(rawAnswer);
  const value = String(scalar ?? '').trim();
  if (!value) return '';

  let options = slot.option || slot.options || [];
  if ((slot.type === 'true_false_notgiven' || slot.type === 'yes_no_notgiven') && options.length === 0) {
    options = slot.type === 'true_false_notgiven' ? fixedTrueFalseOptions : fixedYesNoOptions;
  }

  const byText = options.find((opt) => normalizeValue(opt.text) === normalizeValue(value));
  if (byText) return byText.text;

  const byLabel = options.find(
    (opt) => normalizeValue(opt.label) === normalizeValue(value) || normalizeValue(opt.id) === normalizeValue(value)
  );
  if (byLabel) return byLabel.text;

  return value;
}

function resolveOptionId(options, rawAnswer) {
  const scalar = toScalar(rawAnswer);
  const value = String(scalar ?? '').trim();
  if (!value) return '';

  const byId = options.find(
    (opt) => normalizeValue(opt.id) === normalizeValue(value) || normalizeValue(opt.label) === normalizeValue(value)
  );
  if (byId) return byId.id;

  const byText = options.find((opt) => normalizeValue(opt.text) === normalizeValue(value));
  if (byText) return byText.id;

  return value;
}

function resolveReviewValue(slot, reviewItem) {
  if (!reviewItem) return '';
  const correctAnswer = reviewItem.correct_answer;

  if (slot.type === 'mult_choice' || slot.type === 'mult_choice_multi' || slot.type === 'true_false_notgiven' || slot.type === 'yes_no_notgiven') {
    return resolveChoiceText(slot, correctAnswer);
  }

  if (
    slot.type === 'matching_headings' ||
    slot.type === 'matching_features' ||
    slot.type === 'matching_information' ||
    slot.type === 'matching_info' ||
    slot.type === 'matching' ||
    slot.type === 'summary_completion'
  ) {
    return resolveOptionId(slot.headings || slot.options || [], correctAnswer);
  }

  if (Array.isArray(correctAnswer)) {
    return correctAnswer.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
  }

  return String(correctAnswer ?? '');
}

export default function ReviewExamLayout({
  examTitle,
  step,
  steps,
  slots,
  currentStep,
  setCurrentStep,
  questionReview = [],
  passageStates,
  setPassageState,
  listeningAudioUrl,
  onListeningAudioEnded,
  isSingleMode,
  onBackToResult
}) {
  const reviewLookup = useMemo(
    () =>
      (questionReview || []).reduce((acc, item) => {
        acc[String(item.question_number)] = item;
        return acc;
      }, {}),
    [questionReview]
  );

  const reviewAnswers = useMemo(
    () =>
      slots.map((slot) => {
        const reviewItem = reviewLookup[String(slot.q_number)];
        return resolveReviewValue(slot, reviewItem);
      }),
    [reviewLookup, slots]
  );

  const hasSteps = Array.isArray(steps) && steps.length > 0;
  if (!hasSteps || !step) {
    return (
      <div className="page">
        <p className="muted">Không có dữ liệu để xem lại.</p>
      </div>
    );
  }

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="page exam-page exam-page--stepper review-layout">
      <header className="exam-header">
        <div className="exam-header-left">
          <h1 className="exam-title">{examTitle}</h1>
          <div className="exam-timer-wrapper">
            <div className="exam-timer">
              <span>Chế độ giải thích</span>
            </div>
          </div>
        </div>

        <div className="exam-header-right">
          <button type="button" className="btn-finish-test" onClick={onBackToResult}>
            Quay lại kết quả
          </button>
          <Link to="/tests" className="btn-exit-test">
            Thoát kết quả
          </Link>
        </div>
      </header>

      <div className="exam-part-bar">
        <span className="exam-part-label">{step.label}</span>
        <span className="exam-part-title-text">{step.item?.title || 'Xem lại đáp án và giải thích'}</span>
      </div>

      <form className="exam-form" onSubmit={(e) => e.preventDefault()}>
        <StepContent
          step={step}
          slots={slots}
          answers={reviewAnswers}
          setAnswer={() => {}}
          showResult={false}
          passageStates={passageStates}
          setPassageState={setPassageState}
          listeningAudioUrl={listeningAudioUrl}
          onListeningAudioEnded={onListeningAudioEnded}
          reviewMode
          reviewLookup={reviewLookup}
        />
      </form>

      <footer className="exam-footer">
        <div className="exam-footer-left">
          <span className="footer-part-text">{step.label}</span>
        </div>

        <div className="exam-footer-center">
          <div className="footer-question-nav">
            {slots.map((slot, idx) => {
              if (idx < step.startSlotIndex || idx >= step.endSlotIndex) return null;
              const isAnswered = !!reviewAnswers[idx];

              return (
                <button
                  key={`review-q-${idx}`}
                  type="button"
                  className={`footer-q-btn ${isAnswered ? 'answered' : ''}`}
                  onClick={() => document.getElementById(`q-${idx}`)?.focus()}
                >
                  {slot.q_number}
                </button>
              );
            })}
          </div>
        </div>

        <div className="exam-footer-right">
          {!isSingleMode && (
            <div className="footer-step-nav">
              {steps.map((item, index) => (
                <button
                  key={`review-step-${index}`}
                  type="button"
                  className={`footer-step-btn ${index === currentStep ? 'active' : ''}`}
                  onClick={() => setCurrentStep(index)}
                >
                  {item.label.replace('Passage ', 'Part ')}
                </button>
              ))}
            </div>
          )}

          {!isSingleMode && (
            <>
              <button
                type="button"
                className="footer-nav-arrow"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={isFirst}
                title="Phần trước"
              >
                ◀
              </button>
              <button
                type="button"
                className="footer-nav-arrow"
                onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                disabled={isLast}
                title="Phần tiếp theo"
              >
                ▶
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
