import React, { useEffect, useMemo, useState } from 'react';
import HighlightedEssay from './HighlightedEssay';

const CRITERIA = [
  { key: 'task_response', label: 'Task Response' },
  { key: 'coherence_cohesion', label: 'Coherence & Cohesion' },
  { key: 'lexical_resource', label: 'Lexical Resource' },
  { key: 'grammatical_range_accuracy', label: 'Grammatical Range' },
];

const criterionTypeClass = (key) => {
  if (key === 'grammatical_range_accuracy') return 'writing-detail-tag--grammar';
  if (key === 'lexical_resource') return 'writing-detail-tag--vocab';
  if (key === 'coherence_cohesion') return 'writing-detail-tag--coherence';
  return 'writing-detail-tag--task';
};

const toPercent = (score) => {
  const safe = Number.isFinite(Number(score)) ? Number(score) : 0;
  return Math.max(0, Math.min(100, Math.round((safe / 9) * 100)));
};

const flattenFeedbackItems = (analysis = {}) => {
  const items = [];
  for (const criterion of CRITERIA) {
    const section = Array.isArray(analysis?.[criterion.key]) ? analysis[criterion.key] : [];
    for (const item of section) {
      items.push({
        ...item,
        criterion: criterion.key,
        criterionLabel: criterion.label,
      });
    }
  }
  return items;
};

export default function WritingDetailResultView({
  submission,
  detailResult,
  onBack,
}) {
  const [selectedCriterion, setSelectedCriterion] = useState('all');
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  const analysis = detailResult?.analysis || {};
  const allFeedbackItems = useMemo(() => flattenFeedbackItems(analysis), [analysis]);
  const filteredFeedbackItems = useMemo(() => {
    if (selectedCriterion === 'all') return allFeedbackItems;
    return allFeedbackItems.filter((item) => item.criterion === selectedCriterion);
  }, [allFeedbackItems, selectedCriterion]);

  useEffect(() => {
    if (filteredFeedbackItems.length === 0) {
      setSelectedFeedback(null);
      return;
    }

    const currentStillExists = filteredFeedbackItems.some((item) => item === selectedFeedback);
    if (!currentStillExists) {
      setSelectedFeedback(filteredFeedbackItems[0]);
    }
  }, [filteredFeedbackItems, selectedFeedback]);

  const criteriaScores = detailResult?.criteria_scores || {};
  const summaryFeedback = Array.isArray(detailResult?.feedback) ? detailResult.feedback : [];
  const wordCount = Number(submission?.writing_answers?.[0]?.word_count || 0);

  return (
    <div className="writing-ai-shell writing-ai-shell--detail">
      <div className="writing-detail-layout">
        <section className="writing-detail-essay-panel">
          <header className="writing-detail-essay-header">
            <div className="writing-detail-essay-header__badges">
              <span className="writing-detail-badge writing-detail-badge--task">Writing Task</span>
              <span className="writing-detail-badge">{wordCount > 0 ? `${wordCount} Words` : 'Draft'}</span>
            </div>
            <h1>{detailResult?.task_title || submission?.writing_answers?.[0]?.task_title || 'Writing Submission'}</h1>
            <p>
              <strong>Topic:</strong> {detailResult?.prompt_text || detailResult?.task_prompt || 'N/A'}
            </p>
          </header>

          <div className="writing-detail-essay-body">
            <div className="writing-detail-essay-card">
              <HighlightedEssay
                essay={detailResult?.fullEssay || ''}
                analysis={analysis}
                selectedCriterion={selectedCriterion}
                onHighlightClick={setSelectedFeedback}
              />
            </div>
          </div>

          <footer className="writing-detail-legend">
            <div><span className="writing-dot writing-dot--grammar" /> Grammar</div>
            <div><span className="writing-dot writing-dot--vocab" /> Vocabulary</div>
            <div><span className="writing-dot writing-dot--coherence" /> Coherence</div>
          </footer>
        </section>

        <aside className="writing-detail-sidebar">
          <article className="writing-detail-card writing-detail-card--score">
            <p>Overall Band Score</p>
            <h2>{Number(detailResult?.band_score || 0).toFixed(1)}</h2>
            <span>Detailed Evaluation</span>
          </article>

          <article className="writing-detail-card">
            <h3>Score Breakdown</h3>
            <div className="writing-detail-breakdown">
              {CRITERIA.map((criterion) => {
                const score = Number(criteriaScores[criterion.key] || 0);
                return (
                  <div key={criterion.key} className="writing-detail-breakdown__item">
                    <div className="writing-detail-breakdown__head">
                      <button
                        type="button"
                        className={`writing-detail-filter ${selectedCriterion === criterion.key ? 'is-active' : ''}`}
                        onClick={() => setSelectedCriterion(criterion.key)}
                      >
                        {criterion.label}
                      </button>
                      <strong>{score.toFixed(1)}</strong>
                    </div>
                    <div className="writing-detail-progress">
                      <div style={{ width: `${toPercent(score)}%` }} />
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className={`writing-detail-filter writing-detail-filter--all ${selectedCriterion === 'all' ? 'is-active' : ''}`}
                onClick={() => setSelectedCriterion('all')}
              >
                Show All Feedback
              </button>
            </div>
          </article>

          <article className="writing-detail-card">
            <h3>Selected Feedback</h3>
            {selectedFeedback ? (
              <div className="writing-detail-feedback-card">
                <div className="writing-detail-feedback-card__meta">
                  <span className={`writing-detail-tag ${criterionTypeClass(selectedFeedback.criterion)}`}>
                    {selectedFeedback.criterionLabel}
                  </span>
                  <span>{selectedFeedback.type || 'feedback'}</span>
                </div>
                <div className="writing-detail-feedback-card__block">
                  <p>Original Text</p>
                  <strong>{selectedFeedback.text_snippet || 'N/A'}</strong>
                </div>
                <div className="writing-detail-feedback-card__block">
                  <p>Better Alternative</p>
                  <strong>{selectedFeedback.improved || selectedFeedback.correction || 'No suggestion'}</strong>
                </div>
                <div className="writing-detail-feedback-card__explain">
                  {selectedFeedback.explanation || selectedFeedback.comment || 'No explanation available.'}
                </div>
              </div>
            ) : (
              <p className="writing-detail-empty">Select a highlighted segment to see details.</p>
            )}
          </article>

          <article className="writing-detail-card">
            <h3>General Feedback</h3>
            {summaryFeedback.length > 0 ? (
              <ul className="writing-detail-summary-list">
                {summaryFeedback.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="writing-detail-empty">No general feedback available.</p>
            )}
          </article>

          <div className="writing-detail-actions">
            <button type="button" onClick={onBack}>Back to Dashboard</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
