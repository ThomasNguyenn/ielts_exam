import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/shared/api/client';
import './Manage.css';
import { Link, useNavigate } from 'react-router-dom';
import PaginationControls from '@/shared/components/PaginationControls';

const PDF_FONT_FAMILY = 'NotoSans';
const PDF_FONT_SOURCES = [
    { fileName: 'NotoSans-Regular.ttf', style: 'normal', url: '/fonts/NotoSans-Regular.ttf' },
    { fileName: 'NotoSans-Bold.ttf', style: 'bold', url: '/fonts/NotoSans-Bold.ttf' },
];

let pdfFontCachePromise = null;

const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }

    return btoa(binary);
};

const loadPdfFontData = async () => {
    if (!pdfFontCachePromise) {
        pdfFontCachePromise = Promise.all(
            PDF_FONT_SOURCES.map(async (font) => {
                const response = await fetch(font.url);
                if (!response.ok) {
                    throw new Error(`Font fetch failed: ${font.url}`);
                }
                const buffer = await response.arrayBuffer();
                return {
                    ...font,
                    base64: arrayBufferToBase64(buffer),
                };
            })
        );
    }

    return pdfFontCachePromise;
};

const applyUnicodePdfFont = async (doc) => {
    const fonts = await loadPdfFontData();
    fonts.forEach((font) => {
        doc.addFileToVFS(font.fileName, font.base64);
        doc.addFont(font.fileName, PDF_FONT_FAMILY, font.style);
    });
    doc.setFont(PDF_FONT_FAMILY, 'normal');
};

