import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import ReviewExamLayout from '../components/review-mode/ReviewExamLayout';
import { buildQuestionSlots, buildSteps, calculateIELTSBand } from './examHelpers';
import './Exam.css';

const formatTimeTaken = (timeTakenMs) => {
  const ms = Number(timeTakenMs);
  if (!Number.isFinite(ms) || ms <= 0) return '--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes} phút ${seconds} giây`;
  return `${seconds} giây`;
};

const formatDateTime = (value) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN');
};

const questionTypeLabel = (type) => (
  type === 'mult_choice' ? 'Multiple Choice (One Answer)'
    : type === 'true_false_notgiven' ? 'True - False - Not Given'
      : type === 'yes_no_notgiven' ? 'Yes - No - Not Given'
        : type === 'gap_fill' || type === 'note_completion' ? 'Note/Gap Completion'
          : type === 'matching_headings' ? 'Matching Headings'
            : type === 'matching_features' ? 'Matching Features'
              : type === 'matching_information' ? 'Matching Information'
                : type === 'summary_completion' ? 'Summary Completion'
                  : 'Other'
);

export default function TestAttemptResult() {
  const { attemptId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questionReview, setQuestionReview] = useState([]);
  const [mode, setMode] = useState('result');
  const [currentStep, setCurrentStep] = useState(0);
  const [passageStates, setPassageState] = useState({});
  const [listeningAudioIndex, setListeningAudioIndex] = useState(0);

  useEffect(() => {
    if (!attemptId) return;
    let mounted = true;
    setLoading(true);
    setError('');

    api.getMyAttemptResult(attemptId)
      .then((response) => {
        if (!mounted) return;
        const payload = response?.data || {};
        setAttempt(payload.attempt || null);
        setExam(payload.exam || null);
        setQuestionReview(Array.isArray(payload.question_review) ? payload.question_review : []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message || 'Không thể tải chi tiết bài làm.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [attemptId]);

  const slots = useMemo(() => (exam ? buildQuestionSlots(exam) : []), [exam]);
  const steps = useMemo(() => (exam ? buildSteps(exam) : []), [exam]);
  const step = steps[currentStep];

  useEffect(() => {
    if (!steps.length) return;
    setCurrentStep((prev) => Math.max(0, Math.min(prev, steps.length - 1)));
  }, [steps]);

  const listeningAudioQueue = useMemo(() => {
    if (!exam || exam.type !== 'listening') return [];
    if (exam.full_audio) return [exam.full_audio];
    return (exam.listening || []).map((section) => section.audio_url).filter(Boolean);
  }, [exam]);

  useEffect(() => {
    if (!listeningAudioQueue.length) {
      setListeningAudioIndex(0);
      return;
    }
    setListeningAudioIndex((prev) => Math.max(0, Math.min(prev, listeningAudioQueue.length - 1)));
  }, [listeningAudioQueue]);

  const handleListeningAudioEnded = useCallback(() => {
    setListeningAudioIndex((prev) => {
      if (prev + 1 < listeningAudioQueue.length) return prev + 1;
      return prev;
    });
  }, [listeningAudioQueue.length]);

  const listeningAudioUrl = listeningAudioQueue[listeningAudioIndex] || null;

  const resultsByType = useMemo(() => {
    const grouped = {};
    questionReview.forEach((item) => {
      const label = questionTypeLabel(item?.type);
      if (!grouped[label]) grouped[label] = { total: 0, correct: 0, wrong: 0, skipped: 0 };
      grouped[label].total += 1;
      if (item?.is_correct) grouped[label].correct += 1;
      else if (!String(item?.your_answer || '').trim()) grouped[label].skipped += 1;
      else grouped[label].wrong += 1;
    });
    return grouped;
  }, [questionReview]);

  if (loading) return <div className="page"><p className="muted">Loading result...</p></div>;
  if (error) return <div className="page"><p className="error">{error}</p><Link to="/profile">Back to profile</Link></div>;
  if (!exam || !attempt) return <div className="page"><p className="muted">Attempt not found.</p></div>;

  if (mode === 'review' && step) {
    return (
      <ReviewExamLayout
        examTitle={exam.title}
        step={step}
        steps={steps}
        slots={slots}
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        questionReview={questionReview}
        passageStates={passageStates}
        setPassageState={setPassageState}
        listeningAudioUrl={listeningAudioUrl}
        onListeningAudioEnded={handleListeningAudioEnded}
        isSingleMode={false}
        onBackToResult={() => setMode('result')}
      />
    );
  }

  const score = Number(attempt.score || 0);
  const total = Number(attempt.total || questionReview.length || 0);
  const skipped = Number(attempt.skipped || 0);
  const wrong = Number.isFinite(Number(attempt.wrong)) ? Number(attempt.wrong) : Math.max(0, total - score - skipped);
  const correctPct = total ? (score / total) * 100 : 0;
  const wrongPct = total ? (wrong / total) * 100 : 0;
  const bandScore = calculateIELTSBand(score, exam.type || 'reading');

  return (
    <div className="page exam-result-new">
      <div className="result-top-grid">
        <div className="result-left-col">
          <div className="result-test-info-card">
            <h1 className="result-test-name">{exam.title}</h1>
            <p style={{ marginTop: '0.5rem', color: '#64748b', fontWeight: 500 }}>
              Nộp bài: {formatDateTime(attempt.submitted_at)}
            </p>
          </div>
          <div className="band-score-card">
            <div className="band-score-label">Band Score:</div>
            <div className="band-score-value">{bandScore}</div>
          </div>
        </div>

        <div className="result-summary-card">
          <div className="result-card-header">
            <h2>Kết quả làm bài</h2>
            <div className="time-taken-small">
              <span>Thời gian làm bài</span>
              <strong>{formatTimeTaken(attempt.time_taken_ms)}</strong>
            </div>
          </div>

          <div className="result-card-content">
            <div className="doughnut-container">
              <div
                className="doughnut-chart"
                style={{
                  '--correct-pct': `${correctPct}%`,
                  '--wrong-pct': `${wrongPct}%`,
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
                <span className="value">{wrong} câu</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-skipped"></span>
                <span className="label">Bỏ qua:</span>
                <span className="value">{skipped} câu</span>
              </div>
            </div>
          </div>

          <div className="result-card-footer">
            {!exam.is_real_test ? (
              <button className="btn-orange-round" onClick={() => setMode('review')}>
                Xem giải thích chi tiết
              </button>
            ) : (
              <div className="real-test-notice" style={{ color: '#6366F1', fontWeight: 'bold', padding: '0.5rem 1rem', background: '#fff5f5', borderRadius: '8px', border: '1px solid #feb2b2' }}>
                Đây là bài thi thật - Bạn không thể xem chi tiết đáp án.
              </div>
            )}
            <Link to="/profile" className="btn-exit-result">Về hồ sơ</Link>
          </div>
        </div>
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
            {Object.entries(resultsByType).map(([label, stats], index) => (
              <tr key={`row-${index}`}>
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
    </div>
  );
}
