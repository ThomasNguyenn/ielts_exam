import React from 'react';
import './SpeakingResultPhase.css';

const parseAnalysisPayload = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
};

const hasAnalysisPayload = (value) => (
  Boolean(value) && typeof value === 'object' && Object.keys(value).length > 0
);

const toScoreNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampPercent = (value) => Math.min(100, Math.max(0, Math.round((Number(value) / 9) * 100)));

const formatBandDelta = (value) => {
  if (!Number.isFinite(value)) return null;
  if (value === 0) return '0.0';
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
};

const formatReportTimestamp = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeHeatStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['excellent', 'needs_work', 'error', 'neutral'].includes(normalized)) return normalized;
  return 'neutral';
};

const buildFallbackHeatmap = (transcript = '') => (
  String(transcript || '')
    .match(/[A-Za-z0-9']+/g)
    ?.slice(0, 160)
    .map((word) => ({ word, status: 'neutral', note: '' })) || []
);

const normalizePriority = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['high', 'medium', 'low'].includes(normalized)) return normalized;
  return 'medium';
};

const buildDefaultFocusAreas = (pronunciationFeedback = '') => {
  const feedback = String(pronunciationFeedback || '').trim();
  if (!feedback) {
    return [{
      title: 'Pronunciation Focus',
      priority: 'medium',
      description: 'Review stress, ending sounds, and rhythm before retrying this topic.',
    }];
  }

  return [{
    title: 'Pronunciation Focus',
    priority: 'high',
    description: feedback,
  }];
};

const CircularBand = ({ score }) => {
  const safeScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  const radius = 52;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.max(0, Math.min(9, safeScore));
  const dash = (progress / 9) * circumference;

  return (
    <div className="speaking-report-band-circle-wrap">
      <svg className="speaking-report-band-circle" viewBox="0 0 120 120" role="img" aria-label={`Band ${safeScore.toFixed(1)}`}>
        <circle className="speaking-report-band-circle__bg" cx="60" cy="60" r={radius} />
        <circle
          className="speaking-report-band-circle__progress"
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="speaking-report-band-circle__value">{safeScore.toFixed(1)}</div>
    </div>
  );
};

const criteriaConfig = {
  fluency_coherence: {
    label: 'Fluency',
    color: 'blue',
    feedbackFallback: 'No fluency feedback.',
  },
  lexical_resource: {
    label: 'Lexical Resource',
    color: 'purple',
    feedbackFallback: 'No lexical feedback.',
  },
  grammatical_range: {
    label: 'Grammar',
    color: 'orange',
    feedbackFallback: 'No grammar feedback.',
  },
  pronunciation: {
    label: 'Pronunciation',
    color: 'teal',
    feedbackFallback: 'No pronunciation feedback.',
  },
};

