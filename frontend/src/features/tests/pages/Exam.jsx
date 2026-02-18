import { lazy, Suspense, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import './Exam.css';
import StepContent from '../components/exam/StepContent';
import WritingStepContent from '../components/exam/WritingStepContent';

const IELTSSettings = lazy(() => import('@/shared/components/IELTSSettings'));
const ResultReview = lazy(() => import('./ExamResultReview'));

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
  const [passageStates, setPassageState] = useState({});
  const [listeningAudioIndex, setListeningAudioIndex] = useState(0);
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
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);
  const autoSubmitTriggeredRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const answersRef = useRef([]);
  const writingAnswersRef = useRef([]);

  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  // Determine single mode based on params. 
  // We strictly require 'part' param to be present for Single Mode to avoid "Full Test bug" where mode=single is always present.
  const isSingleMode = searchParams.get('mode') === 'single' && searchParams.get('part') !== null;

  useEffect(() => {
    // Reset on mount so StrictMode's dev double-invocation does not leave it false.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .getExam(id)
      .then((res) => {
        // console.log("Exam Data Received:", res.data); // Debug log
        setExam(res.data);
        setPassageState({});
        const slots = buildQuestionSlots(res.data);
        const steps = buildSteps(res.data);
        // console.log("Built Steps:", steps); // Debug log
        const initialAnswers = Array(slots.length).fill('');
        setAnswers(initialAnswers);
        answersRef.current = initialAnswers;
        // Initialize writing answers array
        const writingCount = (res.data.writing || []).length;
        const initialWritingAnswers = Array(writingCount).fill('');
        setWritingAnswers(initialWritingAnswers);
        writingAnswersRef.current = initialWritingAnswers;

        // Initialize timer based on duration (in minutes)
        const duration = res.data.duration || 60;
        setTimeRemaining(duration * 60); // Convert to seconds
        setTimeWarning(false);
        autoSubmitTriggeredRef.current = false;
        submitInFlightRef.current = false;

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
    const shouldRun = timeRemaining !== null && timeRemaining > 0 && !submitted;

    if (!shouldRun) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return prev;

        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // Time's up - auto submit once
          if (!autoSubmitTriggeredRef.current) {
            autoSubmitTriggeredRef.current = true;
            handleAutoSubmit();
          }
          return 0;
        }

        // Set warning when less than 5 minutes remaining
        if (prev <= 301) {
          setTimeWarning((current) => (current ? current : true));
        }
        return prev - 1;
      });
    }, 1000);
  }, [submitted, timeRemaining]);

  const performSubmit = (returnOnly = false) => {
    if (submitLoading || submitted || submitInFlightRef.current) return Promise.resolve(null);
    submitInFlightRef.current = true;
    autoSubmitTriggeredRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
      .submitExam(id, {
        answers: answersRef.current,
        writing: writingAnswersRef.current,
        timeTaken,
        isPractice: isSingleMode
      })
      .then((res) => {
        const payload = res?.data ?? res;
        if (!payload || typeof payload !== 'object') {
          throw new Error('Invalid submit response');
        }
        let resultData = payload;

        // If single mode, recalculate score based only on current part
        if (isSingleMode && steps[currentStep] && Array.isArray(payload.question_review)) {
          const step = steps[currentStep];
          const start = step.startSlotIndex;
          const end = step.endSlotIndex;

          const partReview = payload.question_review.filter((_, idx) => idx >= start && idx < end);

          let partScore = 0;
          let partTotal = 0;

          partReview.forEach((q) => {
            partTotal++;
            if (q.is_correct) partScore++;
          });

          resultData = {
            ...payload,
            question_review: partReview,
            score: partScore,
            total: partTotal,
            wrong: partTotal - partScore,
            isSingleMode: true
          };
        }

        if (!returnOnly) {
          if (isMountedRef.current) setSubmitted(resultData);
        }
        return resultData;
      })
      .catch((err) => {
        if (isMountedRef.current) {
          setError(err.message);
        }
        throw err;
      })
      .finally(() => {
        submitInFlightRef.current = false;
        if (isMountedRef.current) {
          setSubmitLoading(false);
        }
      });
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

  const listeningAudioQueue = useMemo(() => {
    if (!exam || exam.type !== 'listening' || isSingleMode) return [];
    if (exam.full_audio) return [exam.full_audio];
    return (exam.listening || [])
      .map((s) => s.audio_url)
      .filter(Boolean);
  }, [exam, isSingleMode]);

  useEffect(() => {
    setListeningAudioIndex(0);
  }, [listeningAudioQueue.join('|')]);

  const handleListeningAudioEnded = useCallback(() => {
    setListeningAudioIndex((prev) => {
      if (prev + 1 < listeningAudioQueue.length) return prev + 1;
      return prev;
    });
  }, [listeningAudioQueue.length]);

  const listeningAudioUrl = listeningAudioQueue[listeningAudioIndex] || null;
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const isWriting = step && step.type === 'writing';

  const setAnswer = (index, value) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      answersRef.current = next;
      return next;
    });
  };

  const setWritingAnswer = (taskIndex, value) => {
    setWritingAnswers((prev) => {
      const next = [...prev];
      next[taskIndex] = value;
      writingAnswersRef.current = next;
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
            q.type === 'gap_fill' || q.type === 'note_completion' ? 'Note/Gap Completion' :
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
                <div className="real-test-notice" style={{ color: '#6366F1', fontWeight: 'bold', padding: '0.5rem 1rem', background: '#fff5f5', borderRadius: '8px', border: '1px solid #feb2b2' }}>
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
              <Suspense fallback={<p className="muted">Loading review...</p>}>
                <ResultReview submitted={submitted} />
              </Suspense>
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

          <Suspense fallback={null}>
            <IELTSSettings
              brightness={brightness}
              setBrightness={setBrightness}
              textSize={textSize}
              setTextSize={setTextSize}
              theme={theme}
              setTheme={setTheme}
            />
          </Suspense>
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
          <StepContent
            step={step}
            slots={slots}
            answers={answers}
            setAnswer={setAnswer}
            showResult={submitted}
            passageStates={passageStates}
            setPassageState={setPassageState}
            listeningAudioUrl={listeningAudioUrl}
            onListeningAudioEnded={handleListeningAudioEnded}
          />
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
