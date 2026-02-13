import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import './Manage.css';
import { Link } from 'react-router-dom';
import PaginationControls from '../../components/PaginationControls';

export default function GradingDashboard() {
    const PAGE_SIZE = 10;
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'scored'
    const [submissions, setSubmissions] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState('');

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, selectedDate]);

    useEffect(() => {
        fetchSubmissions(activeTab, selectedDate, currentPage);
    }, [activeTab, selectedDate, currentPage]);

    const fetchSubmissions = async (status, date, page = 1) => {
        setLoading(true);
        try {
            let params = { status, page, limit: PAGE_SIZE };
            if (date) {
                // Create local date range for the selected day
                const start = new Date(date + 'T00:00:00');
                const end = new Date(date + 'T23:59:59.999');
                params.startDate = start.toISOString();
                params.endDate = end.toISOString();
            }

            const res = await api.getSubmissions(params);
            if (res.success) {
                setSubmissions(res.data);
                setPagination(res.pagination || null);
            }
        } catch (err) {
            setError('Failed to load submissions');
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async (sub) => {
        const { jsPDF } = await import('jspdf');
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
        doc.line(20, y - 2, 190, y - 2);

        sub.writing_answers.forEach((ans, i) => {
            const scoreData = (sub.scores || []).find(s => s.task_id === ans.task_id);

            if (y > 270) { doc.addPage(); y = 20; }

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Task ${i + 1}: ${ans.task_title || 'Untitled'}`, 20, y);
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
                const avg = validScores.reduce((a, b) => a + b.score, 0) / validScores.length;
                const final = Math.round(avg * 2) / 2;

                if (y > 270) { doc.addPage(); y = 20; }
                y += 10;
                doc.setFontSize(14);
                doc.setTextColor(0);
                doc.setFont(undefined, 'bold');
                doc.text(`Overall Band Score: ${final}`, 20, y);
            }
        }

        doc.save(`Grading_${sub.student_name || 'Student'}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const filteredSubmissions = submissions.filter(sub => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        const studentName = (sub.student_name || '').toLowerCase();
        const taskTitles = sub.writing_answers.map(a => (a.task_title || '').toLowerCase()).join(' ');
        return studentName.includes(query) || taskTitles.includes(query);
    });

    return (
        <div className="manage-container">
            {/* <h1>Bảng điều khiển chấm bài</h1> */}

            <div className="manage-tabs" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                <button
                    className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                    style={{
                        padding: '1rem 1.5rem',
                        borderBottom: activeTab === 'pending' ? '3px solid #d03939' : '3px solid transparent',
                        fontWeight: 800,
                        background: 'none',
                        cursor: 'pointer',
                        color: activeTab === 'pending' ? '#d03939' : '#64748b',
                        transition: 'all 0.2s',
                        fontSize: '0.95rem'
                    }}
                >
                    Chờ chấm điểm (Pending)
                </button>
                <button
                    className={`tab-btn ${activeTab === 'scored' ? 'active' : ''}`}
                    onClick={() => setActiveTab('scored')}
                    style={{
                        padding: '1rem 1.5rem',
                        borderBottom: activeTab === 'scored' ? '3px solid #d03939' : '3px solid transparent',
                        fontWeight: 800,
                        background: 'none',
                        cursor: 'pointer',
                        color: activeTab === 'scored' ? '#d03939' : '#64748b',
                        transition: 'all 0.2s',
                        fontSize: '0.95rem'
                    }}
                >
                    Đã chấm (Graded)
                </button>
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
                <input
                    type="search"
                    placeholder="Search by student name or task title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                    style={{ width: '300px', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}
                />
                <input 
                    type="date"
                    className="search-input"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}
                />
            </div>

            {loading ? <div>Loading...</div> : (
                <>
                    {submissions.length === 0 ? (
                        <p className="muted">Không có bài nộp nào trong danh mục này.</p>
                    ) : (
                        <div className="manage-list">
                            {filteredSubmissions.length === 0 ? (
                                <p className="muted">Không tìm thấy kết quả phù hợp.</p>
                            ) : (
                                filteredSubmissions.map(sub => (
                                    <div key={sub._id} className="list-item">
                                        <div className="item-info">
                                            <span className="item-title">{sub.student_name || 'Anonymous'}</span>
                                            <span className="item-meta">
                                                {new Date(sub.submitted_at).toLocaleDateString()} | {sub.writing_answers.length} Tasks
                                            </span>
                                            {activeTab === 'scored' && (
                                                <div style={{ marginTop: '0.25rem' }}>
                                                    {sub.is_ai_graded ? (
                                                        <span className="badge" style={{ background: '#e0f2fe', color: '#0284c7', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px' }}>
                                                            AI Scoring
                                                        </span>
                                                    ) : (
                                                        <span className="badge" style={{ background: '#dcfce7', color: '#166534', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px' }}>
                                                            Graded by: {sub.scores?.[0]?.scored_by || 'Teacher'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                                {sub.writing_answers.map(a => a.task_title).join(', ')}
                                            </div>
                                        </div>
                                        <div className="item-actions">
                                            {activeTab === 'pending' ? (
                                                <Link to={`/grading/${sub._id}`} className="btn-manage-add" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>Chấm điểm</Link>
                                            ) : (
                                                <>
                                                    <Link to={`/grading/${sub._id}`} className="btn btn-ghost btn-sm" style={{ fontWeight: 700 }}>Xem điểm</Link>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleExportPDF(sub)}
                                                        style={{ color: '#d03939', fontWeight: 800 }}
                                                    >
                                                        PDF
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                    <PaginationControls
                        pagination={pagination}
                        onPageChange={setCurrentPage}
                        loading={loading}
                        itemLabel="submissions"
                    />
                </>
            )}
        </div>
    );
}
