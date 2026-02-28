import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Cast,
  ChevronDown,
  Download,
  Filter,
  Inbox,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/shared/api/client';
import PaginationControls from '@/shared/components/PaginationControls';
import './GradingDashboard.css';

const PAGE_SIZE = 10;

const PDF_FONT_FAMILY = 'NotoSans';
const PDF_FONT_SOURCES = [
  { fileName: 'NotoSans-Regular.ttf', style: 'normal', url: '/fonts/NotoSans-Regular.ttf' },
  { fileName: 'NotoSans-Bold.ttf', style: 'bold', url: '/fonts/NotoSans-Bold.ttf' },
];

const SORT_OPTIONS = [
  { key: 'submitted_at', label: 'Sort by: Submission Date', sortBy: 'submitted_at', sortOrder: 'desc' },
  { key: 'student_name', label: 'Sort by: Name', sortBy: 'student_name', sortOrder: 'asc' },
  { key: 'priority', label: 'Sort by: Priority', sortBy: 'priority', sortOrder: 'asc' },
];

const TASK_TYPE_OPTIONS = [
  { value: '', label: 'All Task Types' },
  { value: 'task1', label: 'Task 1 (Academic)' },
  { value: 'task2', label: 'Task 2 (Essay)' },
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

const normalizeBand = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 2) / 2;
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
};

const formatRelativeTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

