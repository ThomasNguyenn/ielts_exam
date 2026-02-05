import React, { useState } from 'react';
import { api } from '../../api/client';
import { useNotification } from '../../components/NotificationContext';


const IdeationPhase = ({ question, onNext }) => {
    const [outline, setOutline] = useState({
        mainIdeas: ['', '', ''],
        developmentMethod: 'Explanatory',
        topicSentences: ['', '', '']
    });
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(false);
    const [savedSessionId, setSavedSessionId] = useState(null);

    const { showNotification } = useNotification();

    const handleAIReview = async () => {
        setLoading(true);
        try {
            const res = await api.checkOutline({ questionId: question._id, outline });
            setFeedback(res.feedback);
            if (res.session_id) setSavedSessionId(res.session_id);
            return res.session_id;
        } catch (e) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="practice-grid-two">
            <div>
                <h2 className="section-title">Topic</h2>
                <div className="topic-box" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {question.image_url && (
                        <div className="task-image" style={{ textAlign: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                            <img
                                src={question.image_url}
                                alt="Task Graph/Chart"
                                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                            />
                        </div>
                    )}
                    <div style={{ whiteSpace: 'pre-wrap' }}>{question.prompt}</div>
                </div>

                <h3 className="section-title">Outline của tôi</h3>
                <div className="practice-form">
                    <div className="form-group">
                        <label className="form-label">
                            {question.task_type === 'task1' || question.task_type === 1
                                ? 'Cấu trúc bài báo cáo (Overview)'
                                : 'Phương pháp phát triển'}
                        </label>
                        {question.task_type === 'task1' || question.task_type === 1 ? (
                            <input
                                className="form-input"
                                placeholder="E.g., Intro + Overview + Body 1 (Group A) + Body 2 (Group B)"
                                value={outline.developmentMethod}
                                onChange={e => setOutline({ ...outline, developmentMethod: e.target.value })}
                            />
                        ) : (
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
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            {question.task_type === 'task1' || question.task_type === 1
                                ? 'Key Features (Các đặc điểm chính)'
                                : 'Main Ideas (3 key points)'}
                        </label>
                        {outline.mainIdeas.map((idea, i) => (
                            <input
                                key={i}
                                className="form-input"
                                style={{ marginBottom: '0.5rem' }}
                                placeholder={question.task_type === 'task1' || question.task_type === 1 ? `Feature ${i + 1}` : `Idea ${i + 1}`}
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
                        <label className="form-label">
                            {question.task_type === 'task1' || question.task_type === 1
                                ? 'Chi tiết triển khai (Grouping)'
                                : 'Topic Sentences'}
                        </label>
                        {outline.topicSentences.map((sent, i) => (
                            <input
                                key={i}
                                className="form-input"
                                style={{ marginBottom: '0.5rem' }}
                                placeholder={question.task_type === 'task1' || question.task_type === 1 ? `Detail Group ${i + 1}` : `Topic Sentence ${i + 1}`}
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
                <h3 className="section-title">Phản hồi của AI</h3>
                {feedback ? (
                    <div className="feedback-box">
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                            <span style={{ fontWeight: 600, marginRight: '1rem' }}>Score:</span>
                            <span className="feedback-score">{feedback.coherence_score}/100</span>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <p style={{ fontWeight: 600 }}>Phản hồi chung:</p>
                            <p>{feedback.general_feedback}</p>
                        </div>

                        <div>
                            <p style={{ fontWeight: 600 }}>Nâng cao và cải thiện:</p>
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
                                Tiếp tục đến Scaffolding &rarr;
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="muted" style={{ textAlign: 'center', marginTop: '3rem' }}>
                        Nộp bài của bạn để nhận phản hồi từ AI Examiner.
                    </div>
                )}
            </div>
        </div>
    );
};

export default IdeationPhase;
