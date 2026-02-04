import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Link } from 'react-router-dom';

export default function GradingDashboard() {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        try {
            const res = await api.getPendingSubmissions();
            if (res.success) {
                setSubmissions(res.data);
            }
        } catch (err) {
            setError('Failed to load submissions');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="grading-dashboard">
            <h2>Pending Submissions</h2>
            {submissions.length === 0 ? (
                <p className="muted">No pending submissions to grade.</p>
            ) : (
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '1rem' }}>Date</th>
                            <th style={{ padding: '1rem' }}>Student</th>
                            <th style={{ padding: '1rem' }}>Task</th>
                            <th style={{ padding: '1rem' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {submissions.map(sub => (
                            <tr key={sub._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '1rem' }}>
                                    {new Date(sub.submitted_at).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    {sub.student_name || 'Anonymous'}
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    {sub.writing_answers.length > 1 ? (
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{sub.writing_answers.length} Tasks</div>
                                            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                                {sub.writing_answers.map(a => a.task_title).join(', ')}
                                            </div>
                                        </div>
                                    ) : (
                                        sub.writing_answers[0]?.task_title || 'Untitled Task'
                                    )}
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <Link to={`/grading/${sub._id}`} className="btn btn-primary">
                                        Grade
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
