import React, { useEffect, useMemo, useRef, useState } from 'react';

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
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [questionIndex, setQuestionIndex] = useState(0);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    // Visualizer refs
    const canvasRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);

    const conversationQuestions = useMemo(() => toConversationQuestions(topic), [topic]);
    const isPart3Conversational = Number(topic?.part || 0) === 3 && conversationQuestions.length > 1;
    const currentQuestion = isPart3Conversational ? conversationQuestions[questionIndex] : null;
    const atLastConversationQuestion = !isPart3Conversational || questionIndex >= conversationQuestions.length - 1;

    useEffect(() => {
        setQuestionIndex(0);
        setAudioBlob(null);
        setRecordingTime(0);
        setIsRecording(false);
    }, [topic?._id]);

    useEffect(() => () => {
        if (timerRef.current) clearInterval(timerRef.current);
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

            mediaRecorderRef.current = new MediaRecorder(stream);
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

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime((value) => value + 1);
            }, 1000);
        } catch (error) {
            console.error('Mic access denied:', error);
            alert('Please allow microphone access to record your answer.');
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
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const moveToNextQuestion = () => {
        if (!isPart3Conversational) return;
        setQuestionIndex((value) => Math.min(value + 1, conversationQuestions.length - 1));
    };

    const resetForRetry = () => {
        setAudioBlob(null);
        setRecordingTime(0);
        setQuestionIndex(0);
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
                                key={`${currentQuestion.key}-${currentQuestion.audioUrl}`}
                                src={currentQuestion.audioUrl}
                                controls
                                autoPlay
                                preload="auto"
                                style={{ marginTop: '0.75rem', width: '100%' }}
                            />
                        ) : (
                            <p className="muted" style={{ marginTop: '0.75rem' }}>
                                Read-aloud audio is not available yet for this question.
                            </p>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.85rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => setQuestionIndex((value) => Math.max(value - 1, 0))}
                                disabled={questionIndex === 0}
                            >
                                Previous Question
                            </button>
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={moveToNextQuestion}
                                disabled={atLastConversationQuestion}
                            >
                                Next Question
                            </button>
                        </div>
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
                    {isRecording && <canvas ref={canvasRef} width="300" height="60" style={{ width: '100%', height: '100%', borderRadius: '8px' }} />}
                    {!isRecording && !audioBlob && <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Audio wave appears here while recording</div>}
                </div>

                <div className="timer" style={{ fontSize: '2.5rem', fontWeight: 800, color: isRecording ? '#ef4444' : '#1e293b', fontFamily: 'monospace' }}>
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
                    <button
                        onClick={stopRecording}
                        className="pulse"
                        style={{ width: '80px', height: '80px', borderRadius: '50%', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
                    >
                        <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '2px' }}></div>
                    </button>
                )}

                {audioBlob && !isRecording && (
                    <div style={{ width: '100%' }}>
                        <audio src={URL.createObjectURL(audioBlob)} controls style={{ marginBottom: '1rem', width: '100%' }} />
                        {isPart3Conversational && !atLastConversationQuestion && (
                            <p className="muted" style={{ marginBottom: '0.9rem' }}>
                                Continue to the next question(s) before submitting this Part 3 recording.
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
                                title={atLastConversationQuestion ? '' : 'Please finish all Part 3 questions first.'}
                            >
                                Submit for AI Grading
                            </button>
                        </div>
                    </div>
                )}

                <p className="muted" style={{ marginTop: '1rem' }}>
                    {isRecording
                        ? 'Recording in progress. Stop when you finish answering.'
                        : (audioBlob
                            ? 'Review your recording and submit.'
                            : (isPart3Conversational
                                ? 'Follow each question in sequence and answer naturally as a conversation.'
                                : 'Press record and answer the prompt.'))}
                </p>
            </div>
        </div>
    );
}
