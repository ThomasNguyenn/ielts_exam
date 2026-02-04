import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function GradingInterface() {
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
            if (res.success) {
                alert('Grading submitted successfully!');
                navigate('/grading');
            }
        } catch (err) {
            alert('Failed to submit grading');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!submission) return <div>Submission not found</div>;

    return (
        <div className="grading-interface" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <button onClick={() => navigate('/grading')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ← Back to Dashboard
                </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Grading Submission</h1>
                <div className="muted">Student: {submission.student_name}</div>
                <div className="muted">Submitted: {new Date(submission.submitted_at).toLocaleString()}</div>
            </div>

            <form onSubmit={handleSubmit}>
                {submission.writing_answers.map((answer, index) => (
                    <div key={answer.task_id || index} className="task-grading-block" style={{ marginBottom: '3rem', borderTop: index > 0 ? '1px solid #e2e8f0' : 'none', paddingTop: index > 0 ? '2rem' : 0 }}>
                        <div className="submission-content" style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{answer.task_title || `Task ${index + 1}`}</h2>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="muted" style={{ fontSize: '0.9rem' }}>Word count: {answer.word_count}</div>
                                </div>
                            </div>

                            <div className="answer-text" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '1.1rem' }}>
                                {answer.answer_text}
                            </div>
                        </div>

                        <div className="grading-form" style={{ background: '#f8fafc', padding: '2rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ marginTop: 0 }}>Grade for {answer.task_title || `Task ${index + 1}`}</h3>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Band Score (0-9)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="9"
                                    step="0.5"
                                    value={grades[answer.task_id]?.score || ''}
                                    onChange={e => handleGradeChange(answer.task_id, 'score', e.target.value)}
                                    required
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100px' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Feedback</label>
                                <textarea
                                    value={grades[answer.task_id]?.feedback || ''}
                                    onChange={e => handleGradeChange(answer.task_id, 'feedback', e.target.value)}
                                    rows="4"
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                    placeholder="Provide constructive feedback..."
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                    style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                >
                    {submitting ? 'Submitting...' : 'Submit All Grades'}
                </button>
            </form>
        </div>
    );
}
