import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { api } from '@/shared/api/client';
import './AnalyticsDashboard.css';
import './EnhancedAnalytics.css';
import './ErrorAnalyticsDetailsPage.css';

const RANGE_OPTIONS = [
  { value: 'all', label: 'Toàn bộ thời gian' },
  { value: '7d', label: '7 ngày gần đây' },
  { value: '30d', label: '30 ngày gần đây' },
  { value: '90d', label: '90 ngày gần đây' },
];

const SKILL_OPTIONS = [
  { value: 'all', label: 'Tất cả kỹ năng' },
  { value: 'reading', label: 'Đọc' },
  { value: 'listening', label: 'Nghe' },
  { value: 'writing', label: 'Viết' },
  { value: 'speaking', label: 'Nói' },
];

const TASK_TYPE_OPTIONS = [
  { value: 'all', label: 'All Question Types' },
  { value: 'true_false_not_given', label: 'True / False / Not Given' },
  { value: 'yes_no_not_given', label: 'Yes / No / Not Given' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'matching_headings', label: 'Matching Headings' },
  { value: 'matching_information', label: 'Matching Information' },
  { value: 'matching_features', label: 'Matching Features' },
  { value: 'note_completion', label: 'Note Completion' },
  { value: 'summary_completion', label: 'Summary Completion' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'table_completion', label: 'Table Completion' },
  { value: 'flow_chart_completion', label: 'Flow-chart Completion' },
  { value: 'diagram_completion', label: 'Diagram Completion' },
  { value: 'map_labeling', label: 'Map Labeling' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'form_completion', label: 'Form Completion' },
  { value: 'task1', label: 'Writing Task 1' },
  { value: 'task2', label: 'Writing Task 2' },
  { value: 'part1', label: 'Speaking Part 1' },
  { value: 'part2', label: 'Speaking Part 2' },
  { value: 'part3', label: 'Speaking Part 3' },
];

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const clean = (value) => String(value || '').trim();