export default function SpeakingResultPhase({ result, topic, onRetry }) {
  if (!result) return null;

  const transcript = String(result?.transcript || '').trim();
  const scoringState = String(result?.scoring_state || '').trim().toLowerCase();
  const topicPart = Number(topic?.part);
  const normalizedPart = [1, 2, 3].includes(topicPart) ? topicPart : null;

  const finalAnalysis = parseAnalysisPayload(result?.analysis);
  const provisionalAnalysis = parseAnalysisPayload(result?.provisional_analysis);

  const hasFinal = hasAnalysisPayload(finalAnalysis);
  const hasProvisional = hasAnalysisPayload(provisionalAnalysis);
  const usingProvisional = !hasFinal && hasProvisional;
  const activeAnalysis = usingProvisional ? provisionalAnalysis : finalAnalysis;
  const isCompleted = scoringState === 'completed' || hasFinal;

  const finalBand = toScoreNumber(finalAnalysis?.band_score);
  const provisionalBand = toScoreNumber(provisionalAnalysis?.band_score);
  const bandDelta = (
    Number.isFinite(finalBand) && Number.isFinite(provisionalBand)
      ? finalBand - provisionalBand
      : null
  );

  const safeAnalysis = {
    band_score: toScoreNumber(activeAnalysis?.band_score, 0),
    general_feedback: String(activeAnalysis?.general_feedback || 'No overall feedback.').trim(),
    sample_answer: String(activeAnalysis?.sample_answer || 'No model answer yet.').trim(),
    criteria: {
      fluency_coherence: activeAnalysis?.fluency_coherence || { score: 0, feedback: criteriaConfig.fluency_coherence.feedbackFallback },
      lexical_resource: activeAnalysis?.lexical_resource || { score: 0, feedback: criteriaConfig.lexical_resource.feedbackFallback },
      grammatical_range: activeAnalysis?.grammatical_range || { score: 0, feedback: criteriaConfig.grammatical_range.feedbackFallback },
      pronunciation: activeAnalysis?.pronunciation || { score: 0, feedback: criteriaConfig.pronunciation.feedbackFallback },
    },
    pronunciation_heatmap: Array.isArray(activeAnalysis?.pronunciation_heatmap)
      ? activeAnalysis.pronunciation_heatmap
      : [],
    focus_areas: Array.isArray(activeAnalysis?.focus_areas)
      ? activeAnalysis.focus_areas
      : [],
    intonation_pacing: activeAnalysis?.intonation_pacing || {},
    vocabulary_upgrades: Array.isArray(activeAnalysis?.vocabulary_upgrades)
      ? activeAnalysis.vocabulary_upgrades
      : [],
    grammar_corrections: Array.isArray(activeAnalysis?.grammar_corrections)
      ? activeAnalysis.grammar_corrections
      : [],
    next_step: String(activeAnalysis?.next_step || '').trim(),
  };

  const heatmapTokens = safeAnalysis.pronunciation_heatmap
    .map((item) => ({
      word: String(item?.word || '').trim(),
      status: normalizeHeatStatus(item?.status),
      note: String(item?.note || '').trim(),
    }))
    .filter((item) => item.word)
    .slice(0, 180);

  const fallbackHeatmap = buildFallbackHeatmap(transcript);
  const visibleHeatmapTokens = heatmapTokens.length > 0 ? heatmapTokens : fallbackHeatmap;

  const focusAreas = safeAnalysis.focus_areas
    .map((item) => ({
      title: String(item?.title || '').trim() || 'Focus Area',
      priority: normalizePriority(item?.priority),
      description: String(item?.description || '').trim(),
    }))
    .filter((item) => item.title || item.description)
    .slice(0, 5);
  const visibleFocusAreas = focusAreas.length > 0
    ? focusAreas
    : buildDefaultFocusAreas(safeAnalysis.criteria.pronunciation?.feedback);

  const vocabularyUpgrades = safeAnalysis.vocabulary_upgrades
    .map((item) => ({
      original: String(item?.original || '').trim(),
      suggestion: String(item?.suggestion || '').trim(),
      reason: String(item?.reason || '').trim(),
    }))
    .filter((item) => item.original || item.suggestion)
    .slice(0, 6);

  const grammarCorrections = safeAnalysis.grammar_corrections
    .map((item) => ({
      original: String(item?.original || '').trim(),
      corrected: String(item?.corrected || '').trim(),
      reason: String(item?.reason || '').trim(),
    }))
    .filter((item) => item.original || item.corrected)
    .slice(0, 6);

  const paceWpm = Math.max(0, Math.round(toScoreNumber(safeAnalysis.intonation_pacing?.pace_wpm, result?.metrics?.wpm || 0)));
  const pitchVariation = String(
    safeAnalysis.intonation_pacing?.pitch_variation
      || (toScoreNumber(safeAnalysis.criteria.pronunciation?.score, 0) >= 7 ? 'Good' : 'Needs Work'),
  ).trim();
  const nextStep = safeAnalysis.next_step || visibleFocusAreas[0]?.description || 'Practice this topic again and focus on your weakest speaking area.';

  const reportTimestamp = result?.timestamp || result?.provisional_ready_at || null;
  const reportTimestampLabel = formatReportTimestamp(reportTimestamp);
  const topicTitle = String(topic?.title || topic?.prompt || 'Speaking Topic').trim();
  const topicLabel = normalizedPart ? `Part ${normalizedPart}` : 'Speaking';
  const statusLabel = usingProvisional ? 'Provisional' : (isCompleted ? 'Completed' : 'Processing');
  const statusClassName = usingProvisional
    ? 'speaking-report-badge speaking-report-badge--provisional'
    : (isCompleted ? 'speaking-report-badge speaking-report-badge--completed' : 'speaking-report-badge speaking-report-badge--processing');
  const modelAnswerTitle = normalizedPart ? `Model Answer (Part ${normalizedPart})` : 'Model Answer';

  return (
    <div className="speaking-report">
      <section className="speaking-report-header-card">
        <div className="speaking-report-header-card__meta">
          <div className="speaking-report-header-card__row">
            <span className={statusClassName}>{statusLabel}</span>
            <span className="speaking-report-header-card__time">{reportTimestampLabel}</span>
          </div>
          <h2 className="speaking-report-header-card__title">Speaking Performance Report</h2>
          <p className="speaking-report-header-card__subtitle">
            Topic: {topicTitle} · {topicLabel}
          </p>
          {Number.isFinite(finalBand) && Number.isFinite(provisionalBand) && (
            <p className="speaking-report-header-card__delta">
              Provisional {provisionalBand.toFixed(1)} · Final {finalBand.toFixed(1)} · Delta {formatBandDelta(bandDelta)}
            </p>
          )}
        </div>
      </section>

      <section className="speaking-report-score-grid">
        <article className="speaking-report-overall-card">
          <h3 className="speaking-report-overall-card__label">Overall Band Score</h3>
          <CircularBand score={safeAnalysis.band_score} />
          <p className="speaking-report-overall-card__feedback">{safeAnalysis.general_feedback}</p>
        </article>

        <div className="speaking-report-metrics-grid">
          {Object.entries(safeAnalysis.criteria).map(([key, metric]) => {
            const config = criteriaConfig[key] || {
              label: key,
              color: 'slate',
              feedbackFallback: 'No feedback.',
            };
            const score = toScoreNumber(metric?.score, 0);
            return (
              <article key={key} className={`speaking-report-metric speaking-report-metric--${config.color}`}>
                <div className="speaking-report-metric__head">
                  <span className="speaking-report-metric__label">{config.label}</span>
                  <span className="speaking-report-metric__score">{score.toFixed(1)}</span>
                </div>
                <div className="speaking-report-progress">
                  <div className="speaking-report-progress__bar" style={{ width: `${clampPercent(score)}%` }} />
                </div>
                <p className="speaking-report-metric__feedback">{String(metric?.feedback || config.feedbackFallback)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="speaking-report-analysis-grid">
        <article className="speaking-report-heatmap-card">
          <header className="speaking-report-section-head">
            <div>
              <h3>Pronunciation Heatmap</h3>
              <p>Highlighted words are extracted from AI pronunciation analysis.</p>
            </div>
            <div className="speaking-report-legend">
              <span><i className="dot dot--excellent" /> Excellent</span>
              <span><i className="dot dot--needs-work" /> Needs Work</span>
              <span><i className="dot dot--error" /> Error</span>
            </div>
          </header>
          <div className="speaking-report-heatmap-body">
            {visibleHeatmapTokens.length > 0 ? (
              visibleHeatmapTokens.map((token, index) => (
                <span
                  key={`${token.word}-${index}`}
                  className={`heat-token heat-token--${token.status}`}
                  title={token.note || token.status}
                >
                  {token.word}
                </span>
              ))
            ) : (
              <p className="speaking-report-empty">No transcript available.</p>
            )}
          </div>
          {transcript && (
            <div className="speaking-report-transcript-note">
              Transcript: "{transcript}"
            </div>
          )}
        </article>

        <aside className="speaking-report-focus-card">
          <header className="speaking-report-section-head">
            <div>
              <h3>Focus Areas</h3>
              <p>Priority pronunciation and delivery targets.</p>
            </div>
          </header>
          <div className="speaking-report-focus-list">
            {visibleFocusAreas.map((item, index) => (
              <article key={`${item.title}-${index}`} className={`focus-item focus-item--${item.priority}`}>
                <div className="focus-item__head">
                  <h4>{item.title}</h4>
                  <span>{item.priority}</span>
                </div>
                <p>{item.description || 'No detail available.'}</p>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="speaking-report-intonation-card">
        <header className="speaking-report-section-head">
          <div>
            <h3>Intonation &amp; Pacing Analysis</h3>
            <p>Your speaking rhythm profile from the grading pipeline.</p>
          </div>
        </header>
        <div className="speaking-report-intonation-chart">
          <div className="speaking-report-intonation-chart__native" />
          <div className="speaking-report-intonation-chart__you" />
          <div className="speaking-report-intonation-stats">
            <div>
              <small>Pace</small>
              <strong>{paceWpm} wpm</strong>
            </div>
            <div>
              <small>Pitch Var.</small>
              <strong>{pitchVariation}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="speaking-report-suggestions-grid">
        <article className="speaking-report-suggestion-card">
          <header className="speaking-report-suggestion-card__head speaking-report-suggestion-card__head--vocab">
            <h3>Vocabulary Upgrades</h3>
          </header>
          <div className="speaking-report-suggestion-card__body">
            {vocabularyUpgrades.length > 0 ? vocabularyUpgrades.map((item, index) => (
              <div key={`${item.original}-${index}`} className="suggestion-row">
                <div>
                  <small>You said</small>
                  <p className="suggestion-row__original">{item.original}</p>
                </div>
                <div>
                  <small>Suggestion</small>
                  <p className="suggestion-row__improved">{item.suggestion}</p>
                </div>
                {item.reason && <p className="suggestion-row__reason">{item.reason}</p>}
              </div>
            )) : <p className="speaking-report-empty">No vocabulary upgrades detected yet.</p>}
          </div>
        </article>

        <article className="speaking-report-suggestion-card">
          <header className="speaking-report-suggestion-card__head speaking-report-suggestion-card__head--grammar">
            <h3>Grammar Corrections</h3>
          </header>
          <div className="speaking-report-suggestion-card__body">
            {grammarCorrections.length > 0 ? grammarCorrections.map((item, index) => (
              <div key={`${item.original}-${index}`} className="suggestion-row">
                <div>
                  <small>Original</small>
                  <p className="suggestion-row__original">{item.original}</p>
                </div>
                <div>
                  <small>Corrected</small>
                  <p className="suggestion-row__improved">{item.corrected}</p>
                </div>
                {item.reason && <p className="suggestion-row__reason">{item.reason}</p>}
              </div>
            )) : <p className="speaking-report-empty">No grammar corrections detected yet.</p>}
          </div>
        </article>
      </section>

      <section className="speaking-report-model-answer">
        <h3>{modelAnswerTitle}</h3>
        <p>{safeAnalysis.sample_answer}</p>
      </section>

      <section className="speaking-report-action-bar">
        <div className="speaking-report-action-bar__hint">
          <strong>Next Step</strong>
          <span>{nextStep}</span>
        </div>
        <button type="button" className="speaking-report-action-bar__retry" onClick={onRetry}>
          Practice This Topic Again
        </button>
      </section>
    </div>
  );
}