export default function GradingDashboard() {
    const navigate = useNavigate();
    const PAGE_SIZE = 10;
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'scored'
    const [submissions, setSubmissions] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [exportingId, setExportingId] = useState(null);
    const [liveRoomLoadingId, setLiveRoomLoadingId] = useState(null);
    const latestFetchIdRef = useRef(0);
    const previousFiltersRef = useRef({ activeTab: 'pending', selectedDate: '' });

    const fetchSubmissions = useCallback(async (status, date, page = 1) => {
        const requestId = latestFetchIdRef.current + 1;
        latestFetchIdRef.current = requestId;
        setLoading(true);
        setError(null);
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
            if (latestFetchIdRef.current !== requestId) return;
            if (res.success) {
                setSubmissions(res.data);
                setPagination(res.pagination || null);
                setError(null);
            }
        } catch (err) {
            if (latestFetchIdRef.current !== requestId) return;
            setError('Failed to load submissions');
        } finally {
            if (latestFetchIdRef.current !== requestId) return;
            setLoading(false);
        }
    }, [PAGE_SIZE]);

    useEffect(() => {
        const filtersChanged =
            previousFiltersRef.current.activeTab !== activeTab
            || previousFiltersRef.current.selectedDate !== selectedDate;

        if (filtersChanged && currentPage !== 1) {
            previousFiltersRef.current = { activeTab, selectedDate };
            setCurrentPage(1);
            return;
        }

        previousFiltersRef.current = { activeTab, selectedDate };
        fetchSubmissions(activeTab, selectedDate, currentPage);
    }, [activeTab, selectedDate, currentPage, fetchSubmissions]);

    const formatDate = (value) => {
        if (!value) return 'N/A';
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
    };

    const normalizeBand = (value) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return null;
        return Math.round(value * 2) / 2;
    };

    const getOverallBand = (submission) => {
        const directScore = normalizeBand(submission?.score);
        if (directScore !== null) return directScore;

        const validScores = (submission?.scores || []).filter((item) => typeof item?.score === 'number' && !Number.isNaN(item.score));
        if (validScores.length === 0) return null;

        if (validScores.length === 2) {
            const task1 = validScores[0].score;
            const task2 = validScores[1].score;
            return normalizeBand((task2 * 2 + task1) / 3);
        }

        const avg = validScores.reduce((sum, item) => sum + item.score, 0) / validScores.length;
        return normalizeBand(avg);
    };

    const getAiResultForTask = (submission, taskId) => {
        const aiResult = submission?.ai_result;
        if (!aiResult || typeof aiResult !== 'object') return null;

        if (Array.isArray(aiResult.tasks)) {
            const taskNode = aiResult.tasks.find((task) => String(task?.task_id) === String(taskId));
            return taskNode?.result || null;
        }

        if ((submission?.writing_answers || []).length === 1) {
            return aiResult;
        }

        return null;
    };

    const toSafeFilename = (name) => {
        const base = String(name || 'Student')
            .trim()
            .replace(/[^a-zA-Z0-9 _-]/g, '')
            .replace(/\s+/g, '_')
            .slice(0, 40);
        return base || 'Student';
    };

    const handleExportPDF = async (sub) => {
        if (!sub?._id || exportingId === sub._id) return;

        setError(null);
        setExportingId(sub._id);

        try {
            let fullSubmission = sub;
            try {
                const detailRes = await api.getSubmissionById(sub._id);
                if (detailRes?.success && detailRes?.data) {
                    fullSubmission = detailRes.data;
                }
            } catch (detailErr) {
                console.warn('Failed to load full submission details for PDF export:', detailErr);
            }

            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            await applyUnicodePdfFont(doc);
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 16;
            const contentWidth = pageWidth - margin * 2;
            const bottomMargin = 14;
            let y = margin;

            const ensureSpace = (requiredHeight = 6) => {
                if (y + requiredHeight <= pageHeight - bottomMargin) return;
                doc.addPage();
                y = margin;
            };

            const writeLines = (text, opts = {}) => {
                const {
                    fontSize = 10,
                    bold = false,
                    color = [40, 40, 40],
                    lineHeight = 4.8,
                    indent = 0,
                    width = contentWidth,
                } = opts;

                const raw = typeof text === 'string' ? text.trim() : String(text ?? '').trim();
                const value = raw || 'N/A';
                const lines = doc.splitTextToSize(value, Math.max(width - indent, 20));
                doc.setFontSize(fontSize);
                doc.setFont(undefined, bold ? 'bold' : 'normal');
                doc.setTextColor(color[0], color[1], color[2]);

                lines.forEach((line) => {
                    ensureSpace(lineHeight);
                    doc.text(line, margin + indent, y);
                    y += lineHeight;
                });
            };

            const sectionTitle = (title) => {
                ensureSpace(10);
                doc.setFontSize(13);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(20, 20, 20);
                doc.text(title, margin, y);
                y += 5;
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.3);
                doc.line(margin, y, pageWidth - margin, y);
                y += 4;
            };

            const getScoreForTask = (taskId) => {
                const teacherScore = (fullSubmission.scores || []).find((item) => String(item?.task_id) === String(taskId));
                const direct = normalizeBand(teacherScore?.score);
                if (direct !== null) return direct;
                const aiTask = getAiResultForTask(fullSubmission, taskId);
                return normalizeBand(aiTask?.band_score);
            };

            const writingAnswers = fullSubmission.writing_answers || [];
            const scoredBy = fullSubmission?.scores?.find((score) => score?.scored_by)?.scored_by || 'Teacher';
            const scoredAt = fullSubmission?.scores?.find((score) => score?.scored_at)?.scored_at || fullSubmission?.updatedAt;
            const overallBand = getOverallBand(fullSubmission);
            const generatedAt = new Date().toLocaleString();

            doc.setFontSize(18);
            doc.setTextColor(20, 20, 20);
            doc.setFont(undefined, 'bold');
            doc.text('Writing Grading Report', pageWidth / 2, y, { align: 'center' });
            y += 8;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated: ${generatedAt}`, pageWidth / 2, y, { align: 'center' });
            y += 8;

            sectionTitle('Submission Summary');
            writeLines(`Student: ${fullSubmission.student_name || 'Anonymous'}`);
            writeLines(`Email: ${fullSubmission.student_email || 'N/A'}`);
            writeLines(`Submission ID: ${fullSubmission._id || 'N/A'}`);
            writeLines(`Submitted At: ${formatDate(fullSubmission.submitted_at)}`);
            writeLines(`Scored At: ${formatDate(scoredAt)}`);
            writeLines(`Scored By: ${fullSubmission.is_ai_graded ? 'AI Scoring' : scoredBy}`);
            writeLines(`Status: ${fullSubmission.status || 'N/A'}`);
            writeLines(`Overall Band: ${overallBand !== null ? overallBand : 'N/A'}`, { bold: true, color: [180, 40, 40] });
            y += 2;

            sectionTitle('Task Scores');
            if (writingAnswers.length === 0) {
                writeLines('No writing task answers found.');
            } else {
                writingAnswers.forEach((answer, index) => {
                    const score = getScoreForTask(answer.task_id);
                    const wordCount = answer.word_count ?? (answer.answer_text || '').split(/\s+/).filter(Boolean).length;
                    writeLines(`${index + 1}. ${answer.task_title || `Task ${index + 1}`}`, { bold: true });
                    writeLines(`Band: ${score !== null ? score : 'N/A'} | Words: ${wordCount}`);
                    const taskScore = (fullSubmission.scores || []).find((item) => String(item?.task_id) === String(answer.task_id));
                    if (taskScore?.feedback) {
                        writeLines(`Feedback: ${taskScore.feedback}`, { fontSize: 9.6, color: [70, 70, 70], indent: 2 });
                    }
                    y += 1;
                });
            }

            writingAnswers.forEach((answer, index) => {
                const taskScore = (fullSubmission.scores || []).find((item) => String(item?.task_id) === String(answer.task_id));
                const aiTaskResult = getAiResultForTask(fullSubmission, answer.task_id);
                const band = getScoreForTask(answer.task_id);

                y += 2;
                sectionTitle(`Task ${index + 1}: ${answer.task_title || 'Untitled Task'}`);
                writeLines(`Band: ${band !== null ? band : 'N/A'} | Word Count: ${answer.word_count ?? 'N/A'}`, { bold: true });

                writeLines('Prompt', { bold: true, color: [25, 25, 25] });
                writeLines(answer.task_prompt || 'No prompt available for this task.', { fontSize: 9.8, color: [55, 55, 55], indent: 2 });
                y += 1;

                writeLines('Student Answer', { bold: true, color: [25, 25, 25] });
                writeLines(answer.answer_text || 'No answer text.', { fontSize: 9.8, color: [30, 30, 30], indent: 2, lineHeight: 4.6 });
                y += 1;

                if (taskScore?.feedback) {
                    writeLines('Teacher Feedback', { bold: true, color: [25, 25, 25] });
                    writeLines(taskScore.feedback, { fontSize: 9.8, color: [55, 55, 55], indent: 2 });
                    y += 1;
                }

                if (aiTaskResult?.criteria_scores && typeof aiTaskResult.criteria_scores === 'object') {
                    writeLines('AI Criteria Scores', { bold: true, color: [25, 25, 25] });
                    Object.entries(aiTaskResult.criteria_scores).forEach(([key, value]) => {
                        const label = key.replace(/_/g, ' ');
                        writeLines(`${label}: ${value}`, { fontSize: 9.6, color: [60, 60, 60], indent: 2 });
                    });
                    y += 1;
                }

                if (Array.isArray(aiTaskResult?.feedback) && aiTaskResult.feedback.length > 0) {
                    writeLines('AI Feedback', { bold: true, color: [25, 25, 25] });
                    aiTaskResult.feedback.forEach((point, feedbackIndex) => {
                        writeLines(`${feedbackIndex + 1}. ${point}`, { fontSize: 9.6, color: [60, 60, 60], indent: 2 });
                    });
                }
            });

            const totalPages = doc.getNumberOfPages();
            for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
                doc.setPage(pageNo);
                doc.setFontSize(8.5);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(130, 130, 130);
                doc.text(`Page ${pageNo} / ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
            }

            const student = toSafeFilename(fullSubmission.student_name);
            const dateStamp = new Date().toISOString().slice(0, 10);
            doc.save(`GradingReport_${student}_${dateStamp}.pdf`);
        } catch (pdfError) {
            console.error('PDF export failed:', pdfError);
            setError('Failed to export PDF. Please try again.');
        } finally {
            setExportingId(null);
        }
    };

    const handleCreateLiveRoom = async (sub) => {
        if (!sub?._id || liveRoomLoadingId === sub._id) return;

        setError(null);
        setLiveRoomLoadingId(sub._id);
        try {
            const response = await api.createWritingLiveRoom(sub._id);
            const sharedRoute = response?.data?.sharedRoute || '';
            const roomCode = response?.data?.roomCode || '';
            if (!sharedRoute) {
                throw new Error('Failed to create live room');
            }

            if (typeof window !== 'undefined' && navigator?.clipboard?.writeText) {
                const shareUrl = `${window.location.origin}${sharedRoute}`;
                await navigator.clipboard.writeText(`${roomCode} | ${shareUrl}`);
            }

            navigate(sharedRoute);
        } catch (liveError) {
            setError(liveError?.message || 'Failed to create live room');
        } finally {
            setLiveRoomLoadingId(null);
        }
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
                        borderBottom: activeTab === 'pending' ? '3px solid #6366F1' : '3px solid transparent',
                        fontWeight: 800,
                        background: 'none',
                        cursor: 'pointer',
                        color: activeTab === 'pending' ? '#6366F1' : '#64748b',
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
                        borderBottom: activeTab === 'scored' ? '3px solid #6366F1' : '3px solid transparent',
                        fontWeight: 800,
                        background: 'none',
                        cursor: 'pointer',
                        color: activeTab === 'scored' ? '#6366F1' : '#64748b',
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
            {error && (
                <div className="form-error" style={{ marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

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
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleCreateLiveRoom(sub)}
                                                disabled={liveRoomLoadingId === sub._id}
                                                style={{ fontWeight: 700 }}
                                            >
                                                {liveRoomLoadingId === sub._id ? 'Creating...' : 'Live Room'}
                                            </button>
                                            {activeTab === 'pending' ? (
                                                <Link to={`/grading/${sub._id}`} className="btn-manage-add" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>Chấm điểm</Link>
                                            ) : (
                                                <>
                                                    <Link to={`/grading/${sub._id}`} className="btn btn-ghost btn-sm" style={{ fontWeight: 700 }}>Xem điểm</Link>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleExportPDF(sub)}
                                                        disabled={exportingId === sub._id}
                                                        style={{ color: '#6366F1', fontWeight: 800, opacity: exportingId === sub._id ? 0.65 : 1 }}
                                                    >
                                                        {exportingId === sub._id ? 'Exporting...' : 'PDF'}
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
