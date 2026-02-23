import React from 'react';

const CircularProgress = ({ score, maxScore = 9, size = 120, strokeWidth = 8 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = (score / maxScore) * circumference;

    let strokeColor = '#ef4444';
    if (score >= 4) strokeColor = '#f59e0b';
    if (score >= 6) strokeColor = '#6366F1';
    if (score >= 7.5) strokeColor = '#10b981';

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#e5e7eb"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: strokeColor }}>{score}</span>
                <span className="text-xs text-gray-400 font-medium">BAND</span>
            </div>
        </div>
    );
};

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

const formatBandDelta = (value) => {
    if (!Number.isFinite(value)) return null;
    if (value === 0) return '0.0';
    return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
};

export default function SpeakingResultPhase({ result, topic, onRetry }) {
    if (!result) return null;

    const transcript = String(result?.transcript || '').trim();
    const scoringState = String(result?.scoring_state || '').trim().toLowerCase();

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
        general_feedback: activeAnalysis?.general_feedback || 'No overall feedback.',
        sample_answer: activeAnalysis?.sample_answer || 'No model answer yet.',
        criteria: {
            fluency_coherence: activeAnalysis?.fluency_coherence || { score: 0, feedback: 'N/A' },
            lexical_resource: activeAnalysis?.lexical_resource || { score: 0, feedback: 'N/A' },
            grammatical_range: activeAnalysis?.grammatical_range || { score: 0, feedback: 'N/A' },
            pronunciation: activeAnalysis?.pronunciation || { score: 0, feedback: 'N/A' },
        }
    };

    const criteriaConfig = {
        fluency_coherence: { label: 'Fluency & Coherence', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
        lexical_resource: { label: 'Lexical Resource', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
        grammatical_range: { label: 'Grammatical Range', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        pronunciation: { label: 'Pronunciation', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0">
                    <CircularProgress score={safeAnalysis.band_score} />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h2 className="text-xl font-bold text-slate-800">Overall Feedback</h2>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${usingProvisional ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {usingProvisional ? 'Provisional estimate' : 'Final official score'}
                        </span>
                        {usingProvisional && result?.provisional_source && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                {result.provisional_source}
                            </span>
                        )}
                        {!usingProvisional && result?.ai_source && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                {result.ai_source}
                            </span>
                        )}
                    </div>
                    <p className="text-slate-600 leading-relaxed">{safeAnalysis.general_feedback}</p>

                    {Number.isFinite(finalBand) && Number.isFinite(provisionalBand) && (
                        <p className="text-sm text-slate-500 mt-3">
                            Provisional: {provisionalBand.toFixed(1)} | Final: {finalBand.toFixed(1)} | Delta: {formatBandDelta(bandDelta)}
                        </p>
                    )}

                    {!isCompleted && (
                        <p className="text-sm text-blue-600 mt-3">
                            Final AI grading is still running in background.
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(safeAnalysis.criteria).map(([key, data]) => {
                    const config = criteriaConfig[key] || { label: key, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-100' };
                    return (
                        <div key={key} className={`p-6 rounded-xl border ${config.bg} ${config.border} transition-all hover:shadow-md`}>
                            <div className="flex justify-between items-start mb-3">
                                <h3 className={`font-bold text-sm uppercase tracking-wide ${config.color}`}>
                                    {config.label}
                                </h3>
                                <div className={`px-3 py-1 rounded-full bg-white font-bold text-sm shadow-sm ${config.color}`}>
                                    {toScoreNumber(data?.score, 0)}
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                {data?.feedback || 'N/A'}
                            </p>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 gap-8">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
                        Your Transcript
                    </h3>
                    <div className="p-4 bg-slate-50 rounded-xl text-slate-600 italic leading-relaxed text-sm">
                        "{transcript || 'No transcript available.'}"
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <svg className="w-24 h-24 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L1 21h22L12 2zm0 3.516L20.297 19H3.703L12 5.516z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2 relative z-10">
                        <span className="bg-emerald-200 text-emerald-800 text-xs px-2 py-1 rounded uppercase tracking-wider font-extrabold">
                            {isCompleted ? 'Band 7.0+' : 'Pending Final'}
                        </span>
                        {isCompleted ? 'Model Answer' : 'Model Answer (provisional view)'}
                    </h3>
                    <p className="text-emerald-900 leading-7 font-serif text-lg relative z-10 whitespace-pre-wrap">
                        {safeAnalysis.sample_answer}
                    </p>
                </div>
            </div>

            <div className="flex justify-center pt-4">
                <button
                    onClick={onRetry}
                    className="group relative px-8 py-3 bg-slate-900 text-white font-semibold rounded-full shadow-lg hover:bg-slate-800 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                    <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Practice This Topic Again
                    </span>
                </button>
            </div>
        </div>
    );
}
