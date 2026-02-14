import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import RecordingPhase from './RecordingPhase';
import SpeakingResultPhase from './SpeakingResultPhase';
import './Practice.css';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SpeakingFlow() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [topic, setTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState('recording'); // 'recording' | 'processing' | 'result'
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!id) return;

        api.getSpeakings()
            .then((res) => {
                const found = (res.data || []).find((t) => t._id === id);
                if (!found) throw new Error('Topic not found');
                setTopic(found);
            })
            .catch((err) => {
                console.error(err);
                navigate('/practice');
            })
            .finally(() => setLoading(false));
    }, [id, navigate]);

    const pollSpeakingResult = async (sessionId) => {
        const maxAttempts = 90; // ~3 minutes at 2s interval

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const statusRes = await api.getSpeakingSession(sessionId);
            const session = statusRes?.data || {};

            if (session.status === 'completed') {
                setResult({
                    session_id: session.session_id || sessionId,
                    transcript: session.transcript || '',
                    analysis: session.analysis || {
                        band_score: 0,
                        general_feedback: 'AI result is unavailable for this attempt.',
                        sample_answer: 'N/A',
                        fluency_coherence: { score: 0, feedback: 'N/A' },
                        lexical_resource: { score: 0, feedback: 'N/A' },
                        grammatical_range: { score: 0, feedback: 'N/A' },
                        pronunciation: { score: 0, feedback: 'N/A' },
                    },
                    ai_source: session.ai_source || null,
                });
                setPhase('result');
                return;
            }

            if (session.status === 'failed') {
                throw new Error('AI grading failed. Please retry.');
            }

            await wait(2000);
        }

        throw new Error('AI grading timed out. Please check again in a minute.');
    };

    const handleRecordingComplete = async (audioBlob, extraData = {}) => {
        setPhase('processing');
        try {
            const formData = new FormData();
            formData.append('questionId', id);
            formData.append('audio', audioBlob, 'speaking-answer.webm');

            if (extraData.transcript) formData.append('transcript', extraData.transcript);
            if (extraData.duration) formData.append('duration', extraData.duration);
            if (extraData.wpm) formData.append('wpm', extraData.wpm);
            if (extraData.stats) {
                formData.append('metrics', JSON.stringify(extraData.stats));
            }

            const res = await api.submitSpeaking(formData);

            if (res?.status === 'processing' || res?.queued) {
                await pollSpeakingResult(res.session_id);
                return;
            }

            setResult(res);
            setPhase('result');
        } catch (error) {
            console.error('Submission failed:', error);
            alert('Error while processing audio. Please try again.');
            setPhase('recording');
        }
    };

    if (loading) return <div className="practice-container">Loading topic...</div>;

    return (
        <div className="practice-flow-container" style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' }}>
            <div className="practice-header">
                <button onClick={() => navigate('/speaking')} className="btn-ghost" style={{ marginBottom: '1rem' }}>
                    ← Back to list
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <span className="badge badge-purple" style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 700 }}>
                        PART {topic.part}
                    </span>
                    <h1 style={{ margin: 0 }}>{topic.title}</h1>
                </div>
            </div>

            <div className="practice-content" style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                {phase === 'recording' && (
                    <RecordingPhase
                        topic={topic}
                        onComplete={handleRecordingComplete}
                    />
                )}

                {phase === 'processing' && (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <div className="spinner" style={{ marginBottom: '2rem' }}></div>
                        <h2>AI is grading your speaking answer...</h2>
                        <p className="muted">Your submission is queued and being processed in background.</p>
                    </div>
                )}

                {phase === 'result' && (
                    <SpeakingResultPhase
                        result={result}
                        topic={topic}
                        onRetry={() => {
                            setResult(null);
                            setPhase('recording');
                        }}
                    />
                )}
            </div>
        </div>
    );
}
