import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { TrendingUp, BarChart3, Activity, Target } from 'lucide-react';
import { api } from '@/shared/api/client';
import './AnalyticsDashboard.css';

const SKILL_COLORS = {
  Reading: '#6366F1',
  Writing: '#10B981',
  Listening: '#0EA5E9',
  Speaking: '#F59E0B',
};
const SKILL_MODE_OPTIONS = ['overall', 'latest'];

const EMPTY_SKILL_BREAKDOWN = [
  { name: 'Reading', value: 25, score: 0 },
  { name: 'Writing', value: 25, score: 0 },
  { name: 'Listening', value: 25, score: 0 },
  { name: 'Speaking', value: 25, score: 0 },
];

const formatBand = (value) => Number(value || 0).toFixed(1);
const formatWhole = (value) => Number(value || 0).toLocaleString('en-US');
const formatSigned = (value) => `${Number(value || 0) >= 0 ? '+' : ''}${Number(value || 0).toFixed(1)}`;

const READING_BAND_MAP = [
  { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
  { min: 32, band: 7.5 }, { min: 30, band: 7.0 }, { min: 26, band: 6.5 },
  { min: 23, band: 6.0 }, { min: 18, band: 5.5 }, { min: 16, band: 5.0 },
  { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
  { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
  { min: 1, band: 1.0 }, { min: 0, band: 0.0 },
];

const LISTENING_BAND_MAP = [
  { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
  { min: 33, band: 7.5 }, { min: 30, band: 7.0 }, { min: 27, band: 6.5 },
  { min: 23, band: 6.0 }, { min: 19, band: 5.5 }, { min: 15, band: 5.0 },
  { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
  { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
  { min: 1, band: 1.0 }, { min: 0, band: 0.0 },
];

const toBandScore = (score, type) => {
  const numeric = Number(score || 0);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 9) return numeric;
  const map = type === 'listening' ? LISTENING_BAND_MAP : READING_BAND_MAP;
  const hit = map.find((item) => numeric >= item.min);
  return hit ? hit.band : 0;
};

const roundHalf = (value) => Math.round(Number(value || 0) * 2) / 2;
const roundOne = (value) => Math.round(Number(value || 0) * 10) / 10;

const average = (list = []) => {
  const values = list.filter((v) => Number.isFinite(Number(v))).map(Number);
  if (!values.length) return 0;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
};

const monthKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const monthLabel = (key) => {
  const [year, month] = String(key || '').split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleString('en-US', { month: 'short' });
};

const recentMonthKeys = (count = 7) => {
  const now = new Date();
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
};

const SKILL_FIELDS = ['Reading', 'Writing', 'Listening', 'Speaking'];
const PERIOD_OPTIONS = ['day', 'week', 'month'];
const PERIOD_CONFIG = {
  day: { count: 14, chip: 'Last 14 Days', subtitle: 'Band score trends over the past 14 days' },
  week: { count: 12, chip: 'Last 12 Weeks', subtitle: 'Band score trends over the past 12 weeks' },
  month: { count: 7, chip: 'Last 7 Months', subtitle: 'Band score trends over the past 7 months' },
};

const COMPLETION_CANONICAL_TYPES = new Set([
  'gap_fill',
  'note_completion',
  'summary_completion',
  'sentence_completion',
  'form_completion',
  'table_completion',
  'flow_chart_completion',
  'diagram_label_completion',
]);

const canonicalWeaknessType = (rawType = '') => {
  const type = String(rawType || 'unknown').toLowerCase();
  if (COMPLETION_CANONICAL_TYPES.has(type)) return 'note_completion';
  if (type === 'matching_info') return 'matching_information';
  if (type === 'true_false_notgiven' || type === 'true_false_not_given' || type === 'tfng') return 'tfng';
  if (type === 'yes_no_notgiven' || type === 'yes_no_not_given' || type === 'ynng') return 'ynng';
  if (type === 'mult_choice' || type === 'multiple_choice_single' || type === 'multiple_choice_multi' || type === 'mult_choice_multi') {
    return 'multiple_choice';
  }
  return type;
};

const getWeaknessLabel = (rawType = '') => {
  const type = canonicalWeaknessType(rawType);
  const labels = {
    tfng: 'TRUE / FALSE / NOT GIVEN',
    ynng: 'YES / NO / NOT GIVEN',
    multiple_choice: 'Multiple Choice',
    note_completion: 'Note Completion',
    matching_headings: 'Matching Headings',
    matching_features: 'Matching Features',
    matching_information: 'Matching Information',
    matching_sentence_endings: 'Matching Sentence Endings',
    matching: 'Matching',
    short_answer: 'Short Answer Questions',
    plan_map_diagram: 'Plan / Map / Diagram Labeling',
    listening_map: 'Listening Map Labeling',
  };
  if (labels[type]) return labels[type];
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const typeToSkillField = (type) => {
  if (type === 'reading') return 'Reading';
  if (type === 'writing') return 'Writing';
  if (type === 'listening') return 'Listening';
  if (type === 'speaking') return 'Speaking';
  return null;
};

const normalizeDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const startOfWeek = (inputDate) => {
  const date = new Date(inputDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as week start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const dayKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const weekKey = (date) => dayKey(startOfWeek(date));

const periodKey = (date, period) => {
  if (period === 'day') return dayKey(date);
  if (period === 'week') return weekKey(date);
  return monthKey(date);
};

const periodLabel = (key, period) => {
  if (period === 'month') return monthLabel(key);

  const date = normalizeDate(key);
  if (!date) return String(key || '');

  if (period === 'day') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return `Wk ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};

const buildRecentPeriodKeys = (period, count) => {
  const keys = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = count - 1; i >= 0; i -= 1) {
    let date;
    if (period === 'day') {
      date = new Date(now);
      date.setDate(date.getDate() - i);
    } else if (period === 'week') {
      date = startOfWeek(now);
      date.setDate(date.getDate() - i * 7);
    } else {
      date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    }
    keys.push(periodKey(date, period));
  }

  return keys;
};

const buildProgressRows = (history = [], period = 'month') => {
  const config = PERIOD_CONFIG[period] || PERIOD_CONFIG.month;
  const keys = buildRecentPeriodKeys(period, config.count);
  const buckets = keys.reduce((acc, key) => {
    acc[key] = { Reading: [], Writing: [], Listening: [], Speaking: [] };
    return acc;
  }, {});

  history.forEach((item) => {
    const date = normalizeDate(item?.date);
    const skill = typeToSkillField(String(item?.type || '').toLowerCase());
    if (!date || !skill) return;

    const key = periodKey(date, period);
    if (!buckets[key]) return;
    const score = Number(item?.score);
    if (!Number.isFinite(score)) return;
    buckets[key][skill].push(score);
  });

  const carry = { Reading: null, Writing: null, Listening: null, Speaking: null };
  const rows = keys.map((key) => {
    const row = { label: periodLabel(key, period) };

    SKILL_FIELDS.forEach((skill) => {
      const values = buckets[key][skill];
      if (values.length) {
        carry[skill] = roundHalf(average(values));
      }
      row[skill] = carry[skill];
    });

    return row;
  });

  return {
    rows,
    chip: config.chip,
    subtitle: config.subtitle,
  };
};

const normalizeLegacyHistory = (history = []) => {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item?.date && Number.isFinite(Number(item?.score)))
    .map((item) => {
      const type = String(item.type || '');
      const needsBandConvert = (type === 'reading' || type === 'listening');
      const score = needsBandConvert ? toBandScore(item.score, type) : Number(item.score || 0);
      return {
        date: item.date,
        type,
        score: roundOne(score),
      };
    });
};

const buildDashboardFromLegacy = ({ skills = {}, weaknesses = [], history = [] }) => {
  const normalizedSkills = {
    reading: roundHalf(skills?.reading || 0),
    writing: roundHalf(skills?.writing || 0),
    listening: roundHalf(skills?.listening || 0),
    speaking: roundHalf(skills?.speaking || 0),
  };

  const skillBreakdownBase = [
    { name: 'Reading', score: normalizedSkills.reading },
    { name: 'Writing', score: normalizedSkills.writing },
    { name: 'Listening', score: normalizedSkills.listening },
    { name: 'Speaking', score: normalizedSkills.speaking },
  ];
  const skillTotal = skillBreakdownBase.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const skillBreakdown = skillBreakdownBase.map((item) => ({
    ...item,
    value: skillTotal > 0 ? roundOne((Number(item.score || 0) / skillTotal) * 100) : 25,
  }));

  const normalizedHistory = normalizeLegacyHistory(history).sort((a, b) => new Date(a.date) - new Date(b.date));
  const keys = recentMonthKeys(7);
  const monthBuckets = keys.reduce((acc, key) => {
    acc[key] = { Reading: [], Writing: [], Listening: [], Speaking: [] };
    return acc;
  }, {});

  normalizedHistory.forEach((item) => {
    const key = monthKey(item.date);
    if (!key || !monthBuckets[key]) return;
    if (item.type === 'reading') monthBuckets[key].Reading.push(item.score);
    if (item.type === 'writing') monthBuckets[key].Writing.push(item.score);
    if (item.type === 'listening') monthBuckets[key].Listening.push(item.score);
    if (item.type === 'speaking') monthBuckets[key].Speaking.push(item.score);
  });

  const carry = { Reading: null, Writing: null, Listening: null, Speaking: null };
  const progressHistory = keys.map((key) => {
    const row = { month: monthLabel(key) };
    ['Reading', 'Writing', 'Listening', 'Speaking'].forEach((label) => {
      const values = monthBuckets[key][label];
      if (values.length) carry[label] = roundHalf(average(values));
      row[label] = carry[label];
    });
    const all = ['Reading', 'Writing', 'Listening', 'Speaking']
      .map((label) => row[label])
      .filter((v) => Number.isFinite(Number(v)));
    row.overall = all.length ? roundHalf(average(all)) : null;
    return row;
  });

  const overallSeries = progressHistory
    .map((row) => row.overall)
    .filter((v) => Number.isFinite(Number(v)));
  const overallBand = overallSeries.length ? Number(overallSeries[overallSeries.length - 1]) : 0;
  const firstOverall = overallSeries.length ? Number(overallSeries[0]) : 0;
  const improvement = roundOne(overallBand - firstOverall);

  const weaknessMerged = Array.isArray(weaknesses)
    ? weaknesses.reduce((acc, item) => {
      const key = canonicalWeaknessType(item?.type || 'unknown');
      if (!acc[key]) acc[key] = { total: 0, weighted: 0 };
      const total = Number(item?.total || 0);
      const accuracy = Number(item?.accuracy || 0);
      acc[key].total += total;
      acc[key].weighted += accuracy * total;
      return acc;
    }, {})
    : {};

  const normalizedWeaknesses = Object.entries(weaknessMerged).map(([type, stat]) => {
    const total = Number(stat.total || 0);
    const score = total > 0 ? (Number(stat.weighted || 0) / total) : 0;
    return {
      category: getWeaknessLabel(type),
      score: roundOne(score),
      fullMark: 100,
      total,
    };
  }).sort((a, b) => Number(a.score || 0) - Number(b.score || 0));

  return {
    summary: {
      overallBand: roundHalf(overallBand),
      testsTaken: normalizedHistory.length,
      studyHours: 0,
      improvement,
      changes: {
        overallBand: `${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}`,
        testsTaken: '+0 this month',
        studyHours: '+0.0h this month',
        improvement: 'Since start',
      },
    },
    skills: normalizedSkills,
    skillBreakdown,
    weaknesses: normalizedWeaknesses,
    progressHistory,
    history: normalizedHistory,
  };
};

const fetchLegacyDashboard = async (studentId) => {
  if (studentId) {
    const response = await api.getAdminStudentAnalytics(studentId);
    return buildDashboardFromLegacy({
      skills: response?.skills || {},
      weaknesses: response?.weaknesses || [],
      history: response?.history || [],
    });
  }

  const [skillsRes, weaknessesRes, historyRes] = await Promise.all([
    api.getAnalyticsSkills(),
    api.getAnalyticsWeaknesses(),
    api.getAnalyticsHistory(),
  ]);

  return buildDashboardFromLegacy({
    skills: skillsRes?.skills || {},
    weaknesses: weaknessesRes?.weaknesses || [],
    history: historyRes?.history || [],
  });
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip-label">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="analytics-tooltip-row">
          <span className="analytics-tooltip-dot" style={{ backgroundColor: entry.color }} />
          <span className="analytics-tooltip-name">{entry.name}:</span>
          <span className="analytics-tooltip-value">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progressPeriod, setProgressPeriod] = useState('month');
  const [skillBreakdownMode, setSkillBreakdownMode] = useState('overall');

  useEffect(() => {
    let mounted = true;

    async function fetchDashboard() {
      setLoading(true);
      setError('');

      try {
        let response;
        try {
          response = studentId
            ? await api.getAdminStudentAnalyticsDashboard(studentId)
            : await api.getAnalyticsDashboard();
        } catch (primaryError) {
          if (String(primaryError?.message || '').toLowerCase().includes('route not found')) {
            response = await fetchLegacyDashboard(studentId);
          } else {
            throw primaryError;
          }
        }

        if (!mounted) return;
        setDashboard(response || null);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || 'Failed to load analytics dashboard.');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    fetchDashboard();
    return () => {
      mounted = false;
    };
  }, [studentId]);

  const summary = dashboard?.summary || {
    overallBand: 0,
    testsTaken: 0,
    studyHours: 0,
    improvement: 0,
    changes: {
      overallBand: '+0.0',
      testsTaken: '+0 this month',
      studyHours: '+0.0h this month',
      improvement: 'Since start',
    },
  };

  const overallSkillBreakdown = useMemo(() => {
    const data = Array.isArray(dashboard?.skillBreakdown) && dashboard.skillBreakdown.length
      ? dashboard.skillBreakdown
      : EMPTY_SKILL_BREAKDOWN;

    return data.map((item) => ({
      ...item,
      color: SKILL_COLORS[item.name] || '#6366F1',
    }));
  }, [dashboard]);

  const latestSkillScores = useMemo(() => {
    const history = Array.isArray(dashboard?.history) ? dashboard.history : [];
    const latestBySkill = {};

    history.forEach((item) => {
      const type = String(item?.type || '').toLowerCase();
      const score = Number(item?.score);
      const timestamp = new Date(item?.date).getTime();
      if (!Number.isFinite(score) || Number.isNaN(timestamp)) return;
      if (!latestBySkill[type] || timestamp > latestBySkill[type].timestamp) {
        latestBySkill[type] = { score, timestamp };
      }
    });

    return latestBySkill;
  }, [dashboard]);

  const skillBreakdown = useMemo(() => {
    if (skillBreakdownMode === 'overall') return overallSkillBreakdown;

    const typeByName = {
      Reading: 'reading',
      Writing: 'writing',
      Listening: 'listening',
      Speaking: 'speaking',
    };

    const latestData = overallSkillBreakdown.map((item) => {
      const type = typeByName[item.name];
      const latest = latestSkillScores[type];
      return {
        ...item,
        score: Number.isFinite(latest?.score) ? Number(latest.score) : Number(item.score || 0),
      };
    });

    const total = latestData.reduce((sum, item) => sum + Number(item.score || 0), 0);
    return latestData.map((item) => ({
      ...item,
      value: total > 0 ? roundOne((Number(item.score || 0) / total) * 100) : 25,
    }));
  }, [overallSkillBreakdown, latestSkillScores, skillBreakdownMode]);

  const donutCenterBand = useMemo(() => {
    if (skillBreakdownMode === 'overall') return Number(summary.overallBand || 0);
    const scores = skillBreakdown
      .map((item) => Number(item.score))
      .filter((value) => Number.isFinite(value));
    return scores.length ? roundHalf(average(scores)) : 0;
  }, [skillBreakdownMode, summary.overallBand, skillBreakdown]);

  const weaknessData = Array.isArray(dashboard?.weaknesses) ? dashboard.weaknesses : [];
  const weakCategorySet = useMemo(
    () => new Set(weaknessData.filter((item) => Number(item.score || 0) < 65).map((item) => item.category)),
    [weaknessData]
  );

  const progressMeta = useMemo(() => {
    const history = Array.isArray(dashboard?.history) ? dashboard.history : [];

    if (history.length > 0) {
      return buildProgressRows(history, progressPeriod);
    }

    if (progressPeriod === 'month' && Array.isArray(dashboard?.progressHistory)) {
      return {
        rows: dashboard.progressHistory.map((row) => ({ ...row, label: row.month || '' })),
        chip: PERIOD_CONFIG.month.chip,
        subtitle: PERIOD_CONFIG.month.subtitle,
      };
    }

    return {
      rows: [],
      chip: (PERIOD_CONFIG[progressPeriod] || PERIOD_CONFIG.month).chip,
      subtitle: (PERIOD_CONFIG[progressPeriod] || PERIOD_CONFIG.month).subtitle,
    };
  }, [dashboard, progressPeriod]);

  const progressData = progressMeta.rows;

  const stats = [
    {
      label: 'Overall Band',
      value: formatBand(summary.overallBand),
      change: summary?.changes?.overallBand || formatSigned(summary.improvement),
      icon: Target,
      color: '#6366F1',
    },
    {
      label: 'Tests Taken',
      value: formatWhole(summary.testsTaken),
      change: summary?.changes?.testsTaken || '+0 this month',
      icon: BarChart3,
      color: '#10B981',
    },
    {
      label: 'Study Hours',
      value: formatBand(summary.studyHours),
      change: summary?.changes?.studyHours || '+0.0h this month',
      icon: Activity,
      color: '#0EA5E9',
    },
    {
      label: 'Improvement',
      value: formatSigned(summary.improvement),
      change: summary?.changes?.improvement || 'Since start',
      icon: TrendingUp,
      color: '#F59E0B',
    },
  ];

  if (loading) {
    return <div className="analytics-loading">Loading analytics dashboard...</div>;
  }

  if (error) {
    return (
      <div className="analytics-error-card">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {studentId ? (
        <button type="button" className="analytics-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>
      ) : null}

      <div className="analytics-header">
        <h1>Analytics Dashboard</h1>
        <p>Visual insights into your IELTS preparation performance</p>
      </div>

      <div className="analytics-stats-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="analytics-stat-card">
            <div className="analytics-stat-top">
              <span className="analytics-stat-label">{stat.label}</span>
              <span className="analytics-stat-icon-wrap" style={{ backgroundColor: `${stat.color}14` }}>
                <stat.icon className="analytics-stat-icon" style={{ color: stat.color }} />
              </span>
            </div>
            <p className="analytics-stat-value">{stat.value}</p>
            <p className="analytics-stat-change">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="analytics-charts-grid">
        <div className="analytics-card">
          <div className="analytics-card-head">
            <div>
              <h3>Skill Breakdown</h3>
              <p>{skillBreakdownMode === 'overall' ? 'Performance distribution across all attempts' : 'Performance based on latest attempt per skill'}</p>
            </div>
            <div className="analytics-period-switch">
              {SKILL_MODE_OPTIONS.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`analytics-period-btn ${skillBreakdownMode === mode ? 'active' : ''}`}
                  onClick={() => setSkillBreakdownMode(mode)}
                >
                  {mode === 'overall' ? 'Overall' : 'Latest'}
                </button>
              ))}
            </div>
          </div>

          <div className="analytics-donut-layout">
            <div className="analytics-donut-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={skillBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={72}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {skillBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="analytics-donut-center">
                <p>{formatBand(donutCenterBand)}</p>
                <span>{skillBreakdownMode === 'overall' ? 'Overall Band' : 'Latest Skill Avg'}</span>
              </div>
            </div>

            <div className="analytics-legend-list">
              {skillBreakdown.map((skill) => (
                <div key={skill.name} className="analytics-legend-item">
                  <span className="analytics-legend-dot" style={{ backgroundColor: skill.color }} />
                  <div>
                    <p>{skill.name}</p>
                    <span>Band {formatBand(skill.score)} | {Math.round(Number(skill.value || 0))}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h3>Weakness Detective</h3>
          <p>Identify areas that need improvement</p>

          {weaknessData.length ? (
            <div className="analytics-radar-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={weaknessData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 12, fill: '#64748B', fontWeight: 500 }} />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#94A3B8' }}
                    axisLine={false}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#6366F1"
                    fill="#6366F1"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    dot={(dotProps) => {
                      if (!dotProps || dotProps.cx === undefined || dotProps.cy === undefined) return null;
                      const isWeak = weakCategorySet.has(dotProps?.payload?.category);
                      return (
                        <circle
                          cx={dotProps.cx}
                          cy={dotProps.cy}
                          r={isWeak ? 6 : 4}
                          fill={isWeak ? '#F59E0B' : '#6366F1'}
                          stroke="#FFFFFF"
                          strokeWidth={2}
                        />
                      );
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="analytics-empty">Not enough answer-level data to detect weaknesses yet.</div>
          )}

          <div className="analytics-radar-legend">
            <span><i style={{ backgroundColor: '#F59E0B' }} />Needs Improvement</span>
            <span><i style={{ backgroundColor: '#6366F1' }} />On Track</span>
          </div>
        </div>

        <div className="analytics-card analytics-card-wide">
          <div className="analytics-progress-head">
            <div>
              <h3>Progress History</h3>
              <p>{progressMeta.subtitle}</p>
            </div>
            <div className="analytics-progress-controls">
              <div className="analytics-period-switch">
                {PERIOD_OPTIONS.map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={`analytics-period-btn ${progressPeriod === period ? 'active' : ''}`}
                    onClick={() => setProgressPeriod(period)}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>
              <div className="analytics-chip">{progressMeta.chip}</div>
            </div>
          </div>

          {progressData.length ? (
            <div className="analytics-line-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: '#94A3B8', fontWeight: 500 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[4, 9]}
                    ticks={[4, 5, 6, 7, 8, 9]}
                    tick={{ fontSize: 12, fill: '#94A3B8', fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px', fontWeight: 500, paddingTop: '16px' }}
                  />
                  {Object.entries(SKILL_COLORS).map(([skill, color]) => (
                    <Line
                      key={skill}
                      type="monotone"
                      dataKey={skill}
                      stroke={color}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: color, strokeWidth: 2, stroke: '#FFFFFF' }}
                      activeDot={{ r: 6, fill: color, stroke: '#FFFFFF', strokeWidth: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="analytics-empty">No progress history yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
