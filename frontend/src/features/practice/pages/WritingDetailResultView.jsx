import React, { useEffect, useMemo, useState } from 'react';
import HighlightedEssay from './HighlightedEssay';

const CRITERIA = [
  { key: 'task_response', label: 'Task Response', progressClass: 'is-green' },
  { key: 'coherence_cohesion', label: 'Coherence & Cohesion', progressClass: 'is-blue' },
  { key: 'lexical_resource', label: 'Lexical Resource', progressClass: 'is-yellow' },
  { key: 'grammatical_range_accuracy', label: 'Grammatical Range', progressClass: 'is-red' },
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

const toCriterionLabel = (criterion) => {
  if (criterion === 'grammatical_range_accuracy') return 'Grammar';
  if (criterion === 'lexical_resource') return 'Vocabulary';
  if (criterion === 'coherence_cohesion') return 'Coherence';
  return 'Task Response';
};

const performanceLabel = (score) => {
  if (score >= 7) return 'Strong Performance';
  if (score >= 6) return 'Good Progress';
  return 'Needs Improvement';
};

const normalizeComparableText = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeCefrLevel = (level) => String(level || '').trim().toUpperCase();

const feedbackIdentity = (item = {}) => {
  const criterion = String(item?.criterion || 'unknown');
  const snippet = normalizeComparableText(item?.text_snippet || item?.original);
  const replacement = normalizeComparableText(
    item?.improved || item?.correction || item?.band65_replacement || item?.band6_replacement,
  );
  const explanation = normalizeComparableText(item?.explanation || item?.comment);
  return `${criterion}::${snippet}::${replacement || explanation}`;
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

const buildVocabularyEnhancers = (analysis = {}) => {
  const lexicalItems = Array.isArray(analysis?.lexical_resource) ? analysis.lexical_resource : [];
  const mapped = lexicalItems
    .map((item) => {
      const source = String(item?.text_snippet || '').trim();
      const sourceLevel = normalizeCefrLevel(item?.source_level);
      const targetLevel = normalizeCefrLevel(item?.target_level);
      const target = String(
        item?.c1_replacement
        || item?.b2_replacement
        || item?.band65_replacement
        || item?.band6_replacement
        || item?.improved
        || '',
      ).trim();

      const isPreferredSource = !sourceLevel || sourceLevel === 'A2' || sourceLevel === 'B1' || sourceLevel === 'UNKNOWN';
      const isPreferredTarget = !targetLevel || targetLevel === 'B2' || targetLevel === 'C1' || targetLevel === 'UNKNOWN';
      if (!source || !target || source.toLowerCase() === target.toLowerCase()) return null;
      if (!isPreferredSource || !isPreferredTarget) return null;
      return {
        source,
        target,
        lexicalUnit: String(item?.lexical_unit || '').trim().toLowerCase(),
      };
    })
    .filter(Boolean);

  const deduped = [];
  const seen = new Set();
  for (const row of mapped) {
    const key = `${row.source.toLowerCase()}__${row.target.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= 6) break;
  }
  return deduped;
};

export default function WritingDetailResultView({
  submission,
  detailResult,
  onBack,
}) {
  const [selectedCriterion, setSelectedCriterion] = useState('all');
  const [selectedFeedbackKey, setSelectedFeedbackKey] = useState(null);

  const analysis = detailResult?.analysis || {};
  const allFeedbackItems = useMemo(() => flattenFeedbackItems(analysis), [analysis]);
  const filteredFeedbackItems = useMemo(() => {
    if (selectedCriterion === 'all') return allFeedbackItems;
    return allFeedbackItems.filter((item) => item.criterion === selectedCriterion);
  }, [allFeedbackItems, selectedCriterion]);

  const selectedFeedback = useMemo(() => {
    if (filteredFeedbackItems.length === 0) return null;
    if (!selectedFeedbackKey) return filteredFeedbackItems[0];
    return filteredFeedbackItems.find((item) => feedbackIdentity(item) === selectedFeedbackKey) || filteredFeedbackItems[0];
  }, [filteredFeedbackItems, selectedFeedbackKey]);

  useEffect(() => {
    if (filteredFeedbackItems.length === 0) {
      setSelectedFeedbackKey(null);
      return;
    }

    const currentStillExists = selectedFeedbackKey
      ? filteredFeedbackItems.some((item) => feedbackIdentity(item) === selectedFeedbackKey)
      : false;
    if (!currentStillExists) {
      setSelectedFeedbackKey(feedbackIdentity(filteredFeedbackItems[0]));
    }
  }, [filteredFeedbackItems, selectedFeedbackKey]);

  const criteriaScores = detailResult?.criteria_scores || {};
  const summaryFeedback = Array.isArray(detailResult?.feedback) ? detailResult.feedback : [];
  const quickSummary = summaryFeedback.join(' ').trim();
  const overallScore = Number(detailResult?.band_score || 0);
  const overallPercent = toPercent(overallScore);
  const wordCount = Number(submission?.writing_answers?.[0]?.word_count || 0);
  const vocabEnhancers = useMemo(() => buildVocabularyEnhancers(analysis), [analysis]);

  const handleHighlightClick = (feedbackItem) => {
    if (!feedbackItem) return;
    const clickedKey = feedbackIdentity(feedbackItem);
    const matchedItem = allFeedbackItems.find((item) => feedbackIdentity(item) === clickedKey);
    setSelectedFeedbackKey(feedbackIdentity(matchedItem || feedbackItem));
  };

  const originalText = String(selectedFeedback?.text_snippet || '').trim();
  const betterAlternativeText = String(
    selectedFeedback?.c1_replacement
    || selectedFeedback?.b2_replacement
    || selectedFeedback?.band65_replacement
    || selectedFeedback?.band6_replacement
    || selectedFeedback?.improved
    || selectedFeedback?.correction
    || '',
  ).trim();
  const showBetterAlternative = normalizeComparableText(originalText) !== normalizeComparableText(betterAlternativeText)
    && betterAlternativeText.length > 0;

  return (
    <div className="writing-ai-shell writing-ai-shell--detail">
      <main className="writing-detail-main">
        <section className="writing-detail-left-panel">
          <header className="writing-detail-left-header">
            <div className="writing-detail-left-header__content">
              <div className="writing-detail-left-header__top">
                <button type="button" className="writing-detail-back-btn" onClick={onBack}>
                  <span className="material-symbols-outlined">arrow_back</span>
                  Back to Tests
                </button>
              </div>
              <div className="writing-detail-left-header__badges">
                <span className="writing-detail-badge writing-detail-badge--task">Writing Task 2</span>
                <span className="writing-detail-badge">{wordCount > 0 ? `${wordCount} Words` : 'Draft'}</span>
              </div>
              <h1>{detailResult?.task_title || submission?.writing_answers?.[0]?.task_title || 'Writing Submission'}</h1>
              <p>
                <span>Topic:</span> {detailResult?.prompt_text || detailResult?.task_prompt || 'N/A'}
              </p>
            </div>
          </header>

          <div className="writing-detail-left-scroll">
            <div className="writing-detail-essay-wrap">
              <div className="writing-detail-prose">
                <HighlightedEssay
                  essay={detailResult?.fullEssay || ''}
                  analysis={analysis}
                  selectedCriterion={selectedCriterion}
                  onHighlightClick={handleHighlightClick}
                />
              </div>
            </div>
          </div>

          <footer className="writing-detail-left-legend">
            <div><span className="writing-dot writing-dot--task" /> Task Response</div>
            <div><span className="writing-dot writing-dot--grammar" /> Grammar</div>
            <div><span className="writing-dot writing-dot--vocab" /> Vocabulary</div>
            <div><span className="writing-dot writing-dot--coherence" /> Coherence</div>
          </footer>
        </section>

        <aside className="writing-detail-right-panel">
          <div className="writing-detail-right-scroll">
            <article className="writing-detail-overall-card">
              <div className="writing-detail-overall-card__row">
                <div>
                  <p>Overall Band Score</p>
                  <h2>{overallScore.toFixed(1)}</h2>
                  <div className="writing-detail-overall-card__pill">
                    {performanceLabel(overallScore)}
                  </div>
                </div>
                <div className="writing-detail-radial-wrap">
                  <div
                    className="writing-detail-radial"
                    style={{ background: `conic-gradient(#135bec ${overallPercent}%, rgba(255,255,255,.25) 0%)` }}
                  >
                    <div>{overallPercent}%</div>
                  </div>
                </div>
              </div>
            </article>

            <article className="writing-detail-side-card">
              <h3>
                <span className="material-symbols-outlined">bar_chart</span>
                Score Breakdown
              </h3>
              <div className="writing-detail-breakdown-list">
                {CRITERIA.map((criterion) => {
                  const score = Number(criteriaScores[criterion.key] || 0);
                  return (
                    <div key={criterion.key} className="writing-detail-breakdown-item">
                      <div className="writing-detail-breakdown-item__head">
                        <button
                          type="button"
                          className={`writing-detail-filter ${selectedCriterion === criterion.key ? 'is-active' : ''}`}
                          onClick={() => setSelectedCriterion(criterion.key)}
                        >
                          {criterion.label}
                        </button>
                        <strong>{score.toFixed(1)}</strong>
                      </div>
                      <div className="writing-detail-breakdown-item__bar">
                        <div className={criterion.progressClass} style={{ width: `${toPercent(score)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <div className="writing-detail-divider" />

            <article className="writing-detail-side-card">
              <h3>
                <span className="material-symbols-outlined">rate_review</span>
                Selected Feedback
              </h3>
              {selectedFeedback ? (
                <div className="writing-detail-feedback-card">
                  <div className="writing-detail-feedback-card__leftbar" />
                  <div className="writing-detail-feedback-card__meta">
                    <span className={`writing-detail-tag ${criterionTypeClass(selectedFeedback.criterion)}`}>
                      {toCriterionLabel(selectedFeedback.criterion)}
                    </span>
                    <span>{selectedFeedback.band_impact || selectedFeedback.type || 'Essay feedback'}</span>
                  </div>
                  <div className="writing-detail-feedback-card__block">
                    <p>Original Text</p>
                    <strong className={showBetterAlternative ? 'is-crossed' : ''}>
                      "{selectedFeedback.text_snippet || 'N/A'}"
                    </strong>
                  </div>
                  {showBetterAlternative ? (
                    <div className="writing-detail-feedback-card__block">
                      <p>Better Alternative</p>
                      <div className="writing-detail-feedback-card__improved">
                        <span className="material-symbols-outlined">check_circle</span>
                        <strong>"{betterAlternativeText}"</strong>
                      </div>
                    </div>
                  ) : null}
                  <div className="writing-detail-feedback-card__why">
                    <span className="material-symbols-outlined">lightbulb</span>
                    <p>
                      <span>Why?</span> {selectedFeedback.explanation || selectedFeedback.comment || quickSummary || 'No explanation available.'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="writing-detail-empty">Select a highlighted segment to see details.</p>
              )}
            </article>

            <div className="writing-detail-divider" />

            <article className="writing-detail-side-card">
              <h3>
                <span className="material-symbols-outlined">auto_awesome</span>
                Vocabulary Enhancer
              </h3>
              {vocabEnhancers.length > 0 ? (
                <div className="writing-detail-vocab-list">
                  {vocabEnhancers.map((row, index) => (
                    <div key={`${row.source}-${index}`} className="writing-detail-vocab-item">
                      <div>
                        <span className="writing-detail-vocab-item__old">{row.source}</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                        <span className="writing-detail-vocab-item__new">{row.target}</span>
                      </div>
                      <span className="material-symbols-outlined">add_circle</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="writing-detail-empty">
                  {quickSummary || 'No vocabulary enhancement available from this submission yet.'}
                </p>
              )}
            </article>
          </div>

          <footer className="writing-detail-right-footer">
            <button type="button">
              <span className="material-symbols-outlined">chat</span>
              Ask AI Assistant
            </button>
          </footer>
        </aside>
      </main>
    </div>
  );
}
