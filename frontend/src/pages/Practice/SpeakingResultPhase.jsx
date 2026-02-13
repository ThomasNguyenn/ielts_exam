import React from 'react';

export default function SpeakingResultPhase({ result, topic, onRetry }) {
    // Defensive check: Ensure result exists
    if (!result) return null;

    const { transcript } = result;
    let { analysis } = result;

    // Normalization: specific check if analysis is a string (double-encoded JSON)
    if (typeof analysis === 'string') {
        try {
            analysis = JSON.parse(analysis);
        } catch (e) {
            console.error("Failed to parse analysis string in frontend:", e);
            analysis = {};
        }
    }

    // Ensure analysis is an object
    analysis = analysis || {};

    // Safe Accessors with Defaults
    const safeAnalysis = {
        band_score: analysis.band_score || 0,
        general_feedback: analysis.general_feedback || "Không có nhận xét tổng quan.",
        sample_answer: analysis.sample_answer || "Chưa có bài mẫu.",
        // Extract specific criteria to avoid iterating over unexpected keys
        criteria: {
            fluency_coherence: analysis.fluency_coherence || { score: 0, feedback: "N/A" },
            lexical_resource: analysis.lexical_resource || { score: 0, feedback: "N/A" },
            grammatical_range: analysis.grammatical_range || { score: 0, feedback: "N/A" },
            pronunciation: analysis.pronunciation || { score: 0, feedback: "N/A" }
        }
    };

    const renderCriteria = (name, data) => {
        // Guard against malformed data in criteria
        if (!data || typeof data !== 'object') return null;

        const displayName = {
            fluency_coherence: "Fluency & Coherence",
            lexical_resource: "Lexical Resource",
            grammatical_range: "Grammatical Range",
            pronunciation: "Pronunciation"
        }[name] || name.replace(/_/g, ' & '); // Fallback formatting

        return (
            <div key={name} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, textTransform: 'capitalize' }}>{displayName}</h4>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6' }}>{data.score}</span>
                </div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>{data.feedback}</p>
            </div>
        );
    };

    return (
        <div className="result-phase">
            <div className="overall-score" style={{ textAlign: 'center', marginBottom: '3rem', padding: '2rem', background: '#f0f9ff', borderRadius: '16px', border: '2px solid #bae6fd' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>Dự đoán Band Score</h2>
                <div style={{ fontSize: '4rem', fontWeight: 900, color: '#0369a1' }}>{safeAnalysis.band_score}</div>
                <p style={{ maxWidth: '600px', margin: '1rem auto 0', color: '#1e293b', fontWeight: 500 }}>{safeAnalysis.general_feedback}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="transcript-section">
                    <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Bản ghi âm (Transcript)</h3>
                    <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', lineHeight: '1.8', color: '#334155', fontStyle: 'italic' }}>
                        "{transcript || "(Không có nội dung)"}"
                    </div>
                </div>

                <div className="criteria-section">
                    <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Đánh giá chi tiết</h3>
                    {/* Render specific keys specifically to avoid raw JSON leakage */}
                    {Object.entries(safeAnalysis.criteria).map(([key, value]) => renderCriteria(key, value))}
                </div>
            </div>

            <div className="model-answer" style={{ marginTop: '3rem', padding: '2rem', background: '#ecfdf5', borderRadius: '16px', border: '1px solid #a7f3d0' }}>
                <h3 style={{ color: '#065f46', marginBottom: '1rem' }}>Câu trả lời mẫu (Band 8.0+)</h3>
                <p style={{ lineHeight: '1.8', color: '#064e3b', whiteSpace: 'pre-wrap' }}>{safeAnalysis.sample_answer}</p>
            </div>

            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                <button
                    onClick={onRetry}
                    className="btn-sidebar-start"
                    style={{ padding: '1rem 3rem', borderRadius: '50px' }}
                >
                    Luyện tập lại chủ đề này
                </button>
            </div>
        </div>
    );
}
