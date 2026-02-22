import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/shared/api/client';
import './Manage.css';
import { useNotification } from '@/shared/context/NotificationContext';

export default function GradingInterface() {
    const { showNotification } = useNotification();
    const { id } = useParams();
    const navigate = useNavigate();
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [grades, setGrades] = useState({}); // { [taskId]: { score: '', feedback: '' } }
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchSubmission();
    }, [id]);

    const fetchSubmission = async () => {
        try {
            const res = await api.getSubmissionById(id);
            if (res.success) {
                setSubmission(res.data);
                // Initialize grades state if existing scores present
                const initialGrades = {};
                res.data.writing_answers.forEach(ans => {
                    // Check if there's already a score for this task (if re-grading)
                    const existingScore = res.data.scores?.find(s => s.task_id === ans.task_id);
                    initialGrades[ans.task_id] = {
                        score: existingScore?.score || '',
                        feedback: existingScore?.feedback || ''
                    };
                });
                setGrades(initialGrades);
            }
        } catch (err) {
            setError('Failed to load submission');
        } finally {
            setLoading(false);
        }
    };

    const handleGradeChange = (taskId, field, value) => {
        setGrades(prev => ({
            ...prev,
            [taskId]: {
                ...prev[taskId],
                [field]: value
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const scoresPayload = submission.writing_answers.map(ans => ({
            task_id: ans.task_id,
            score: parseFloat(grades[ans.task_id]?.score || 0),
            feedback: grades[ans.task_id]?.feedback || ''
        }));

        try {
            const res = await api.scoreSubmission(id, { scores: scoresPayload });
            if (res) {
                showNotification('Grading submitted successfully!', 'success');
                navigate('/grading');
            }
        } catch (err) {
            console.error(err);
            showNotification('Failed to submit grading', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <p className="muted">Loading...</p>;
    if (error) return <div className="manage-container"><p className="form-error">{error}</p></div>;
    if (!submission) return <div className="manage-container"><p className="muted">Bài nộp không tồn tại</p></div>;

    return (
        <div className="manage-container" style={{ maxWidth: '900px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <button onClick={() => navigate('/grading')} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    ← Quay lại danh sách
                </button>
            </div>

            <div style={{ marginBottom: '3rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#6366F1' }}>Đánh giá bài nộp</h1>
                <div className="item-meta" style={{ fontSize: '1rem' }}>
                    Học viên: <strong>{submission.student_name}</strong> | Ngày nộp: {new Date(submission.submitted_at).toLocaleString()}
                </div>
                {submission.score !== undefined && submission.score !== null && (
                    <div style={{ fontWeight: 800, color: '#6366F1', marginTop: '1.25rem', fontSize: '1.5rem', background: '#EEF2FF', display: 'inline-block', padding: '0.5rem 1.5rem', borderRadius: '1rem', border: '1px solid #E0E7FF' }}>
                        Điểm tổng: {submission.score}
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="manage-form">
                {submission.writing_answers.map((answer, index) => (
                    <div key={answer.task_id || index} style={{ marginBottom: '4rem' }}>
                        <div className="question-group-block">
                            <div className="group-header" style={{ cursor: 'default' }}>
                                <div className="group-title">
                                    {answer.task_title || `Task ${index + 1}`}
                                </div>
                                <span className="item-meta">{answer.word_count} từ</span>
                            </div>

                            {/* Task Prompt and Image */}
                            {(answer.task_prompt || answer.task_image) && (
                                <div style={{ padding: '2rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    {answer.task_image && (
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Task Image / Chart
                                            </h4>
                                            <img
                                                src={answer.task_image}
                                                alt="Task visual"
                                                style={{
                                                    maxWidth: '100%',
                                                    height: 'auto',
                                                    borderRadius: '8px',
                                                    border: '2px solid #e2e8f0',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                                }}
                                            />
                                        </div>
                                    )}
                                    {answer.task_prompt && (
                                        <div>
                                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Task Prompt
                                            </h4>
                                            <div style={{
                                                whiteSpace: 'pre-wrap',
                                                lineHeight: '1.6',
                                                fontSize: '0.95rem',
                                                color: '#475569',
                                                fontStyle: 'italic'
                                            }}>
                                                {answer.task_prompt}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Student Answer */}
                            <div className="group-content" style={{ padding: '2rem' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Student's Answer
                                </h4>
                                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '1.1rem', color: '#1e293b' }}>
                                    {answer.answer_text}
                                </div>
                            </div>
                        </div>

                        <div className="grading-box" style={{ background: '#EEF2FF', padding: '2rem', borderRadius: '1.5rem', border: '1px solid #E0E7FF', marginTop: '1.5rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#6366F1', fontWeight: 800 }}>Chấm điểm {answer.task_title || `Task ${index + 1}`}</h3>

                            <div className="form-row">
                                <label>Band Score (0-9)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="9"
                                    step="0.5"
                                    value={grades[answer.task_id]?.score || ''}
                                    onChange={e => handleGradeChange(answer.task_id, 'score', e.target.value)}
                                    required
                                    style={{ width: '120px' }}
                                />
                            </div>

                            <div className="form-row">
                                <label>Nhận xét (Feedback)</label>
                                <textarea
                                    value={grades[answer.task_id]?.feedback || ''}
                                    onChange={e => handleGradeChange(answer.task_id, 'feedback', e.target.value)}
                                    rows="5"
                                    placeholder="Nhập nhận xét chi tiết cho học viên..."
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <div className="form-actions" style={{ marginTop: '3rem' }}>
                    <button
                        type="submit"
                        className="btn-manage-add"
                        disabled={submitting}
                        style={{ width: '100%', padding: '1.5rem', fontSize: '1.2rem', fontWeight: 800, justifyContent: 'center' }}
                    >
                        {submitting ? 'Đang gửi...' : 'Hoàn tất chấm điểm'}
                    </button>
                </div>
            </form>
        </div>
    );
}
