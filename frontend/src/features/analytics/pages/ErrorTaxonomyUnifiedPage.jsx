import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Grid3X3,
  Headphones,
  History,
  Mic,
  PenSquare,
  X,
} from 'lucide-react';
import { api } from '@/shared/api/client';
import './ErrorTaxonomyUnifiedPage.css';

/**
 * @typedef {Object} AnalyticsUnifiedFilters
 * @property {'all'|'7d'|'30d'|'90d'} range
 * @property {string} errorCode
 * @property {number} page
 * @property {string} skill
 * @property {string} taskType
 */

/**
 * @typedef {Object} SkillMasteryCardVM
 * @property {string} skill
 * @property {string} label
 * @property {number} target
 * @property {number} band
 * @property {number} progress
 * @property {number} deltaPercent
 */

/**
 * @typedef {Object} TreemapTileVM
 * @property {string} code
 * @property {string} label
 * @property {string} skillLabel
 * @property {'critical'|'moderate'|'minor'} severity
 * @property {number} count
 * @property {number} share
 */

/**
 * @typedef {Object} WeaknessCardVM
 * @property {TreemapTileVM} tile
 * @property {number} bandImpact
 * @property {string} recommendation
 */

/**
 * @typedef {Object} ErrorLogRowVM
 * @property {string} id
 * @property {string} dateLabel
 * @property {string} testId
 * @property {string} section
 * @property {string} questionType
 * @property {string} errorCategory
 */

/**
 * @typedef {Object} ErrorLogDetailModalVM
 * @property {string} id
 * @property {string} errorCode
 * @property {string} errorLabel
 * @property {string} section
 * @property {string} taskType
 * @property {string} taxonomyReason
 * @property {string} explanation
 * @property {string} textSnippet
 * @property {string} userAnswer
 * @property {string} correctAnswer
 * @property {string} sourceRef
 * @property {string} sourceLabel
 * @property {string} loggedAt
 */

const RANGE_OPTIONS = [
  { value: 'all', label: 'Toàn bộ thời gian' },
  { value: '7d', label: '7 ngày gần đây' },
  { value: '30d', label: '30 ngày gần đây' },
  { value: '90d', label: '90 ngày gần đây' },
];

const SKILL_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả kỹ năng' },
  { value: 'reading', label: 'Reading' },
  { value: 'listening', label: 'Listening' },
  { value: 'writing', label: 'Writing' },
  { value: 'speaking', label: 'Speaking' },
];

const SKILL_META = {
  reading: {
    key: 'reading',
    label: 'Reading',
    target: 7.0,
    icon: BookOpen,
    iconClass: 'is-reading',
    progressClass: 'is-reading',
  },
  listening: {
    key: 'listening',
    label: 'Listening',
    target: 7.5,
    icon: Headphones,
    iconClass: 'is-listening',
    progressClass: 'is-listening',
  },
  writing: {
    key: 'writing',
    label: 'Writing',
    target: 7.0,
    icon: PenSquare,
    iconClass: 'is-writing',
    progressClass: 'is-writing',
  },
  speaking: {
    key: 'speaking',
    label: 'Speaking',
    target: 7.0,
    icon: Mic,
    iconClass: 'is-speaking',
    progressClass: 'is-speaking',
  },
};

const SKILL_ORDER = ['reading', 'listening', 'writing', 'speaking'];
const HEATMAP_LAYOUT_CLASSES = [
  'tile-large',
  'tile-wide',
  'tile-small',
  'tile-small',
  'tile-bottom-left',
  'tile-bottom-right',
];

const SKILL_BADGE_CLASS = {
  reading: 'skill-badge is-reading',
  listening: 'skill-badge is-listening',
  writing: 'skill-badge is-writing',
  speaking: 'skill-badge is-speaking',
};

const cleanText = (value) => String(value || '').trim();

const clamp = (value, min, max) => Math.min(Math.max(Number(value || 0), min), max);

const formatBand = (value) => Number(value || 0).toFixed(1);

