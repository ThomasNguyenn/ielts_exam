import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';

export default function GradingDashboard() {
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'scored'
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSubmissions(activeTab);
    }, [activeTab]);

    const fetchSubmissions = async (status) => {
        setLoading(true);
        try {
            const res = await api.getSubmissions(status);
            if (res.success) {
                setSubmissions(res.data);
            }
        } catch (err) {
            setError('Failed to load submissions');
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = (sub) => {
        const doc = new jsPDF();
        let y = 20;

        doc.setFontSize(18);
        doc.text("Writing Submission Report", 105, y, { align: 'center' });
        y += 15;

        doc.setFontSize(12);
        doc.text(`Student: ${sub.student_name || 'Anonymous'}`, 20, y);
        y += 10;
        doc.text(`Date: ${new Date(sub.submitted_at).toLocaleDateString()}`, 20, y);
        y += 15;

        // Writing Tasks
        doc.setFontSize(14);
        doc.text("Tasks & Scores", 20, y);
        y += 10;
        doc.setLineWidth(0.5);
        doc.line(20, y-2, 190, y-2);

        sub.writing_answers.forEach((ans, i) => {
             const scoreData = (sub.scores || []).find(s => s.task_id === ans.task_id);
             
             if (y > 270) { doc.addPage(); y = 20; }

             doc.setFontSize(12);
             doc.setFont(undefined, 'bold');
             doc.text(`Task ${i+1}: ${ans.task_title || 'Untitled'}`, 20, y);
             doc.setFont(undefined, 'normal');
             doc.text(`Score: ${scoreData?.score ?? 'N/A'}`, 150, y);
             y += 10;

             // Answer text (simple wrap)
             const splitText = doc.splitTextToSize(ans.answer_text, 170);
             doc.setFontSize(10);
             doc.setTextColor(50);
             doc.text(splitText, 20, y);
             
             const textHeight = splitText.length * 5; // approx line height
             y += textHeight + 10;
        });

        // Overall Score (if linked attempt)
        if (sub.scores && sub.scores.length > 0) {
             const validScores = sub.scores.filter(s => typeof s.score === 'number');
             if (validScores.length > 0) {
                 const avg = validScores.reduce((a,b) => a + b.score, 0) / validScores.length;
                 const final = Math.round(avg * 2) / 2;
                 
                 if (y > 270) { doc.addPage(); y = 20; }
                 y += 10;
                 doc.setFontSize(14);
                 doc.setTextColor(0);
                 doc.setFont(undefined, 'bold');
                 doc.text(`Overall Band Score: ${final}`, 20, y);
             }
        }

        doc.save(`Grading_${sub.student_name || 'Student'}_${new Date().toISOString().slice(0,10)}.pdf`);
    };

    return (
        <div className="grading-dashboard">
            <h2>Grading Dashboard</h2>
            
            <div className="manage-tabs" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                <button 
                  className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pending')}
                  style={{ padding: '0.75rem 1.5rem', borderBottom: activeTab === 'pending' ? '2px solid #2563eb' : 'none', fontWeight: activeTab === 'pending' ? 'bold' : 'normal', background: 'none', cursor: 'pointer', color: activeTab === 'pending' ? '#2563eb' : '#6b7280' }}
                >
                  Pending (Chưa Chấm)
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'scored' ? 'active' : ''}`}
                  onClick={() => setActiveTab('scored')}
                  style={{ padding: '0.75rem 1.5rem', borderBottom: activeTab === 'scored' ? '2px solid #2563eb' : 'none', fontWeight: activeTab === 'scored' ? 'bold' : 'normal', background: 'none', cursor: 'pointer', color: activeTab === 'scored' ? '#2563eb' : '#6b7280' }}
                >
                  Graded (Đã Chấm)
                </button>
            </div>

            {loading ? <div>Loading...</div> : (
              <>
                {submissions.length === 0 ? (
                    <p className="muted">No submissions in this category.</p>
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
                                        {activeTab === 'pending' ? (
                                           <Link to={`/grading/${sub._id}`} className="btn btn-primary">
                                               Grade
                                           </Link>
                                        ) : (
                                           <div style={{ display: 'flex', gap: '0.5rem' }}>
                                              <Link to={`/grading/${sub._id}`} className="btn btn-secondary" style={{ fontSize: '0.875rem' }}>
                                                  View Score
                                              </Link>
                                              <button 
                                                className="btn btn-outline" 
                                                onClick={() => handleExportPDF(sub)}
                                                style={{ fontSize: '0.875rem', borderColor: '#ef4444', color: '#ef4444' }}
                                                title="Export to PDF"
                                              >
                                                Export PDF
                                              </button>
                                           </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
              </>
            )}
        </div>
    );
}
