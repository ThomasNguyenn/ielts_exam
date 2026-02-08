import { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import parse from 'html-react-parser';
import { api } from '../api/client';
import './Exam.css';
import IELTSAudioPlayer from '../components/IELTSAudioPlayer';
import IELTSSettings from '../components/IELTSSettings';
import VocabHighlighter from '../components/VocabHighlighter';
import HighlightableContent, { HighlightableWrapper, tokenizeHtml } from '../components/HighlightableContent';

/** IELTS Band Score Calculator */
function calculateIELTSBand(correctCount, testType) {
  const bands = {
    listening: [
      { min: 39, band: 9.0 },
      { min: 37, band: 8.5 },
      { min: 35, band: 8.0 },
      { min: 32, band: 7.5 },
      { min: 30, band: 7.0 },
      { min: 26, band: 6.5 },
      { min: 23, band: 6.0 },
      { min: 18, band: 5.5 },
      { min: 16, band: 5.0 },
      { min: 13, band: 4.5 },
      { min: 10, band: 4.0 },
      { min: 8, band: 3.5 },
      { min: 6, band: 3.0 },
      { min: 4, band: 2.5 },
      { min: 2, band: 2.0 },
      { min: 1, band: 1.0 },
      { min: 0, band: 0 },
    ],
    reading: [
      { min: 39, band: 9.0 },
      { min: 37, band: 8.5 },
      { min: 35, band: 8.0 },
      { min: 33, band: 7.5 },
      { min: 30, band: 7.0 },
      { min: 27, band: 6.5 },
      { min: 23, band: 6.0 },
      { min: 19, band: 5.5 },
      { min: 15, band: 5.0 },
      { min: 13, band: 4.5 },
      { min: 10, band: 4.0 },
      { min: 8, band: 3.5 },
      { min: 6, band: 3.0 },
      { min: 4, band: 2.5 },
      { min: 2, band: 2.0 },
      { min: 1, band: 1.0 },
      { min: 0, band: 0 },
    ],
  };

  const typeBands = bands[testType] || bands.reading;
  for (const b of typeBands) {
    if (correctCount >= b.min) {
      return b.band;
    }
  }
  return 0;
}

/** Build flat list of question slots in exam order */
function buildQuestionSlots(exam) {
  const slots = [];
  const pushSlots = (items) => {
    if (!items) return;
    for (const item of items) {
      for (const group of item.question_groups || []) {
        for (const q of group.questions || []) {
          slots.push({
            type: group.type,
            instructions: group.instructions,
            headings: group.headings || [],
            q_number: q.q_number,
            text: q.text,
            option: q.option || [],
          });
        }
      }
    }
  };
  pushSlots(exam.reading);
  pushSlots(exam.listening);
  return slots;
}

/** Build steps: one per passage/section/writing-task with slot range */
function buildSteps(exam) {
  const steps = [];
  let slotIndex = 0;
  const pushStep = (type, label, item) => {
    let start = slotIndex;
    if (type === 'reading' || type === 'listening') {
      for (const group of item.question_groups || []) {
        slotIndex += (group.questions || []).length;
      }
    } else if (type === 'writing') {
      // Writing tasks don't have slot indices
      start = -1;
    }
    steps.push({ type, label, item, startSlotIndex: start, endSlotIndex: slotIndex });
  };
  (exam.reading || []).forEach((p, i) => pushStep('reading', `Passage ${i + 1}`, p));
  (exam.listening || []).forEach((s, i) => pushStep('listening', `Section ${i + 1}`, s));
  (exam.writing || []).forEach((w, i) => pushStep('writing', `Task ${i + 1}`, w));
  return steps;
}

function QuestionInput({ slot, value, onChange, index, onHighlightUpdate, showResult }) {
  const id = `q-${index}`;
  const [strikethroughOptions, setStrikethroughOptions] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem(`strikethrough_${id}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // 1. Định nghĩa logic chung (Binding dữ liệu)
  const common = {
    value: value || '',
    onChange: (e) => onChange(e.target.value),
    disabled: false
  };

  // Handle right-click to toggle strikethrough
  const handleRightClick = (e, optionLabel) => {
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
  if (slot.type === 'mult_choice' || slot.type === 'true_false_notgiven') {
    return (
      <div className="exam-options">
        {(slot.option || []).filter((o) => o.text).map((opt) => {
          // Unique key for this option's highlighted state
          const optKey = `opt_${index}_${opt.label}`;
          // Initial tokenized HTML or persisted state
          const html = (window.__passageStates && window.__passageStates[optKey]) || tokenizeHtml(opt.text);
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
                onChange={() => onChange(opt.text)}
                disabled={isStrikethrough}
              />
              <span className="opt-id">{opt.label}.</span>
              <span className="opt-text">
                <HighlightableWrapper
                  onUpdateHtml={(newHtml) => {
                    if (onHighlightUpdate) {
                      onHighlightUpdate(optKey, newHtml);
                    }
                  }}
                  tagName="span"
                >
                  {parse(html)}
                </HighlightableWrapper>
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  // --- ĐIỀN TỪ (Gap Fill) - Inline numbered box ---
  if (slot.type === 'gap_fill') {
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
  if (slot.type === 'matching_headings' || slot.type === 'matching_features' || slot.type === 'matching_information') {
    const options = slot.headings || [];
    const selectedOption = options.find(h => h.id === value);

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const droppedId = e.dataTransfer.getData('headingId');
      if (droppedId) {
          onChange(droppedId);
          e.currentTarget.classList.remove('drag-over');
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
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
            <span className="matching-chip-text">{selectedOption.text}</span>
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

/** Custom audio player component for listening (no pause/seek controls) */
function ListeningAudioPlayer({ audioUrl }) {
  const audioRef = useState(null)[0];
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audio.autoplay = true;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.play().catch(err => console.error('Audio play failed:', err));

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div className="custom-audio-player">
      <div className="audio-progress-bar">
        <div className="audio-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="audio-time-display">
        <span>{formatTime(currentTime)}</span>
        <span className="audio-status">🔊 Playing...</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

/** Inline Drop Zone for Summary Completion */
function SummaryDropZone({ value, onChange, index, options, displayNumber }) {
  const selectedOption = (options || []).find(o => o.id === value);

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('optionId');
    if (droppedId) onChange(droppedId);
  };

  const handleDragOver = (e) => e.preventDefault();

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
function ListeningMapGrid({ group, slots, answers, setAnswer, startSlotIndex }) {
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
                            onChange={() => setAnswer(currentSlotIndex, answers[currentSlotIndex] === opt.id ? '' : opt.id)}
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



/** One step: passage/section content + its questions (with slot indices) */
function StepContent({ step, slots, answers, setAnswer, passageStates, setPassageState, testId, showResult }) {
  const { item, startSlotIndex, endSlotIndex, type } = step;
  const isReading = type === 'reading';
  const isListening = type === 'listening';
  const hasAudio = isListening && item.audio_url;
  let slotIndex = startSlotIndex;

  // Use persisted HTML if available, otherwise original content
  const contentHtml = (passageStates && passageStates[item._id]) || (item.content || '').replace(/\n/g, '<br />');

  const handleHtmlUpdate = (id, newHtml) => {
    if (setPassageState) {
      setPassageState(prev => ({ ...prev, [id]: newHtml }));
    }
  };

  const questionsBlock = (
    <div className="exam-step-questions">
      {(item.question_groups || []).map((group, groupIdx) => {
        // Check for special group types
        const isMatching = group.type === 'matching_headings' || group.type === 'matching_features' || group.type === 'matching_information';
        const isSummary = group.type === 'summary_completion';

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

              return headings.length > 0 ? (
                <div className="">
                  <div className={`matching-options-pool ${isListening ? 'matching-options-pool-listening' : ''}`}>
                    {/* <div className="matching-options-label">Available Options - Drag to Questions Below:</div> */}
                    <div className={`matching-chips ${group.type === 'matching_headings' ? 'matching-chips-column' : ''}`}>
                      {headings.map((h) => (
                        <div
                          key={h.id}
                          className="matching-chip"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('headingId', h.id);
                            e.currentTarget.classList.add('dragging');
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.classList.remove('dragging');
                          }}
                        >
                          {/* <span className="matching-chip-id">{h.id}</span> */}
                          <span className="matching-chip-text">{h.text}</span>
                        </div>
                      ))}
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
                  />
                );
              }

              // --- SUMMARY & GAP FILL TEXT BLOCK RENDERER ---
              if (isSummary || (group.type === 'gap_fill' && group.text)) {
                // We advance slotIndex for all questions in this group
                const currentGroupStartIndex = slotIndex;
                slotIndex += group.questions.length;

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
                                      onChange={(e) => setAnswer(realSlotIndex, e.target.value)}
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
                                draggable={!isUsed}
                                onDragStart={(e) => {
                                  if (!isUsed) {
                                    e.dataTransfer.setData('optionId', opt.id);
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
                      {group.text ? (
                        <HighlightableWrapper
                          onUpdateHtml={(html) => handleHtmlUpdate(`group_text_${item._id}_${groupIdx}`, html)}
                          tagName="div"
                        >
                          {parse(
                            (passageStates && passageStates[`group_text_${item._id}_${groupIdx}`]) || tokenizeHtml(group.text.replace(/\n/g, '<br />')),
                            parseOptions
                          )}
                        </HighlightableWrapper>
                      ) : (
                        <div className="summary-missing-warning">
                          <strong>{isSummary ? 'Summary' : 'Gap Fill'} text is missing.</strong> Please update this question in the Manage interface.
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // --- STANDARD QUESTION LOOP (for non-summary types) ---
              return (group.questions || []).map((q, qIndex) => {
                const slot = slots[slotIndex];
                const currentIndex = slotIndex;
                slotIndex++;

                // --- GAP FILL (Unified Logic) ---
                if (group.type === 'gap_fill') {
                  // Case A: Text Block Gap Fill (New Style similar to Summary)
                  if (group.text) {
                    // We advance slotIndex for all questions in this group
                    // NOTE: This logic assumes the [q_number] placeholders match questions in order or ID
                    if (qIndex === 0) { // Only render the text block once for the whole group (simulated by checking first question of group logic, but here we are in a map... wait.
                      // The structure of this map is iterating over questions.
                      // For Summary Completion, we used a separate block (if isSummary) outside this map.
                      // We should do the same for Gap Fill if group.text exists.
                      return null; // Don't render per-question items if we are rendering a text block.
                    }
                    return null;
                  }

                  // Case B: Standard Line-by-Line Gap Fill (Old Style)
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
                      />
                    </div>
                  );
                }
              });
            })()}
          </div>
        );
      })}
    </div>
  );

  // ==========================================================
  // IELTS LISTENING LAYOUT: Centered questions with audio at bottom
  // ==========================================================
  if (isListening && hasAudio) {
    return (
      <div className="ielts-listening-layout">
        <div className="ielts-audio-controls top-sticky">
          {/* <div className="audio-label-wrapper">
            <span className="audio-icon">🎧</span>
            <span className="audio-text">IELTS Listening Audio</span>
          </div> */}
          <IELTSAudioPlayer audioUrl={item.audio_url} />
        </div>
        <div className="listening-content-area-top-padded">
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

  // ==========================================================
  // IELTS READING LAYOUT: True split-screen (passage left, questions right)
  // ==========================================================
  // ==========================================================
  // IELTS READING LAYOUT: True split-screen (passage left, questions right)
  // ==========================================================
  if (isReading) {
    // 1. Pre-process HTML to inject placeholders for specific question types (Matching Headings/Info)
    // We look for [n] where n corresponds to a question number in a matching group.
    
    // We need to identify valid question numbers for matching groups first
    const matchingQuestionNumbers = new Set();
    (item.question_groups || []).forEach(g => {
        if (g.type === 'matching_headings' || g.type === 'matching_information') { // Add matching_information
            g.questions.forEach(q => matchingQuestionNumbers.add(String(q.q_number)));
        }
    });

    // Replace [n] with <span class="embedded-dropzone" data-question-number="n"></span>
    // Only if n is in matchingQuestionNumbers
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

    // State to hold the DOM nodes for portals
    const [embeddedNodes, setEmbeddedNodes] = useState([]);
    const passageContainerRef = useRef(null);

    // Effect to find the nodes after render
    useEffect(() => {
        if (passageContainerRef.current) {
            const nodes = passageContainerRef.current.querySelectorAll('.embedded-dropzone');
            setEmbeddedNodes(Array.from(nodes));
        }
    }, [processedContentHtml]); // Re-run if content changes

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
            {/* Render Portals for Embedded Drop Zones */}
            {embeddedNodes.map((node) => {
                const qNum = node.getAttribute('data-question-number');
                
                // Find the group and question for this qNum
                let targetGroup = null;
                let targetQuestion = null;
                let targetSlotIndex = -1;

                // We need to find the absolute slot index for this question
                let runningSlotIndex = startSlotIndex; // Start from current step's start
                
                // Iterate groups in this step to find the matching question and its slot index
                (item.question_groups || []).forEach((g) => {
                    const foundQIndex = g.questions.findIndex(q => String(q.q_number) === qNum);
                    if (foundQIndex !== -1) {
                        targetGroup = g;
                        targetQuestion = g.questions[foundQIndex];
                        targetSlotIndex = runningSlotIndex + foundQIndex;
                    }
                    runningSlotIndex += (g.questions || []).length;
                });

                if (!targetGroup || !targetQuestion || targetSlotIndex === -1) return null;

                const currentValue = answers[targetSlotIndex] || '';
                
                // Find the selected option text/ID
                const selectedHeading = targetGroup.headings?.find(h => h.id === currentValue);

                return ReactDOM.createPortal(
                    <div className="embedded-matching-slot" style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 5px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', marginRight: '4px', color: '#666' }}>{qNum}</span>
                         <QuestionInput
                            slot={{
                                type: 'matching_headings', // Force matching style logic
                                ...targetQuestion, // Contains _id, text, etc.
                                headings: targetGroup.headings, // Pass headings pool
                                correct_answer: targetQuestion.correct_answer // Ensure correct_answer is passed for result mode
                            }}
                            value={currentValue}
                            onChange={(val) => setAnswer(targetSlotIndex, val)}
                            showResult={showResult}
                            index={targetQuestion.q_number - 1} // Optional: might be used for ID generation
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

  // Fallback for other content types
  return questionsBlock;
}

/** Writing step content with big textarea and real-time word count */
function WritingStepContent({ step, writingAnswers, setWritingAnswer }) {
  const { item } = step;
  const taskIndex = parseInt(step.label.replace('Task ', '')) - 1;
  const currentAnswer = writingAnswers[taskIndex] || '';

  const wordCount = currentAnswer.trim() ? currentAnswer.trim().split(/\s+/).length : 0;
  const charCount = currentAnswer.length;

  const hasImage = !!item.image_url;

  return (
    <div className={`writing-step-content ${hasImage ? 'writing-step-content--with-image' : ''}`}>
      <div className="writing-prompt">
        <h3 className="writing-prompt-title">{item.title}</h3>
        <div
          className="writing-prompt-text"
          dangerouslySetInnerHTML={{ __html: (item.prompt || '').replace(/\n/g, '<br />') }}
        />
        {hasImage && (
          <div className="writing-image-container">
            <img
              src={item.image_url}
              alt="Writing task visual"
              className="writing-task-image"
            />
          </div>
        )}
      </div>

      <div className="writing-input-area">
        <label className="writing-input-label">
          Your Answer:
        </label>
        <textarea
          className="writing-textarea"
          value={currentAnswer}
          onChange={(e) => setWritingAnswer(taskIndex, e.target.value)}
          placeholder="Write your answer here..."
          rows={15}
        />
        <div className="writing-stats">
          <span className="word-count">
            <strong>{wordCount}</strong> words
          </span>
          <span className="char-count">
            <strong>{charCount}</strong> characters
          </span>
        </div>
      </div>
    </div>
  );
}

/** Result Review Component - Shows detailed question-by-question review */
function ResultReview({ submitted, exam }) {
  const [expandedItems, setExpandedItems] = useState(new Set());

  const toggleExpand = (index) => {
    setExpandedItems(prev => {
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

  // Helper function to get heading text from correct_answer ID
  const getHeadingText = (q) => {
    if (!q.headings || !q.correct_answer) return q.correct_answer;
    const headingObj = q.headings.find(h => h.id === q.correct_answer);
    return headingObj ? `${q.correct_answer}. ${headingObj.text}` : q.correct_answer;
  };

  const getYourHeadingText = (q) => {
    if (!q.headings || !q.your_answer) return q.your_answer || '(No answer)';
    const headingObj = q.headings.find(h => h.id === q.your_answer);
    return headingObj ? `${q.your_answer}. ${headingObj.text}` : q.your_answer;
  };

  const getSummaryOptionText = (q, answerId) => {
    if (!q.options || !answerId) return answerId || '(No answer)';
    const optionObj = q.options.find(o => o.id === answerId);
    return optionObj ? `${answerId}. ${optionObj.text}` : answerId;
  };

  // Robust comparison for highlighting
  const normalizeForReview = (val) => {
    if (!val) return '';
    const n = val.trim().toLowerCase().replace(/\s+/g, ' ');
    const mapping = { 'not': 'not given', 'ng': 'not given' };
    return mapping[n] || n;
  };

  const getOptionClass = (opt, q) => {
    const normUser = normalizeForReview(q.your_answer);
    const normCorrect = normalizeForReview(q.correct_answer);
    const normOpt = normalizeForReview(opt.text);

    const isYourAnswer = normUser === normOpt;
    const isCorrect = normCorrect === normOpt;

    if (isCorrect) return 'result-option result-option--correct';
    if (isYourAnswer) return 'result-option result-option--wrong';
    return 'result-option';
  };

  const getResultIcon = (isCorrect) => {
    return isCorrect ? (
      <span className="result-icon result-icon--correct">✓</span>
    ) : (
      <span className="result-icon result-icon--wrong">✗</span>
    );
  };

  const getQuestionTypeLabel = (type) => {
    const labels = {
      'mult_choice': 'Multiple Choice',
      'true_false_notgiven': 'True/False/Not Given',
      'yes_no_notgiven': 'Yes/No/Not Given',
      'gap_fill': 'Gap Fill',
      'matching_headings': 'Matching Headings',
      'matching_features': 'Matching Features',
      'matching_information': 'Matching Information',
      'summary_completion': 'Summary Completion',
      'listening_map': 'Map Labeling'
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
                <span className={`result-expand-icon ${isExpanded ? 'expanded' : ''}`}>
                  ▼
                </span>
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
                      {q.options.filter(o => o.text).map((opt, oi) => (
                        <div key={oi} className={getOptionClass(opt, q)}>
                          <span className="option-label">{opt.label}.</span>
                          <span className="option-text">{opt.text}</span>
                          {normalizeForReview(opt.text) === normalizeForReview(q.your_answer) && <span className="your-badge">(Your answer)</span>}
                          {normalizeForReview(opt.text) === normalizeForReview(q.correct_answer) && <span className="correct-badge">(Correct)</span>}
                        </div>
                      ))}
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

export default function Exam() {
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [writingAnswers, setWritingAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [timeWarning, setTimeWarning] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showScoreChoice, setShowScoreChoice] = useState(false);
  const [fontSize, setFontSize] = useState(100); // 100% = default
  const [startTime, setStartTime] = useState(null); // Track when exam actually started (after loading)

  // IELTS Theme & Settings
  const [theme, setTheme] = useState('light');
  const [textSize, setTextSize] = useState('regular');
  const [brightness, setBrightness] = useState(100);

  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  // Determine single mode based on params. 
  // We strictly require 'part' param to be present for Single Mode to avoid "Full Test bug" where mode=single is always present.
  const isSingleMode = searchParams.get('mode') === 'single' && searchParams.get('part') !== null;

  useEffect(() => {
    if (!id) return;
    api
      .getExam(id)
      .then((res) => {
        console.log("Exam Data Received:", res.data); // Debug log
        setExam(res.data);
        const slots = buildQuestionSlots(res.data);
        const steps = buildSteps(res.data);
        console.log("Built Steps:", steps); // Debug log
        setAnswers(Array(slots.length).fill(''));
        // Initialize writing answers array
        const writingCount = (res.data.writing || []).length;
        setWritingAnswers(Array(writingCount).fill(''));

        // Initialize timer based on duration (in minutes)
        const duration = res.data.duration || 60;
        setTimeRemaining(duration * 60); // Convert to seconds

        // Handle deep link to specific part
        const searchParams = new URLSearchParams(location.search);
        const partParam = searchParams.get('part');
        if (partParam !== null) {
          const partIndex = parseInt(partParam, 10);
          if (!isNaN(partIndex)) {
            setCurrentStep(partIndex);
          }
        }
        setStartTime(Date.now());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, location.search]);

  // Timer countdown effect - Optimized to avoid re-creating interval every second
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || submitted) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time's up - auto submit
          handleAutoSubmit();
          clearInterval(timer);
          return 0;
        }
        // Set warning when less than 5 minutes remaining
        // Note: we check the value here to avoid unnecessary state updates
        if (prev <= 301 && !timeWarning) {
          setTimeWarning(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitted, timeWarning, timeRemaining === null]); // Restart if submission status or warning flag changes, or when initialized

  const performSubmit = (returnOnly = false) => {
    if (submitLoading || submitted) return Promise.resolve(null);
    setSubmitLoading(true);
    setShowSubmitConfirm(false);
    setShowScoreChoice(false);
    const now = Date.now();
    const timeTaken = startTime ? now - startTime : (exam.duration || 60) * 60 * 1000;

    // Clear all strikethrough localStorage entries for this exam
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('strikethrough_q-')) {
        localStorage.removeItem(key);
      }
    });

    return api
      .submitExam(id, { answers, writing: writingAnswers, timeTaken, isPractice: isSingleMode })
      .then((res) => {
        let resultData = res.data;

        // If single mode, recalculate score based only on current part
        if (isSingleMode && steps[currentStep]) {
          const step = steps[currentStep];
          const start = step.startSlotIndex;
          const end = step.endSlotIndex;

          const partReview = res.data.question_review.filter((_, idx) => idx >= start && idx < end);

          let partScore = 0;
          let partTotal = 0;

          partReview.forEach((q) => {
            partTotal++;
            if (q.is_correct) partScore++;
          });

          resultData = {
            ...res.data,
            question_review: partReview,
            score: partScore,
            total: partTotal,
            wrong: partTotal - partScore,
            isSingleMode: true
          };
        }

        if (!returnOnly) {
          setSubmitted(resultData);
        }
        return resultData;
      })
      .catch((err) => {
        setError(err.message);
        setSubmitLoading(false);
        throw err;
      })
      .finally(() => setSubmitLoading(false));
  };

  const handleScoreChoice = (mode) => {
    if (mode === 'standard') {
      performSubmit();
    } else {
      // AI Scoring
      performSubmit(true).then((data) => {
        if (data && data.writingSubmissionId) {
          navigate(`/tests/writing/result-ai/${data.writingSubmissionId}`);
        } else {
          // Fallback if ID is missing
          console.error("Missing writingSubmissionId");
          setSubmitted(data);
        }
      });
    }
  };

  const handleAutoSubmit = () => {
    performSubmit();
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (isWriting && isSingleMode && !exam.is_real_test) {
      setShowScoreChoice(true);
    } else {
      setShowSubmitConfirm(true);
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time taken in Vietnamese format
  const formatTimeTaken = (start, end) => {
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);

    if (diffMins > 0) {
      return `${diffMins} phút ${diffSecs} giây`;
    }
    return `${diffSecs} giây`;
  };

  // Calculate time taken for results display
  const getTimeTaken = () => {
    if (!submitted) return '';
    // Use fixed time from submission if available
    if (submitted.timeTaken !== undefined) {
      return formatTimeTaken(0, submitted.timeTaken);
    }
    const now = Date.now();
    return formatTimeTaken(startTime || now, now);
  };

  const slots = exam ? buildQuestionSlots(exam) : [];
  const steps = exam ? buildSteps(exam) : [];
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const isWriting = step && step.type === 'writing';

  const setAnswer = (index, value) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const setWritingAnswer = (taskIndex, value) => {
    setWritingAnswers((prev) => {
      const next = [...prev];
      next[taskIndex] = value;
      return next;
    });
  };


  if (loading) return <div className="page"><p className="muted">Loading exam…</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p><Link to="/tests">Back to tests</Link></div>;
  if (!exam) return <div className="page"><p className="muted">Exam not found.</p></div>;

  if (submitted) {
    const { score, total, wrong, writingCount, isSingleMode } = submitted;
    const wrongCount = wrong ?? (total - score);
    const pct = total ? Math.round((score / total) * 100) : 0;
    const correctPct = total ? (score / total) * 100 : 0;

    // Calculate IELTS Band Score (only for Reading and Listening)
    const examType = exam.type || 'reading';
    const showBandScore = !isSingleMode && examType !== 'writing';
    const bandScore = showBandScore ? calculateIELTSBand(score, examType) : null;

    // Get time taken
    const timeTaken = getTimeTaken();

    // Detailed Stats for Table
    const resultsByType = {};
    const questionReview = (submitted.question_review || []).map(q => {
      // Basic q.type mapping for labeling
      const typeLabel = q.type === 'mult_choice' ? 'Multiple Choice (One Answer)' :
        q.type === 'true_false_notgiven' ? 'True - False - Not Given' :
          q.type === 'yes_no_notgiven' ? 'Yes - No - Not Given' :
            q.type === 'gap_fill' ? 'Gap Fill' :
              q.type === 'matching_headings' ? 'Matching Headings' :
                q.type === 'matching_features' ? 'Matching Features' :
                  q.type === 'matching_information' ? 'Matching Information' :
                    q.type === 'summary_completion' ? 'Summary Completion' : 'Other';

      if (!resultsByType[typeLabel]) {
        resultsByType[typeLabel] = { total: 0, correct: 0, wrong: 0, skipped: 0 };
      }
      resultsByType[typeLabel].total++;
      if (q.is_correct) resultsByType[typeLabel].correct++;
      else if (!q.your_answer) resultsByType[typeLabel].skipped++;
      else resultsByType[typeLabel].wrong++;

      return { ...q, typeLabel };
    });

    const wrongPct = total ? (wrongCount / total) * 100 : 0;

    return (
      <div className="page exam-result-new">
        <div className="result-top-grid">
          <div className="result-left-col">
            <div className="result-test-info-card">
              <h1 className="result-test-name">{exam.title}</h1>
            </div>
            {showBandScore && (
              <div className="band-score-card">
                <div className="band-score-label">Band Score:</div>
                <div className="band-score-value">{bandScore}</div>
              </div>
            )}
            {!showBandScore && writingCount > 0 && (
              <div className="band-score-card" style={{ background: '#4e6a97' }}>
                <div className="band-score-label">Practice Mode</div>
                <div className="band-score-value" style={{ fontSize: '2rem' }}>Writing Tasks</div>
              </div>
            )}
          </div>

          <div className="result-summary-card">
            <div className="result-card-header">
              <h2>Kết quả làm bài</h2>
              <div className="time-taken-small">
                <span>Thời gian làm bài</span>
                <strong>{timeTaken}</strong>
              </div>
            </div>

            <div className="result-card-content">
              <div className="doughnut-container">
                <div
                  className="doughnut-chart"
                  style={{
                    '--correct-pct': `${correctPct}%`,
                    '--wrong-pct': `${wrongPct}%`
                  }}
                >
                  <div className="doughnut-inner">
                    <span className="doughnut-score">{score}/{total}</span>
                    <span className="doughnut-subtext">câu đúng</span>
                  </div>
                </div>
              </div>

              <div className="stats-legend">
                <div className="legend-item">
                  <span className="dot dot-correct"></span>
                  <span className="label">Đúng:</span>
                  <span className="value">{score} câu</span>
                </div>
                <div className="legend-item">
                  <span className="dot dot-wrong"></span>
                  <span className="label">Sai:</span>
                  <span className="value">{wrongCount} câu</span>
                </div>
                <div className="legend-item">
                  <span className="dot dot-skipped"></span>
                  <span className="label">Bỏ qua:</span>
                  <span className="value">{total - score - wrongCount} câu</span>
                </div>
              </div>
            </div>

            <div className="result-card-footer">
              {!exam.is_real_test ? (
                <button className="btn-orange-round" onClick={() => setShowReview(!showReview)}>
                  {showReview ? 'Ẩn giải thích chi tiết' : 'Xem giải thích chi tiết'}
                </button>
              ) : (
                <div className="real-test-notice" style={{ color: '#d03939', fontWeight: 'bold', padding: '0.5rem 1rem', background: '#fff5f5', borderRadius: '8px', border: '1px solid #feb2b2' }}>
                  Đây là bài thi thật - Bạn không thể xem chi tiết đáp án.
                </div>
              )}
              <Link to="/tests" className="btn-exit-result">
                Thoát kết quả
              </Link>
            </div>
          </div>
        </div>

        <div className="feedback-dashed-container">
          {/* Feedback placeholder or note */}
          {!showBandScore && writingCount > 0 && (
            <p style={{ padding: '1rem', margin: 0, textAlign: 'center', color: '#059669', fontWeight: 'bold' }}>
              Your writing tasks have been submitted successfully.
            </p>
          )}
        </div>

        <div className="detailed-stats-section">
          <h3>Bảng dữ liệu chi tiết</h3>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Loại câu hỏi</th>
                <th>Số câu hỏi</th>
                <th className="th-correct">Đúng</th>
                <th>Sai</th>
                <th>Bỏ qua</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(resultsByType).map(([label, stats], idx) => (
                <tr key={idx}>
                  <td>{label}</td>
                  <td>{stats.total}</td>
                  <td className="td-correct">{stats.correct}</td>
                  <td className="td-wrong">{stats.wrong}</td>
                  <td className="td-skipped">{stats.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showReview && (
          <div className="review-container">
            {/* <div className="result-actions" style={{ justifyContent: 'flex-end', marginBottom: '1rem', gap: '1rem', display: 'flex' }}>
              <button className="btn btn-ghost" onClick={() => setShowReview(false)}>Ẩn giải thích</button>
              <Link to="/tests" className="btn btn-ghost">Thoát kết quả</Link>
            </div> */}
            {submitted.question_review && submitted.question_review.length > 0 && (
              <ResultReview submitted={submitted} exam={exam} />
            )}

            {submitted.writing_answers && submitted.writing_answers.length > 0 && (
              <div className="result-review" style={{ marginTop: '2rem' }}>
                <h3 className="result-review-title">Your Writing Answers</h3>
                {submitted.writing_answers.map((answer, index) => (
                  <div key={index} className="writing-review-item" style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#1e293b' }}>
                      Task {index + 1}
                    </h4>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#334155' }}>
                      {answer}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const hasSteps = steps.length > 0;

  if (!hasSteps) {
    return (
      <div className="page">
        <p className="muted">This test has no content.</p>
        <Link to="/tests">Back to tests</Link>
      </div>
    );
  }

  // Determine timer flash class
  const getTimerClass = () => {
    if (timeRemaining === null) return 'exam-timer';
    if (timeRemaining <= 300) return 'exam-timer exam-timer--flash-5'; // 5 min
    if (timeRemaining <= 600) return 'exam-timer exam-timer--flash-10'; // 10 min
    return 'exam-timer';
  };

  return (
    <div
      className={`page exam-page exam-page--stepper text-size-${textSize}`}
      data-theme={theme}
      style={{
        '--exam-font-size': `${fontSize}%`,
        filter: `brightness(${brightness}%)`
      }}
    >
      <header className="exam-header">
        <div className="exam-header-left">
          <h1 className="exam-title">{exam.title}</h1>
          <div className="exam-timer-wrapper">
            {timeRemaining !== null && (
              <div className={getTimerClass()}>
                <span className="exam-timer-icon">⏱</span>
                <span className="exam-timer-text">{formatTime(timeRemaining)} minutes remaining</span>
              </div>
            )}
          </div>
          <Link to={`/tests/${id}`} className="btn-exit-test">
            Exit Test
          </Link>
        </div>

        <div className="exam-header-right">
          <button
            type="button"
            className="btn-finish-test"
            onClick={handleSubmit}
            disabled={submitLoading}
          >
            {submitLoading ? 'Submitting...' : 'Finish Test'}
          </button>

          <IELTSSettings
            brightness={brightness}
            setBrightness={setBrightness}
            textSize={textSize}
            setTextSize={setTextSize}
            theme={theme}
            setTheme={setTheme}
          />
        </div>
      </header>

      {/* Part Title Bar (below header, above split content) */}
      <div className="exam-part-bar">
        <span className="exam-part-label">{step.label}</span>
        <span className="exam-part-title-text">{step.item.title || "Read the text and answer questions"}</span>
      </div >

      <form onSubmit={handleSubmit} className="exam-form" onKeyDown={(e) => {
        // Prevent Enter key from submitting the form unexpectedly
        if (e.key === 'Enter') {
          const target = e.target;
          // Allow Enter in textareas for new lines
          if (target.tagName === 'TEXTAREA') {
            return;
          }
          // Prevent submission for standard inputs or the form itself
          if (target.tagName === 'INPUT' || target === e.currentTarget) {
            e.preventDefault();
          }
        }
      }}>
        {isWriting ? (
          <WritingStepContent
            step={step}
            writingAnswers={writingAnswers}
            setWritingAnswer={setWritingAnswer}
          />
        ) : (
          <StepContent step={step} slots={slots} answers={answers} setAnswer={setAnswer} testId={id} showResult={submitted} />
        )}
      </form>

      {showSubmitConfirm && (
        <div className="note-modal-overlay" onClick={() => setShowSubmitConfirm(false)}>
          <div className="note-modal" onClick={e => e.stopPropagation()}>
            <div className="note-modal-header">
              <h3>Finish Test?</h3>
              <button type="button" onClick={() => setShowSubmitConfirm(false)}>✕</button>
            </div>
            <div style={{ padding: '10px 0', color: '#475569' }}>
              Are you sure you want to finish the test? You won't be able to change your answers after submitting.
            </div>
            <div className="note-modal-actions">
              <button type="button" className="btn-save" onClick={() => performSubmit(false)} disabled={submitLoading}>
                {submitLoading ? 'Submitting...' : 'Yes, Finish'}
              </button>
              <button type="button" className="btn-cancel" onClick={() => setShowSubmitConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showScoreChoice && (
        <div className="note-modal-overlay" onClick={() => setShowScoreChoice(false)}>
          <div className="note-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="note-modal-header">
              <h3>Choose Scoring Method</h3>
              <button type="button" onClick={() => setShowScoreChoice(false)}>✕</button>
            </div>
            <div style={{ padding: '15px 0', color: '#475569', textAlign: 'center' }}>
              <p>How would you like to grade your writing?</p>
            </div>
            <div className="note-modal-actions" style={{ flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleScoreChoice('ai')}
                disabled={submitLoading}
                style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
              >
                {submitLoading ? 'Submitting...' : '✨ AI Detailed Scoring (Instant)'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleScoreChoice('standard')}
                disabled={submitLoading}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Standard Submit (Teacher Grading)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Footer */}
      <footer className="exam-footer">
        <div className="exam-footer-left">
          <span className="footer-part-text">{step.label}</span>
        </div>

        <div className="exam-footer-center">
          {/* Question Palette for CURRENT step only (or all? Screenshot implies specific range for part) */}
          {/* Usually IELTS shows all questions or just current part. Let's show current Part's questions. */}
          <div className="footer-question-nav">
            {slots.map((s, idx) => {
              // Only show questions relevant to current step?
              // Actually standard UI shows ALL questions 1-40 sometimes, but filtered by visible.
              // Let's filter by the range of the current step to avoid clutter if test is huge?
              // Or mapping all is fine. The screenshot shows "Question 1-6" in title, and footer has "1 2 ... 13".
              // If step has startSlotIndex and endSlotIndex, let's render those.
              if (idx < step.startSlotIndex || idx >= step.endSlotIndex) return null;

              const isAnswered = !!answers[idx];
              const qNum = s.q_number;
              return (
                <button
                  key={idx}
                  type="button"
                  className={`footer-q-btn ${isAnswered ? 'answered' : ''}`}
                  onClick={() => {
                    // Scroll to specific question logic is tricky without refs.
                    // For now, simple focus interaction or just visual indicator
                    document.getElementById(`q-${idx}`)?.focus();
                  }}
                >
                  {qNum}
                </button>
              );
            })}
          </div>
        </div>

        <div className="exam-footer-right">
          {/* Part Tabs (Previous/Next Part basically) */}
          {!isSingleMode && hasSteps && (
            <div className="footer-step-nav">
              {steps.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={`footer-step-btn ${i === currentStep ? 'active' : ''}`}
                  onClick={() => setCurrentStep(i)}
                >
                  {s.label.replace('Passage ', 'Part ')}
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
                title="Previous Part"
              >
                ◀
              </button>
              <button
                type="button"
                className="footer-nav-arrow"
                onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                disabled={isLast}
                title="Next Part"
              >
                ▶
              </button>
            </>
          )}
        </div>
      </footer>
    </div >
  );
}