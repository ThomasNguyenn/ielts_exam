import React from 'react';

export default function SpeakingResultPhase({ result, topic, onRetry }) {
    const { transcript, analysis } = result;

    const renderCriteria = (name, data) => (
        <div key={name} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, textTransform: 'capitalize' }}>{name.replace('_', ' & ')}</h4>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6' }}>{data.score}</span>
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>{data.feedback}</p>
        </div>
    );

    return (
        <div className="result-phase">
            <div className="overall-score" style={{ textAlign: 'center', marginBottom: '3rem', padding: '2rem', background: '#f0f9ff', borderRadius: '16px', border: '2px solid #bae6fd' }}>
                <h2 style={{ marginBottom: '0.5rem' }}>Dự đoán Band Score</h2>
                <div style={{ fontSize: '4rem', fontWeight: 900, color: '#0369a1' }}>{analysis.band_score}</div>
                <p style={{ maxWidth: '600px', margin: '1rem auto 0', color: '#1e293b', fontWeight: 500 }}>{analysis.general_feedback}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="transcript-section">
                    <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Bản ghi âm (Transcript)</h3>
                    <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', lineHeight: '1.8', color: '#334155', fontStyle: 'italic' }}>
                        "{transcript}"
                    </div>
                </div>

                <div className="criteria-section">
                    <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Đánh giá chi tiết</h3>
                    {Object.entries(analysis).map(([key, value]) => {
                        if (['band_score', 'general_feedback', 'sample_answer'].includes(key)) return null;
                        return renderCriteria(key, value);
                    })}
                </div>
            </div>

            <div className="model-answer" style={{ marginTop: '3rem', padding: '2rem', background: '#ecfdf5', borderRadius: '16px', border: '1px solid #a7f3d0' }}>
                <h3 style={{ color: '#065f46', marginBottom: '1rem' }}>Câu trả lời mẫu (Band 8.0+)</h3>
                <p style={{ lineHeight: '1.8', color: '#064e3b', whiteSpace: 'pre-wrap' }}>{analysis.sample_answer}</p>
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