const formatSignedPercent = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || Math.abs(numeric) < 0.05) return '0%';
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(1)}%`;
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
};

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

const getSkillFromErrorCode = (errorCode) => {
  const code = cleanText(errorCode).toUpperCase();
  if (code.startsWith('R')) return 'reading';
  if (code.startsWith('L')) return 'listening';
  if (code.startsWith('W')) return 'writing';
  if (code.startsWith('S')) return 'speaking';
  return 'reading';
};

const normalizeTaskType = (value) => cleanText(value).toLowerCase().replace(/[\s-]+/g, '_');

const inferSkillFromTaskType = (taskType) => {
  const normalized = normalizeTaskType(taskType);
  if (!normalized) return null;

  if (normalized === 'task1' || normalized === 'task2' || normalized.startsWith('writing')) return 'writing';
  if (normalized === 'part1' || normalized === 'part2' || normalized === 'part3' || normalized.startsWith('speaking')) return 'speaking';

  if (
    normalized === 'form_completion'
    || normalized === 'table_completion'
    || normalized === 'flow_chart_completion'
    || normalized === 'flowchart_completion'
    || normalized === 'map_labeling'
    || normalized === 'listening_map'
    || normalized === 'diagram_completion'
  ) {
    return 'listening';
  }

  if (
    normalized === 'matching_headings'
    || normalized === 'matching_information'
    || normalized === 'matching_features'
    || normalized === 'true_false_not_given'
    || normalized === 'tfng'
    || normalized === 'yes_no_not_given'
    || normalized === 'ynng'
    || normalized === 'short_answer'
    || normalized === 'plan_map_diagram'
  ) {
    return 'reading';
  }

  return null;
};

const pickDominantSkill = (votes = {}) => {
  const pairs = Object.entries(votes || {})
    .filter(([skill]) => Boolean(SKILL_META[skill]))
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
  if (!pairs.length) return '';
  return pairs[0][0];
};

const getSkillLabel = (skill) => {
  const normalized = cleanText(skill).toLowerCase();
  if (normalized === 'reading') return 'Reading';
  if (normalized === 'listening') return 'Listening';
  if (normalized === 'writing') return 'Writing';
  if (normalized === 'speaking') return 'Speaking';
  return 'Reading';
};

const getDeltaPercentBySkill = (history = [], skill) => {
  const rows = (Array.isArray(history) ? history : [])
    .filter((item) => cleanText(item?.type).toLowerCase() === skill)
    .filter((item) => Number.isFinite(Number(item?.score)))
    .sort((a, b) => new Date(a?.date || 0) - new Date(b?.date || 0));

  if (rows.length < 2) return 0;
  const prev = Number(rows[rows.length - 2].score || 0);
  const next = Number(rows[rows.length - 1].score || 0);
  if (!Number.isFinite(prev) || !Number.isFinite(next) || prev <= 0) return 0;
  return ((next - prev) / prev) * 100;
};

const getSeverityByRank = (rank) => {
  if (rank <= 1) return 'critical';
  if (rank <= 3) return 'moderate';
  return 'minor';
};

const getImpactLabel = (severity) => {
  if (severity === 'critical') return 'High Impact';
  if (severity === 'moderate') return 'Med Impact';
  return 'Low Impact';
};

const getBandImpactByShare = (share) => {
  const numeric = Number(share || 0);
  if (numeric >= 0.22) return -0.5;
  if (numeric >= 0.12) return -0.3;
  return -0.1;
};

const mapSectionFromSkill = (skill) => {
  const normalized = cleanText(skill).toLowerCase();
  if (normalized === 'reading') return 'Reading';
  if (normalized === 'listening') return 'Listening';
  if (normalized === 'writing') return 'Writing';
  if (normalized === 'speaking') return 'Speaking';
  return 'Reading';
};

const getNormalizedFilters = (searchParams) => {
  const range = cleanText(searchParams.get('range') || 'all').toLowerCase();
  const safeRange = ['all', '7d', '30d', '90d'].includes(range) ? range : 'all';
  const errorCode = cleanText(searchParams.get('errorCode'));
  const pageRaw = Number(searchParams.get('page') || 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const skill = cleanText(searchParams.get('skill') || 'all').toLowerCase();
  const taskType = cleanText(searchParams.get('taskType') || '');

  return {
    range: /** @type {'all'|'7d'|'30d'|'90d'} */ (safeRange),
    errorCode,
    page,
    skill,
    taskType,
  };
};

const getCoreApiParams = (filters) => ({
  range: filters.range !== 'all' ? filters.range : undefined,
  skill: filters.skill && filters.skill !== 'all' ? filters.skill : undefined,
});

const getDetailsApiParams = (filters) => ({
  ...getCoreApiParams(filters),
  errorCode: filters.errorCode || undefined,
  taskType: filters.taskType || undefined,
  page: filters.page,
  limit: 8,
});

function TaxonomyDropdown({
  value,
  options = [],
  onChange,
  shellClassName = '',
  icon: Icon = null,
  ariaLabel = 'Dropdown',
}) {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const selected = useMemo(() => {
    if (!Array.isArray(options) || options.length === 0) return { value: '', label: '' };
    const current = options.find((option) => String(option?.value) === String(value));
    return current || options[0];
  }, [options, value]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`taxonomy-dropdown ${shellClassName}`.trim()}>
      <button
        type="button"
        className={`taxonomy-dropdown-trigger${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {Icon ? (
          <span className="taxonomy-dropdown-icon">
            <Icon size={16} />
          </span>
        ) : null}
        <span className="taxonomy-dropdown-content">
          <span className="taxonomy-dropdown-value">{selected?.label || ''}</span>
        </span>
        <ChevronDown size={16} className={`taxonomy-dropdown-arrow${isOpen ? ' is-open' : ''}`} />
      </button>

      {isOpen ? (
        <div className="taxonomy-dropdown-menu" role="listbox">
          {options.map((option) => {
            const optionValue = String(option?.value ?? '');
            const isActive = optionValue === String(selected?.value ?? '');
            return (
              <button
                key={optionValue}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`taxonomy-dropdown-option${isActive ? ' is-active' : ''}`}
                onClick={() => {
                  onChange?.(optionValue);
                  setIsOpen(false);
                }}
              >
                <span>{option?.label || optionValue}</span>
                {isActive ? <Check size={14} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ErrorLogDetailModal({ detail, onClose }) {
  if (!detail) return null;

  return (
    <div className="error-taxonomy-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="error-taxonomy-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết lỗi"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="error-taxonomy-modal-close" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>

        <div className="error-taxonomy-modal-header">
          <h3>{detail.errorLabel || detail.errorCode || 'Chi tiết lỗi'}</h3>
          <p>
            {detail.section} · {detail.taskType}
          </p>
        </div>

        <div className="error-taxonomy-modal-meta">
          <span>
            <strong>Mã lỗi:</strong> {detail.errorCode || 'UNCLASSIFIED'}
          </span>
          <span>
            <strong>Nguồn:</strong> {detail.sourceLabel || '-'} ({detail.sourceRef || '-'})
          </span>
          <span>
            <strong>Thời gian:</strong> {detail.loggedAt}
          </span>
        </div>

        {detail.textSnippet ? (
          <section className="error-taxonomy-modal-block">
            <h4>Câu/đoạn liên quan</h4>
            <p>{detail.textSnippet}</p>
          </section>
        ) : null}

        {(detail.userAnswer || detail.correctAnswer) ? (
          <section className="error-taxonomy-modal-grid">
            <div>
              <h4>Đáp án học viên</h4>
              <p>{detail.userAnswer || '-'}</p>
            </div>
            <div>
              <h4>Đáp án đúng</h4>
              <p>{detail.correctAnswer || '-'}</p>
            </div>
          </section>
        ) : null}

        <section className="error-taxonomy-modal-block">
          <h4>Vì sao được gán taxonomy này</h4>
          <p>{detail.taxonomyReason || 'Không có mô tả taxonomy reason.'}</p>
          {detail.explanation ? <p className="error-taxonomy-modal-explain">{detail.explanation}</p> : null}
        </section>
      </div>
    </div>
  );
}

function SectionError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="error-taxonomy-inline-error">
      <p>{message}</p>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </div>
  );
}

function SectionSkeleton({ className }) {
  return <div className={`error-taxonomy-skeleton ${className || ''}`.trim()} />;
}

export default function ErrorTaxonomyUnifiedPage() {
  const { studentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => getNormalizedFilters(searchParams), [searchParams]);

  const [dashboardData, setDashboardData] = useState(null);
  const [errorsData, setErrorsData] = useState(null);
  const [detailsData, setDetailsData] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);

  const [isCoreLoading, setIsCoreLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [errorsError, setErrorsError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [aiError, setAiError] = useState('');

  const [coreRetrySeed, setCoreRetrySeed] = useState(0);
  const [aiRetrySeed, setAiRetrySeed] = useState(0);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const requestRef = useRef(0);
  const aiRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = Date.now();
    requestRef.current = requestId;

    setIsCoreLoading(true);
    setDashboardError('');
    setErrorsError('');
    setDetailsError('');

    const coreParams = getCoreApiParams(filters);
    const detailParams = getDetailsApiParams(filters);

    const dashboardPromise = studentId
      ? api.getAdminStudentAnalyticsDashboard(studentId)
      : api.getAnalyticsDashboard();
    const errorsPromise = studentId
      ? api.getAdminStudentAnalyticsErrors(studentId, coreParams)
      : api.getAnalyticsErrors(coreParams);
    const detailsPromise = studentId
      ? api.getAdminStudentAnalyticsErrorDetails(studentId, detailParams)
      : api.getAnalyticsErrorDetails(detailParams);

    Promise.allSettled([dashboardPromise, errorsPromise, detailsPromise])
      .then((result) => {
        if (cancelled || requestRef.current !== requestId) return;
        const [dashboardResult, errorsResult, detailsResult] = result;

        if (dashboardResult.status === 'fulfilled') {
          setDashboardData(dashboardResult.value || null);
        } else {
          setDashboardData(null);
          setDashboardError(dashboardResult.reason?.message || 'Không tải được dữ liệu skill mastery.');
        }

        if (errorsResult.status === 'fulfilled') {
          setErrorsData(errorsResult.value?.data || null);
        } else {
          setErrorsData(null);
          setErrorsError(errorsResult.reason?.message || 'Không tải được dữ liệu heatmap lỗi.');
        }

        if (detailsResult.status === 'fulfilled') {
          setDetailsData(detailsResult.value?.data || null);
        } else {
          setDetailsData(null);
          setDetailsError(detailsResult.reason?.message || 'Không tải được danh sách lỗi chi tiết.');
        }
      })
      .finally(() => {
        if (cancelled || requestRef.current !== requestId) return;
        setIsCoreLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, filters, coreRetrySeed]);

  useEffect(() => {
    let cancelled = false;
    const requestId = Date.now();
    aiRequestRef.current = requestId;
    setIsAiLoading(true);
    setAiError('');

    const params = getCoreApiParams(filters);
    const request = studentId
      ? api.getAdminStudentAnalyticsAIInsights(studentId, params)
      : api.getAnalyticsAIInsights(params);

    request
      .then((response) => {
        if (cancelled || aiRequestRef.current !== requestId) return;
        setAiInsights(response?.data || null);
      })
      .catch((error) => {
        if (cancelled || aiRequestRef.current !== requestId) return;
        setAiInsights(null);
        setAiError(error?.message || 'Không tải được AI recommendation.');
      })
      .finally(() => {
        if (cancelled || aiRequestRef.current !== requestId) return;
        setIsAiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, filters.range, filters.skill, aiRetrySeed]);

  useEffect(() => {
    if (!selectedDetail) return;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setSelectedDetail(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedDetail]);

  const updateQuery = (patch = {}, resetPage = false) => {
    const next = new URLSearchParams(searchParams);

    if (resetPage) next.delete('page');

    Object.entries(patch).forEach(([key, value]) => {
      const normalized = cleanText(value);
      if (!normalized || normalized === 'all') {
        next.delete(key);
      } else {
        next.set(key, normalized);
      }
    });

    const pageValue = Number(next.get('page') || 1);
    if (!Number.isFinite(pageValue) || pageValue <= 1) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const skillCards = useMemo(() => {
    const skills = dashboardData?.skills || {};
    const history = Array.isArray(dashboardData?.history) ? dashboardData.history : [];

    return SKILL_ORDER.map((skill) => {
      const meta = SKILL_META[skill];
      const band = Number(skills?.[skill] || 0);
      const target = Number(meta.target);
      const progress = clamp((band / target) * 100, 0, 100);
      const deltaPercent = getDeltaPercentBySkill(history, skill);
      return {
        skill,
        label: meta.label,
        target,
        band,
        progress,
        deltaPercent,
      };
    });
  }, [dashboardData]);

  const detailsItems = Array.isArray(detailsData?.items) ? detailsData.items : [];

  const codeRanking = useMemo(() => {
    const heatmapRows = Array.isArray(errorsData?.heatmapData) ? errorsData.heatmapData : [];
    const codeTotals = {};

    heatmapRows.forEach((row) => {
      Object.entries(row || {}).forEach(([key, value]) => {
        if (key === 'taskType') return;
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric) || numeric <= 0) return;
        const normalizedCode = cleanText(key).toUpperCase();
        if (!normalizedCode) return;
        codeTotals[normalizedCode] = Number(codeTotals[normalizedCode] || 0) + numeric;
      });
    });

    return Object.entries(codeTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count: Number(count || 0) }));
  }, [errorsData]);

  const codeSkillVotesFromDetails = useMemo(() => {
    const votes = {};
    detailsItems.forEach((item) => {
      const code = cleanText(item?.error_code).toUpperCase();
      const skill = cleanText(item?.skill).toLowerCase();
      if (!code || !SKILL_META[skill]) return;
      if (!votes[code]) votes[code] = {};
      votes[code][skill] = Number(votes[code][skill] || 0) + 1;
    });
    return votes;
  }, [detailsItems]);

  const codeSkillVotesFromHeatmap = useMemo(() => {
    const rows = Array.isArray(errorsData?.heatmapData) ? errorsData.heatmapData : [];
    const votes = {};

    rows.forEach((row) => {
      const inferredSkill = inferSkillFromTaskType(row?.taskType);
      if (!inferredSkill || !SKILL_META[inferredSkill]) return;

      Object.entries(row || {}).forEach(([key, value]) => {
        if (key === 'taskType') return;
        const count = Number(value || 0);
        const code = cleanText(key).toUpperCase();
        if (!code || !Number.isFinite(count) || count <= 0) return;
        if (!votes[code]) votes[code] = {};
        votes[code][inferredSkill] = Number(votes[code][inferredSkill] || 0) + count;
      });
    });

    return votes;
  }, [errorsData]);

  const treemapTiles = useMemo(() => {
    const totalErrors = Number(errorsData?.totalErrors || 0);
    const codeLegend = errorsData?.codeLegend || {};

    return codeRanking.slice(0, 6).map((entry, index) => {
      const severity = getSeverityByRank(index);
      const code = cleanText(entry.code).toUpperCase();
      const skillFromDetails = pickDominantSkill(codeSkillVotesFromDetails[code]);
      const skillFromHeatmap = pickDominantSkill(codeSkillVotesFromHeatmap[code]);
      const skill = skillFromDetails || skillFromHeatmap || getSkillFromErrorCode(code);
      const label = cleanText(codeLegend?.[code] || codeLegend?.[entry.code]) || entry.code;
      const share = totalErrors > 0 ? entry.count / totalErrors : 0;
      return {
        code,
        label,
        skillLabel: getSkillLabel(skill),
        severity,
        count: entry.count,
        share,
      };
    });
  }, [errorsData, codeRanking, codeSkillVotesFromDetails, codeSkillVotesFromHeatmap]);

  const reasonByCode = useMemo(() => {
    const map = {};
    detailsItems.forEach((item) => {
      const code = cleanText(item?.error_code).toUpperCase();
      if (!code || map[code]) return;
      const reason = cleanText(item?.taxonomy_reason) || cleanText(item?.explanation);
      if (reason) map[code] = reason;
    });
    return map;
  }, [detailsItems]);

  const weaknessCards = useMemo(() => {
    const advice = Array.isArray(aiInsights?.actionable_advice) ? aiInsights.actionable_advice : [];
    return treemapTiles.slice(0, 2).map((tile, index) => {
      const recommendation = cleanText(advice[index])
        || cleanText(reasonByCode[tile.code])
        || `Tập trung xử lý lỗi ${tile.label.toLowerCase()} với 5-10 câu tương tự mỗi ngày.`;
      return {
        tile,
        bandImpact: getBandImpactByShare(tile.share),
        recommendation,
      };
    });
  }, [aiInsights, treemapTiles, reasonByCode]);

  const errorTypeOptions = useMemo(() => {
    const legend = errorsData?.codeLegend || {};
    return codeRanking.map((entry) => ({
      value: entry.code,
      label: `${entry.code} - ${cleanText(legend?.[entry.code]) || entry.code}`,
    }));
  }, [errorsData, codeRanking]);

  const pagination = detailsData?.pagination || {};
  const totalRows = Number(pagination?.total || 0);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const currentPage = Math.max(1, Number(pagination?.page || filters.page || 1));

  const openDetailModal = (item) => {
    if (!item) return;
    const modalPayload = {
      id: cleanText(item.id),
      errorCode: cleanText(item.error_code) || 'UNCLASSIFIED',
      errorLabel: cleanText(item.error_label),
      section: mapSectionFromSkill(item.skill),
      taskType: cleanText(item.task_type_label) || cleanText(item.task_type) || 'Unknown',
      taxonomyReason: cleanText(item.taxonomy_reason),
      explanation: cleanText(item.explanation),
      textSnippet: cleanText(item.text_snippet),
      userAnswer: cleanText(item.user_answer),
      correctAnswer: cleanText(item.correct_answer),
      sourceRef: cleanText(item.source_ref) || cleanText(item.source_id),
      sourceLabel: cleanText(item.source_label),
      loggedAt: formatDateTime(item.logged_at),
    };
    setSelectedDetail(modalPayload);
  };

  const isCoreReady = !isCoreLoading && (dashboardData || errorsData || detailsData);

  return (
    <div className="error-taxonomy-page">
      <div className="error-taxonomy-inner">
        <section className="error-taxonomy-header">
          <div>
            <h1>Error Taxonomy &amp; Analysis</h1>
            <p>Identify patterns in your mistakes to surgically improve your band score.</p>
          </div>
          <div className="error-taxonomy-actions">
            <TaxonomyDropdown
              value={filters.range}
              options={RANGE_OPTIONS}
              icon={CalendarDays}
              shellClassName="is-range"
              ariaLabel="Chọn khoảng thời gian"
              onChange={(nextValue) => updateQuery({ range: nextValue }, true)}
            />
            <button
              type="button"
              className="error-taxonomy-export-btn"
              disabled
              title="Sắp có"
            >
              <Download size={16} />
              Export Report
            </button>
          </div>
        </section>

        <section className="error-taxonomy-section">
          {dashboardError ? <SectionError message={dashboardError} onRetry={() => setCoreRetrySeed((prev) => prev + 1)} /> : null}
          <div className="error-taxonomy-skill-grid">
            {isCoreLoading && !dashboardData
              ? SKILL_ORDER.map((skill) => <SectionSkeleton key={skill} className="skill-card-skeleton" />)
              : skillCards.map((card) => {
                const meta = SKILL_META[card.skill];
                const Icon = meta.icon;
                const deltaClass = card.deltaPercent > 0 ? 'is-up' : card.deltaPercent < 0 ? 'is-down' : 'is-neutral';

                return (
                  <article key={card.skill} className="error-taxonomy-skill-card">
                    <header>
                      <div className="skill-heading">
                        <span className={`skill-icon ${meta.iconClass}`}>
                          <Icon size={18} />
                        </span>
                        <span className="skill-name">{card.label}</span>
                      </div>
                      <span className={`skill-delta ${deltaClass}`}>{formatSignedPercent(card.deltaPercent)}</span>
                    </header>

                    <div className="skill-band">
                      <span className="skill-band-value">{formatBand(card.band)}</span>
                      <span className="skill-band-label">Band Score</span>
                    </div>

                    <div className="skill-progress">
                      <span className={`skill-progress-fill ${meta.progressClass}`} style={{ width: `${card.progress}%` }} />
                    </div>

                    <p className="skill-target">
                      Target: {formatBand(card.target)}
                      {card.band < card.target ? ' (Needs Focus)' : ''}
                    </p>
                  </article>
                );
              })}
          </div>
        </section>

        <section className="error-taxonomy-main-grid">
          <div className="error-taxonomy-left">
            <h2 className="error-taxonomy-title">
              <Grid3X3 size={18} />
              Global Error Heatmap
            </h2>
            {errorsError ? <SectionError message={errorsError} onRetry={() => setCoreRetrySeed((prev) => prev + 1)} /> : null}

            <div className="error-taxonomy-heatmap-card">
              <div className="heatmap-head">
                <div className="heatmap-head-main">
                  <h3>Frequency by Category</h3>
                </div>
                <div className="heatmap-head-controls">
                  <TaxonomyDropdown
                    value={filters.skill || 'all'}
                    options={SKILL_FILTER_OPTIONS}
                    shellClassName="is-compact"
                    ariaLabel="Lọc kỹ năng heatmap"
                    onChange={(nextValue) => updateQuery({ skill: nextValue }, true)}
                  />
                  <div className="heatmap-legend">
                    <span><i className="is-critical" /> Critical</span>
                    <span><i className="is-moderate" /> Moderate</span>
                    <span><i className="is-minor" /> Minor</span>
                  </div>
                </div>
              </div>

              {isCoreLoading && !errorsData ? (
                <SectionSkeleton className="heatmap-skeleton" />
              ) : treemapTiles.length === 0 ? (
                <div className="error-taxonomy-empty">Chưa có dữ liệu lỗi để hiển thị heatmap.</div>
              ) : (
                <>
                  <div className="heatmap-grid">
                    {treemapTiles.map((tile, index) => (
                      <article
                        key={tile.code}
                        className={`heatmap-tile ${tile.severity} ${HEATMAP_LAYOUT_CLASSES[index] || 'tile-small'}`}
                        title={`${tile.code} - ${tile.label}`}
                      >
                        <div>
                          <p className="tile-skill">{tile.skillLabel}</p>
                          <p className="tile-label">{tile.label}</p>
                        </div>
                        <div className="tile-footer">
                          <span className="tile-count">{tile.count}</span>
                          <span className="tile-impact">{getImpactLabel(tile.severity)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="heatmap-note">
                    Interactive Treemap: Size represents frequency, Color represents severity.
                  </p>
                </>
              )}
            </div>
          </div>

          <aside className="error-taxonomy-right">
            <h2 className="error-taxonomy-title">
              <Brain size={18} />
              Top Weaknesses
            </h2>

            {aiError ? <SectionError message={aiError} onRetry={() => setAiRetrySeed((prev) => prev + 1)} /> : null}
            {errorsError ? null : (
              <div className="weakness-list">
                {isCoreLoading && !errorsData ? (
                  <>
                    <SectionSkeleton className="weakness-skeleton" />
                    <SectionSkeleton className="weakness-skeleton" />
                  </>
                ) : weaknessCards.length === 0 ? (
                  <div className="error-taxonomy-empty">Chưa có dữ liệu điểm yếu nổi bật.</div>
                ) : weaknessCards.map((weakness, index) => (
                  <article key={weakness.tile.code} className={`weakness-card ${weakness.tile.severity}`}>
                    <div className="weakness-head">
                      <div>
                        <h3>{weakness.tile.label}</h3>
                        <p>{weakness.tile.skillLabel} Section</p>
                      </div>
                      <span className={`weakness-badge ${weakness.tile.severity}`}>
                        {weakness.tile.severity === 'critical' ? 'Critical' : weakness.tile.severity === 'moderate' ? 'Moderate' : 'Minor'}
                      </span>
                    </div>

                    <div className="weakness-stats">
                      <div>
                        <p>Frequency</p>
                        <strong>{weakness.tile.count}</strong>
                      </div>
                      <div>
                        <p>Est. Band Impact</p>
                        <strong>{weakness.bandImpact.toFixed(1)}</strong>
                      </div>
                    </div>

                    {index === 0 ? (
                      <div className="weakness-ai-block">
                        <p className="ai-title">
                          <Bot size={14} />
                          AI Recommendation
                        </p>
                        <p>{isAiLoading ? 'Đang phân tích AI recommendation...' : weakness.recommendation}</p>
                        <button type="button" className="ai-link-btn">
                          Start Lesson
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="weakness-secondary-btn">
                        View {weakness.tile.count} Mistakes
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </aside>
        </section>

        <section className="error-taxonomy-section">
          <div className="error-taxonomy-table-head">
            <h2 className="error-taxonomy-title">
              <History size={18} />
              Recent Error Log
            </h2>
            <TaxonomyDropdown
              value={filters.errorCode || 'all'}
              shellClassName="is-table-filter"
              ariaLabel="Lọc loại lỗi"
              options={[
                { value: 'all', label: 'All Error Types' },
                ...errorTypeOptions,
              ]}
              onChange={(nextValue) => updateQuery({ errorCode: nextValue }, true)}
            />
          </div>

          {detailsError ? <SectionError message={detailsError} onRetry={() => setCoreRetrySeed((prev) => prev + 1)} /> : null}

          <div className="error-taxonomy-table-card">
            {isCoreLoading && !isCoreReady ? (
              <SectionSkeleton className="table-skeleton" />
            ) : detailsItems.length === 0 ? (
              <div className="error-taxonomy-empty">Không có lỗi phù hợp bộ lọc hiện tại.</div>
            ) : (
              <>
                <div className="error-taxonomy-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Test ID</th>
                        <th>Section</th>
                        <th>Question Type</th>
                        <th>Error Category</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsItems.map((item) => {
                        const section = mapSectionFromSkill(item.skill).toLowerCase();
                        const skillBadgeClass = SKILL_BADGE_CLASS[section] || SKILL_BADGE_CLASS.reading;
                        const row = {
                          id: cleanText(item.id),
                          dateLabel: formatDate(item.logged_at),
                          testId: cleanText(item.source_ref) || cleanText(item.source_id) || '-',
                          section: mapSectionFromSkill(item.skill),
                          questionType: cleanText(item.task_type_label) || cleanText(item.task_type) || 'Unknown',
                          errorCategory: cleanText(item.error_label) || cleanText(item.error_code) || 'Unclassified',
                        };

                        return (
                          <tr key={row.id}>
                            <td>{row.dateLabel}</td>
                            <td className="table-strong">{row.testId}</td>
                            <td>
                              <span className={skillBadgeClass}>{row.section}</span>
                            </td>
                            <td>{row.questionType}</td>
                            <td>
                              <span className="error-tag">{row.errorCategory}</span>
                            </td>
                            <td>
                              <button type="button" className="review-btn" onClick={() => openDetailModal(item)}>
                                Review Question
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="error-taxonomy-table-footer">
                  <p>Showing {detailsItems.length} of {totalRows} errors</p>
                  <div className="table-pagination">
                    <button
                      type="button"
                      disabled={currentPage <= 1 || isCoreLoading}
                      onClick={() => updateQuery({ page: String(currentPage - 1) })}
                    >
                      <ChevronLeft size={14} />
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages || isCoreLoading}
                      onClick={() => updateQuery({ page: String(currentPage + 1) })}
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <ErrorLogDetailModal detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
    </div>
  );
}
