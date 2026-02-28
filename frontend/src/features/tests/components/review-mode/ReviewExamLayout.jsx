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
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase().replace(/[.,]+$/, '');
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

  // Build reviewAnswers in a group-aware way so multi-select groups
  // get ALL correct answers spread across their slots (for checkbox highlighting).
  const reviewAnswers = useMemo(() => {
    const result = new Array(slots.length).fill('');

    // We need to process slot by slot but be aware of multi-select groups.
    // A multi-select group: mult_choice type with >1 questions and no 'radio' layout.
    // We build a group index to detect this. We walk step.item.question_groups.
    // Since reviewAnswers is used for the whole exam, we iterate all steps.

    // Build a map: q_number -> { groupSize, groupQNumbers }
    const groupInfoByQNumber = {};
    (steps || []).forEach((s) => {
      (s.item?.question_groups || []).forEach((group) => {
        const groupLayout = group.group_layout;
        const isForceRadio = groupLayout === 'radio';
        const isForceCheckbox = groupLayout === 'checkbox';
        const qs = group.questions || [];
        const isMulti =
          (group.type === 'mult_choice' || group.type === 'mult_choice_multi') &&
          (isForceCheckbox || (!isForceRadio && qs.length > 1));

        qs.forEach((q) => {
          groupInfoByQNumber[String(q.q_number)] = {
            isMultiSelectGroup: isMulti,
            groupQNumbers: isMulti ? qs.map((gq) => String(gq.q_number)) : null,
          };
        });
      });
    });

    // Track which multi-select groups we've already processed (to avoid double work)
    const processedGroups = new Set();

    slots.forEach((slot, idx) => {
      const qKey = String(slot.q_number);
      const info = groupInfoByQNumber[qKey];

      if (info?.isMultiSelectGroup) {
        const groupKey = info.groupQNumbers.join(',');
        if (processedGroups.has(groupKey)) {
          // Already filled in by the first slot's pass — leave as-is
          return;
        }
        processedGroups.add(groupKey);

        // Collect all unique correct answers from every slot in this group
        const allCorrect = [];
        info.groupQNumbers.forEach((gqKey) => {
          const ri = reviewLookup[gqKey];
          if (!ri) return;
          const ca = ri.correct_answer;
          if (Array.isArray(ca)) {
            ca.forEach((v) => { if (v && !allCorrect.includes(v)) allCorrect.push(v); });
          } else if (ca) {
            if (!allCorrect.includes(ca)) allCorrect.push(ca);
          }
        });

        // Spread them into consecutive slots starting at the first slot of the group
        const firstSlotIdx = slots.findIndex((s) => String(s.q_number) === info.groupQNumbers[0]);
        allCorrect.forEach((answer, i) => {
          if (firstSlotIdx + i < result.length) {
            result[firstSlotIdx + i] = answer;
          }
        });
      } else {
        // Normal single-answer slot
        const reviewItem = reviewLookup[qKey];
        result[idx] = resolveReviewValue(slot, reviewItem);
      }
    });

    return result;
  }, [reviewLookup, slots, steps]);


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
