import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import parse from 'html-react-parser';
import HighlightableContent, { HighlightableWrapper, tokenizeHtml } from '@/shared/components/HighlightableContent';

const IELTSAudioPlayer = lazy(() => import('@/shared/components/IELTSAudioPlayer'));

function QuestionInput({
  slot,
  value,
  onChange,
  index,
  onHighlightUpdate,
  showResult,
  passageStates,
  isListening = false,
  reviewMode = false
}) {
  const id = `q-${index}`;
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
    );
  }

  // --- ĐIỀN TỪ (Gap Fill) - Inline numbered box ---
  if (slot.type === 'gap_fill' || slot.type === 'note_completion') {
    return (
      <input
        type="text"
        className={`gap-fill-input ${isListening ? 'gap-fill-input-listening' : ''}`}
        placeholder={`${index + 1}`}
        autoComplete="off"
        {...common}
      />
    );
  }

  // --- MATCHING (Drag and Drop) - Just render drop zone, options pool is at group level ---
  if (
    slot.type === 'matching_headings' ||
    slot.type === 'matching_features' ||
    slot.type === 'matching_information' ||
    slot.type === 'matching_info' ||
    slot.type === 'matching'
  ) {
    const options = slot.headings || [];
    const normalizedValue = normalizeReviewText(value);
    const selectedOption = normalizedValue
      ? options.find((h) => {
          const normalizedId = normalizeReviewText(h?.id);
          const normalizedLabel = normalizeReviewText(h?.label);
          const normalizedText = normalizeReviewText(h?.text);
          return (
            (normalizedId && normalizedId === normalizedValue) ||
            (normalizedLabel && normalizedLabel === normalizedValue) ||
            (normalizedText && normalizedText === normalizedValue)
          );
        })
      : null;

    if (reviewMode) {
      return (
        <div className="matching-dropzone result-mode correct">
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

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const droppedId =
        e.dataTransfer.getData('headingId') ||
        e.dataTransfer.getData('text/plain');
      if (droppedId) {
        onChange(droppedId);
        e.currentTarget.classList.remove('drag-over');
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.classList.remove('drag-over');
    };

    const handleRemove = (e) => {
      e.stopPropagation();
      onChange('');
    };

    // Result display logic
    if (showResult) {
      const clean = (str) => (str || '').toLowerCase().replace(/^[ivx]+\.?\s*/i, '').trim();

      // Find correct answer object - resilient search
      let correctOption = options.find(h => h.id === slot.correct_answer);
      if (!correctOption) {
        // Fallback: try to find by text content
        correctOption = options.find(h => clean(h.text) === clean(slot.correct_answer));
      }

      let isCorrect = value === slot.correct_answer;

      // Loose check: Compare text content if IDs don't match directly
      if (!isCorrect && selectedOption && correctOption) {
        if (clean(selectedOption.text) === clean(correctOption.text)) {
          isCorrect = true;
        }
      }

      return (
        <div className={`matching-dropzone result-mode ${isCorrect ? 'correct' : 'wrong'}`}>
          {selectedOption ? (
            <div className="matching-selected">
              <span className="matching-chip-text">{selectedOption.text}</span>
            </div>
          ) : (
            <div className="matching-placeholder">
              (No answer)
            </div>
          )}
          {!isCorrect && correctOption && (
            <div className="matching-correct-ans">
              <strong>Correct: </strong> {correctOption.text}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className={`matching-dropzone ${selectedOption ? 'has-value' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {selectedOption ? (
          <div className="matching-selected">
            {/* <span className="matching-chip-id">{selectedOption.id}</span> */}
            <span className="matching-chip-text">{selectedOption.id}. {selectedOption.text}</span>
            <button
              type="button"
              className="matching-remove"
              onClick={handleRemove}
              title="Remove selection"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="matching-placeholder">
            Drag here
          </div>
        )}
      </div>
    );
  }

  // Mặc định (Fallback)
  return <input type="text" className="exam-input" placeholder="Your answer" {...common} />;
}

/** Inline Drop Zone for Summary Completion */
function SummaryDropZone({ value, onChange, index, options, displayNumber, reviewMode = false }) {
  const selectedOption = (options || []).find(o => o.id === value);

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedId =
      e.dataTransfer.getData('optionId') ||
      e.dataTransfer.getData('text/plain');
    if (droppedId) onChange(droppedId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  if (reviewMode) {
    return (
      <span className={`summary-dropzone ${selectedOption ? 'has-value' : ''}`}>
        {selectedOption ? (
          <span className="summary-selected-chip">
            <span className="summary-chip-text">{selectedOption.text}</span>
          </span>
        ) : (
          <span style={{ color: '#9ca3af', fontSize: '0.9rem', fontWeight: 'bold' }}>{displayNumber || index + 1}</span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`summary-dropzone ${selectedOption ? 'has-value' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => onChange('')}
      title={selectedOption ? "Click to remove" : "Drop answer here"}
    >
      {selectedOption ? (
        <span className="summary-selected-chip">
          {/* <span className="summary-chip-id">{selectedOption.id}</span> */}
          <span className="summary-chip-text">{selectedOption.text}</span>
        </span>
      ) : (
        <span style={{ color: '#9ca3af', fontSize: '0.9rem', fontWeight: 'bold' }}>{displayNumber || index + 1}</span>
      )}
    </span>
  );
}

/** Component for IELTS Listening Map questions with Image + Matching Grid */
function ListeningMapGrid({ group, slots, answers, setAnswer, startSlotIndex, reviewMode = false }) {
  const options = group.options || []; // e.g. [{id: 'A', text: ''}, ...]
  const questions = group.questions || []; // e.g. [{q_number: 5, text: 'hotel'}, ...]

  return (
    <div className="listening-map-container">
      {group.text && (
        <div className="listening-map-image-wrapper">
          <img src={group.text} alt="IELTS Map" className="listening-map-image" />
        </div>
      )}

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
  reviewMode = false
}) {
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

  useEffect(() => {
    if (passageContainerRef.current) {
      const nodes = passageContainerRef.current.querySelectorAll('.embedded-dropzone');
      setEmbeddedNodes(Array.from(nodes));
    }
  }, [processedContentHtml]);

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
            let runningSlotIndex = startSlotIndex;

            (item.question_groups || []).forEach((g) => {
              const foundQIndex = g.questions.findIndex((q) => String(q.q_number) === qNum);
              if (foundQIndex !== -1) {
                targetGroup = g;
                targetQuestion = g.questions[foundQIndex];
                targetSlotIndex = runningSlotIndex + foundQIndex;
              }
              runningSlotIndex += (g.questions || []).length;
            });

            if (!targetGroup || !targetQuestion || targetSlotIndex === -1) return null;

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
                  onChange={(val) => setAnswer(targetSlotIndex, val)}
                  passageStates={passageStates}
                  showResult={showResult}
                  index={targetQuestion.q_number - 1}
                  isListening={isListening}
                  reviewMode={reviewMode}
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
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
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

function escapeRegexForReview(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  reviewLookup = {}
}) {
  const { item, startSlotIndex, type } = step;
  const isReading = type === 'reading';
  const isListening = type === 'listening';
  const audioUrl = isListening ? (listeningAudioUrl || item.audio_url || null) : item.audio_url;
  const hasAudio = isListening && Boolean(audioUrl);
  let slotIndex = startSlotIndex;
  const getReviewForQuestion = (qNumber) => reviewLookup?.[String(qNumber)] || null;
  const [expandedReviewQuestions, setExpandedReviewQuestions] = useState({});
  const [activeReviewQuestionNumber, setActiveReviewQuestionNumber] = useState(null);

  // Use persisted HTML if available, otherwise original content
  const contentHtml = (passageStates && passageStates[item._id]) || (item.content || '').replace(/\n/g, '<br />');
  const activeReviewReference = useMemo(() => {
    if (!reviewMode || !isReading || !activeReviewQuestionNumber) return '';
    const activeReviewItem = getReviewForQuestion(activeReviewQuestionNumber);
    return String(activeReviewItem?.passage_reference || activeReviewItem?.passageReference || '').trim();
  }, [reviewMode, isReading, activeReviewQuestionNumber, reviewLookup]);

  const renderedContentHtml = useMemo(() => {
    if (!reviewMode || !isReading) return contentHtml;
    return applyReferenceHighlightToHtml(contentHtml, activeReviewReference);
  }, [reviewMode, isReading, contentHtml, activeReviewReference]);

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

        const groupStartIndex = slotIndex;

        return (
          <div key={group.type + slotIndex + groupIdx} className={`exam-group ${group.type === 'summary_completion' ? 'summary-completion' : ''}`}>
            {/* Instructions */}
            {group.instructions && (
              <HighlightableContent
                id={`group_inst_${item._id}_${groupIdx}`}
                htmlContent={(passageStates && passageStates[`group_inst_${item._id}_${groupIdx}`]) || group.instructions}
                onUpdateHtml={(html) => handleHtmlUpdate(`group_inst_${item._id}_${groupIdx}`, html)}
                className="exam-instructions"
                tagName="div"
              />
            )}

            {/* Shared options pool for matching questions */}
            {isMatching && group.questions && group.questions.length > 0 && (() => {
              // Get headings from first question's slot
              const firstSlot = slots[groupStartIndex];
              const headings = firstSlot?.headings || [];

              // Calculate used headings for this group (to hide them from list)
              const usedIds = new Set();
              if (group.type === 'matching_headings') {
                for (let i = 0; i < (group.questions || []).length; i++) {
                  const ans = answers[groupStartIndex + i];
                  if (ans) usedIds.add(ans);
                }
              }

              return headings.length > 0 ? (
                <div className="">
                  <div className={`matching-options-pool ${isListening ? 'matching-options-pool-listening' : ''}`}>
                    {/* <div className="matching-options-label">Available Options - Drag to Questions Below:</div> */}
                    <div className={`matching-chips ${group.type === 'matching_headings' ? 'matching-chips-column' : 'matching-chips-row'}`}>
                      {headings.map((h) => {
                        // Check if heading is used (and group type is matching_headings)
                        if (group.type === 'matching_headings' && usedIds.has(h.id)) return null;

                        return (
                          <div
                            key={h.id}
                            className="matching-chip"
                            draggable={!reviewMode}
                            onDragStart={(e) => {
                              if (reviewMode) return;
                              // Cross-browser support: set text/plain as well
                              e.dataTransfer.setData('headingId', h.id);
                              e.dataTransfer.setData('text/plain', h.id);
                              e.dataTransfer.effectAllowed = 'move';
                              e.currentTarget.classList.add('dragging');
                            }}
                            onDragEnd={(e) => {
                              e.currentTarget.classList.remove('dragging');
                            }}
                          >
                            {(group.type === 'matching_headings' || group.type === 'matching_features') && !reviewMode ? <span className="matching-chip-id">{h.id}</span> : null}
                            {/* {console.log(group.type)} */}
                            <span className="matching-chip-text">{h.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}




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

              // --- SUMMARY & GAP-LIKE TEXT BLOCK RENDERER ---
              if (isSummary || (isGapLike && group.text)) {
                // We advance slotIndex for all questions in this group
                const currentGroupStartIndex = slotIndex;
                slotIndex += group.questions.length;
                const rawGroupText = (passageStates && passageStates[`group_text_${item._id}_${groupIdx}`]) || group.text || '';
                const groupTextHtml = getGroupTextHtml(rawGroupText);

                // Regex to find [33], [34], [Q33], [ 33 ] etc
                const questionPlaceholderRegex = /\[\s*[Qq]?(\d+)\s*\]/g;

                const parseOptions = {
                  replace: (domNode) => {
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

                                if (isSummary) {
                                  return (
                                    <SummaryDropZone
                                      key={realSlotIndex}
                                      index={realSlotIndex}
                                      displayNumber={qNum}
                                      value={answers[realSlotIndex]}
                                      onChange={(val) => setAnswer(realSlotIndex, val)}
                                      options={group.options || []}
                                      reviewMode={reviewMode}
                                    />
                                  );
                                } else {
                                  return (
                                    <input
                                      key={realSlotIndex}
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
                              return <span style={{ color: 'red', fontWeight: 'bold' }}>[Q{qNum}?]</span>;
                            }
                            return part;
                          })}
                        </>
                      );
                    }
                  }
                };

                // NEW: Calculate used options for the pool (within the summary block)
                const usedValues = new Set();
                let tempIdx = currentGroupStartIndex;
                group.questions.forEach(() => {
                  if (answers[tempIdx]) usedValues.add(answers[tempIdx]);
                  tempIdx++;
                });

                return (
                  <div className={isListening ? "summary-completion-wrapper" : ""}>
                    {isSummary && group.options && group.options.length > 0 && (
                      <div className={`matching-options-pool ${isListening ? 'matching-options-pool-listening' : ''}`}>
                        <div className="matching-chips">
                          {group.options.map((opt) => {
                            const isUsed = usedValues.has(opt.id);
                            return (
                              <div
                                key={opt.id}
                                className={`matching-chip ${isUsed ? 'used' : ''}`}
                                draggable={!isUsed && !reviewMode}
                                onDragStart={(e) => {
                                  if (!isUsed && !reviewMode) {
                                    // Cross-browser support: set text/plain as well
                                    e.dataTransfer.setData('optionId', opt.id);
                                    e.dataTransfer.setData('text/plain', opt.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.currentTarget.classList.add('dragging');
                                  }
                                }}
                                onDragEnd={(e) => {
                                  e.currentTarget.classList.remove('dragging');
                                }}
                              >
                                <span className="matching-chip-text">{opt.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="exam-summary-text">
                      {groupTextHtml ? (
                        <HighlightableWrapper
                          onUpdateHtml={(html) => handleHtmlUpdate(`group_text_${item._id}_${groupIdx}`, html)}
                          tagName="div"
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
                    <div className="exam-question-label mb-2">
                      <strong>Questions {group.questions[0].q_number}-{group.questions[group.questions.length - 1].q_number}</strong>
                      {group.text && <div className="mt-1 mb-2">{parse(group.text)}</div>}
                      <div className="text-sm text-gray-500 italic">Choose {maxSelect} letters, A-{String.fromCharCode(65 + options.length - 1)}.</div>
                    </div>
                    <div className="exam-options">
                      {options.map((opt) => {
                        const optKey = `opt_${item._id}_${groupIdx}_${opt.label}`;
                        const isChecked = currentAnswers.includes(opt.text);
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

                  if (isEmbedded) {
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
                        onChange={(v) => setAnswer(currentIndex, v)}
                        index={currentIndex}
                        onHighlightUpdate={handleHtmlUpdate}
                        showResult={showResult}
                        passageStates={passageStates}
                        isListening={isListening}
                        reviewMode={reviewMode}
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
                  const optionPool = isSummary
                    ? ((group.options && group.options.length) ? group.options : (group.headings || []))
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

                  return (
                    <div key={`review-${groupIdx}-${q.q_number}`}>
                      <div
                        className={`review-check-row ${correct ? 'correct' : 'wrong'} ${isActiveReference ? 'active' : ''}`}
                        onClick={() => setActiveReviewQuestionNumber(q.q_number)}
                      >
                        <span className="review-check-number">Q{q.q_number}</span>
                        <span className="review-check-user">{'\u0042\u1EA1n l\u00E0m:'} {yourAnswer}</span>
                        <span className="review-check-correct">{'\u0110\u00E1p \u00E1n:'} {correctAnswer}</span>
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
      />
    );
  }

  // Fallback for other content types
  return questionsBlock;
}

/** Writing step content with big textarea and real-time word count */

export default StepContent;