const getDueLabel = (submittedAt) => {
  const submittedDate = new Date(submittedAt);
  if (Number.isNaN(submittedDate.getTime())) return null;

  const deadline = submittedDate.getTime() + 24 * 60 * 60 * 1000;
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) return 'Overdue';

  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  return `Due in ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
};

const getInitials = (name) => {
  const fallback = 'AN';
  if (!name) return fallback;

  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

const getOverallBand = (submission) => {
  const directScore = normalizeBand(submission?.score);
  if (directScore !== null) return directScore;

  const validScores = (submission?.scores || []).filter(
    (item) => typeof item?.score === 'number' && !Number.isNaN(item.score)
  );
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

export default function GradingDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('pending');
  const [submissions, setSubmissions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [tabTotals, setTabTotals] = useState({ pending: 0, scored: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedTaskType, setSelectedTaskType] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedSortKey, setSelectedSortKey] = useState('submitted_at');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [studentOptions, setStudentOptions] = useState([]);
  const [recentlyGraded, setRecentlyGraded] = useState([]);

  const [exportingId, setExportingId] = useState(null);
  const [liveRoomLoadingId, setLiveRoomLoadingId] = useState(null);
  const latestFetchIdRef = useRef(0);
  const datePanelRef = useRef(null);

  const selectedSort = useMemo(
    () => SORT_OPTIONS.find((option) => option.key === selectedSortKey) || SORT_OPTIONS[0],
    [selectedSortKey]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedTaskType, selectedStudent, selectedSortKey, startDate, endDate]);

  useEffect(() => {
    if (!dateFilterOpen) return undefined;

    const onPointerDown = (event) => {
      if (datePanelRef.current && !datePanelRef.current.contains(event.target)) {
        setDateFilterOpen(false);
      }
    };

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setDateFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [dateFilterOpen]);

  useEffect(() => {
    let ignore = false;

    const loadStudents = async () => {
      try {
        const response = await api.getSubmissionStudents({ status: activeTab });
        if (!ignore && response?.success) {
          setStudentOptions(Array.isArray(response.data) ? response.data : []);
        }
      } catch {
        if (!ignore) {
          setStudentOptions([]);
        }
      }
    };

    loadStudents();

    return () => {
      ignore = true;
    };
  }, [activeTab]);

  useEffect(() => {
    let ignore = false;

    const loadRecentlyGraded = async () => {
      try {
        const response = await api.getSubmissions({
          status: 'scored',
          page: 1,
          limit: 3,
          sortBy: 'submitted_at',
          sortOrder: 'desc',
        });
        if (!ignore && response?.success) {
          setRecentlyGraded(Array.isArray(response.data) ? response.data : []);
        }
      } catch {
        if (!ignore) {
          setRecentlyGraded([]);
        }
      }
    };

    loadRecentlyGraded();

    return () => {
      ignore = true;
    };
  }, []);

  const fetchSubmissions = useCallback(async () => {
    const requestId = latestFetchIdRef.current + 1;
    latestFetchIdRef.current = requestId;

    setLoading(true);
    setError(null);

    try {
      const baseParams = {
        taskType: selectedTaskType || undefined,
        student: selectedStudent || undefined,
        sortBy: selectedSort.sortBy,
        sortOrder: selectedSort.sortOrder,
      };

      if (startDate && endDate) {
        baseParams.startDate = new Date(`${startDate}T00:00:00`).toISOString();
        baseParams.endDate = new Date(`${endDate}T23:59:59.999`).toISOString();
      }

      const oppositeTab = activeTab === 'pending' ? 'scored' : 'pending';

      const [currentRes, oppositeRes] = await Promise.all([
        api.getSubmissions({ ...baseParams, status: activeTab, page: currentPage, limit: PAGE_SIZE }),
        api.getSubmissions({ ...baseParams, status: oppositeTab, page: 1, limit: 1 }),
      ]);

      if (latestFetchIdRef.current !== requestId) return;

      if (!currentRes?.success) {
        throw new Error('Failed to load submissions');
      }

      const currentData = Array.isArray(currentRes.data) ? currentRes.data : [];
      const currentPagination = currentRes.pagination || null;
      const currentTotal = Number(currentPagination?.totalItems || 0);
      const oppositeTotal = Number(oppositeRes?.pagination?.totalItems || 0);

      setSubmissions(currentData);
      setPagination(currentPagination);
      setTabTotals((prev) => ({
        ...prev,
        [activeTab]: currentTotal,
        [oppositeTab]: oppositeTotal,
      }));
    } catch (fetchError) {
      if (latestFetchIdRef.current !== requestId) return;
      setSubmissions([]);
      setPagination(null);
      setError(fetchError?.message || 'Failed to load submissions');
    } finally {
      if (latestFetchIdRef.current !== requestId) return;
      setLoading(false);
    }
  }, [activeTab, currentPage, endDate, selectedSort, selectedStudent, selectedTaskType, startDate]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleExportPDF = async (submissionSummary) => {
    if (!submissionSummary?._id || exportingId === submissionSummary._id) return;

    setError(null);
    setExportingId(submissionSummary._id);

    try {
      let fullSubmission = submissionSummary;
      try {
        const detailRes = await api.getSubmissionById(submissionSummary._id);
        if (detailRes?.success && detailRes?.data) {
          fullSubmission = detailRes.data;
        }
      } catch (detailError) {
        console.warn('Failed to load full submission details for PDF export:', detailError);
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
      writeLines(`Submitted At: ${formatDateTime(fullSubmission.submitted_at)}`);
      writeLines(`Scored At: ${formatDateTime(scoredAt)}`);
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

  const handleCreateLiveRoom = async (submission) => {
    if (!submission?._id || liveRoomLoadingId === submission._id) return;

    setError(null);
    setLiveRoomLoadingId(submission._id);
    try {
      const response = await api.createWritingLiveRoom(submission._id);
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

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setDateFilterOpen(false);
  };

  return (
    <div className="grading-dashboard min-h-screen w-full bg-[#f6f6f8] text-slate-900">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 p-6 md:p-10 lg:flex-row">
        <section className="flex flex-1 flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="m-0 text-3xl font-bold tracking-tight text-slate-900">Assignment Management</h1>
            <p className="m-0 text-slate-500">Review, grade, and track student submissions for IELTS Task 1 &amp; 2.</p>
          </header>

          <div className="border-b border-slate-200">
            <div className="flex gap-8">
              <button
                type="button"
                className={`group flex items-center gap-2 border-b-[3px] bg-transparent pb-3 pt-2 ${activeTab === 'pending'
                  ? 'border-[#0f49bd] text-[#0f49bd]'
                  : 'border-transparent text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700'
                  }`}
                onClick={() => setActiveTab('pending')}
              >
                <span className="text-sm font-bold">Pending</span>
                <span className="rounded-full bg-[#0f49bd]/10 px-2 py-0.5 text-xs font-bold text-[#0f49bd]">
                  {tabTotals.pending}
                </span>
              </button>
              <button
                type="button"
                className={`group flex items-center gap-2 border-b-[3px] bg-transparent pb-3 pt-2 ${activeTab === 'scored'
                  ? 'border-[#0f49bd] text-[#0f49bd]'
                  : 'border-transparent text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700'
                  }`}
                onClick={() => setActiveTab('scored')}
              >
                <span className="text-sm font-bold">Graded</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeTab === 'scored'
                  ? 'bg-[#0f49bd]/10 text-[#0f49bd]'
                  : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  }`}>
                  {tabTotals.scored}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 py-2">
            <label className="grading-dashboard__select-wrap">
              <select
                value={selectedTaskType}
                onChange={(event) => setSelectedTaskType(event.target.value)}
                className="grading-dashboard__select"
              >
                {TASK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown size={18} className="grading-dashboard__select-icon" aria-hidden="true" />
            </label>

            <label className="grading-dashboard__select-wrap">
              <select
                value={selectedStudent}
                onChange={(event) => setSelectedStudent(event.target.value)}
                className="grading-dashboard__select"
              >
                <option value="">All Students</option>
                {studentOptions.map((student) => (
                  <option key={student.value} value={student.value}>{student.label}</option>
                ))}
              </select>
              <ChevronDown size={18} className="grading-dashboard__select-icon" aria-hidden="true" />
            </label>

            <label className="grading-dashboard__select-wrap">
              <select
                value={selectedSortKey}
                onChange={(event) => setSelectedSortKey(event.target.value)}
                className="grading-dashboard__select"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
              <ChevronDown size={18} className="grading-dashboard__select-icon" aria-hidden="true" />
            </label>

            <div className="relative ml-auto" ref={datePanelRef}>
              <button
                type="button"
                className={`grading-dashboard__filter-button ${dateFilterOpen || (startDate && endDate) ? 'grading-dashboard__filter-button--active' : ''}`}
                onClick={() => setDateFilterOpen((previous) => !previous)}
                aria-expanded={dateFilterOpen}
                aria-controls="grading-date-filter-panel"
              >
                <Filter size={18} aria-hidden="true" />
              </button>

              {dateFilterOpen && (
                <div id="grading-date-filter-panel" className="grading-dashboard__date-panel" role="dialog" aria-label="Date range filter">
                  <div className="grading-dashboard__date-field">
                    <span className="grading-dashboard__date-label">Start date</span>
                    <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </div>
                  <div className="grading-dashboard__date-field">
                    <span className="grading-dashboard__date-label">End date</span>
                    <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </div>
                  <div className="grading-dashboard__date-actions">
                    <button type="button" className="grading-dashboard__date-btn" onClick={clearDateFilter}>Clear</button>
                    <button type="button" className="grading-dashboard__date-btn grading-dashboard__date-btn--primary" onClick={() => setDateFilterOpen(false)}>Apply</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="grading-dashboard__spinner" aria-label="Loading submissions" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Inbox size={44} className="text-slate-300" aria-hidden="true" />
              <h3 className="m-0 text-lg font-bold text-slate-900">No submissions found</h3>
              <p className="m-0 text-sm text-slate-500">There are no submissions matching your current filters.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {submissions.map((submission) => {
                const tasks = Array.isArray(submission.writing_answers) ? submission.writing_answers : [];
                const firstTask = tasks[0] || null;
                const taskLabel = tasks.length > 1
                  ? `${tasks.length} Tasks Submission`
                  : (firstTask?.task_title || 'Untitled task');

                const wordCount = firstTask?.word_count ?? (firstTask?.answer_text || '').split(/\s+/).filter(Boolean).length;
                const aiFastBand = normalizeBand(submission?.ai_fast_result?.band_score);
                const fallbackBand = firstTask ? normalizeBand(getAiResultForTask(submission, firstTask.task_id)?.band_score) : null;
                const aiPrelimBand = aiFastBand ?? fallbackBand;
                const teacherBand = getOverallBand(submission);
                const statusLabel = activeTab === 'pending' ? `Submitted ${formatRelativeTime(submission.submitted_at)}` : `Graded ${formatRelativeTime(submission.submitted_at)}`;
                const dueLabel = activeTab === 'pending' ? getDueLabel(submission.submitted_at) : null;

                return (
                  <article key={submission._id} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-[#0f49bd]/30 hover:shadow-md">
                    <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="flex size-12 items-center justify-center rounded-full bg-[#0f49bd]/10 text-lg font-bold text-[#0f49bd]">
                            {getInitials(submission.student_name)}
                          </div>
                        </div>
                        <div>
                          <h3 className="m-0 text-lg font-bold leading-tight text-slate-900 transition-colors group-hover:text-[#0f49bd]">
                            {submission.student_name || 'Anonymous'}
                          </h3>
                          <p className="m-0 mt-1 line-clamp-1 text-sm text-slate-500">{taskLabel}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${activeTab === 'pending'
                          ? 'border-orange-100 bg-orange-50 text-orange-700'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                          }`}>
                          <span className={`size-1.5 rounded-full ${activeTab === 'pending' ? 'bg-orange-500' : 'bg-slate-400'}`} />
                          {statusLabel}
                        </span>
                        {dueLabel && (
                          <span className="text-xs font-medium text-slate-400">{dueLabel}</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:flex-row">
                      <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                        {aiPrelimBand !== null && (
                          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                            <Bot size={16} className="text-purple-600" aria-hidden="true" />
                            <span className="text-xs font-semibold text-slate-700">
                              AI Prelim: <span className="text-purple-700">{aiPrelimBand}</span>
                            </span>
                          </div>
                        )}
                        {tasks.length === 1 && (
                          <span className="text-xs font-medium text-slate-400">Word count: {wordCount || 0}</span>
                        )}
                        {activeTab === 'scored' && teacherBand !== null && (
                          <span className="rounded-lg border border-green-100 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                            Final band: {teacherBand}
                          </span>
                        )}
                      </div>

                      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleCreateLiveRoom(submission)}
                          disabled={liveRoomLoadingId === submission._id}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 sm:flex-none"
                        >
                          <Cast size={16} className="text-[#0f49bd]" aria-hidden="true" />
                          <span>{liveRoomLoadingId === submission._id ? 'Starting...' : 'Live Room'}</span>
                        </button>

                        {activeTab === 'scored' && (
                          <button
                            type="button"
                            onClick={() => handleExportPDF(submission)}
                            disabled={exportingId === submission._id}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 sm:flex-none"
                          >
                            <Download size={16} className="text-red-500" aria-hidden="true" />
                            <span>{exportingId === submission._id ? 'Exporting...' : 'PDF'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => navigate(`/grading/${submission._id}`)}
                          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all sm:flex-none ${activeTab === 'pending'
                            ? 'bg-[#0f49bd] shadow-[#0f49bd]/30 hover:bg-[#0d3ea3]'
                            : 'bg-slate-800 shadow-slate-800/30 hover:bg-slate-900'
                            }`}
                        >
                          <span>{activeTab === 'pending' ? 'Grade Now' : 'View Grade'}</span>
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && submissions.length > 0 && (
            <div className="pb-8">
              <PaginationControls
                pagination={pagination}
                onPageChange={setCurrentPage}
                loading={loading}
                itemLabel="submissions"
              />
            </div>
          )}
        </section>

        <aside className="grading-dashboard__sidebar flex w-full flex-col gap-6 lg:w-80">
          <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="m-0 text-base font-bold text-slate-900">Your Performance</h3>
              <TrendingUp size={18} className="text-slate-400" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <span className="text-sm font-medium text-slate-500">Weekly Goal</span>
                <span className="text-lg font-bold text-slate-900">15<span className="text-sm font-normal text-slate-400">/20</span></span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div className="h-2 w-[75%] rounded-full bg-[#0f49bd]" />
              </div>
              <p className="m-0 mt-1 text-xs text-slate-400">5 more to reach your goal!</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-500">Avg. Turnaround Time</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">4.5h</span>
                <span className="inline-flex items-center gap-1 rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-600">
                  <TrendingDown size={12} aria-hidden="true" /> 12%
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-base font-bold text-slate-900">Recently Graded</h3>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('scored');
                  setCurrentPage(1);
                }}
                className="bg-transparent p-0 text-xs font-medium text-[#0f49bd] hover:underline"
              >
                View All
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {recentlyGraded.length === 0 ? (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
                  No graded submissions yet.
                </div>
              ) : recentlyGraded.map((submission) => {
                const band = getOverallBand(submission);
                const firstTask = submission?.writing_answers?.[0];
                const taskLabel = firstTask?.task_title?.toLowerCase().includes('task 1') ? 'Task 1' : (firstTask?.task_title?.toLowerCase().includes('task 2') ? 'Task 2' : 'Submission');

                return (
                  <button
                    key={submission._id}
                    type="button"
                    onClick={() => navigate(`/grading/${submission._id}`)}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-transparent bg-transparent p-0 text-left transition-colors hover:border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        {getInitials(submission.student_name)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-[#0f49bd]">{submission.student_name || 'Anonymous'}</span>
                        <span className="text-xs text-slate-500">{taskLabel} - {formatRelativeTime(submission.submitted_at)}</span>
                      </div>
                    </div>
                    <span className={`rounded border px-2 py-0.5 text-xs font-bold ${band !== null && band >= 7 ? 'border-green-100 bg-green-50 text-green-700' : 'border-yellow-100 bg-yellow-50 text-yellow-700'}`}>
                      {band ?? 'N/A'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-[#0f49bd]/10 bg-[#0f49bd]/5 p-5">
            <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-[#0f49bd]/10" />
            <div className="relative z-10">
              <h4 className="m-0 mb-1 text-sm font-bold text-[#0f49bd]">New Rubric Update</h4>
              <p className="m-0 mb-3 text-xs text-slate-600">The IELTS writing evaluation criteria has been slightly updated for Task 1.</p>
              <button type="button" className="inline-flex items-center gap-1 bg-transparent p-0 text-xs font-bold text-[#0f49bd] hover:text-[#0d3ea3]">
                Read Guidelines <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
