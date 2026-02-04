import React, { useState } from 'react';
import { api } from '../../api/client';

const IdeationPhase = ({ question, onNext }) => {
    const [outline, setOutline] = useState({
        mainIdeas: ['', '', ''],
        developmentMethod: 'Explanatory',
        topicSentences: ['', '', '']
    });
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(false);
    const [savedSessionId, setSavedSessionId] = useState(null);

    const handleAIReview = async () => {
        setLoading(true);
        try {
            const res = await api.checkOutline({ questionId: question._id, outline });
            setFeedback(res.feedback);
            if (res.session_id) setSavedSessionId(res.session_id);
            return res.session_id;
        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="practice-grid-two">
            <div>
                <h2 className="section-title">Topic</h2>
                <div className="topic-box">
                    {question.prompt}
                </div>

                <h3 className="section-title">My Outline</h3>
                <div className="practice-form">
                    <div className="form-group">
                        <label className="form-label">Development Method</label>
                        <select
                            className="form-select"
                            value={outline.developmentMethod}
                            onChange={e => setOutline({ ...outline, developmentMethod: e.target.value })}
                        >
                            <option>Cause & Effect</option>
                            <option>Problem & Solution</option>
                            <option>Discussion (Agree/Disagree)</option>
                            <option>Explanatory</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Main Ideas (3 key points)</label>
                        {outline.mainIdeas.map((idea, i) => (
                            <input
                                key={i}
                                className="form-input"
                                style={{ marginBottom: '0.5rem' }}
                                placeholder={`Idea ${i + 1}`}
                                value={idea}
                                onChange={e => {
                                    const newIdeas = [...outline.mainIdeas];
                                    newIdeas[i] = e.target.value;
                                    setOutline({ ...outline, mainIdeas: newIdeas });
                                }}
                            />
                        ))}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Topic Sentences</label>
                        {outline.topicSentences.map((sent, i) => (
                            <input
                                key={i}
                                className="form-input"
                                style={{ marginBottom: '0.5rem' }}
                                placeholder={`Topic Sentence ${i + 1}`}
                                value={sent}
                                onChange={e => {
                                    const newSent = [...outline.topicSentences];
                                    newSent[i] = e.target.value;
                                    setOutline({ ...outline, topicSentences: newSent });
                                }}
                            />
                        ))}
                    </div>

                    <button
                        onClick={handleAIReview}
                        disabled={loading}
                        className="btn-check"
                    >
                        {loading ? 'Analyzing...' : 'Check with AI'}
                    </button>
                </div>
            </div>

            <div style={{ paddingLeft: '2rem', borderLeft: '1px solid var(--color-border)' }}>
                <h3 className="section-title">AI Examiner Feedback</h3>
                {feedback ? (
                    <div className="feedback-box">
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                            <span style={{ fontWeight: 600, marginRight: '1rem' }}>Coherence Score:</span>
                            <span className="feedback-score">{feedback.coherence_score}/9.0</span>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <p style={{ fontWeight: 600 }}>General Feedback:</p>
                            <p>{feedback.general_feedback}</p>
                        </div>

                        <div>
                            <p style={{ fontWeight: 600 }}>Improvements:</p>
                            <ul className="feedback-list">
                                {feedback.improvements.map((imp, i) => (
                                    <li key={i}>{imp}</li>
                                ))}
                            </ul>
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            <button
                                onClick={() => onNext({ outline, sessionId: savedSessionId })}
                                className="btn-next"
                            >
                                Continue to Scaffolding &rarr;
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="muted" style={{ textAlign: 'center', marginTop: '3rem' }}>
                        Submit your outline to get real-time feedback from the AI Examiner.
                    </div>
                )}
            </div>
        </div>
    );
};

export default IdeationPhase;
