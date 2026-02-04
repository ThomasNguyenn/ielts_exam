import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import parse from 'html-react-parser';
import { api } from '../api/client';

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

function QuestionInput({ slot, value, onChange, index }) {
  const id = `q-${index}`;

  // 1. Định nghĩa logic chung (Binding dữ liệu)
  const common = {
    value: value || '',
    onChange: (e) => onChange(e.target.value),
    disabled: false
  };

  // --- TRẮC NGHIỆM (Radio) ---
  if (slot.type === 'mult_choice' || slot.type === 'true_false_notgiven') {
    return (
      <div className="exam-options">
        {(slot.option || []).filter((o) => o.text).map((opt) => (
          <label key={opt.label} className="exam-option-label">
            <input
              type="radio"
              name={id}
              checked={(value || '').trim() === (opt.text || '').trim()}
              onChange={() => onChange(opt.text)}
            />
            <span>{opt.label}. {opt.text}</span>
          </label>
        ))}
      </div>
    );
  }

  // --- ĐIỀN TỪ (Gap Fill) ---
  if (slot.type === 'gap_fill') {
    return (
      <input
        type="text"
        className="exam-input text-center font-bold text-blue-700 border-b-2 border-gray-300 focus:border-blue-500 outline-none px-2"
        placeholder={`(${index + 1})`}
        autoComplete="off"
        {...common}
      />
    );
  }

  // --- NỐI TIÊU ĐỀ (Dropdown) ---
  if (slot.type === 'matching_headings' || slot.type === 'matching_features') {
    const options = slot.headings || [];
    return (
      <select className="exam-select" {...common}>
        <option value="">-- Choose --</option>
        {options.map((h) => (
          <option key={h.id} value={h.id}>{h.id}. {h.text}</option>
        ))}
      </select>
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

/** One step: passage/section content + its questions (with slot indices) */
function StepContent({ step, slots, answers, setAnswer }) {
  const { item, startSlotIndex, endSlotIndex, type } = step;
  const isReading = type === 'reading';
  const isListening = type === 'listening';
  const hasAudio = isListening && item.audio_url;
  let slotIndex = startSlotIndex;

  const questionsBlock = (
    <div className="exam-step-questions">
      {(item.question_groups || []).map((group, groupIdx) => (
        <div key={group.type + slotIndex + groupIdx} className="exam-group">

          {/* SỬA 1: Instruction hiển thị xuống dòng đúng */}
          {group.instructions && (
            <div
              className="exam-instructions"
              style={{ whiteSpace: 'pre-line' }}
            >
              {group.instructions}
            </div>
          )}

          {(group.questions || []).map((q) => {
            const slot = slots[slotIndex];
            const currentIndex = slotIndex;
            slotIndex++; // Tăng index cho câu tiếp theo

            // --- LOGIC GAP FILL MỚI (Dùng html-react-parser) ---
            if (group.type === 'gap_fill') {
              const gapRegex = /_{3,}|\.{3,}/; // Tìm ____ hoặc ....

              // Cấu hình Parser để thay thế "___" bằng Input
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
                              <span className="inline-input-wrapper mx-1" style={{ display: 'inline-block', margin: '0 5px' }}>
                                <QuestionInput
                                  slot={slot}
                                  value={answers[currentIndex]}
                                  onChange={(v) => setAnswer(currentIndex, v)}
                                  index={currentIndex}
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
                <div key={currentIndex} className="exam-question inline-text mb-3" style={{ lineHeight: '2.2' }}>
                  <strong style={{ marginRight: '8px', color: '#666' }}>({q.q_number})</strong>
                  <span>{parse(q.text || '', parseOptions)}</span>
                </div>
              );
            }

            // --- LOGIC CÁC LOẠI CÂU HỎI KHÁC ---
            else {
              return (
                <div key={currentIndex} className="exam-question mb-4">
                  <label className="exam-question-label" style={{ display: 'block', marginBottom: '8px' }}>
                    <strong style={{ marginRight: '5px' }}>Q{q.q_number}.</strong>
                    <span dangerouslySetInnerHTML={{ __html: (q.text || '').replace(/\n/g, '<br />') }} />
                  </label>
                  <QuestionInput
                    slot={slot}
                    value={answers[currentIndex]}
                    onChange={(v) => setAnswer(currentIndex, v)}
                    index={currentIndex}
                  />
                </div>
              );
            }
          })}
        </div>
      ))}
    </div>
  );

  // Listening layout: title at top, questions in middle, audio at bottom
  if (isListening && hasAudio) {
    return (
      <div className="exam-step-layout exam-step-layout--listening">
        <div className="listening-header">
          <div
            className="exam-content-inner"
            dangerouslySetInnerHTML={{ __html: (item.content || '').replace(/\n/g, '<br />') }}
          />
        </div>
        <div className="listening-questions">
          {questionsBlock}
        </div>
        <div className="listening-audio-player">
          <ListeningAudioPlayer audioUrl={item.audio_url} />
        </div>
      </div>
    );
  }

  // Default layout for reading (two columns)
  const contentBlock = (
    <div className="exam-step-content">
      <div
        className="exam-content-inner"
        dangerouslySetInnerHTML={{ __html: (item.content || '').replace(/\n/g, '<br />') }}
      />
    </div>
  );

  return (
    <div className="exam-step-layout exam-step-layout--two-col">
      <div className="exam-step-passage">{contentBlock}</div>
      <div className="exam-step-questions-col">{questionsBlock}</div>
    </div>
  );
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

  // Group questions by type for accordion sections
  const questionsByType = {};
  questionReview.forEach((q, index) => {
    const typeLabel = q.type === 'mult_choice' ? 'Multiple Choice' :
      q.type === 'true_false_notgiven' ? 'True/False/Not Given' :
        q.type === 'gap_fill' ? 'Gap Fill' :
          q.type === 'matching_headings' ? 'Matching Headings' :
            q.type === 'matching_features' ? 'Matching Features' : 'Questions';
    if (!questionsByType[typeLabel]) {
      questionsByType[typeLabel] = [];
    }
    questionsByType[typeLabel].push({ ...q, index });
  });

  const getOptionClass = (opt, q) => {
    const isYourAnswer = (q.your_answer || '').trim().toLowerCase() === (opt.text || '').trim().toLowerCase();
    const isCorrect = (q.correct_answer || '').trim().toLowerCase() === (opt.text || '').trim().toLowerCase();

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

  return (
    <div className="result-review">
      <h3 className="result-review-title">Question Review</h3>

      {Object.entries(questionsByType).map(([typeLabel, questions]) => (
        <div key={typeLabel} className="result-section">
          <h4 className="result-section-title">{typeLabel}</h4>
          <div className="result-accordion">
            {questions.map((q) => {
              const isExpanded = expandedItems.has(q.index);
              return (
                <div key={q.index} className={`result-item ${q.is_correct ? 'result-item--correct' : 'result-item--wrong'}`}>
                  <button
                    className="result-item-header"
                    onClick={() => toggleExpand(q.index)}
                    aria-expanded={isExpanded}
                  >
                    <div className="result-item-info">
                      {getResultIcon(q.is_correct)}
                      <span className="result-question-number">Question {q.question_number}</span>
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

                      {(q.type === 'mult_choice' || q.type === 'true_false_notgiven') && (
                        <div className="result-options">
                          <p className="result-label">Your Answer:</p>
                          {q.options.filter(o => o.text).map((opt, oi) => (
                            <div key={oi} className={getOptionClass(opt, q)}>
                              <span className="option-label">{opt.label}.</span>
                              <span className="option-text">{opt.text}</span>
                              {opt.text === q.your_answer && <span className="your-badge">(Your answer)</span>}
                              {opt.text === q.correct_answer && <span className="correct-badge">(Correct)</span>}
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

                      {(q.type === 'matching_headings' || q.type === 'matching_features') && (
                        <div className="result-matching-answer">
                          <p className="result-label">Your Answer:</p>
                          <p className="answer-text">{q.your_answer || '(No answer)'}</p>
                          <p className="result-label">Correct Answer:</p>
                          <p className="correct-text">{q.correct_answer || '(No correct answer)'}</p>
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
      ))}
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
  const [fontSize, setFontSize] = useState(100); // 100% = default
  const [startTime] = useState(() => Date.now()); // Track when exam started

  useEffect(() => {
    if (!id) return;
    api
      .getExam(id)
      .then((res) => {
        setExam(res.data);
        const slots = buildQuestionSlots(res.data);
        setAnswers(Array(slots.length).fill(''));
        // Initialize writing answers array
        const writingCount = (res.data.writing || []).length;
        setWritingAnswers(Array(writingCount).fill(''));

        // Initialize timer based on duration (in minutes)
        const duration = res.data.duration || 60;
        setTimeRemaining(duration * 60); // Convert to seconds
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Timer countdown effect
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
        if (prev <= 300 && !timeWarning) {
          setTimeWarning(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, submitted, timeWarning]);

  // Auto submit function when time expires
  const handleAutoSubmit = () => {
    if (submitLoading || submitted) return;
    setSubmitLoading(true);
    const timeTaken = Date.now() - startTime;
    api
      .submitExam(id, { answers, writing: writingAnswers, timeTaken })
      .then((res) => setSubmitted(res.data))
      .catch((err) => {
        setError(err.message);
        setSubmitLoading(false);
      });
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
    return formatTimeTaken(startTime, Date.now());
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    const timeTaken = Date.now() - startTime;
    api
      .submitExam(id, { answers, writing: writingAnswers, timeTaken })
      .then((res) => setSubmitted(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setSubmitLoading(false));
  };

  if (loading) return <div className="page"><p className="muted">Loading exam…</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p><Link to="/tests">Back to tests</Link></div>;
  if (!exam) return <div className="page"><p className="muted">Exam not found.</p></div>;

  if (submitted) {
    const { score, total, wrong, writingCount } = submitted;
    const wrongCount = wrong ?? (total - score);
    const pct = total ? Math.round((score / total) * 100) : 0;
    const correctPct = total ? (score / total) * 100 : 0;

    // Calculate IELTS Band Score (only for Reading and Listening)
    const examType = exam.type || 'reading';
    const showBandScore = examType !== 'writing';
    const bandScore = showBandScore ? calculateIELTSBand(score, examType) : null;

    // Get time taken
    const timeTaken = getTimeTaken();

    return (
      <div className="page exam-result">
        <h1 className="result-test-name">{exam.title}</h1>
        <div className="result-card">
          <div className="result-stats">
            <p className="result-stat"><strong>{total}</strong> questions</p>
            <p className="result-stat result-stat--correct"><strong>{score}</strong> correct</p>
            <p className="result-stat result-stat--wrong"><strong>{wrongCount}</strong> wrong</p>
            {writingCount > 0 && (
              <p className="result-stat"><strong>{writingCount}</strong> writing tasks</p>
            )}
          </div>
          <div className="result-donut-wrap">
            <div
              className="result-donut"
              style={{
                background: `conic-gradient(#22c55e 0% ${correctPct}%, #ef4444 ${correctPct}% 100%)`,
              }}
              aria-hidden
            />
            <div className="result-donut-center">
              <span className="result-donut-value">{score}/{total}</span>
              <span className="result-donut-pct">{pct}%</span>
            </div>
          </div>
          <p className="result-score">{score} / {total} ({pct}%)</p>
          {showBandScore && (
            <div className="ielts-band-score">
              <span className="ielts-band-label">IELTS Band Score</span>
              <span className="ielts-band-value">{bandScore}</span>
            </div>
          )}
          <div className="time-taken">
            <span className="time-taken-label">Thời Gian Làm Bài</span>
            <span className="time-taken-value">{timeTaken}</span>
          </div>
          {!showBandScore && (
            <p className="result-note">
              Your writing tasks will be scored by your teacher.
            </p>
          )}
        </div>

        <div className="result-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowReview(!showReview)}
          >
            {showReview ? 'Hide Review' : 'Show Review'}
          </button>
          <Link to="/tests" className="btn btn-ghost">Back to tests</Link>
        </div>

        {showReview && (
          <div className="review-container">
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

  return (
    <div className="page exam-page exam-page--stepper" style={{ '--exam-font-size': `${fontSize}%` }}>
      <header className="exam-header">
        <div className="exam-header-left">
          <h1 className="exam-title">{exam.title}</h1>
          {step && (
            <span className="exam-step-badge">
              {step.type === 'reading' && `Reading — ${step.label} of ${steps.filter((s) => s.type === 'reading').length}`}
              {step.type === 'listening' && `Listening — ${step.label} of ${steps.filter((s) => s.type === 'listening').length}`}
              {step.type === 'writing' && `Writing — ${step.label} of ${steps.filter((s) => s.type === 'writing').length}`}
            </span>
          )}
        </div>
        <div className="exam-header-right">
          {timeRemaining !== null && (
            <div className={`exam-timer ${timeWarning ? 'exam-timer--warning' : ''}`}>
              <span className="exam-timer-icon">⏱</span>
              <span className="exam-timer-text">{formatTime(timeRemaining)}</span>
            </div>
          )}
          <div className="font-size-controls">
            <button
              className="btn btn-ghost btn-sm font-size-btn"
              onClick={() => setFontSize(Math.max(75, fontSize - 25))}
              title="Decrease font size"
              disabled={fontSize <= 75}
            >
              A-
            </button>
            <button
              className="btn btn-ghost btn-sm font-size-btn"
              onClick={() => setFontSize(100)}
              title="Default font size"
            >
              A
            </button>
            <button
              className="btn btn-ghost btn-sm font-size-btn"
              onClick={() => setFontSize(Math.min(200, fontSize + 25))}
              title="Increase font size"
              disabled={fontSize >= 200}
            >
              A+
            </button>
          </div>
          <Link to={`/tests/${id}`} className="btn btn-ghost btn-sm">Leave exam</Link>
        </div>
      </header>

      {hasSteps && (
        <div className="exam-stepper-nav">
          {steps.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`exam-stepper-dot ${i === currentStep ? 'active' : ''} ${s.type === 'writing' ? 'writing-dot' : ''}`}
              onClick={() => setCurrentStep(i)}
              title={`${s.label}`}
              aria-label={`Go to ${s.label}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="exam-step-heading">
        <h2>{step.label}</h2>
        {step.item.title && !isWriting && <span className="exam-step-meta">— {step.item.title}</span>}
        {isWriting && step.item.title && <span className="exam-step-meta">— {step.item.title}</span>}
        <span className="exam-step-meta">
          {step.type === 'reading' && 'Reading'}
          {step.type === 'listening' && 'Listening'}
          {step.type === 'writing' && 'Writing'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="exam-form" onKeyDown={(e) => {
        // Prevent Enter key from submitting the form when typing in textarea
        if (e.key === 'Enter' && e.target.tagName === 'TEXTAREA') {
          e.preventDefault();
          e.target.value += '\n';
        }
      }}>
        {isWriting ? (
          <WritingStepContent
            step={step}
            writingAnswers={writingAnswers}
            setWritingAnswer={setWritingAnswer}
          />
        ) : (
          <StepContent step={step} slots={slots} answers={answers} setAnswer={setAnswer} />
        )}

        <nav className="exam-step-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={isFirst}
          >
            ← Previous
          </button>
          <span className="step-indicator">
            Step {currentStep + 1} of {steps.length}
          </span>
          {isLast ? (
            <button type="submit" className="btn btn-primary" disabled={submitLoading}>
              {submitLoading ? 'Submitting…' : 'Submit answers'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentStep(currentStep + 1);
              }}
            >
              Next →
            </button>
          )}
        </nav>
      </form>
    </div>
  );
}
