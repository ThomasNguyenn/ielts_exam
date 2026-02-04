import React from 'react';

const ResultPhase = ({ result, onRestart }) => {
    return (
        <div style={{ height: '100%', overflowY: 'auto' }}>
            <div className="result-header">
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Your Results</h2>
                    <p className="muted" style={{ margin: 0 }}>Overall Band Score Assessment</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--color-accent)', lineHeight: 1 }}>{result.band_score}</div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>Band Score</div>
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
                            <li key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <span style={{ color: '#059669', fontWeight: 'bold' }}>✓</span>
                                <span style={{ color: 'var(--color-text)' }}>{f}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
                <h3 className="section-title">Paraphrased Version (Band 8.0 Style)</h3>
                <div className="paraphrase-box">
                    {result.corrected_essay}
                </div>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center', paddingBottom: '2rem' }}>
                <button
                    onClick={onRestart}
                    className="btn-next"
                    style={{ background: 'var(--color-text)', width: 'auto', paddingLeft: '2rem', paddingRight: '2rem' }}
                >
                    Start New Practice Session
                </button>
            </div>
        </div>
    );
};

export default ResultPhase;
