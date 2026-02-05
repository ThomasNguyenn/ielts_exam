import React, { useState } from 'react';
import { useNotification } from '../../components/NotificationContext';
import { api } from '../../api/client';

const WritingPhase = ({ question, sessionId, outline, materials, onNext }) => {
    const [essay, setEssay] = useState('');
    const [loading, setLoading] = useState(false);
    const { showNotification } = useNotification();

    const handleSubmit = async () => {
        if (!essay.trim()) return showNotification("Please write something!", "warning");

        setLoading(true);
        try {
            const res = await api.submitPracticeWriting({ sessionId, fullEssay: essay });
            onNext(res);
        } catch (e) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="practice-grid-sidebar">
            {/* Sidebar Reference */}
            <div className="sidebar-ref">
                <div style={{ marginBottom: '1.5rem' }}>
                    <h4 className="form-label" style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.8rem' }}>Topic</h4>
                    <div style={{ background: 'var(--color-bg)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {question.image_url && (
                            <img
                                src={question.image_url}
                                alt="Task Graph/Chart"
                                style={{ width: '100%', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                            />
                        )}
                        <div style={{ whiteSpace: 'pre-wrap' }}>{question.prompt}</div>
                    </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <h4 className="form-label" style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                        {question.task_type === 'task1' || question.task_type === 1 ? 'Key Features' : 'My Outline'}
                    </h4>
                    <ul style={{ paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                        {outline?.mainIdeas?.map((idea, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{idea}</li>)}
                    </ul>
                </div>

                <div>
                    <h4 className="form-label" style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.8rem' }}>Key Vocab</h4>
                    <ul style={{ padding: 0, listStyle: 'none' }}>
                        {materials?.vocab?.map((v, i) => (
                            <li key={i} style={{ color: 'var(--color-accent)', marginBottom: '0.25rem', cursor: 'help', fontSize: '0.9rem' }} title={v.meaning}>
                                {v.word}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Editor */}
            <div className="editor-area">
                <textarea
                    className="essay-editor"
                    placeholder="Start writing your essay here..."
                    value={essay}
                    onChange={(e) => setEssay(e.target.value)}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="muted">Word Count: {essay.trim().split(/\s+/).filter(w => w).length}</span>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="btn-submit"
                        style={{ width: 'auto', paddingLeft: '3rem', paddingRight: '3rem' }}
                    >
                        {loading ? 'Grading...' : 'Submit for Grading'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WritingPhase;
