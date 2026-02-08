import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import RecordingPhase from './RecordingPhase';
import SpeakingResultPhase from './SpeakingResultPhase';
import './Practice.css';

export default function SpeakingFlow() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [topic, setTopic] = useState(null);
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState('recording'); // 'recording', 'processing', 'result'
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!id) return;

        // Use getSpeakingById if available, otherwise filter getSpeakings
        // For now, let's just fetch all and find
        api.getSpeakings()
            .then((res) => {
                const found = res.data.find(t => t._id === id);
                if (found) setTopic(found);
                else throw new Error("Topic not found");
            })
            .catch((err) => {
                console.error(err);
                navigate('/practice');
            })
            .finally(() => setLoading(false));
    }, [id]);

    const handleRecordingComplete = async (audioBlob, extraData = {}) => {
        setPhase('processing');
        try {
            const formData = new FormData();
            formData.append('questionId', id);
            formData.append('audio', audioBlob, 'speaking-answer.webm');

            // Append extra ELSA-like metrics
            if (extraData.transcript) formData.append('transcript', extraData.transcript);
            if (extraData.duration) formData.append('duration', extraData.duration);
            if (extraData.wpm) formData.append('wpm', extraData.wpm);
            if (extraData.stats) {
                formData.append('metrics', JSON.stringify(extraData.stats));
            }

            const res = await api.submitSpeaking(formData);
            setResult(res);
            setPhase('result');
        } catch (error) {
            console.error("Submission failed:", error);
            alert("Lỗi khi xử lý âm thanh. Vui lòng thử lại.");
            setPhase('recording');
        }
    };

    if (loading) return <div className="practice-container">Đang tải chủ đề...</div>;

    return (
        <div className="practice-flow-container" style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' }}>
            <div className="practice-header">
                <button onClick={() => navigate('/speaking')} className="btn-ghost" style={{ marginBottom: '1rem' }}>
                    ← Quay lại danh sách
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
                        <h2>AI đang phân tích câu trả lời của bạn...</h2>
                        <p className="muted">Quá trình này có thể mất 5-10 giây tùy độ dài đoạn ghi âm.</p>
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
