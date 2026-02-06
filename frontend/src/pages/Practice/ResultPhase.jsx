import React from 'react';

const ResultPhase = ({ result, onRestart }) => {
    return (
        <div style={{ height: '100%', overflowY: 'auto' }}>
            <div className="result-header">
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Your Results</h2>
                    <p className="muted" style={{ margin: 0 }}>Overall Band Score Assessment</p>
                </div>
                <div style={{ textAlign: 'center', background: '#FFF9F1', padding: '1rem 2rem', borderRadius: '1rem', border: '1px solid #fdf4e3', boxShadow: '0 4px 12px rgba(208, 57, 57, 0.05)' }}>
                    <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#d03939', lineHeight: 1 }}>{result.band_score}</div>
                    <div className="muted" style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#d03939', marginTop: '0.25rem' }}>Band Score</div>
                </div>
            </div>

            <div className="score-grid">
                {Object.entries(result.criteria_scores).map(([key, val]) => (
                    <div key={key} className="score-card">
                        <div className="score-value">{val}</div>
                        <div className="score-label">
                            {key.replace(/_/g, ' ')}
                        </div>
                    </div>
                ))}
            </div>

            <div className="practice-grid-two" style={{ marginBottom: '2rem' }}>
                <div>
                    <h3 className="section-title" style={{ color: '#059669', borderColor: '#059669' }}>Improvement Feedback</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {result.feedback.map((f, i) => (
                            <li key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', background: '#f0fdf4', padding: '1rem', borderRadius: '12px', borderLeft: '4px solid #059669' }}>
                                <span style={{ color: '#059669', fontWeight: 'bold' }}>✓</span>
                                <span style={{ color: '#166534', fontWeight: 500 }}>{f}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
                <h3 className="section-title">Bài mẫu Band 8.0 (Model Essay)</h3>
                <div className="paraphrase-box">
                    {result.corrected_essay}
                </div>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center', paddingBottom: '2rem' }}>
                <button
                    onClick={onRestart}
                    className="btn-sidebar-start"
                    style={{ width: 'auto', paddingLeft: '3rem', paddingRight: '3rem', margin: '0 auto' }}
                >
                    Start New Practice Session
                </button>
            </div>
        </div>
    );
};

export default ResultPhase;
