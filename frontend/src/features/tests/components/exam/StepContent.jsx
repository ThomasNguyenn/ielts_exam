import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import parse from 'html-react-parser';
import HighlightableContent, { HighlightableWrapper, tokenizeHtml } from '@/shared/components/HighlightableContent';
import { toSanitizedInnerHtml } from '@/shared/utils/safeHtml';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

const IELTSAudioPlayer = lazy(() => import('@/shared/components/IELTSAudioPlayer'));

function getMatchingOptionToken(option = {}) {
  const idToken = String(option?.id ?? '').trim();
  if (idToken) return idToken;
  const labelToken = String(option?.label ?? '').trim();
  if (labelToken) return labelToken;
  const textToken = String(option?.text ?? '').trim();
  return textToken;
}

function getMatchingOptionLabel(option = {}) {
  const idToken = String(option?.id ?? '').trim();
  const textToken = String(option?.text ?? '').trim();
  if (idToken && textToken) return `${idToken}. ${textToken}`;
  return textToken || idToken || getMatchingOptionToken(option);
}

function QuestionInput({
  slot,
  value,
  onChange,
  index,
  onHighlightUpdate,
  showResult,
  passageStates,
  isListening = false,
  reviewMode = false,
  useMatchingDropdown = false,
}) {
  const id = `q-${index}`;
  const [matchingDragOver, setMatchingDragOver] = useState(false);
  const [strikethroughOptions, setStrikethroughOptions] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem(`strikethrough_${id}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // 1. Định nghĩa logic chung (Binding dữ liệu)
  const common = {
    value: value || '',
    onChange: (e) => {
      if (!reviewMode) onChange(e.target.value);
    },
    disabled: reviewMode,
    readOnly: reviewMode
  };

  // Handle right-click to toggle strikethrough
  const handleRightClick = (e, optionLabel) => {
    if (reviewMode) return;
    e.preventDefault();
    setStrikethroughOptions(prev => {
      const next = new Set(prev);
      if (next.has(optionLabel)) {
        next.delete(optionLabel);
      } else {
        next.add(optionLabel);
      }
      // Save to localStorage specifically for this question
      localStorage.setItem(`strikethrough_${id}`, JSON.stringify([...next]));
      return next;
    });
  };

  // --- TRẮC NGHIỆM (Radio) ---
  if (slot.type === 'mult_choice' || slot.type === 'true_false_notgiven' || slot.type === 'yes_no_notgiven') {
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
    const dynamicOptions = (slot.option || []).filter((o) => o.text);
    const resolvedOptions =
      slot.type === 'true_false_notgiven'
        ? (dynamicOptions.length ? dynamicOptions : fixedTrueFalseOptions)
        : slot.type === 'yes_no_notgiven'
          ? (dynamicOptions.length ? dynamicOptions : fixedYesNoOptions)
          : dynamicOptions;
    return (
      <div id={id} data-question-index={index} tabIndex={-1} className="question-slot-anchor">
        <div className="exam-options">
          {resolvedOptions.map((opt) => {
            // Unique key for this option's highlighted state
            const optKey = `opt_${index}_${opt.label}`;
            // Initial tokenized HTML or persisted state
            const optionHtml = (passageStates && passageStates[optKey]) || opt.text || '';
            const isStrikethrough = strikethroughOptions.has(opt.label);

            return (
              <label
                key={opt.label}
                className={`exam-option-label ${isStrikethrough ? 'eliminated' : ''}`}
                onContextMenu={(e) => handleRightClick(e, opt.label)}
                title="Right-click to eliminate this option"
              >
                <input
                  type="radio"
                  name={id}
                  checked={(value || '').trim() === (opt.text || '').trim()}
                  onChange={() => !reviewMode && onChange(opt.text)}
                  disabled={reviewMode || isStrikethrough}
                />
                <span className="opt-id">{opt.label}.</span>
                <HighlightableContent
                  id={optKey}
                  htmlContent={optionHtml}
                  onUpdateHtml={(newHtml) => {
                    if (onHighlightUpdate) {
                      onHighlightUpdate(optKey, newHtml);
                    }
                  }}
                  tagName="span"
                  className="opt-text"
                />
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  // --- ĐIỀN TỪ (Gap Fill) - Inline numbered box ---
  if (slot.type === 'gap_fill' || slot.type === 'note_completion') {
    return (
      <input
        id={id}
        data-question-index={index}
        type="text"
        className={`gap-fill-input ${isListening ? 'gap-fill-input-listening' : ''}`}
        placeholder={`${index + 1}`}
        autoComplete="off"
        {...common}
      />
    );
  }

  // --- MATCHING ---
  if (
    slot.type === 'matching_headings' ||
    slot.type === 'matching_features' ||
    slot.type === 'matching_information' ||
    slot.type === 'matching_info' ||
    slot.type === 'matching'
  ) {
    const options = slot.headings || [];
    const normalizedValue = normalizeReviewText(value);
    const selectedById = normalizedValue
      ? options.find((option) => normalizeReviewText(option?.id) === normalizedValue)
      : null;
    const selectedByLabel = normalizedValue && !selectedById
      ? options.find((option) => normalizeReviewText(option?.label) === normalizedValue)
      : null;
    const selectedByText = normalizedValue && !selectedById && !selectedByLabel
      ? options.find((option) => normalizeReviewText(option?.text) === normalizedValue)
      : null;
    const selectedOption = selectedById || selectedByLabel || selectedByText || null;

    if (reviewMode) {
      return (
        <div
          id={id}
          data-question-index={index}
          tabIndex={-1}
          className="matching-dropzone result-mode correct"
        >
          {selectedOption ? (
            <div className="matching-selected">
              <span className="matching-chip-text">{selectedOption.text}</span>
            </div>
          ) : (
            <div className="matching-placeholder">(No answer)</div>
          )}
        </div>
      );
    }

    // Result display logic
    if (showResult) {
      const clean = (str) => (str || '').toLowerCase().replace(/^[ivx]+\.?\s*/i, '').trim();

      // Find correct answer object - resilient search
      let correctOption = options.find((option) => option.id === slot.correct_answer);
      if (!correctOption) {
        // Fallback: try to find by text content
        correctOption = options.find((option) => clean(option.text) === clean(slot.correct_answer));
      }

      let isCorrect = value === slot.correct_answer;

      // Loose check: Compare text content if IDs don't match directly
      if (!isCorrect && selectedOption && correctOption) {
        if (clean(selectedOption.text) === clean(correctOption.text)) {
          isCorrect = true;
        }
      }

      return (
        <div
          id={id}
          data-question-index={index}
          tabIndex={-1}
          className={`matching-dropzone result-mode ${isCorrect ? 'correct' : 'wrong'}`}
        >
          {selectedOption ? (
            <div className="matching-selected">
              <span className="matching-chip-text">{selectedOption.text}</span>
            </div>
          ) : (
            <div className="matching-placeholder">(No answer)</div>
          )}
          {!isCorrect && correctOption && (
            <div className="matching-correct-ans">
              <strong>Correct: </strong> {correctOption.text}
            </div>
          )}
        </div>
      );
    }

    const selectedToken = selectedOption ? getMatchingOptionToken(selectedOption) : '';

    if (useMatchingDropdown) {
      return (
        <div
          id={id}
          data-question-index={index}
          tabIndex={-1}
          className={`matching-dropzone ${selectedOption ? 'has-value' : ''}`}
        >
          <Select
            value={selectedToken || undefined}
            onValueChange={(nextValue) => !reviewMode && onChange(nextValue)}
            disabled={reviewMode}
          >
            <SelectTrigger
              className="matching-dropdown-trigger"
              aria-label={`Question ${index + 1} matching answer`}
            >
              <SelectValue placeholder="Select answer" />
            </SelectTrigger>
            <SelectContent
              className="matching-dropdown-content"
              position="popper"
              collisionPadding={12}
              sideOffset={8}
            >
              {options.map((option) => {
                const optionToken = getMatchingOptionToken(option);
                if (!optionToken) return null;
                const optionId = String(option?.id ?? '').trim();
                const optionText = String(option?.text ?? '').trim();
                const optionLabel = optionId && optionText ? `${optionId}. ${optionText}` : optionText || optionId || optionToken;

                return (
                  <SelectItem key={optionToken} value={optionToken}>
                    {optionLabel}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div
        id={id}
        data-question-index={index}
        tabIndex={-1}
        className={`matching-dropzone ${selectedOption ? 'has-value' : ''} ${matchingDragOver ? 'drag-over' : ''}`}
        onDragOver={(event) => {
          if (reviewMode) return;
          event.preventDefault();
          setMatchingDragOver(true);
        }}
        onDragLeave={() => setMatchingDragOver(false)}
        onDrop={(event) => {
          if (reviewMode) return;
          event.preventDefault();
          setMatchingDragOver(false);
          const droppedToken =
            event.dataTransfer.getData('application/x-matching-token') ||
            event.dataTransfer.getData('text/plain');
          if (droppedToken) onChange(droppedToken);
        }}
      >
        {selectedOption ? (
          <div className="matching-selected">
            <span className="matching-chip-text">{selectedOption.text || selectedOption.id || selectedToken}</span>
            <button
              type="button"
              className="matching-remove"
              onClick={() => !reviewMode && onChange('')}
              aria-label={`Clear question ${index + 1} answer`}
            >
              x
            </button>
          </div>
        ) : (
          <div className="matching-placeholder">Drop answer here</div>
        )}
      </div>
    );
  }
  // Mặc định (Fallback)
  return (
    <input
      id={id}
      data-question-index={index}
      type="text"
      className="exam-input"
      placeholder="Your answer"
      {...common}
    />
  );
}

/** Inline Dropdown for Summary Completion */
function SummaryDropZone({
  value,
  onChange,
  index,
  options,
  displayNumber,
  reviewMode = false,
  questionIndex,
  useDropdown = false,
}) {
  const anchorIndex = Number.isFinite(questionIndex) ? questionIndex : index;
  const anchorId = `q-${anchorIndex}`;
  const [isDragOver, setIsDragOver] = useState(false);
  const selectedOption = findSummaryOptionByAnswer(options || [], value);
  const selectedToken = selectedOption?.token || '';

  if (reviewMode) {
    return (
      <span
        id={anchorId}
        data-question-index={anchorIndex}
        tabIndex={-1}
        className={`summary-dropzone ${selectedOption ? 'has-value' : ''}`}
      >
        {selectedOption ? (
          <span className="summary-selected-chip">
            <span className="summary-chip-text">{selectedOption.text || selectedOption.id || selectedOption.token}</span>
          </span>
        ) : (
          <span style={{ color: '#9ca3af', fontSize: '0.9rem', fontWeight: 'bold' }}>{displayNumber || index + 1}</span>
        )}
      </span>
    );
  }

  if (useDropdown) {
    return (
      <span
        id={anchorId}
        data-question-index={anchorIndex}
        tabIndex={-1}
        className={`summary-dropzone ${selectedOption ? 'has-value' : ''}`}
        title="Choose answer"
      >
        <Select
          value={selectedToken || undefined}
          onValueChange={(nextValue) => onChange(nextValue)}
        >
          <SelectTrigger
            className="summary-dropdown-trigger"
            aria-label={`Question ${displayNumber || index + 1} summary answer`}
          >
            <SelectValue placeholder={`${displayNumber || index + 1}`} />
          </SelectTrigger>
          <SelectContent
            className="summary-dropdown-content"
            position="popper"
            collisionPadding={12}
            sideOffset={8}
          >
            {(options || []).map((option) => (
              <SelectItem key={option.token} value={option.token}>
                {getSummaryDisplayText(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    );
  }

  return (
    <span
      id={anchorId}
      data-question-index={anchorIndex}
      tabIndex={-1}
      className={`summary-dropzone ${selectedOption ? 'has-value' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={(event) => {
        if (reviewMode) return;
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        if (reviewMode) return;
        event.preventDefault();
        setIsDragOver(false);
        const droppedToken =
          event.dataTransfer.getData('application/x-summary-token') ||
          event.dataTransfer.getData('text/plain');
        if (droppedToken) onChange(droppedToken);
      }}
      title="Drop answer"
    >
      {selectedOption ? (
        <span className="summary-selected-chip">
          <span className="summary-chip-text">{selectedOption.text || selectedOption.id || selectedOption.token}</span>
          <button
            type="button"
            className="matching-remove"
            onClick={() => onChange('')}
            aria-label={`Clear question ${displayNumber || index + 1} answer`}
          >
            x
          </button>
        </span>
      ) : (
        <span style={{ color: '#64748b', fontSize: '0.86rem', fontWeight: 700 }}>Drop answer here</span>
      )}
    </span>
  );
}
/** Component for IELTS Listening Map questions with Image + Matching Grid */
function ListeningMapGrid({ group, slots, answers, setAnswer, startSlotIndex, reviewMode = false }) {
  const options = group.options || []; // e.g. [{id: 'A', text: ''}, ...]
  const questions = group.questions || []; // e.g. [{q_number: 5, text: 'hotel'}, ...]
  const mapImageUrl = String(group.image_url || '').trim() || (isLikelyHttpUrl(group.text) ? String(group.text || '').trim() : '');

  return (
    <div className="listening-map-container">
      {mapImageUrl ? (
        <div className="listening-map-image-wrapper">
          <img src={mapImageUrl} alt="IELTS Map" className="listening-map-image" />
        </div>
      ) : null}

      <div className="listening-map-grid-wrapper">
        <table className="listening-map-table">
          <thead>
            <tr>
              <th className="row-label-header"></th>
              {options.map(opt => (
                <th key={opt.id} className="col-label">{opt.id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {questions.map((q, qi) => {
              const currentSlotIndex = startSlotIndex + qi;
              return (
                <tr key={qi}>
                  <td className="row-label">
                    <span
                      id={`q-${currentSlotIndex}`}
                      data-question-index={currentSlotIndex}
                      tabIndex={-1}
                      className="question-slot-anchor-marker"
                    />
                    <strong>{q.q_number}</strong> {q.text}
                  </td>
                  {options.map(opt => {
                    const id = `map-${currentSlotIndex}-${opt.id}`;
                    return (
                      <td key={opt.id} className="grid-cell">
                        <label className="grid-radio-label" htmlFor={id}>
                          <input
                            type="checkbox"
                            id={id}
                            checked={answers[currentSlotIndex] === opt.id}
                            onChange={() => !reviewMode && setAnswer(currentSlotIndex, answers[currentSlotIndex] === opt.id ? '' : opt.id)}
                            disabled={reviewMode}
                          />
                          <span className="radio-custom" />
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
    </div>
  );
}

function getGroupTextHtml(rawText) {
  if (!rawText) return '';
  const hasTableMarkup = /<\s*(table|thead|tbody|tr|td|th)\b/i.test(rawText);
  if (hasTableMarkup) {
    return rawText
      .replace(/(<br\s*\/?>\s*){2,}/gi, '<br />')
      .replace(/<br\s*\/?>\s*(?=<table\b)/gi, '')
      .replace(/<\/table>\s*<br\s*\/?>/gi, '</table>');
  }
  if (rawText.includes('token-word')) return rawText;
  return tokenizeHtml(rawText.replace(/\n/g, '<br />'));
}

function hasAnsweredValue(value) {
  if (Array.isArray(value)) {
    return value.some((item) => String(item ?? '').trim().length > 0);
  }
  return String(value ?? '').trim().length > 0;
}

function ReadingStepLayout({
  item,
  contentHtml,
  startSlotIndex,
  answers,
  setAnswer,
  passageStates,
  showResult,
  isListening,
  handleHtmlUpdate,
  questionsBlock,
  reviewMode = false,
  useMobileReadingDrawer = false,
}) {
  const useDropdownForDragDrop = Boolean(useMobileReadingDrawer);
  // Identify valid matching question placeholders in passage text.
  const matchingQuestionNumbers = new Set();
  (item.question_groups || []).forEach((g) => {
    if (g.type === 'matching_headings' || g.type === 'matching_information' || g.type === 'matching_info' || g.type === 'matching') {
      g.questions.forEach((q) => matchingQuestionNumbers.add(String(q.q_number)));
    }
  });

  let processedContentHtml = contentHtml;
  if (matchingQuestionNumbers.size > 0) {
    processedContentHtml = contentHtml.replace(/\[\s*(\d+)\s*\]/g, (match, p1) => {
      const numStr = String(p1);
      if (matchingQuestionNumbers.has(numStr)) {
        return `<span class="embedded-dropzone" data-question-number="${numStr}"></span>`;
      }
      return match;
    });
  }

  const [embeddedNodes, setEmbeddedNodes] = useState([]);
  const passageContainerRef = useRef(null);
  const [mobileQuestionsOpen, setMobileQuestionsOpen] = useState(false);
  const [mobileSnapPoint, setMobileSnapPoint] = useState(0.55);
  const [activeMobileQuestionIndex, setActiveMobileQuestionIndex] = useState(null);
  const mobileDrawerQuestionsRef = useRef(null);

  const questionItems = useMemo(() => {
    const items = [];
    let runningSlotIndex = startSlotIndex;

    (item.question_groups || []).forEach((group) => {
      (group.questions || []).forEach((question, questionIndex) => {
        const slotIdx = runningSlotIndex + questionIndex;
        items.push({
          slotIndex: slotIdx,
          qNumber: question?.q_number ?? (slotIdx + 1),
          answered: hasAnsweredValue(answers[slotIdx]),
        });
      });
      runningSlotIndex += (group.questions || []).length;
    });

    return items;
  }, [item.question_groups, startSlotIndex, answers]);

  const answeredQuestionCount = useMemo(
    () => questionItems.reduce((count, question) => count + (question.answered ? 1 : 0), 0),
    [questionItems],
  );

  useEffect(() => {
    if (passageContainerRef.current) {
      const nodes = passageContainerRef.current.querySelectorAll('.embedded-dropzone');
      setEmbeddedNodes(Array.from(nodes));
      return;
    }
    setEmbeddedNodes([]);
  }, [processedContentHtml]);

  useEffect(() => {
    if (!questionItems.length) {
      setActiveMobileQuestionIndex(null);
      return;
    }
    setActiveMobileQuestionIndex((current) => {
      if (questionItems.some((question) => question.slotIndex === current)) {
        return current;
      }
      return questionItems[0].slotIndex;
    });
  }, [questionItems]);

  useEffect(() => {
    setMobileQuestionsOpen(false);
    setMobileSnapPoint(0.55);
  }, [item?._id, useMobileReadingDrawer]);

  const scrollToQuestionInDrawer = (targetQuestionIndex) => {
    const container = mobileDrawerQuestionsRef.current;
    if (!container) return false;

    const selector = `[data-question-index="${targetQuestionIndex}"]`;
    const target =
      container.querySelector(selector) ||
      container.querySelector(`#q-${targetQuestionIndex}`);

    if (!target) return false;

    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const nextTop =
      targetRect.top - containerRect.top + container.scrollTop - 12;

    container.scrollTo({
      top: Math.max(0, nextTop),
      behavior: 'smooth',
    });

    if (typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
    return true;
  };

  const handleMobileQuestionSelect = (targetQuestionIndex) => {
    setActiveMobileQuestionIndex(targetQuestionIndex);
    if (!mobileQuestionsOpen) {
      setMobileQuestionsOpen(true);
      return;
    }
    const didScroll = scrollToQuestionInDrawer(targetQuestionIndex);
    if (!didScroll) {
      window.requestAnimationFrame(() => {
        scrollToQuestionInDrawer(targetQuestionIndex);
      });
    }
  };

  useEffect(() => {
    if (!useMobileReadingDrawer || !mobileQuestionsOpen || activeMobileQuestionIndex == null) return undefined;
    let timeoutId = null;
    const rafId = window.requestAnimationFrame(() => {
      const didScroll = scrollToQuestionInDrawer(activeMobileQuestionIndex);
      if (!didScroll) {
        timeoutId = window.setTimeout(() => {
          scrollToQuestionInDrawer(activeMobileQuestionIndex);
        }, 120);
      }
    });
    return () => {
      window.cancelAnimationFrame(rafId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [useMobileReadingDrawer, mobileQuestionsOpen, activeMobileQuestionIndex]);

  if (useMobileReadingDrawer && !reviewMode) {
    return (
      <div className="reading-mobile-layout">
        <div className="passage-scrollable reading-mobile-passage">
          <HighlightableContent
            ref={passageContainerRef}
            htmlContent={processedContentHtml}
            onUpdateHtml={(html) => handleHtmlUpdate(item._id, html)}
            id={item._id}
          />
          {embeddedNodes.map((node) => {
            const qNum = node.getAttribute('data-question-number');

            let targetGroup = null;
            let targetQuestion = null;
            let targetSlotIndex = -1;
            let targetGroupStartIndex = -1;
            let runningSlotIndex = startSlotIndex;

            (item.question_groups || []).forEach((group) => {
              const groupStartIndex = runningSlotIndex;
              const foundQuestionIndex = group.questions.findIndex((question) => String(question.q_number) === qNum);
              if (foundQuestionIndex !== -1) {
                targetGroup = group;
                targetQuestion = group.questions[foundQuestionIndex];
                targetSlotIndex = groupStartIndex + foundQuestionIndex;
                targetGroupStartIndex = groupStartIndex;
              }
              runningSlotIndex += (group.questions || []).length;
            });

            if (!targetGroup || !targetQuestion || targetSlotIndex === -1 || targetGroupStartIndex === -1) return null;

            const currentValue = answers[targetSlotIndex] || '';
            return ReactDOM.createPortal(
              <div className="embedded-matching-slot" style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 5px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', marginRight: '4px', color: '#666' }}>{qNum}</span>
                <QuestionInput
                  slot={{
                    type: 'matching_headings',
                    ...targetQuestion,
                    headings: targetGroup.headings,
                    correct_answer: targetQuestion.correct_answer
                  }}
                  value={currentValue}
                  onChange={(value) =>
                    setMatchingAnswerWithSingleUse({
                      group: targetGroup,
                      groupStartIndex: targetGroupStartIndex,
                      questionCount: (targetGroup.questions || []).length,
                      targetIndex: targetSlotIndex,
                      nextValue: value,
                      answers,
                      setAnswer,
                    })}
                  passageStates={passageStates}
                  showResult={showResult}
                  index={targetSlotIndex}
                  isListening={isListening}
                  reviewMode={reviewMode}
                  useMatchingDropdown={useDropdownForDragDrop}
                />
              </div>,
              node
            );
          })}
        </div>

        {questionItems.length > 0 ? (
          <button
            type="button"
            className="reading-mobile-drawer-trigger"
            onClick={() => setMobileQuestionsOpen(true)}
          >
            Questions ({answeredQuestionCount}/{questionItems.length})
          </button>
        ) : null}

        <Drawer
          open={mobileQuestionsOpen}
          onOpenChange={setMobileQuestionsOpen}
          direction="bottom"
          snapPoints={[0.3, 0.55, 0.9]}
          activeSnapPoint={mobileSnapPoint}
          setActiveSnapPoint={setMobileSnapPoint}
        >
          <DrawerContent className="reading-mobile-drawer-content">
            <DrawerHeader className="reading-mobile-drawer-header">
              <div className="reading-mobile-drawer-header-row">
                <DrawerTitle className="text-base">Questions</DrawerTitle>
                <button
                  type="button"
                  className="reading-mobile-drawer-close"
                  onClick={() => setMobileQuestionsOpen(false)}
                  aria-label="Close question panel"
                >
                  ×
                </button>
              </div>
              <DrawerDescription>
                Answered {answeredQuestionCount}/{questionItems.length}. Drag up/down to resize.
              </DrawerDescription>
            </DrawerHeader>

            <div ref={mobileDrawerQuestionsRef} className="reading-mobile-drawer-questions questions-scrollable">
              {questionsBlock}
            </div>

            {questionItems.length > 0 ? (
              <div className="reading-mobile-question-nav">
                {questionItems.map((question) => (
                  <button
                    key={`mobile-question-${question.slotIndex}`}
                    type="button"
                    className={`reading-mobile-question-chip ${question.answered ? 'is-answered' : ''} ${activeMobileQuestionIndex === question.slotIndex ? 'is-active' : ''}`}
                    onClick={() => handleMobileQuestionSelect(question.slotIndex)}
                    aria-label={`Question ${question.qNumber}`}
                  >
                    {question.qNumber}
                  </button>
                ))}
              </div>
            ) : null}
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <PanelGroup direction="horizontal" className="ielts-reading-layout">
      <Panel defaultSize={50} minSize={20} className="ielts-passage-panel">
        <div className="passage-scrollable">
          <HighlightableContent
            ref={passageContainerRef}
            htmlContent={processedContentHtml}
            onUpdateHtml={(html) => handleHtmlUpdate(item._id, html)}
            id={item._id}
          />
          {embeddedNodes.map((node) => {
            const qNum = node.getAttribute('data-question-number');

            let targetGroup = null;
            let targetQuestion = null;
            let targetSlotIndex = -1;
            let targetGroupStartIndex = -1;
            let runningSlotIndex = startSlotIndex;

            (item.question_groups || []).forEach((g) => {
              const groupStartIndex = runningSlotIndex;
              const foundQIndex = g.questions.findIndex((q) => String(q.q_number) === qNum);
              if (foundQIndex !== -1) {
                targetGroup = g;
                targetQuestion = g.questions[foundQIndex];
                targetSlotIndex = groupStartIndex + foundQIndex;
                targetGroupStartIndex = groupStartIndex;
              }
              runningSlotIndex += (g.questions || []).length;
            });

            if (!targetGroup || !targetQuestion || targetSlotIndex === -1 || targetGroupStartIndex === -1) return null;

            const currentValue = answers[targetSlotIndex] || '';
            return ReactDOM.createPortal(
              <div className="embedded-matching-slot" style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 5px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', marginRight: '4px', color: '#666' }}>{qNum}</span>
                <QuestionInput
                  slot={{
                    type: 'matching_headings',
                    ...targetQuestion,
                    headings: targetGroup.headings,
                    correct_answer: targetQuestion.correct_answer
                  }}
                  value={currentValue}
                  onChange={(val) =>
                    setMatchingAnswerWithSingleUse({
                      group: targetGroup,
                      groupStartIndex: targetGroupStartIndex,
                      questionCount: (targetGroup.questions || []).length,
                      targetIndex: targetSlotIndex,
                      nextValue: val,
                      answers,
                      setAnswer,
                    })}
                  passageStates={passageStates}
                  showResult={showResult}
                  index={targetSlotIndex}
                  isListening={isListening}
                  reviewMode={reviewMode}
                  useMatchingDropdown={useDropdownForDragDrop}
                />
              </div>,
              node
            );
          })}
        </div>
      </Panel>

      <PanelResizeHandle className="ielts-resizer">
        <div className="resizer-handle-button" />
      </PanelResizeHandle>

      <Panel defaultSize={50} minSize={20} className="ielts-questions-panel">
        <div className="questions-scrollable">
          {questionsBlock}
        </div>
      </Panel>
    </PanelGroup>
  );
}


/** One step: passage/section content + its questions (with slot indices) */
function normalizeReviewText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase().replace(/[.,]+$/, '');
}

function normalizeMatchingGroupType(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'matching_info') return 'matching_information';
  if (raw === 'matching_heading') return 'matching_headings';
  return raw;
}

function parseMatchingUseOnceFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'no' ||
      normalized === 'off' ||
      normalized === '' ||
      normalized === 'null' ||
      normalized === 'undefined'
    ) {
      return false;
    }
    return false;
  }
  return false;
}

function shouldUseMatchingOptionOnce(group = {}) {
  const groupType = normalizeMatchingGroupType(group?.type);
  if (groupType === 'matching_headings') {
    const rawUseOnce = group?.use_once;
    const isUnset =
      rawUseOnce === undefined ||
      rawUseOnce === null ||
      (typeof rawUseOnce === 'string' && rawUseOnce.trim() === '');
    if (isUnset) return true;
  }
  return parseMatchingUseOnceFlag(group?.use_once);
}

function setMatchingAnswerWithSingleUse({
  group,
  groupStartIndex,
  questionCount,
  targetIndex,
  nextValue,
  answers,
  setAnswer,
}) {
  const nextToken = String(nextValue ?? '').trim();
  const shouldEnforceSingleUse = shouldUseMatchingOptionOnce(group);
  console.log('matching debug', {
    type: group?.type,
    use_once: group?.use_once,
    shouldUse: shouldEnforceSingleUse,
  });

  if (
    !shouldEnforceSingleUse ||
    !nextToken ||
    !Array.isArray(answers) ||
    !Number.isFinite(groupStartIndex) ||
    !Number.isFinite(questionCount) ||
    questionCount <= 0
  ) {
    setAnswer(targetIndex, nextValue);
    return;
  }

  const normalizedNextToken = normalizeReviewText(nextToken);
  for (let offset = 0; offset < questionCount; offset += 1) {
    const questionIndex = groupStartIndex + offset;
    if (questionIndex === targetIndex) continue;
    if (normalizeReviewText(answers[questionIndex]) === normalizedNextToken) {
      setAnswer(questionIndex, '');
    }
  }

  setAnswer(targetIndex, nextValue);
}

function formatReviewAnswer(value) {
  if (Array.isArray(value)) {
    const cleaned = value.map((v) => String(v ?? '').trim()).filter(Boolean);
    return cleaned.length ? cleaned.join(', ') : '(Bỏ trống)';
  }
  const text = String(value ?? '').trim();
  return text || '(Bỏ trống)';
}

function getAnswerTextFromOptions(value, options = []) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const normalizedRaw = normalizeReviewText(raw);
  const foundByIdOrLabel = options.find(
    (opt) =>
      normalizeReviewText(opt?.id) === normalizedRaw ||
      normalizeReviewText(opt?.label) === normalizedRaw
  );
  if (foundByIdOrLabel?.text) return foundByIdOrLabel.text;

  const foundByText = options.find(
    (opt) => normalizeReviewText(opt?.text) === normalizedRaw
  );
  if (foundByText?.text) return foundByText.text;

  return raw;
}

function formatReviewAnswerByOptions(value, options = []) {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => getAnswerTextFromOptions(item, options))
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
    return cleaned.length ? cleaned.join(', ') : '(Bo trong)';
  }

  const text = getAnswerTextFromOptions(value, options);
  return String(text ?? '').trim() || '(Bo trong)';
}

function getSummaryOptionToken(option = {}) {
  const id = String(option?.id ?? '').trim();
  if (id) return id;
  const text = String(option?.text ?? '').trim();
  if (text) return text;
  return '';
}

function getSummaryDisplayText(option = {}) {
  const text = String(option?.text ?? '').trim();
  if (text) return text;
  const id = String(option?.id ?? '').trim();
  if (id) return id;
  return String(option?.token ?? '').trim();
}

function getNormalizedSummaryOptions(rawOptions = []) {
  if (!Array.isArray(rawOptions)) return [];
  const seen = new Set();
  return rawOptions
    .map((rawOption) => {
      const id = String(rawOption?.id ?? '').trim();
      const text = String(rawOption?.text ?? '').trim();
      const label = String(rawOption?.label ?? '').trim();
      const token = getSummaryOptionToken({ id, text });
      if (!token) return null;

      const normalizedToken = normalizeReviewText(token);
      if (!normalizedToken || seen.has(normalizedToken)) return null;
      seen.add(normalizedToken);

      return {
        ...rawOption,
        id,
        text,
        label,
        token,
      };
    })
    .filter(Boolean);
}

function findSummaryOptionByAnswer(options = [], answer = '') {
  const normalizedAnswer = normalizeReviewText(answer);
  if (!normalizedAnswer) return null;

  return (
    (options || []).find((option) => {
      const candidates = [option?.token, option?.id, option?.label, option?.text];
      return candidates.some((candidate) => normalizeReviewText(candidate) === normalizedAnswer);
    }) || null
  );
}

function escapeRegexForReview(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isLikelyHttpUrl(value = '') {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function normalizeReferenceToken(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '')
    .trim();
}

function highlightTokenizedHtmlWithReference(rawHtml = '', reference = '') {
  if (!rawHtml || !reference || typeof document === 'undefined') return rawHtml;
  const container = document.createElement('div');
  container.innerHTML = String(rawHtml);

  container.querySelectorAll('.review-reference-highlight').forEach((node) => {
    node.classList.remove('review-reference-highlight');
  });

  const referenceTokens = String(reference || '')
    .split(/\s+/)
    .map(normalizeReferenceToken)
    .filter(Boolean);
  if (!referenceTokens.length) return container.innerHTML;

  const tokenNodes = Array.from(container.querySelectorAll('.token-word'));
  if (!tokenNodes.length) return container.innerHTML;

  const normalizedTokens = tokenNodes.map((node) => normalizeReferenceToken(node.textContent || ''));
  for (let startIndex = 0; startIndex <= normalizedTokens.length - referenceTokens.length; startIndex += 1) {
    let matched = true;
    for (let offset = 0; offset < referenceTokens.length; offset += 1) {
      if (normalizedTokens[startIndex + offset] !== referenceTokens[offset]) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;

    for (let offset = 0; offset < referenceTokens.length; offset += 1) {
      tokenNodes[startIndex + offset].classList.add('review-reference-highlight');
    }
    return container.innerHTML;
  }

  return container.innerHTML;
}

function highlightPlainHtmlWithReference(rawHtml = '', reference = '') {
  const source = String(rawHtml || '');
  const needle = String(reference || '').trim();
  if (!source || !needle) return source;
  const regex = new RegExp(escapeRegexForReview(needle), 'i');
  return source.replace(regex, (matched) => `<mark class="review-reference-highlight">${matched}</mark>`);
}

function applyReferenceHighlightToHtml(rawHtml = '', reference = '') {
  if (!reference) return rawHtml;
  const source = String(rawHtml || '');
  if (source.includes('token-word')) {
    return highlightTokenizedHtmlWithReference(source, reference);
  }
  return highlightPlainHtmlWithReference(source, reference);
}

function isReviewAnswerCorrect(reviewItem) {
  if (!reviewItem) return false;
  if (typeof reviewItem.is_correct === 'boolean') return reviewItem.is_correct;
  const your = reviewItem.your_answer;
  const correct = reviewItem.correct_answer;

  if (Array.isArray(your) || Array.isArray(correct)) {
    const left = (Array.isArray(your) ? your : [your]).map(normalizeReviewText).filter(Boolean).sort();
    const right = (Array.isArray(correct) ? correct : [correct]).map(normalizeReviewText).filter(Boolean).sort();
    if (left.length !== right.length) return false;
    return left.every((item, index) => item === right[index]);
  }

  return normalizeReviewText(your) === normalizeReviewText(correct);
}

function StepContent({
  step,
  slots,
  answers,
  setAnswer,
  passageStates,
  setPassageState,
  showResult,
  listeningAudioUrl,
  onListeningAudioEnded,
  listeningAudioInitialTimeSec = 0,
  onListeningAudioTimeUpdate,
  reviewMode = false,
  reviewLookup = {},
  useMobileReadingDrawer = false,
  isMobileViewport = false,
}) {
  const { item, startSlotIndex, type } = step;
  const isReading = type === 'reading';
  const isListening = type === 'listening';
  const audioUrl = isListening ? (listeningAudioUrl || item.audio_url || null) : item.audio_url;
  const hasAudio = isListening && Boolean(audioUrl);
  const useDropdownForDragDrop = Boolean(isMobileViewport);
  let slotIndex = startSlotIndex;
  const getReviewForQuestion = (qNumber) => reviewLookup?.[String(qNumber)] || null;
  const [expandedReviewQuestions, setExpandedReviewQuestions] = useState({});
  const [activeReviewQuestionNumber, setActiveReviewQuestionNumber] = useState(null);

  // Use persisted HTML if available, otherwise original content
  const contentHtml = (passageStates && passageStates[item._id]) || (item.content || '').replace(/\n/g, '<br />');
  const transcriptHtml = String(item?.transcript || '').replace(/\n/g, '<br />');
  const hasReviewTranscript = reviewMode && isListening && String(item?.transcript || '').trim().length > 0;
  const activeReviewReference = useMemo(() => {
    if (!reviewMode || !(isReading || isListening) || !activeReviewQuestionNumber) return '';
    const activeReviewItem = getReviewForQuestion(activeReviewQuestionNumber);
    return String(activeReviewItem?.passage_reference || activeReviewItem?.passageReference || '').trim();
  }, [reviewMode, isReading, isListening, activeReviewQuestionNumber, reviewLookup]);

  const renderedContentHtml = useMemo(() => {
    if (!reviewMode || !isReading) return contentHtml;
    return applyReferenceHighlightToHtml(contentHtml, activeReviewReference);
  }, [reviewMode, isReading, contentHtml, activeReviewReference]);

  const renderedTranscriptHtml = useMemo(() => {
    if (!hasReviewTranscript) return transcriptHtml;
    return applyReferenceHighlightToHtml(transcriptHtml, activeReviewReference);
  }, [hasReviewTranscript, transcriptHtml, activeReviewReference]);

  useEffect(() => {
    if (!reviewMode) return;
    const questionNumbers = [];
    (item.question_groups || []).forEach((group) => {
      (group.questions || []).forEach((question) => {
        questionNumbers.push(question.q_number);
      });
    });
    const firstWithReference = questionNumbers.find((qNumber) => {
      const reviewItem = getReviewForQuestion(qNumber);
      return String(reviewItem?.passage_reference || reviewItem?.passageReference || '').trim();
    });
    setActiveReviewQuestionNumber(firstWithReference || questionNumbers[0] || null);
    setExpandedReviewQuestions({});
  }, [reviewMode, item?._id, startSlotIndex, reviewLookup]);

  const handleHtmlUpdate = (id, newHtml) => {
    if (reviewMode) return;
    if (setPassageState) {
      setPassageState(prev => ({ ...prev, [id]: newHtml }));
    }
  };

  const questionsBlock = (
    <div className="exam-step-questions">
      {(item.question_groups || []).map((group, groupIdx) => {
        // Check for special group types
        const isMatching =
          group.type === 'matching_headings' ||
          group.type === 'matching_features' ||
          group.type === 'matching_information' ||
          group.type === 'matching_info' ||
          group.type === 'matching';
        const isSummary = group.type === 'summary_completion';
        const isGapLike = group.type === 'gap_fill' || group.type === 'note_completion';
        const isFlowOrPlan = group.type === 'flow_chart_completion' || group.type === 'plan_map_diagram';
        const isDiagramLabel = group.type === 'diagram_label_completion';
        const summaryOptions = isSummary ? getNormalizedSummaryOptions(group.options || []) : [];
        const hasSummaryOptions = summaryOptions.length > 0;
        const shouldStyleMatchingOptionAsUsed = isMatching && shouldUseMatchingOptionOnce(group);
        const groupStartIndex = slotIndex;
        const groupQuestionCount = (group.questions || []).length;
        const matchingPoolOptions = isMatching ? (group.headings || []) : [];
        const shouldRenderMatchingPool = !reviewMode && !useDropdownForDragDrop && matchingPoolOptions.length > 0;
        const shouldRenderSummaryPool = !reviewMode && !useDropdownForDragDrop && isSummary && hasSummaryOptions;
        const selectedTokens = new Set();
        for (let offset = 0; offset < groupQuestionCount; offset += 1) {
          const rawAnswer = String(answers[groupStartIndex + offset] ?? '').trim();
          if (rawAnswer) selectedTokens.add(normalizeReviewText(rawAnswer));
        }

        return (
          <div key={group.type + slotIndex + groupIdx} className={`exam-group ${group.type === 'summary_completion' ? 'summary-completion' : ''}`}>
            {/* Instructions */}
            {group.instructions && (
              (isReading || isListening) ? (
                <div
                  className="exam-instructions"
                  dangerouslySetInnerHTML={toSanitizedInnerHtml(
                    (passageStates && passageStates[`group_inst_${item._id}_${groupIdx}`]) || group.instructions,
                  )}
                />
              ) : (
                <HighlightableContent
                  id={`group_inst_${item._id}_${groupIdx}`}
                  htmlContent={(passageStates && passageStates[`group_inst_${item._id}_${groupIdx}`]) || group.instructions}
                  onUpdateHtml={(html) => handleHtmlUpdate(`group_inst_${item._id}_${groupIdx}`, html)}
                  className="exam-instructions"
                  tagName="div"
                />
              )
            )}

            {shouldRenderMatchingPool ? (
              <div className="matching-options-pool">
                <div className="matching-chips matching-chips-row">
                  {matchingPoolOptions.map((option, optionIndex) => {
                    const optionToken = getMatchingOptionToken(option);
                    if (!optionToken) return null;
                    const normalizedToken = normalizeReviewText(optionToken);
                    const isUsed = shouldStyleMatchingOptionAsUsed && selectedTokens.has(normalizedToken);
                    return (
                      <button
                        key={`matching-pool-${groupIdx}-${optionToken}-${optionIndex}`}
                        type="button"
                        className={`matching-chip ${isUsed ? 'used' : ''}`}
                        draggable={!reviewMode}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('application/x-matching-token', optionToken);
                          event.dataTransfer.setData('text/plain', optionToken);
                          event.dataTransfer.effectAllowed = 'copy';
                          event.currentTarget.classList.add('dragging');
                        }}
                        onDragEnd={(event) => event.currentTarget.classList.remove('dragging')}
                      >
                        <span className="matching-chip-id">{String(option?.id ?? '').trim() || String(option?.label ?? '').trim()}</span>
                        <span className="matching-chip-text">{String(option?.text ?? '').trim() || getMatchingOptionLabel(option)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {shouldRenderSummaryPool ? (
              <div className="matching-options-pool">
                <div className="matching-chips matching-chips-row">
                  {summaryOptions.map((option, optionIndex) => {
                    const optionToken = String(option?.token || '').trim();
                    if (!optionToken) return null;
                    const normalizedToken = normalizeReviewText(optionToken);
                    const isUsed = selectedTokens.has(normalizedToken);
                    return (
                      <button
                        key={`summary-pool-${groupIdx}-${optionToken}-${optionIndex}`}
                        type="button"
                        className={`matching-chip ${isUsed ? 'used' : ''}`}
                        draggable={!reviewMode}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('application/x-summary-token', optionToken);
                          event.dataTransfer.setData('text/plain', optionToken);
                          event.dataTransfer.effectAllowed = 'copy';
                          event.currentTarget.classList.add('dragging');
                        }}
                        onDragEnd={(event) => event.currentTarget.classList.remove('dragging')}
                      >
                        <span className="matching-chip-id">{String(option?.id || '').trim() || String(option?.label || '').trim()}</span>
                        <span className="matching-chip-text">{getSummaryDisplayText(option)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Questions Rendering (Summary Text or Standard List) */}
            {(() => {
              // --- LISTENING MAP GRID RENDERER ---
              if (group.type === 'listening_map') {
                const currentGroupStartIndex = slotIndex;
                slotIndex += group.questions.length;
                return (
                  <ListeningMapGrid
                    group={group}
                    slots={slots}
                    answers={answers}
                    setAnswer={setAnswer}
                    startSlotIndex={currentGroupStartIndex}
                    reviewMode={reviewMode}
                  />
                );
              }

              if (isDiagramLabel) {
                const currentGroupStartIndex = slotIndex;
                slotIndex += group.questions.length;
                const diagramImageUrl = String(group.image_url || '').trim() || (isLikelyHttpUrl(group.text) ? String(group.text || '').trim() : '');

                return (
                  <div className="diagram-label-group">
                    {diagramImageUrl ? (
                      <div className="diagram-label-image-wrapper">
                        <img src={diagramImageUrl} alt="Diagram" className="diagram-label-image" />
                      </div>
                    ) : null}

                    <div className="diagram-label-questions">
                      {(group.questions || []).map((question, questionIndex) => {
                        const currentIndex = currentGroupStartIndex + questionIndex;
                        const slot = slots[currentIndex];
                        if (!slot) return null;
                        const questionLabel = String(question?.text || '').trim();

                        return (
                          <div key={`diagram-row-${currentIndex}`} className="diagram-label-question-row">
                            <label className="diagram-label-question-title">
                              <strong>Q{question.q_number}</strong>
                              {questionLabel ? <span>{` ${questionLabel}`}</span> : null}
                            </label>
                            <QuestionInput
                              slot={slot}
                              value={answers[currentIndex]}
                              onChange={(value) => setAnswer(currentIndex, value)}
                              index={currentIndex}
                              onHighlightUpdate={handleHtmlUpdate}
                              showResult={showResult}
                              passageStates={passageStates}
                              isListening={isListening}
                              reviewMode={reviewMode}
                              useMatchingDropdown={useDropdownForDragDrop}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (isFlowOrPlan) {
                const currentGroupStartIndex = slotIndex;
                slotIndex += group.questions.length;
                const steps = Array.isArray(group.steps) && group.steps.length
                  ? group.steps.map((step) => String(step || ''))
                  : (String(group.text || '').trim() ? [String(group.text || '')] : []);
                const questionIndexByNumber = new Map(
                  (group.questions || []).map((question, index) => [Number(question.q_number), index]),
                );
                const placeholderRegex = /\[\s*[Qq]?(\d+)\s*\]/g;

                const renderStepText = (stepText = '') => parse(
                  String(stepText || '').replace(/\n/g, '<br />'),
                  {
                    replace: (domNode) => {
                      if (domNode.type !== 'text') return undefined;
                      const text = String(domNode.data || '');
                      const parts = text.split(placeholderRegex);
                      if (parts.length === 1) return domNode;

                      return (
                        <>
                          {parts.map((part, index) => {
                            if (!/^\d+$/.test(part)) return <span key={`step-text-${index}`}>{part}</span>;

                            const qNumber = Number(part);
                            const qIndexInGroup = questionIndexByNumber.get(qNumber);
                            if (typeof qIndexInGroup !== 'number') {
                              return <span key={`step-missing-${qNumber}-${index}`}>[Q{qNumber}?]</span>;
                            }

                            const realSlotIndex = currentGroupStartIndex + qIndexInGroup;
                            return (
                              <input
                                key={`step-input-${realSlotIndex}`}
                                id={`q-${realSlotIndex}`}
                                data-question-index={realSlotIndex}
                                type="text"
                                className={`gap-fill-input ${isListening ? 'gap-fill-input-listening' : ''}`}
                                placeholder={`${qNumber}`}
                                value={answers[realSlotIndex] || ''}
                                onChange={(event) => !reviewMode && setAnswer(realSlotIndex, event.target.value)}
                                readOnly={reviewMode}
                                disabled={reviewMode}
                                autoComplete="off"
                              />
                            );
                          })}
                        </>
                      );
                    },
                  },
                );

                if (!steps.length) {
                  return (
                    <div className="summary-missing-warning">
                      <strong>Flow steps are missing.</strong> Please update this group in the Manage interface.
                    </div>
                  );
                }

                return (
                  <div className="flow-steps-group">
                    {steps.map((step, stepIndex) => (
                      <div key={`flow-step-${stepIndex}`} className="flow-step-wrapper">
                        <div className="flow-step-item">
                          <span className="flow-step-number">{stepIndex + 1}.</span>
                          <span className="flow-step-content">{renderStepText(step)}</span>
                        </div>
                        {stepIndex < steps.length - 1 ? (
                          <div className="flow-step-arrow" aria-hidden="true">&darr;</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                );
              }

              // --- SUMMARY & GAP-LIKE TEXT BLOCK RENDERER ---
              if (isSummary || (isGapLike && group.text)) {
                // We advance slotIndex for all questions in this group
                const currentGroupStartIndex = slotIndex;
                slotIndex += group.questions.length;
                const rawGroupText = (passageStates && passageStates[`group_text_${item._id}_${groupIdx}`]) || group.text || '';
                const groupTextHtml = getGroupTextHtml(rawGroupText);
                const getQuestionNumberBySlotIndex = (slotIdx) => {
                  if (!Number.isInteger(slotIdx)) return null;
                  const offset = slotIdx - currentGroupStartIndex;
                  if (offset < 0 || offset >= (group.questions || []).length) return null;
                  const qNumber = group.questions[offset]?.q_number;
                  if (qNumber == null || String(qNumber).trim() === '') return null;
                  return qNumber;
                };
                const serializeGroupTextForPersistence = (rootEl) => {
                  if (!rootEl) return '';
                  const clone = rootEl.cloneNode(true);
                  const runtimeControls = clone.querySelectorAll(
                    'input.gap-fill-input[data-question-index], .summary-dropzone[data-question-index]'
                  );

                  runtimeControls.forEach((node) => {
                    const slotIdx = Number.parseInt(node.getAttribute('data-question-index'), 10);
                    const qNumber = getQuestionNumberBySlotIndex(slotIdx);
                    if (qNumber == null) {
                      node.remove();
                      return;
                    }
                    node.replaceWith(document.createTextNode(`[${qNumber}]`));
                  });

                  return clone.innerHTML;
                };

                // Regex to find [33], [34], [Q33], [ 33 ] etc
                const questionPlaceholderRegex = /\[\s*[Qq]?(\d+)\s*\]/g;

                const parseOptions = {
                  replace: (domNode) => {
                    // Recover React bindings if passageStates captured the previously rendered DOM
                    if (domNode.type === 'tag' && domNode.attribs) {
                      const className = String(domNode.attribs.class || '');
                      const tagName = String(domNode.name || '').toLowerCase();
                      const hasQuestionIndex = Object.prototype.hasOwnProperty.call(domNode.attribs, 'data-question-index');
                      const isGapInput = tagName === 'input' && /\bgap-fill-input\b/.test(className);
                      const isSummaryDropzone = (tagName === 'span' || tagName === 'div') && /\bsummary-dropzone\b/.test(className);
                      if (!hasQuestionIndex || (!isGapInput && !isSummaryDropzone)) return;

                      const realSlotIndex = Number.parseInt(domNode.attribs['data-question-index'], 10);
                      const qNum = getQuestionNumberBySlotIndex(realSlotIndex);
                      if (qNum == null) return null;

                      if (isSummary && hasSummaryOptions) {
                        return (
                          <SummaryDropZone
                            key={realSlotIndex}
                            index={realSlotIndex}
                            questionIndex={realSlotIndex}
                            displayNumber={qNum}
                            value={answers[realSlotIndex]}
                            onChange={(val) => setAnswer(realSlotIndex, val)}
                            options={summaryOptions}
                            reviewMode={reviewMode}
                            useDropdown={useDropdownForDragDrop}
                          />
                        );
                      } else {
                        return (
                          <input
                            key={realSlotIndex}
                            id={`q-${realSlotIndex}`}
                            data-question-index={realSlotIndex}
                            type="text"
                            className={`gap-fill-input ${isListening ? 'gap-fill-input-listening' : ''}`}
                            placeholder={`${qNum}`}
                            value={answers[realSlotIndex] || ''}
                            onChange={(e) => !reviewMode && setAnswer(realSlotIndex, e.target.value)}
                            readOnly={reviewMode}
                            disabled={reviewMode}
                            autoComplete="off"
                          />
                        );
                      }
                    }

                    if (domNode.type === 'text') {
                      const text = domNode.data;
                      // Split by regex
                      const parts = text.split(questionPlaceholderRegex);
                      if (parts.length === 1) return domNode;

                      return (
                        <>
                          {parts.map((part, i) => {
                            // Check if part is a number (it captures the group match)
                            if (/^\d+$/.test(part)) {
                              const qNum = parseInt(part);
                              const qIndexInGroup = group.questions.findIndex(q => q.q_number === qNum);

                              if (qIndexInGroup !== -1) {
                                const realSlotIndex = currentGroupStartIndex + qIndexInGroup;

                                if (isSummary && hasSummaryOptions) {
                                  return (
                                    <SummaryDropZone
                                      key={realSlotIndex}
                                      index={realSlotIndex}
                                      questionIndex={realSlotIndex}
                                      displayNumber={qNum}
                                      value={answers[realSlotIndex]}
                                      onChange={(val) => setAnswer(realSlotIndex, val)}
                                      options={summaryOptions}
                                      reviewMode={reviewMode}
                                      useDropdown={useDropdownForDragDrop}
                                    />
                                  );
                                } else {
                                  return (
                                    <input
                                      key={realSlotIndex}
                                      id={`q-${realSlotIndex}`}
                                      data-question-index={realSlotIndex}
                                      type="text"
                                      className={`gap-fill-input ${isListening ? 'gap-fill-input-listening' : ''}`}
                                      placeholder={`${qNum}`}
                                      value={answers[realSlotIndex] || ''}
                                      onChange={(e) => !reviewMode && setAnswer(realSlotIndex, e.target.value)}
                                      readOnly={reviewMode}
                                      disabled={reviewMode}
                                      autoComplete="off"
                                    />
                                  );
                                }
                              }
                              // Fallback: If number found but no matching question
                              return <span key={i} style={{ color: 'red', fontWeight: 'bold' }}>[Q{qNum}?]</span>;
                            }
                            return <span key={i}>{part}</span>;
                          })}
                        </>
                      );
                    }
                  }
                };

                return (
                  <div className={isListening ? "summary-completion-wrapper" : ""}>
                    <div className="exam-summary-text">
                      {groupTextHtml ? (
                        <HighlightableWrapper
                          onUpdateHtml={(html) => handleHtmlUpdate(`group_text_${item._id}_${groupIdx}`, html)}
                          tagName="div"
                          serializeHtmlForUpdate={serializeGroupTextForPersistence}
                        >
                          {parse(
                            groupTextHtml,
                            parseOptions
                          )}
                        </HighlightableWrapper>
                      ) : (
                        <div className="summary-missing-warning">
                          <strong>{isSummary ? 'Summary' : 'Completion'} text is missing.</strong> Please update this question in the Manage interface.
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // --- MULTI-SELECT GROUP (Choose TWO/THREE...) ---
              // If mult_choice has multiple questions, we treat it as a single block where user picks N answers
              // UNLESS explicitly set to 'radio' layout (independent questions)
              const isForceRadio = group.group_layout === 'radio';
              const isForceCheckbox = group.group_layout === 'checkbox';
              const isAutoMulti = (group.questions || []).length > 1;

              if ((group.type === 'mult_choice' || group.type === 'mult_choice_multi') && (isForceCheckbox || (!isForceRadio && isAutoMulti))) {
                const currentGroupStartIndex = slotIndex;
                slotIndex += group.questions.length; // Advance slot index for all questions in this group

                // if (qIndex > 0) return null; // Only render once for the group - qIndex is not defined here! logic is handled by returning early if this block matches.

                // Use options from the first question (assumed shared)
                // DB Structure seems to be `option` (singular) for the array
                const options = group.questions[0].option || group.questions[0].options || group.options || [];
                const maxSelect = group.questions.length; // Choose N

                if (options.length === 0) {
                  // Fallback to avoid crash if no options found, or maybe render standard loop?
                  // For now, let's keep it safe.
                }

                // Collect current answers for this group
                const currentAnswers = [];
                for (let i = 0; i < maxSelect; i++) {
                  if (answers[currentGroupStartIndex + i]) currentAnswers.push(answers[currentGroupStartIndex + i]);
                }

                const handleMultiChange = (optText, isChecked) => {
                  if (reviewMode) return;
                  let newSelection = [...currentAnswers];
                  if (isChecked) {
                    if (newSelection.length < maxSelect) {
                      newSelection.push(optText);
                    } else {
                      // Optional: Auto-replace the last one or separate warning? 
                      // For now, let's just replace the last one to be user friendly
                      newSelection.pop();
                      newSelection.push(optText);
                    }
                  } else {
                    newSelection = newSelection.filter(a => a !== optText);
                  }

                  // Sort alphabetically for consistency if needed, but primarily just fill slots
                  // newSelection.sort(); 

                  // Update individual slots
                  for (let i = 0; i < maxSelect; i++) {
                    const val = newSelection[i] || ''; // Clear if not selected
                    setAnswer(currentGroupStartIndex + i, val);
                  }
                };

                return (
                  <div className="exam-multi-select-group mb-6">
                    <div className="question-slot-anchor-list" aria-hidden="true">
                      {group.questions.map((_, offset) => {
                        const anchorIndex = currentGroupStartIndex + offset;
                        return (
                          <span
                            key={`anchor-${anchorIndex}`}
                            id={`q-${anchorIndex}`}
                            data-question-index={anchorIndex}
                            tabIndex={-1}
                            className="question-slot-anchor-marker"
                          />
                        );
                      })}
                    </div>
                    <div className="exam-question-label mb-2">
                      <strong>Questions {group.questions[0].q_number}-{group.questions[group.questions.length - 1].q_number}</strong>
                      {group.text && <div className="mt-1 mb-2">{parse(group.text)}</div>}
                      <div className="text-sm text-gray-500 italic">Choose {maxSelect} letters, A-{String.fromCharCode(65 + options.length - 1)}.</div>
                    </div>
                    <div className="exam-options">
                      {options.map((opt) => {
                        const optKey = `opt_${item._id}_${groupIdx}_${opt.label}`;
                        const isChecked = currentAnswers.some(ans =>
                          normalizeReviewText(ans) === normalizeReviewText(opt.text) ||
                          normalizeReviewText(ans) === normalizeReviewText(opt.label) ||
                          normalizeReviewText(ans) === normalizeReviewText(opt.id)
                        );
                        return (
                          <label key={opt.label} className={`exam-option-label ${isChecked ? 'selected-multi' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => !reviewMode && handleMultiChange(opt.text, e.target.checked)}
                              disabled={reviewMode}
                              style={{ width: '1.25rem', height: '1.25rem', marginRight: '1rem' }}
                            />
                            <span className="opt-id font-bold min-w-[1.5rem]">{opt.label}.</span>
                            <HighlightableContent
                              id={optKey}
                              htmlContent={(passageStates && passageStates[optKey]) || opt.text || ''}
                              onUpdateHtml={(newHtml) => handleHtmlUpdate(optKey, newHtml)}
                              tagName="span"
                              className="opt-text"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // --- STANDARD QUESTION LOOP (for non-summary types) ---
              return (group.questions || []).map((q, qIndex) => {
                const slot = slots[slotIndex];
                const currentIndex = slotIndex;
                slotIndex++;

                // --- GAP-LIKE COMPLETION (Unified Logic) ---
                if (isGapLike) {
                  // Case A: Text Block completion (handled above for group.text)
                  if (group.text) {
                    // We advance slotIndex for all questions in this group
                    // NOTE: This logic assumes the [q_number] placeholders match questions in order or ID
                    if (qIndex === 0) { // Only render the text block once for the whole group
                      return null;
                    }
                    return null;
                  }

                  // Case B: Standard line-by-line completion fallback
                  const gapRegex = /_{3,}|\.{3,}/;

                  const parseOptions = {
                    replace: (domNode) => {
                      if (domNode.type === 'text' && gapRegex.test(domNode.data)) {
                        const parts = domNode.data.split(gapRegex);
                        return (
                          <>
                            {parts.map((part, i) => (
                              <span key={i}>
                                {part}
                                {i < parts.length - 1 && (
                                  <span className="inline-input-wrapper">
                                    <QuestionInput
                                      slot={slot}
                                      value={answers[currentIndex]}
                                      onChange={(v) => setAnswer(currentIndex, v)}
                                      index={currentIndex}
                                      onHighlightUpdate={handleHtmlUpdate}
                                      showResult={showResult}
                                      passageStates={passageStates}
                                      isListening={isListening}
                                      reviewMode={reviewMode}
                                      useMatchingDropdown={useDropdownForDragDrop}
                                    />
                                  </span>
                                )}
                              </span>
                            ))}
                          </>
                        );
                      }
                    }
                  };

                  return (
                    <div key={currentIndex} className="exam-question inline-text">
                      <strong>({q.q_number})</strong>
                      <span>{parse(q.text || '', parseOptions)}</span>
                    </div>
                  );
                }

                // --- MATCHING QUESTIONS (horizontal layout) ---
                else if (isMatching) {
                  // Check if this question is embedded in the passage content
                  // We check for EITHER the raw placeholder [n] OR the processed dropzone with data-question-number="n"
                  const isEmbedded = contentHtml && (
                    new RegExp(`\\[\\s*${q.q_number}\\s*\\]`).test(contentHtml) ||
                    new RegExp(`data-question-number=["']?${q.q_number}["']?`).test(contentHtml)
                  );

                  if (isEmbedded && !useMobileReadingDrawer) {
                    return null; // Skip rendering if embedded
                  }

                  const qKey = `qtext_${item._id}_${q.q_number}`;
                  return (
                    <div key={currentIndex} className="matching-question-row">
                      <div className="matching-question-text">
                        <HighlightableContent
                          id={qKey}
                          htmlContent={(passageStates && passageStates[qKey]) || (q.text || '').replace(/\n/g, '<br />')}
                          onUpdateHtml={(html) => handleHtmlUpdate(qKey, html)}
                          tagName="span"
                        />
                      </div>
                      <div className="matching-question-number">{q.q_number}</div>
                      <QuestionInput
                        slot={slot}
                        value={answers[currentIndex]}
                        onChange={(v) =>
                          setMatchingAnswerWithSingleUse({
                            group,
                            groupStartIndex,
                            questionCount: (group.questions || []).length,
                            targetIndex: currentIndex,
                            nextValue: v,
                            answers,
                            setAnswer,
                          })}
                        index={currentIndex}
                        onHighlightUpdate={handleHtmlUpdate}
                        showResult={showResult}
                        passageStates={passageStates}
                        isListening={isListening}
                        reviewMode={reviewMode}
                        useMatchingDropdown={useDropdownForDragDrop}
                      />
                    </div>
                  );
                }

                // --- OTHER QUESTION TYPES ---
                else {
                  const qKey = `qtext_${item._id}_${q.q_number}`;
                  return (
                    <div key={currentIndex} className="exam-question mb-4">
                      <label className="exam-question-label" style={{ display: 'block', marginBottom: '8px' }}>
                        <strong style={{ marginRight: '5px' }}>Q{q.q_number}.</strong>
                        <HighlightableContent
                          id={qKey}
                          htmlContent={(passageStates && passageStates[qKey]) || (q.text || '').replace(/\n/g, '<br />')}
                          onUpdateHtml={(html) => handleHtmlUpdate(qKey, html)}
                          tagName="span"
                          style={{ display: 'inline' }}
                        />
                      </label>
                      <QuestionInput
                        slot={slot}
                        value={answers[currentIndex]}
                        onChange={(v) => setAnswer(currentIndex, v)}
                        index={currentIndex}
                        onHighlightUpdate={handleHtmlUpdate}
                        showResult={showResult}
                        passageStates={passageStates}
                        isListening={isListening}
                        reviewMode={reviewMode}
                        useMatchingDropdown={useDropdownForDragDrop}
                      />
                    </div>
                  );
                }
              });
            })()}

            {reviewMode && (
              <div className="review-group-status-list">
                {(group.questions || []).map((q) => {
                  const reviewItem = getReviewForQuestion(q.q_number);
                  if (!reviewItem) return null;

                  const isAutoMulti = (group.questions || []).length > 1;
                  const isForceRadio = group.group_layout === 'radio';
                  const isForceCheckbox = group.group_layout === 'checkbox';
                  const isMultiSelectGroup = (group.type === 'mult_choice' || group.type === 'mult_choice_multi') && (isForceCheckbox || (!isForceRadio && isAutoMulti));

                  if (!reviewItem) return null;
                  const optionPool = isSummary
                    ? (hasSummaryOptions ? summaryOptions : [])
                    : isMatching
                      ? ((group.headings && group.headings.length) ? group.headings : (group.options || []))
                      : [];
                  const yourAnswer = optionPool.length
                    ? formatReviewAnswerByOptions(reviewItem.your_answer, optionPool)
                    : formatReviewAnswer(reviewItem.your_answer);
                  const correctAnswer = optionPool.length
                    ? formatReviewAnswerByOptions(reviewItem.correct_answer, optionPool)
                    : formatReviewAnswer(reviewItem.correct_answer);
                  const correct = isReviewAnswerCorrect(reviewItem);
                  const explanationText = String(reviewItem.explanation || '').trim() || '\u0043h\u01B0a c\u00F3 gi\u1EA3i th\u00EDch.';
                  const referenceText = String(reviewItem.passage_reference || reviewItem.passageReference || '').trim();
                  const isExpanded = Boolean(expandedReviewQuestions[q.q_number]);
                  const isActiveReference = Number(activeReviewQuestionNumber) === Number(q.q_number);

                  let displayCorrectAnswer = correctAnswer;
                  if (isMultiSelectGroup) {
                    const mappedPool = group.questions.map(gq => {
                      const ri = getReviewForQuestion(gq.q_number);
                      return ri ? ri.correct_answer : null;
                    }).flat().filter(Boolean);

                    const groupCorrectPool = [...new Set(mappedPool)];

                    displayCorrectAnswer = optionPool.length
                      ? formatReviewAnswerByOptions(groupCorrectPool, optionPool)
                      : formatReviewAnswer(groupCorrectPool);
                  }

                  return (
                    <div key={`review-${groupIdx}-${q.q_number}`}>
                      <div
                        className={`review-check-row ${correct ? 'correct' : 'wrong'} ${isActiveReference ? 'active' : ''}`}
                        onClick={() => setActiveReviewQuestionNumber(q.q_number)}
                      >
                        <span className="review-check-number">Q{q.q_number}</span>
                        <span className="review-check-user">{'\u0042\u1EA1n l\u00E0m:'} {yourAnswer}</span>
                        <span className="review-check-correct">{'\u0110\u00E1p \u00E1n:'} {displayCorrectAnswer}</span>
                        <div className="review-check-actions">
                          <span className={`review-check-badge ${correct ? 'correct' : 'wrong'}`}>
                            {correct ? '\u0110\u00FAng' : 'Sai'}
                          </span>
                          <button
                            type="button"
                            className="review-explain-btn review-check-toggle"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedReviewQuestions((prev) => ({
                                ...prev,
                                [q.q_number]: !prev[q.q_number],
                              }));
                              setActiveReviewQuestionNumber(q.q_number);
                            }}
                          >
                            {isExpanded ? '\u1EA8n gi\u1EA3i th\u00EDch' : 'Gi\u1EA3i th\u00EDch'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="review-explanation-box review-check-details">
                          <p className="review-explanation-title">{'Gi\u1EA3i th\u00EDch'}</p>
                          <p className="review-explanation-content">{explanationText}</p>
                          <p className="review-reference-text">
                            <strong>Reference text:</strong>{' '}
                            {referenceText || '\u0043h\u01B0a c\u00F3 \u0111o\u1EA1n tham chi\u1EBFu cho c\u00E2u h\u1ECFi n\u00E0y.'}
                          </p>
                          {referenceText && (
                            <p className="review-reference-hint">
                              {'\u0110o\u1EA1n tham chi\u1EBFu \u0111ang \u0111\u01B0\u1EE3c t\u00F4 v\u00E0ng \u1EDF passage b\u00EAn tr\u00E1i.'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ==========================================================
  // IELTS LISTENING LAYOUT: Centered questions with audio at bottom
  // ==========================================================
  if (isListening) {
    if (reviewMode) {
      if (hasReviewTranscript) {
        return (
          <PanelGroup direction="horizontal" className="ielts-reading-layout">
            <Panel defaultSize={50} minSize={20} className="ielts-passage-panel">
              <div className="passage-scrollable">
                <div
                  className="listening-transcript-content"
                  dangerouslySetInnerHTML={toSanitizedInnerHtml(renderedTranscriptHtml)}
                />
              </div>
            </Panel>

            <PanelResizeHandle className="ielts-resizer">
              <div className="resizer-handle-button" />
            </PanelResizeHandle>

            <Panel defaultSize={50} minSize={20} className="ielts-questions-panel">
              <div className="questions-scrollable">
                {questionsBlock}
              </div>
            </Panel>
          </PanelGroup>
        );
      }

      return (
        <div className="ielts-listening-layout">
          <div className="listening-content-area-top-padded listening-content-area-no-audio">
            <div className="listening-questions-centered">
              {questionsBlock}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="ielts-listening-layout">
        {hasAudio && (
          <div className="ielts-audio-controls top-sticky">
            {/* <div className="audio-label-wrapper">
            <span className="audio-icon">🎧</span>
            <span className="audio-text">IELTS Listening Audio</span>
          </div> */}
            <Suspense fallback={null}>
              <IELTSAudioPlayer
                audioUrl={audioUrl}
                onEnded={onListeningAudioEnded}
                initialTimeSec={listeningAudioInitialTimeSec}
                onTimeUpdate={onListeningAudioTimeUpdate}
              />
            </Suspense>
          </div>
        )}
        <div className={`listening-content-area-top-padded${hasAudio ? '' : ' listening-content-area-no-audio'}`}>
          {item.content && (
            <HighlightableContent
              htmlContent={contentHtml}
              onUpdateHtml={(html) => handleHtmlUpdate(item._id, html)}
              id={item._id}
            />
          )}
          <div className="listening-questions-centered">
            {questionsBlock}
          </div>
        </div>
      </div>
    );
  }

  if (isReading) {
    return (
      <ReadingStepLayout
        item={item}
        contentHtml={renderedContentHtml}
        startSlotIndex={startSlotIndex}
        answers={answers}
        setAnswer={setAnswer}
        passageStates={passageStates}
        showResult={showResult}
        isListening={isListening}
        handleHtmlUpdate={handleHtmlUpdate}
        questionsBlock={questionsBlock}
        reviewMode={reviewMode}
        useMobileReadingDrawer={useMobileReadingDrawer}
      />
    );
  }

  // Fallback for other content types
  return questionsBlock;
}

/** Writing step content with big textarea and real-time word count */

export default StepContent;


