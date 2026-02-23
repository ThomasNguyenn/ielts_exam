import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import RecordingPhase from './RecordingPhase';
import SpeakingResultPhase from './SpeakingResultPhase';
import './Practice.css';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatElapsed = (totalSeconds) => {
    const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const normalizeSpeakingSessionPayload = (response) => {
    if (!response) return {};
    if (response.data?.data) return response.data.data;
    if (response.data) return response.data;
    return response;
};

const getSpeakingSessionId = (payload) => (
    payload?.session_id ||
    payload?._id ||
    payload?.id ||
    null
);

const getPollDelayMs = (attempt) => {
    const jitterMs = Math.floor(Math.random() * 500) - 250; // -250..+249

    if (attempt < 3) {
        return Math.max(1200, 1500 + jitterMs);
    }

    if (attempt < 10) {
        return Math.max(1800, 2400 + jitterMs);
    }

    const baseMs = 3500;
    const backoffMs = Math.min(Math.floor((attempt - 10) / 5) * 800, 3200);
    return Math.max(2500, baseMs + backoffMs + jitterMs);
};

export default function SpeakingFlow() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [topic, setTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState('recording'); // 'recording' | 'processing' | 'result'
    const [result, setResult] = useState(null);
    const [processingStartedAt, setProcessingStartedAt] = useState(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const { showNotification } = useNotification();

    useEffect(() => {
        if (!id) return;

        api.getSpeakingById(id)
            .then((res) => {
                if (!res?._id) throw new Error('Topic not found');
                setTopic(res);
            })
            .catch((err) => {
                console.error(err);
                navigate('/practice');
            })
            .finally(() => setLoading(false));
    }, [id, navigate]);

    useEffect(() => {
        if (phase !== 'processing' || !processingStartedAt) return undefined;

        const tick = () => {
            setElapsedSeconds(Math.max(0, Math.floor((Date.now() - processingStartedAt) / 1000)));
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [phase, processingStartedAt]);

    const pollSpeakingResult = async (sessionId) => {
        const maxAttempts = 45; // ~3-5 minutes with backoff polling

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const statusRes = await api.getSpeakingSession(sessionId);
            const session = normalizeSpeakingSessionPayload(statusRes);

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
                setProcessingStartedAt(null);
                setPhase('result');
                return;
            }

            if (session.status === 'failed') {
                throw new Error('AI grading failed. Please retry.');
            }

            await wait(getPollDelayMs(attempt));
        }

        throw new Error('AI grading timed out. Please check again in a minute.');
    };

    const handleRecordingComplete = async (audioBlob, extraData = {}) => {
        const startedAt = Date.now();
        setProcessingStartedAt(startedAt);
        setElapsedSeconds(0);
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
            const submitPayload = normalizeSpeakingSessionPayload(res);
            const sessionId = getSpeakingSessionId(submitPayload);
            const statusValue = String(submitPayload?.status || '').toLowerCase().trim();
            const hasAnalysis = Boolean(submitPayload?.analysis);
            const shouldPoll =
                Boolean(sessionId) &&
                !hasAnalysis &&
                (
                    submitPayload?.queued === true ||
                    statusValue === 'processing' ||
                    statusValue === 'queued' ||
                    statusValue === 'pending' ||
                    !statusValue
                );

            if (shouldPoll) {
                await pollSpeakingResult(sessionId);
                return;
            }

            setResult(submitPayload);
            setProcessingStartedAt(null);
            setPhase('result');
        } catch (error) {
            console.error('Submission failed:', error);
            showNotification('Error while processing audio. Please try again.', 'error');
            setProcessingStartedAt(null);
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
                    <h1 style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{topic.title}</h1>
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
                        <p className="muted" style={{ marginTop: '0.75rem', fontWeight: 600 }}>
                            Waiting time: {formatElapsed(elapsedSeconds)}
                        </p>
                    </div>
                )}

                {phase === 'result' && (
                    <SpeakingResultPhase
                        result={result}
                        topic={topic}
                        onRetry={() => {
                            setResult(null);
                            setProcessingStartedAt(null);
                            setElapsedSeconds(0);
                            setPhase('recording');
                        }}
                    />
                )}
            </div>
        </div>
    );
}
