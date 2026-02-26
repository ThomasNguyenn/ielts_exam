import React from 'react';

const formatSubmittedDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
};

const formatTimeSpent = (timeTakenMs) => {
  const totalSeconds = Number.isFinite(Number(timeTakenMs))
    ? Math.max(0, Math.floor(Number(timeTakenMs) / 1000))
    : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

const toPercent = (score) => {
  const safeScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  return Math.max(0, Math.min(100, Math.round((safeScore / 9) * 100)));
};

const getCriterionColorClass = (score) => {
  if (score >= 7) return 'writing-fast-bar--good';
  if (score >= 6) return 'writing-fast-bar--mid';
  return 'writing-fast-bar--low';
};

const CRITERIA = [
  { key: 'task_response', label: 'Task Response', icon: 'assignment_turned_in' },
  { key: 'coherence_cohesion', label: 'Coherence & Cohesion', icon: 'link' },
  { key: 'lexical_resource', label: 'Lexical Resource', icon: 'menu_book' },
  { key: 'grammatical_range_accuracy', label: 'Grammatical Range & Accuracy', icon: 'spellcheck' },
];

export default function WritingFastResultView({
  submission,
  fastResult,
  onRequestDetail,
  onBack,
  onRetryFast,
  isDetailLoading = false,
  fastError = '',
}) {
  const overallBand = Number.isFinite(Number(fastResult?.band_score))
    ? Number(fastResult.band_score).toFixed(1)
    : '0.0';
  const criteriaScores = fastResult?.criteria_scores || {};
  const criteriaNotes = fastResult?.criteria_notes || {};
  const summary = fastResult?.summary || fastResult?.feedback?.[0] || 'Fast scoring result is ready.';
  const performanceLabel = fastResult?.performance_label || 'Developing';
  const answer = Array.isArray(submission?.writing_answers) ? submission.writing_answers[0] : null;
  const wordCount = Number(answer?.word_count || 0);

  return (
    <div className="writing-ai-shell writing-ai-shell--fast">
      <div className="writing-ai-container">
        <section className="writing-fast-banner">
          <div className="writing-fast-banner__icon-wrap">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <h2>Assessment Submitted Successfully!</h2>
          <p>
            Your writing task has been received and analyzed by our AI. Below is your preliminary band
            score estimation and feedback.
          </p>
        </section>

        <section className="writing-fast-main-grid">
          <div className="writing-fast-left">
            <article className="writing-fast-score-card">
              <h3>Estimated Band Score</h3>
              <div className="writing-fast-gauge-wrap">
                <div
                  className="writing-fast-gauge"
                  style={{
                    background: `conic-gradient(#1152d4 ${toPercent(overallBand)}%, #e2e8f0 0%)`,
                  }}
                >
                  <div className="writing-fast-gauge__inner">
                    <strong>{overallBand}</strong>
                    <span>Overall</span>
                  </div>
                </div>
              </div>
              <div className="writing-fast-performance-pill">
                <span className="material-symbols-outlined">trending_up</span>
                <span>Performance: {performanceLabel}</span>
              </div>
              <p>Calculated based on IELTS assessment criteria.</p>
            </article>

            <article className="writing-fast-summary">
              <div className="writing-fast-summary__title">
                <span className="material-symbols-outlined">auto_awesome</span>
                <h4>AI Summary</h4>
              </div>
              <p>{summary}</p>
            </article>
          </div>

          <div className="writing-fast-right">
            <article className="writing-fast-breakdown">
              <h3>Criteria Breakdown</h3>
              <div className="writing-fast-breakdown__list">
                {CRITERIA.map((criterion) => {
                  const score = Number(criteriaScores[criterion.key] || 0);
                  const note = String(criteriaNotes[criterion.key] || '').trim();
                  const width = toPercent(score);

                  return (
                    <div key={criterion.key} className="writing-fast-breakdown__item">
                      <div className="writing-fast-breakdown__row">
                        <div className="writing-fast-breakdown__label">
                          <span className="material-symbols-outlined">{criterion.icon}</span>
                          <span>{criterion.label}</span>
                        </div>
                        <strong>{score.toFixed(1)}</strong>
                      </div>
                      <div className="writing-fast-bar-track">
                        <div
                          className={`writing-fast-bar-fill ${getCriterionColorClass(score)}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <p>{note || 'No additional note in fast mode.'}</p>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
        </section>

        <section className="writing-fast-meta-grid">
          <div className="writing-fast-meta-item">
            <div className="writing-fast-meta-item__icon">
              <span className="material-symbols-outlined">calendar_today</span>
            </div>
            <div>
              <p>Submitted On</p>
              <strong>{formatSubmittedDate(submission?.submitted_at)}</strong>
            </div>
          </div>
          <div className="writing-fast-meta-item">
            <div className="writing-fast-meta-item__icon">
              <span className="material-symbols-outlined">timer</span>
            </div>
            <div>
              <p>Time Spent</p>
              <strong>{formatTimeSpent(submission?.time_taken_ms)}</strong>
            </div>
          </div>
          <div className="writing-fast-meta-item">
            <div className="writing-fast-meta-item__icon">
              <span className="material-symbols-outlined">description</span>
            </div>
            <div>
              <p>Word Count</p>
              <strong>{wordCount > 0 ? `${wordCount} words` : '--'}</strong>
            </div>
          </div>
        </section>

        {fastError ? (
          <section className="writing-fast-error">
            <p>{fastError}</p>
            <button type="button" onClick={onRetryFast}>Retry Fast Scoring</button>
          </section>
        ) : null}

        <section className="writing-fast-actions">
          <button type="button" className="writing-fast-btn writing-fast-btn--secondary" onClick={onBack}>
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Tests
          </button>
          <button
            type="button"
            className="writing-fast-btn writing-fast-btn--primary"
            onClick={onRequestDetail}
            disabled={isDetailLoading}
          >
            <span className="material-symbols-outlined">visibility</span>
            {isDetailLoading ? 'Scoring Detailed Feedback...' : 'View Detailed AI Feedback'}
          </button>
        </section>
      </div>
    </div>
  );
}