export default function ErrorAnalyticsDetailsPage() {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [payload, setPayload] = useState(null);
  const [isListLoading, setIsListLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersionRef = useRef(0);

  const range = searchParams.get('range') || 'all';
  const skill = searchParams.get('skill') || 'all';
  const taskType = searchParams.get('taskType') || '';
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = 20;

  const updateQuery = (patch = {}, resetPage = false) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      const normalized = String(value ?? '').trim();
      if (!normalized || normalized === 'all') next.delete(key);
      else next.set(key, normalized);
    });

    if (resetPage) next.delete('page');
    setSearchParams(next);
  };

  useEffect(() => {
    let cancelled = false;
    const requestVersion = Date.now();
    requestVersionRef.current = requestVersion;

    const fetchDetails = async () => {
      setIsListLoading(true);
      setError('');
      try {
        const params = {
          range,
          skill,
          taskType: clean(taskType) || undefined,
          page,
          limit,
        };
        const response = studentId
          ? await api.getAdminStudentAnalyticsErrorDetails(studentId, params)
          : await api.getAnalyticsErrorDetails(params);

        if (cancelled || requestVersionRef.current !== requestVersion) return;
        setPayload(response?.data || null);
      } catch (err) {
        if (cancelled || requestVersionRef.current !== requestVersion) return;
        setError(err?.message || 'Không tải được chi tiết lỗi.');
      } finally {
        if (cancelled || requestVersionRef.current !== requestVersion) return;
        setIsListLoading(false);
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [studentId, range, skill, taskType, page]);

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const pagination = payload?.pagination || {};
  const total = Number(pagination.total || 0);
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));

  const title = useMemo(() => (
    studentId ? 'Chi tiết lỗi Taxonomy (Học viên)' : 'Chi tiết lỗi Taxonomy'
  ), [studentId]);

  const navigateBackToTaxonomy = () => {
    const basePath = studentId ? `/analytics/student/${studentId}` : '/analytics';
    navigate(`${basePath}?tab=taxonomy`);
  };

  const isInitialLoading = isListLoading && !payload;

  if (isInitialLoading) {
    return <div className="analytics-loading">Đang tải chi tiết lỗi...</div>;
  }

  if (error && !payload) {
    return (
      <div className="analytics-error-card">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>Thử lại</button>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard error-details-page">
      <button type="button" className="analytics-back-btn" onClick={navigateBackToTaxonomy}>
        Quay lại
      </button>

      <div className="analytics-header">
        <h1>{title}</h1>
        <p>Liệt kê chi tiết từng lỗi: sai câu nào, thuộc bài nào, test nào và vì sao bị gán taxonomy đó.</p>
      </div>

      <div className="error-details-filter-row">
        <label className="enhanced-analytics-filter">
          <span>Khoảng thời gian</span>
          <select value={range} onChange={(e) => updateQuery({ range: e.target.value }, true)}>
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="enhanced-analytics-filter">
          <span>Kỹ năng</span>
          <select value={skill} onChange={(e) => updateQuery({ skill: e.target.value }, true)}>
            {SKILL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="enhanced-analytics-filter">
          <span>Question Type</span>
          <select
            value={taskType || 'all'}
            onChange={(e) => updateQuery({ taskType: e.target.value }, true)}
          >
            {TASK_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="error-details-meta">
        <span>Tổng lỗi: <strong>{total}</strong></span>
        <span>Trang: <strong>{page}</strong> / {totalPages}</span>
        {isListLoading ? <span className="error-details-updating">Đang cập nhật...</span> : null}
      </div>

      {error ? <div className="analytics-inline-error">{error}</div> : null}

      <div className={`error-details-list-wrap${isListLoading ? ' is-updating' : ''}`}>
        {items.length === 0 ? (
          <div className="analytics-empty">Không có lỗi phù hợp bộ lọc hiện tại.</div>
        ) : (
          <div className="error-details-list">
            {items.map((item) => {
              const snippet = clean(item?.text_snippet);
              const userAnswer = clean(item?.user_answer);
              const correctAnswer = clean(item?.correct_answer);

              return (
                <article key={item.id} className="error-details-card">
                  <header className="error-details-card-head">
                    <div className="error-details-badges">
                      <span className="error-badge skill">{clean(item.skill) || 'không_xác_định'}</span>
                      <span className="error-badge code">{clean(item.error_code) || 'UNCLASSIFIED'}</span>
                      <span className="error-badge task">{clean(item.task_type_label) || clean(item.task_type) || 'Unknown'}</span>
                    </div>
                    <div className="error-details-time">
                      <CalendarClock size={14} />
                      <span>{formatDateTime(item.logged_at)}</span>
                    </div>
                  </header>

                  <div className="error-details-context">
                    <p><FileText size={14} /> <strong>Bài:</strong> {clean(item.source_label) || '-'} | <strong>Ref:</strong> {clean(item.source_ref) || '-'} | <strong>Bản ghi:</strong> {clean(item.source_id) || '-'}</p>
                    <p><AlertTriangle size={14} /> <strong>Câu:</strong> {item.question_number ?? '-'} | <strong>Nhóm taxonomy:</strong> {clean(item.error_category) || '-'} | <strong>Kỹ năng:</strong> {clean(item.cognitive_skill) || '-'}</p>
                    <p><strong>Lỗi cụ thể:</strong> {clean(item.error_label) || '-'}</p>
                  </div>

                  {snippet ? (
                    <div className="error-details-snippet">
                      <p className="label">Câu/đoạn sai</p>
                      <p>{snippet}</p>
                    </div>
                  ) : null}

                  {(userAnswer || correctAnswer) ? (
                    <div className="error-details-answer-grid">
                      <div>
                        <p className="label">Đáp án học viên</p>
                        <p>{userAnswer || '-'}</p>
                      </div>
                      <div>
                        <p className="label">Đáp án đúng</p>
                        <p>{correctAnswer || '-'}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="error-details-reason">
                    <p className="label">Vì sao xếp taxonomy này</p>
                    <p>{clean(item.taxonomy_reason) || 'Không có mô tả taxonomy reason.'}</p>
                    {clean(item.explanation) ? (
                      <p className="explanation">Giải thích chi tiết: {item.explanation}</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="error-details-pagination">
        <button
          type="button"
          disabled={page <= 1 || isListLoading}
          onClick={() => updateQuery({ page: String(page - 1) })}
        >
          <ChevronLeft size={16} /> Trang trước
        </button>
        <button
          type="button"
          disabled={page >= totalPages || isListLoading}
          onClick={() => updateQuery({ page: String(page + 1) })}
        >
          Trang sau <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
