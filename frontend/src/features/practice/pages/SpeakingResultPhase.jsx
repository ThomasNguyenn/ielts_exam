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

const clampPercent = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round((score / 9) * 100)));
};

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

const normalizePriority = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['high', 'medium', 'low'].includes(normalized)) return normalized;
  return 'medium';
};

const isUnavailableAnalysis = (analysis) => {
  if (!analysis || typeof analysis !== 'object') return false;
  const generalFeedback = String(analysis?.general_feedback || '').toLowerCase();
  if (
    generalFeedback.includes('ai scoring temporarily unavailable')
    || generalFeedback.includes('he thong tam thoi khong cham duoc')
  ) {
    return true;
  }

  const scores = [
    toScoreNumber(analysis?.band_score, 0),
    toScoreNumber(analysis?.fluency_coherence?.score, 0),
    toScoreNumber(analysis?.lexical_resource?.score, 0),
    toScoreNumber(analysis?.grammatical_range?.score, 0),
    toScoreNumber(analysis?.pronunciation?.score, 0),
  ];
  const allZero = scores.every((score) => Number(score) === 0);
  return allZero && !String(analysis?.sample_answer || '').trim();
};

const splitTranscriptToHeatmap = (transcript = '') => (
  String(transcript || '')
    .match(/[A-Za-z0-9']+/g)
    ?.slice(0, 220)
    .map((word) => ({ word, status: 'neutral', note: '' })) || []
);

const toPriorityStyle = (priority) => {
  if (priority === 'high') {
    return {
      card: 'bg-red-50 border-red-100',
      title: 'text-red-700',
      badge: 'text-red-600',
    };
  }
  if (priority === 'low') {
    return {
      card: 'bg-green-50 border-green-100',
      title: 'text-green-700',
      badge: 'text-green-600',
    };
  }
  return {
    card: 'bg-yellow-50 border-yellow-100',
    title: 'text-yellow-700',
    badge: 'text-yellow-600',
  };
};

const toHeatTokenStyle = (status) => {
  if (status === 'excellent') {
    return 'bg-green-100 text-green-800 border-b-2 border-green-500';
  }
  if (status === 'needs_work') {
    return 'bg-yellow-100 text-yellow-800 border-b-2 border-yellow-500';
  }
  if (status === 'error') {
    return 'bg-red-100 text-red-800 border-b-2 border-red-500';
  }
  return 'hover:bg-slate-100';
};

const metricConfig = {
  fluency_coherence: {
    label: 'Fluency',
    icon: 'speed',
    iconWrap: 'bg-blue-100 text-blue-600',
    bar: 'bg-blue-500',
    feedbackFallback: 'No fluency feedback.',
  },
  lexical_resource: {
    label: 'Lexical Resource',
    icon: 'library_books',
    iconWrap: 'bg-purple-100 text-purple-600',
    bar: 'bg-purple-500',
    feedbackFallback: 'No lexical feedback.',
  },
  grammatical_range: {
    label: 'Grammar',
    icon: 'history_edu',
    iconWrap: 'bg-orange-100 text-orange-600',
    bar: 'bg-orange-500',
    feedbackFallback: 'No grammar feedback.',
  },
  pronunciation: {
    label: 'Pronunciation',
    icon: 'graphic_eq',
    iconWrap: 'bg-teal-100 text-teal-600',
    bar: 'bg-teal-500',
    feedbackFallback: 'No pronunciation feedback.',
  },
};

const defaultFocusAreas = (pronunciationFeedback = '') => {
  const fallbackDescription = String(pronunciationFeedback || '').trim();
  return [
    {
      title: 'Pronunciation Focus',
      priority: 'medium',
      description: fallbackDescription || 'Review pronunciation stress and intonation in your next attempt.',
    },
  ];
};

const trendTextFromBand = (band) => {
  const score = toScoreNumber(band, 0);
  if (score >= 8.0) return 'Top 10% of students';
  if (score >= 7.0) return 'Top 20% of students';
  if (score >= 6.0) return 'On track to Band 7.0';
  return 'Keep practicing to improve';
};

export default function SpeakingResultPhase({ result, topic, onRetry }) {
  if (!result) return null;

  const transcript = String(result?.transcript || '').trim();
  const topicPart = Number(topic?.part);
  const normalizedPart = [1, 2, 3].includes(topicPart) ? topicPart : null;

  const finalAnalysis = parseAnalysisPayload(result?.analysis);
  const provisionalAnalysis = parseAnalysisPayload(result?.provisional_analysis);
  const phase1Analysis = parseAnalysisPayload(result?.phase1_analysis);
  const hasFinal = hasAnalysisPayload(finalAnalysis);
  const hasProvisional = hasAnalysisPayload(provisionalAnalysis);
  const hasPhase1 = hasAnalysisPayload(phase1Analysis);
  const scoringState = String(result?.scoring_state || '').trim().toLowerCase();
  const shouldUsePhase1 = scoringState !== 'completed' && hasPhase1 && (!hasFinal || isUnavailableAnalysis(finalAnalysis));
  const shouldUseProvisional = hasProvisional && (!hasFinal || isUnavailableAnalysis(finalAnalysis));
  const activeAnalysis = shouldUsePhase1
    ? phase1Analysis
    : (shouldUseProvisional ? provisionalAnalysis : (hasFinal ? finalAnalysis : provisionalAnalysis));

  const safeAnalysis = {
    band_score: toScoreNumber(activeAnalysis?.band_score, 0),
    general_feedback: String(activeAnalysis?.general_feedback || 'No overall feedback.').trim(),
    criteria: {
      fluency_coherence: activeAnalysis?.fluency_coherence || { score: 0, feedback: metricConfig.fluency_coherence.feedbackFallback },
      lexical_resource: activeAnalysis?.lexical_resource || { score: 0, feedback: metricConfig.lexical_resource.feedbackFallback },
      grammatical_range: activeAnalysis?.grammatical_range || { score: 0, feedback: metricConfig.grammatical_range.feedbackFallback },
      pronunciation: activeAnalysis?.pronunciation || { score: 0, feedback: metricConfig.pronunciation.feedbackFallback },
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

  const finalBand = toScoreNumber(finalAnalysis?.band_score);
  const provisionalBand = toScoreNumber(provisionalAnalysis?.band_score);
  const bandDelta = (
    Number.isFinite(finalBand) && Number.isFinite(provisionalBand)
      ? finalBand - provisionalBand
      : null
  );

  const statusLabel = shouldUsePhase1
    ? 'Phase 1 Ready'
    : (shouldUseProvisional
      ? 'Provisional'
      : (scoringState === 'completed' ? 'Completed' : 'Processing'));
  const statusClassName = shouldUsePhase1
    ? 'bg-indigo-100 text-indigo-700'
    : (shouldUseProvisional
      ? 'bg-blue-100 text-blue-700'
      : (scoringState === 'completed'
      ? 'bg-green-100 text-green-700'
      : 'bg-slate-100 text-slate-700'));

  const topicTitle = String(topic?.title || topic?.prompt || 'Speaking Topic').trim();
  const topicLabel = normalizedPart ? `Part ${normalizedPart}` : 'Speaking';
  const reportTimestamp = result?.timestamp || result?.provisional_ready_at || null;
  const reportTimestampLabel = formatReportTimestamp(reportTimestamp);
  const bandPercent = Math.max(0, Math.min(100, (safeAnalysis.band_score / 9) * 100));

  const heatmapTokens = safeAnalysis.pronunciation_heatmap
    .map((item) => ({
      word: String(item?.word || '').trim(),
      status: normalizeHeatStatus(item?.status),
      note: String(item?.note || '').trim(),
    }))
    .filter((item) => item.word)
    .slice(0, 240);
  const visibleHeatmapTokens = heatmapTokens.length > 0 ? heatmapTokens : splitTranscriptToHeatmap(transcript);

  const focusAreas = safeAnalysis.focus_areas
    .map((item) => ({
      title: String(item?.title || '').trim() || 'Focus Area',
      priority: normalizePriority(item?.priority),
      description: String(item?.description || '').trim(),
    }))
    .filter((item) => item.title || item.description)
    .slice(0, 6);
  const visibleFocusAreas = focusAreas.length > 0
    ? focusAreas
    : defaultFocusAreas(safeAnalysis.criteria.pronunciation?.feedback);

  const vocabularyUpgrades = safeAnalysis.vocabulary_upgrades
    .map((item) => ({
      original: String(item?.original || '').trim(),
      suggestion: String(item?.suggestion || '').trim(),
      reason: String(item?.reason || '').trim(),
    }))
    .filter((item) => item.original || item.suggestion)
    .slice(0, 8);

  const grammarCorrections = safeAnalysis.grammar_corrections
    .map((item) => ({
      original: String(item?.original || '').trim(),
      corrected: String(item?.corrected || '').trim(),
      reason: String(item?.reason || '').trim(),
    }))
    .filter((item) => item.original || item.corrected)
    .slice(0, 8);

  const paceWpm = Math.max(
    0,
    Math.round(toScoreNumber(safeAnalysis.intonation_pacing?.pace_wpm, result?.metrics?.wpm || 0)),
  );
  const pitchVariation = String(
    safeAnalysis.intonation_pacing?.pitch_variation
      || (toScoreNumber(safeAnalysis.criteria.pronunciation?.score, 0) >= 7 ? 'Good' : 'Needs Work'),
  ).trim();
  const nextStep = safeAnalysis.next_step || visibleFocusAreas[0]?.description || 'Practice again and focus on pronunciation control.';

  return (
    <div className="speaking-result-template min-h-screen bg-[#f6f6f8] text-slate-900">
      <div className="w-full max-w-[1200px] flex flex-col gap-8 mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${statusClassName}`}>
                {statusLabel}
              </span>
              <p className="text-slate-500 text-sm font-medium">{reportTimestampLabel}</p>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Speaking Performance Report</h1>
            <p className="text-slate-600 text-base">
              Topic: {topicTitle} - {topicLabel}
            </p>
            {Number.isFinite(finalBand) && Number.isFinite(provisionalBand) && (
              <p className="text-slate-500 text-sm font-medium">
                Provisional: {provisionalBand.toFixed(1)} | Final: {finalBand.toFixed(1)} | Delta: {formatBandDelta(bandDelta)}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#1717cf] text-white p-6 rounded-2xl shadow-lg shadow-[#1717cf]/25 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 to-transparent" />
            <h3 className="text-white/80 font-medium text-lg mb-2 relative z-10">Overall Band Score</h3>
            <div className="relative size-40 my-2 z-10">
              <svg className="circular-chart text-white" viewBox="0 0 36 36">
                <path
                  className="circle-bg stroke-white/20"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle stroke-white"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  strokeDasharray={`${bandPercent}, 100`}
                />
                <text className="percentage fill-white text-[10px]" x="18" y="20.35">
                  {safeAnalysis.band_score.toFixed(1)}
                </text>
              </svg>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm z-10">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span className="text-sm font-bold">{trendTextFromBand(safeAnalysis.band_score)}</span>
            </div>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(metricConfig).map(([key, config]) => {
              const metric = safeAnalysis.criteria[key] || {};
              const score = toScoreNumber(metric?.score, 0);
              const feedback = String(metric?.feedback || config.feedbackFallback);
              return (
                <div key={key} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${config.iconWrap}`}>
                        <span className="material-symbols-outlined">{config.icon}</span>
                      </div>
                      <span className="text-slate-700 font-semibold">{config.label}</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-900">{score.toFixed(1)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                    <div className={`${config.bar} h-2 rounded-full`} style={{ width: `${clampPercent(score)}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{feedback}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Pronunciation Heatmap</h3>
                <p className="text-sm text-slate-500">Click colored words to compare with AI.</p>
              </div>
              <div className="flex gap-2 text-xs font-medium flex-wrap justify-end">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-green-500" />Excellent</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-yellow-500" />Needs Work</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500" />Error</span>
              </div>
            </div>

            <div className="p-6 leading-relaxed text-lg text-slate-800 font-light custom-scrollbar max-h-[320px] overflow-y-auto">
              {visibleHeatmapTokens.length > 0 ? visibleHeatmapTokens.map((token, index) => (
                <span
                  key={`${token.word}-${index}`}
                  className={`cursor-pointer rounded px-1 mx-0.5 ${toHeatTokenStyle(token.status)}`}
                  title={token.note || token.status}
                >
                  {token.word}
                </span>
              )) : (
                <span className="text-slate-500 text-sm">No transcript available.</span>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-full">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1717cf]">hearing</span>
                Focus Areas
              </h3>
              <div className="flex flex-col gap-4">
                {visibleFocusAreas.map((area, index) => {
                  const style = toPriorityStyle(area.priority);
                  return (
                    <div key={`${area.title}-${index}`} className={`p-3 rounded-lg border ${style.card}`}>
                      <div className="flex justify-between items-center mb-2 gap-2">
                        <span className={`font-bold text-lg ${style.title}`}>{area.title}</span>
                        <span className={`text-xs font-bold uppercase bg-white px-2 py-0.5 rounded shadow-sm ${style.badge}`}>
                          {area.priority} priority
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{area.description || 'No details available.'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Intonation &amp; Pacing Analysis</h3>
              <p className="text-sm text-slate-500">Your speaking rhythm compared to a native speaker benchmark.</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="block size-3 rounded-full bg-[#1717cf]" />
                <span className="text-sm font-medium text-slate-600">You</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="block size-3 rounded-full bg-slate-300" />
                <span className="text-sm font-medium text-slate-600">Native Benchmark</span>
              </div>
            </div>
          </div>
          <div className="relative h-48 w-full bg-slate-50 rounded-lg overflow-hidden flex items-end">
            <div className="absolute bottom-0 left-0 w-full h-full flex items-end opacity-20 pointer-events-none">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
                <path
                  className="text-slate-400"
                  d="M0,100 C150,150 250,50 400,100 C550,150 750,50 1000,100 L1000,200 L0,200 Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-full flex items-end pointer-events-none z-10">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
                <path
                  className="text-[#1717cf]"
                  d="M0,120 C150,80 250,140 400,110 C550,60 750,140 1000,120"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </svg>
            </div>
            <div className="absolute top-4 right-4 flex gap-4">
              <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-bold">Pace</p>
                <p className="text-lg font-bold text-slate-900">
                  {paceWpm} <span className="text-xs font-normal text-slate-500">wpm</span>
                </p>
              </div>
              <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-bold">Pitch Var.</p>
                <p className="text-lg font-bold text-green-600">{pitchVariation || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-purple-50 to-white border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-100 rounded text-purple-600">
                  <span className="material-symbols-outlined text-[20px]">auto_fix_high</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Vocabulary Upgrades</h3>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {vocabularyUpgrades.length > 0 ? vocabularyUpgrades.map((item, index) => (
                <div key={`${item.original}-${index}`} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition">
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 mb-1">You said:</p>
                    <p className="text-slate-800 line-through decoration-red-400 decoration-2">"{item.original || 'N/A'}"</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400">arrow_forward</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 mb-1">Band 8+ Suggestion:</p>
                    <p className="text-[#1717cf] font-bold">"{item.suggestion || 'N/A'}"</p>
                    {item.reason && <p className="text-xs text-slate-500 mt-1">{item.reason}</p>}
                  </div>
                </div>
              )) : (
                <div className="p-4 text-sm text-slate-500">No vocabulary suggestions yet.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-orange-50 to-white border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded text-orange-600">
                  <span className="material-symbols-outlined text-[20px]">spellcheck</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Grammar Corrections</h3>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {grammarCorrections.length > 0 ? grammarCorrections.map((item, index) => (
                <div key={`${item.original}-${index}`} className="p-4 flex flex-col gap-2 hover:bg-slate-50 transition">
                  <div className="flex gap-2 text-sm text-slate-800">
                    <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5">cancel</span>
                    <span>"{item.original || 'N/A'}"</span>
                  </div>
                  <div className="flex gap-2 text-sm text-slate-800 ml-6">
                    <span className="material-symbols-outlined text-green-500 text-[18px] mt-0.5">check_circle</span>
                    <span>"{item.corrected || 'N/A'}"</span>
                  </div>
                  {item.reason && <p className="text-xs text-slate-500 ml-8 mt-1">{item.reason}</p>}
                </div>
              )) : (
                <div className="p-4 text-sm text-slate-500">No grammar corrections yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-4 z-40 bg-slate-900/90 backdrop-blur text-white p-4 rounded-xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-white/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-400">lightbulb</span>
            </div>
            <div>
              <p className="font-bold text-sm">Next Step:</p>
              <p className="text-xs text-slate-300">{nextStep}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="w-full sm:w-auto bg-[#1717cf] hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition shadow-lg shadow-[#1717cf]/40 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">mic</span>
            Re-practice Difficult Words
          </button>
        </div>
      </div>
    </div>
  );
}
