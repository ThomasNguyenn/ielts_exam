import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { api } from '@/shared/api/client';
import './AnalyticsDashboard.css';
import './EnhancedAnalytics.css';
import './ErrorAnalyticsDetailsPage.css';

const RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const SKILL_OPTIONS = [
  { value: 'all', label: 'All skills' },
  { value: 'reading', label: 'Reading' },
  { value: 'listening', label: 'Listening' },
  { value: 'writing', label: 'Writing' },
  { value: 'speaking', label: 'Speaking' },
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersionRef = useRef(0);

  const range = searchParams.get('range') || 'all';
  const skill = searchParams.get('skill') || 'all';
  const errorCode = searchParams.get('errorCode') || '';
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
      setLoading(true);
      setError('');
      try {
        const params = {
          range,
          skill,
          errorCode: clean(errorCode) || undefined,
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
        setError(err?.message || 'Failed to load error details.');
      } finally {
        if (cancelled || requestVersionRef.current !== requestVersion) return;
        setLoading(false);
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [studentId, range, skill, errorCode, taskType, page]);

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const pagination = payload?.pagination || {};
  const total = Number(pagination.total || 0);
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));

  const title = useMemo(() => (
    studentId ? 'Taxonomy Error Details (Student)' : 'Taxonomy Error Details'
  ), [studentId]);

  if (loading) {
    return <div className="analytics-loading">Đang tải chi tiết lỗi...</div>;
  }

  if (error) {
    return (
      <div className="analytics-error-card">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>Thử lại</button>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard error-details-page">
      <button type="button" className="analytics-back-btn" onClick={() => navigate(-1)}>
        Quay lại
      </button>

      <div className="analytics-header">
        <h1>{title}</h1>
        <p>Liệt kê chi tiết từng lỗi: sai câu nào, thuộc bài nào, test nào và vì sao bị gán taxonomy đó.</p>
      </div>

      <div className="error-details-filter-row">
        <label className="enhanced-analytics-filter">
          <span>Range</span>
          <select value={range} onChange={(e) => updateQuery({ range: e.target.value }, true)}>
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="enhanced-analytics-filter">
          <span>Skill</span>
          <select value={skill} onChange={(e) => updateQuery({ skill: e.target.value }, true)}>
            {SKILL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="enhanced-analytics-filter">
          <span>Error Code</span>
          <input
            className="error-details-input"
            value={errorCode}
            placeholder="e.g. R-C4"
            onChange={(e) => updateQuery({ errorCode: e.target.value.toUpperCase() }, true)}
          />
        </label>

        <label className="enhanced-analytics-filter">
          <span>Task Type</span>
          <input
            className="error-details-input"
            value={taskType}
            placeholder="e.g. matching_information"
            onChange={(e) => updateQuery({ taskType: e.target.value.toLowerCase() }, true)}
          />
        </label>
      </div>

      <div className="error-details-meta">
        <span>Total errors: <strong>{total}</strong></span>
        <span>Page: <strong>{page}</strong> / {totalPages}</span>
      </div>

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
                    <span className="error-badge skill">{clean(item.skill) || 'unknown'}</span>
                    <span className="error-badge code">{clean(item.error_code) || 'UNCLASSIFIED'}</span>
                    <span className="error-badge task">{clean(item.task_type_label) || clean(item.task_type) || 'Unknown'}</span>
                  </div>
                  <div className="error-details-time">
                    <CalendarClock size={14} />
                    <span>{formatDateTime(item.logged_at)}</span>
                  </div>
                </header>

                <div className="error-details-context">
                  <p><FileText size={14} /> <strong>Bài:</strong> {clean(item.source_label) || '-'} | <strong>Ref:</strong> {clean(item.source_ref) || '-'} | <strong>Record:</strong> {clean(item.source_id) || '-'}</p>
                  <p><AlertTriangle size={14} /> <strong>Câu:</strong> {item.question_number ?? '-'} | <strong>Nhóm taxonomy:</strong> {clean(item.error_category) || '-'} | <strong>Kỹ năng:</strong> {clean(item.cognitive_skill) || '-'}</p>
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
                      <p className="label">User answer</p>
                      <p>{userAnswer || '-'}</p>
                    </div>
                    <div>
                      <p className="label">Correct answer</p>
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

      <div className="error-details-pagination">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => updateQuery({ page: String(page - 1) })}
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => updateQuery({ page: String(page + 1) })}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
