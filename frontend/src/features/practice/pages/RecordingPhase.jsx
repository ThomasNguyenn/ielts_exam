import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNotification } from '@/shared/context/NotificationContext';

const AUTO_RESUME_FALLBACK_MS = 20000;
const AUDIO_BITS_PER_SECOND = 64000;
const CHUNK_TIMESLICE_MS = 1000;

const getSupportedRecordingMimeType = () => {
    if (typeof window === 'undefined' || !window.MediaRecorder?.isTypeSupported) {
        return null;
    }

    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
    ];

    return candidates.find((type) => window.MediaRecorder.isTypeSupported(type)) || null;
};

const toConversationQuestions = (topic) => {
    const part = Number(topic?.part || 0);
    if (part !== 3) return [];

    const scriptedQuestions = Array.isArray(topic?.conversation_script?.questions)
        ? topic.conversation_script.questions
        : [];
    if (scriptedQuestions.length > 0) {
        return scriptedQuestions
            .map((item, index) => ({
                key: `${item.type || 'q'}-${index}`,
                text: String(item?.text || '').trim(),
                audioUrl: item?.audio_url || null,
            }))
            .filter((item) => item.text);
    }

    const fallback = [];
    const prompt = String(topic?.prompt || '').trim();
    if (prompt) {
        fallback.push({ key: 'prompt-0', text: prompt, audioUrl: null });
    }

    (topic?.sub_questions || []).forEach((question, index) => {
        const text = String(question || '').trim();
        if (!text) return;
        fallback.push({ key: `sub-${index}`, text, audioUrl: null });
    });

    return fallback;
};

