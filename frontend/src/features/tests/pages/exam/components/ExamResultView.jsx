import { Link } from 'react-router-dom';
import ReviewExamLayout from '../../../components/review-mode/ReviewExamLayout';
import { calculateIELTSBand } from '../../examHelpers';
import {
  getTimeTakenLabel,
  normalizeResultStats,
  typeToResultLabel,
} from '../utils/examMappers';

export default function ExamResultView({
  submitted,
  exam,
  mode,
  currentStep,
  setCurrentStep,
  steps,
  slots,
  passageStates,
  setPassageState,
  listeningAudioUrl,
  onListeningAudioEnded,
  isSingleMode,
  strikethroughNamespace,
  onEnterReview,
  onBackToResult,
  startTime,
}) {
  const {
    safeTotal,
    safeScore,
    wrongCount,
    skippedCount,
    safeWritingCount,
    submittedSingleMode,
    correctPct,
    wrongPct,
  } = normalizeResultStats({ submitted });

  const examType = exam.type || 'reading';
  const showBandScore = !submittedSingleMode && examType !== 'writing';
  const bandScore = showBandScore ? calculateIELTSBand(safeScore, examType) : null;
  const timeTaken = getTimeTakenLabel({ submitted, startTime });

  const resultsByType = {};
  const questionReview = (submitted.question_review || []).map((question) => {
    const typeLabel = typeToResultLabel(question.type);

    if (!resultsByType[typeLabel]) {
      resultsByType[typeLabel] = { total: 0, correct: 0, wrong: 0, skipped: 0 };
    }
    resultsByType[typeLabel].total += 1;
    if (question.is_correct) resultsByType[typeLabel].correct += 1;
    else if (!question.your_answer) resultsByType[typeLabel].skipped += 1;
    else resultsByType[typeLabel].wrong += 1;

    return { ...question, typeLabel };
  });

  const step = steps[currentStep];

  if (mode === 'review') {
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
        onListeningAudioEnded={onListeningAudioEnded}
        isSingleMode={isSingleMode}
        strikethroughNamespace={strikethroughNamespace}
        onBackToResult={onBackToResult}
      />
    );
  }

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
          {!showBandScore && safeWritingCount > 0 && (
            <div className="band-score-card" style={{ background: '#4e6a97' }}>
              <div className="band-score-label">Practice Mode</div>
              <div className="band-score-value" style={{ fontSize: '2rem' }}>Writing Tasks</div>
            </div>
          )}
        </div>

        <div className="result-summary-card">
          <div className="result-card-header">
            <h2>K?t qu? làm bài</h2>
            <div className="time-taken-small">
              <span>Th?i gian làm bài</span>
              <strong>{timeTaken}</strong>
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
                  <span className="doughnut-score">{safeScore}/{safeTotal}</span>
                  <span className="doughnut-subtext">câu đúng</span>
                </div>
              </div>
            </div>

            <div className="stats-legend">
              <div className="legend-item">
                <span className="dot dot-correct" />
                <span className="label">Đúng:</span>
                <span className="value">{safeScore} câu</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-wrong" />
                <span className="label">Sai:</span>
                <span className="value">{wrongCount} câu</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-skipped" />
                <span className="label">B? qua:</span>
                <span className="value">{skippedCount} câu</span>
              </div>
            </div>
          </div>

          <div className="result-card-footer">
            {!exam.is_real_test ? (
              <button className="btn-orange-round" onClick={onEnterReview}>
                Xem giải thích chi tiết
              </button>
            ) : (
              <div className="real-test-notice" style={{ color: '#6366F1', fontWeight: 'bold', padding: '0.5rem 1rem', background: '#fff5f5', borderRadius: '8px', border: '1px solid #feb2b2' }}>
                Đây là bài thi thật - Bạn không thể xem chi ti?t đáp án.
              </div>
            )}
            <Link to="/student-ielts/tests" className="btn-exit-result">
              Thoát kết quả
            </Link>
          </div>
        </div>
      </div>

      <div className="feedback-dashed-container">
        {!showBandScore && safeWritingCount > 0 && (
          <p style={{ padding: '1rem', margin: 0, textAlign: 'center', color: '#059669', fontWeight: 'bold' }}>
            Your writing tasks have been submitted successfully.
          </p>
        )}
      </div>

      <div className="detailed-stats-section">
        <h3>B?ng d? li?u chi ti?t</h3>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Lo?i câu h?i</th>
              <th>S? câu h?i</th>
              <th className="th-correct">Đúng</th>
              <th>Sai</th>
              <th>B? qua</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(resultsByType).map(([label, stats]) => (
              <tr key={`result-${label}`}>
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
