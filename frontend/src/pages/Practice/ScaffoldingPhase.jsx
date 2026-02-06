import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';

const ScaffoldingPhase = ({ question, onNext }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [translations, setTranslations] = useState({}); // { index: user_input }
    const [checked, setChecked] = useState({}); // { index: boolean }

    useEffect(() => {
        const fetchMaterials = async () => {
            try {
                const res = await api.getMaterials(question._id);
                setData(res);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchMaterials();
    }, [question]);

    if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Generating Learning Materials...</div>;

    return (
        <div className="practice-grid-sidebar">
            <div style={{ overflowY: 'auto', maxHeight: '600px', paddingRight: '1rem' }}>
                <h3 className="section-title">Vocabulary (Band 7+)</h3>
                <ul className="vocab-list">
                    {data?.vocab?.map((v, i) => (
                        <li key={i} className="vocab-item" style={{ background: '#FFF9F1', borderLeftColor: '#d03939' }}>
                            <div style={{ fontWeight: '800', color: '#d03939' }}>{v.word}</div>
                            <div style={{ fontSize: '0.95rem', color: '#1e293b', marginTop: '0.25rem' }}>{v.meaning}</div>
                            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem', fontStyle: 'italic', color: '#64748b' }}>
                                Collocation: {v.collocation}
                            </div>
                        </li>
                    ))}
                </ul>

                <h3 className="section-title" style={{ marginTop: '1.5rem' }}>Structures</h3>
                <ul className="structure-list">
                    {data?.structures?.map((s, i) => (
                        <li key={i} className="structure-item" style={{ borderLeftColor: '#10B981', background: '#f0fdf4' }}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#059669' }}>{s.structure}</div>
                            <div style={{ fontSize: '0.9rem', marginTop: '0.25rem', color: '#166534' }}>Example: {s.example}</div>
                        </li>
                    ))}
                </ul>
            </div>

            <div style={{ paddingLeft: '2rem', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                <h3 className="section-title" style={{ color: '#d03939' }}>Translation Drill</h3>
                <p className="muted" style={{ marginBottom: '1rem' }}>Translate these sentences using the vocab provided.</p>

                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
                    {data?.translations?.map((t, i) => (
                        <div key={i} className="translation-card">
                            <p style={{ fontWeight: 500, marginBottom: '0.5rem', fontSize: '1.1rem' }}>{t.vietnamese}</p>
                            <textarea
                                className="form-textarea"
                                style={{ minHeight: '60px' }}
                                placeholder="Type your English translation..."
                                onChange={(e) => setTranslations({ ...translations, [i]: e.target.value })}
                            />

                            {checked[i] && (
                                <div className="reference-text">
                                    <strong>Reference: </strong> {t.english_ref}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="topic-box" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#FFF9F1', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                    {question.image_url && (
                        <div className="task-image" style={{ textAlign: 'center', background: '#ffffff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <img
                                src={question.image_url}
                                alt="Task Graph/Chart"
                                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                            />
                        </div>
                    )}
                    <div style={{ whiteSpace: 'pre-wrap', color: '#1e293b' }}>{question.prompt}</div>
                </div>

                <div style={{ paddingTop: '1.5rem', borderTop: '2px solid #FFF9F1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        onClick={() => {
                            const allChecked = {};
                            data?.translations?.forEach((_, i) => allChecked[i] = true);
                            setChecked(allChecked);
                        }}
                        className="btn-secondary"
                    >
                        Reveal All Answers
                    </button>
                    <button
                        onClick={() => onNext(data)}
                        className="btn-next"
                        style={{ width: 'auto', paddingLeft: '2rem', paddingRight: '2rem' }}
                    >
                        Start Writing &rarr;
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScaffoldingPhase;