export default function RecordingPhase({ topic, onComplete }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isRecorderPaused, setIsRecorderPaused] = useState(false);
    const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [questionIndex, setQuestionIndex] = useState(0);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const autoResumeTimeoutRef = useRef(null);
    const questionAudioRef = useRef(null);

    // Visualizer refs
    const canvasRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);

    const conversationQuestions = useMemo(() => toConversationQuestions(topic), [topic]);
    const isPart3Conversational = Number(topic?.part || 0) === 3 && conversationQuestions.length > 1;
    const currentQuestion = isPart3Conversational ? conversationQuestions[questionIndex] : null;
    const atLastConversationQuestion = !isPart3Conversational || questionIndex >= conversationQuestions.length - 1;
    const { showNotification } = useNotification();

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startTimer = () => {
        clearTimer();
        timerRef.current = setInterval(() => {
            setRecordingTime((value) => value + 1);
        }, 1000);
    };

    const clearAutoResumeTimeout = () => {
        if (autoResumeTimeoutRef.current) {
            clearTimeout(autoResumeTimeoutRef.current);
            autoResumeTimeoutRef.current = null;
        }
    };

    const resetQuestionFlow = () => {
        setQuestionIndex(0);
        setIsRecorderPaused(false);
        setIsAutoAdvancing(false);
        clearAutoResumeTimeout();
    };

    useEffect(() => {
        resetQuestionFlow();
        setAudioBlob(null);
        setRecordingTime(0);
        setIsRecording(false);
    }, [topic?._id]);

    useEffect(() => () => {
        clearTimer();
        clearAutoResumeTimeout();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
        }
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioContext;
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            audioContext.createMediaStreamSource(stream).connect(analyser);
            visualize();

            const supportedMimeType = getSupportedRecordingMimeType();
            const recorderOptions = {
                audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
                ...(supportedMimeType ? { mimeType: supportedMimeType } : {}),
            };

            mediaRecorderRef.current = new MediaRecorder(stream, recorderOptions);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: mimeType });
                setAudioBlob(blob);
                stream.getTracks().forEach((track) => track.stop());
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            };

            mediaRecorderRef.current.start(CHUNK_TIMESLICE_MS);
            setIsRecording(true);
            setIsRecorderPaused(false);
            setIsAutoAdvancing(false);
            setRecordingTime(0);
            startTimer();
        } catch (error) {
            console.error('Mic access denied:', error);
            showNotification('Please allow microphone access to record your answer.', 'warning');
        }
    };

    const visualize = () => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current.getByteFrequencyData(dataArray);

            context.fillStyle = '#f8fafc';
            context.fillRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i += 1) {
                const barHeight = dataArray[i] / 2;
                context.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
                context.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };

        draw();
    };

    const stopRecording = () => {
        if (!mediaRecorderRef.current || !isRecording) return;
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        setIsRecorderPaused(false);
        setIsAutoAdvancing(false);
        clearTimer();
        clearAutoResumeTimeout();
    };

    const resumeRecordingAfterAdvance = () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === 'inactive') {
            setIsRecorderPaused(false);
            setIsAutoAdvancing(false);
            clearAutoResumeTimeout();
            return;
        }

        try {
            if (recorder.state === 'paused') {
                recorder.resume();
            }
        } catch (error) {
            console.error('Failed to resume recorder:', error);
        }

        setIsRecorderPaused(false);
        setIsAutoAdvancing(false);
        clearAutoResumeTimeout();
        startTimer();
    };

    const pauseAndGoNextQuestion = () => {
        if (!isPart3Conversational || !isRecording || isRecorderPaused || isAutoAdvancing || atLastConversationQuestion) return;
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === 'inactive') return;

        try {
            if (recorder.state === 'recording') {
                recorder.pause();
            }
        } catch (error) {
            console.error('Failed to pause recorder:', error);
        }

        setIsRecorderPaused(true);
        setIsAutoAdvancing(true);
        clearTimer();
        setQuestionIndex((value) => Math.min(value + 1, conversationQuestions.length - 1));
    };

    useEffect(() => {
        if (!isPart3Conversational || !isAutoAdvancing || !isRecording) return;

        const audioEl = questionAudioRef.current;
        let removed = false;

        const completeAdvance = () => {
            if (removed) return;
            resumeRecordingAfterAdvance();
        };

        clearAutoResumeTimeout();
        autoResumeTimeoutRef.current = setTimeout(() => {
            completeAdvance();
        }, AUTO_RESUME_FALLBACK_MS);

        if (!currentQuestion?.audioUrl || !audioEl) {
            setTimeout(() => completeAdvance(), 600);
            return () => {
                removed = true;
                clearAutoResumeTimeout();
            };
        }

        const onEnded = () => completeAdvance();
        const onError = () => completeAdvance();

        audioEl.addEventListener('ended', onEnded);
        audioEl.addEventListener('error', onError);

        audioEl.currentTime = 0;
        audioEl.play().catch(() => {
            setTimeout(() => completeAdvance(), 600);
        });

        return () => {
            removed = true;
            audioEl.removeEventListener('ended', onEnded);
            audioEl.removeEventListener('error', onError);
            clearAutoResumeTimeout();
        };
    }, [currentQuestion?.audioUrl, isAutoAdvancing, isPart3Conversational, isRecording]);

    const resetForRetry = () => {
        setAudioBlob(null);
        setRecordingTime(0);
        resetQuestionFlow();
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="recording-phase" style={{ textAlign: 'center' }}>
            <div className="topic-display" style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid #6366F1' }}>
                <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>
                    {isPart3Conversational ? 'Part 3 Conversational Mode' : 'Speaking Prompt'}
                </h3>

                {isPart3Conversational ? (
                    <div style={{ textAlign: 'left' }}>
                        <p style={{ margin: '0 0 0.75rem', fontWeight: 700, color: '#4338ca' }}>
                            Question {questionIndex + 1} / {conversationQuestions.length}
                        </p>
                        <p style={{ fontSize: '1.1rem', lineHeight: 1.6, color: '#334155', fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                            {currentQuestion?.text}
                        </p>
                        {currentQuestion?.audioUrl ? (
                            <audio
                                ref={questionAudioRef}
                                key={`${currentQuestion.key}-${currentQuestion.audioUrl}`}
                                src={currentQuestion.audioUrl}
                                controls={!isRecording}
                                autoPlay
                                preload="auto"
                                style={{ marginTop: '0.75rem', width: '100%' }}
                            />
                        ) : (
                            <p className="muted" style={{ marginTop: '0.75rem' }}>
                                Read-aloud audio is not available yet for this question.
                            </p>
                        )}
                    </div>
                ) : (
                    <>
                        <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#334155', fontWeight: 500, whiteSpace: 'pre-wrap', textAlign: 'left' }}>
                            {topic.prompt}
                        </p>
                        {topic.sub_questions?.length > 0 && (
                            <ul style={{ textAlign: 'left', marginTop: '1rem', color: '#64748b' }}>
                                {topic.sub_questions.map((question, index) => <li key={index}>{question}</li>)}
                            </ul>
                        )}
                    </>
                )}
            </div>

            <div className="recorder-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ position: 'relative', height: '60px', width: '100%', maxWidth: '300px', marginBottom: '1rem' }}>
                    {isRecording && !isRecorderPaused && <canvas ref={canvasRef} width="300" height="60" style={{ width: '100%', height: '100%', borderRadius: '8px' }} />}
                    {(!isRecording || isRecorderPaused) && !audioBlob && (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                            {isRecorderPaused ? 'Paused between questions...' : 'Audio wave appears here while recording'}
                        </div>
                    )}
                </div>

                <div className="timer" style={{ fontSize: '2.5rem', fontWeight: 800, color: isRecording && !isRecorderPaused ? '#ef4444' : '#1e293b', fontFamily: 'monospace' }}>
                    {formatTime(recordingTime)}
                </div>

                {!isRecording && !audioBlob && (
                    <button
                        onClick={startRecording}
                        style={{ width: '80px', height: '80px', borderRadius: '50%', border: 'none', background: '#6366F1', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)', transition: 'transform 0.2s' }}
                        onMouseEnter={(event) => { event.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseLeave={(event) => { event.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        <span style={{ fontSize: '1.5rem' }}>Rec</span>
                    </button>
                )}

                {isRecording && (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {isPart3Conversational && !atLastConversationQuestion && (
                            <button
                                type="button"
                                onClick={pauseAndGoNextQuestion}
                                className="btn-ghost"
                                style={{ padding: '0.75rem 1rem', borderRadius: '8px', fontWeight: 700 }}
                                disabled={isRecorderPaused || isAutoAdvancing}
                            >
                                {isAutoAdvancing ? 'Loading Next Question...' : 'Pause & Next Question'}
                            </button>
                        )}
                        <button
                            onClick={stopRecording}
                            className="pulse"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
                        >
                            <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '2px' }}></div>
                        </button>
                    </div>
                )}

                {audioBlob && !isRecording && (
                    <div style={{ width: '100%' }}>
                        <audio src={URL.createObjectURL(audioBlob)} controls style={{ marginBottom: '1rem', width: '100%' }} />
                        {isPart3Conversational && !atLastConversationQuestion && (
                            <p className="muted" style={{ marginBottom: '0.9rem' }}>
                                You have not reached the last question yet. Please record again and use Pause & Next Question.
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={resetForRetry}
                                className="btn-ghost"
                                style={{ padding: '0.75rem 1.5rem', borderRadius: '8px' }}
                            >
                                Record Again
                            </button>
                            <button
                                onClick={() => onComplete(audioBlob)}
                                className="btn-sidebar-start"
                                style={{ padding: '0.75rem 2rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: atLastConversationQuestion ? 'pointer' : 'not-allowed', fontWeight: 700, opacity: atLastConversationQuestion ? 1 : 0.6 }}
                                disabled={!atLastConversationQuestion}
                                title={atLastConversationQuestion ? '' : 'Please finish all Part 3 questions before submitting.'}
                            >
                                Submit for AI Grading
                            </button>
                        </div>
                    </div>
                )}

                <p className="muted" style={{ marginTop: '1rem' }}>
                    {isRecording
                        ? (isPart3Conversational
                            ? 'Answer the current question, tap "Pause & Next Question", then recording will continue automatically.'
                            : 'Recording in progress. Stop when you finish answering.')
                        : (audioBlob
                            ? 'Review your recording and submit.'
                            : (isPart3Conversational
                                ? 'Start recording and use Pause & Next Question after each answer.'
                                : 'Press record and answer the prompt.'))}
                </p>
            </div>
        </div>
    );
}
