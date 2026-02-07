import React, { useState, useRef, useEffect } from 'react';

export default function RecordingPhase({ topic, onComplete }) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    // Visualizer refs
    const canvasRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const sourceRef = useRef(null);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Visualizer Setup
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            sourceRef.current = source;
            visualize();

            // Recorder Setup - Let browser pick default supported mimeType
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: mimeType });
                setAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop());
                
                // Stop visualizer
                cancelAnimationFrame(animationFrameRef.current);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Mic access denied:", err);
            alert("Vui lòng cấp quyền truy cập Mic để ghi âm.");
        }
    };

    const visualize = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current.getByteFrequencyData(dataArray);
            
            canvasCtx.fillStyle = '#f8fafc';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for(let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        draw();
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="recording-phase" style={{ textAlign: 'center' }}>
            <div className="topic-display" style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
                <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Yêu cầu bài nói:</h3>
                <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#334155', fontWeight: 500 }}>{topic.prompt}</p>
                {topic.sub_questions?.length > 0 && (
                    <ul style={{ textAlign: 'left', marginTop: '1rem', color: '#64748b' }}>
                        {topic.sub_questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                )}
            </div>

            <div className="recorder-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ position: 'relative', height: '60px', width: '100%', maxWidth: '300px', marginBottom: '1rem' }}>
                    {isRecording && <canvas ref={canvasRef} width="300" height="60" style={{ width: '100%', height: '100%', borderRadius: '8px' }} />}
                    {!isRecording && !audioBlob && <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Sóng âm sẽ hiện ở đây khi ghi âm</div>}
                </div>

                <div className="timer" style={{ fontSize: '2.5rem', fontWeight: 800, color: isRecording ? '#ef4444' : '#1e293b', fontFamily: 'monospace' }}>
                    {formatTime(recordingTime)}
                </div>

                {!isRecording && !audioBlob && (
                    <button 
                        onClick={startRecording}
                        style={{ width: '80px', height: '80px', borderRadius: '50%', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)', transition: 'transform 0.2s' }}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                        <span style={{ fontSize: '1.5rem' }}>🎤</span>
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
                        <audio src={URL.createObjectURL(audioBlob)} controls style={{ marginBottom: '2rem', width: '100%' }} />
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button 
                                onClick={() => { setAudioBlob(null); setRecordingTime(0); }}
                                className="btn-ghost"
                                style={{ padding: '0.75rem 1.5rem', borderRadius: '8px' }}
                            >
                                Ghi âm lại
                            </button>
                            <button 
                                onClick={() => onComplete(audioBlob)}
                                className="btn-sidebar-start"
                                style={{ padding: '0.75rem 2rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                            >
                                Gửi bài AI chấm
                            </button>
                        </div>
                    </div>
                )}
                
                <p className="muted" style={{ marginTop: '1rem' }}>
                    {isRecording ? 'Đang ghi âm... Nhấn nút đỏ để dừng.' : (audioBlob ? 'Nghe lại hoặc nhấn Gửi để AI chấm bài.' : 'Nhấn vào Mic để bắt đầu trả lời.')}
                </p>
            </div>
        </div>
    );
}
