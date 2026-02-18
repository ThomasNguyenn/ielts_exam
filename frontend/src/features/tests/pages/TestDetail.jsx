import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import {
  ArrowLeft,
  Clock,
  HelpCircle,
  BarChart3,
  ArrowRight,
  Layers,
  BookOpen,
  PenTool,
  Headphones,
  Mic,
  CheckCircle2,
  Target,
  Trophy,
  Play,
  Sparkles,
} from 'lucide-react';
import './TestDetail.css';

const SKILL_CONFIG = {
  reading: { label: 'Reading', Icon: BookOpen, unit: 'passage', color: '#6366F1' },
  listening: { label: 'Listening', Icon: Headphones, unit: 'section', color: '#10B981' },
  writing: { label: 'Writing', Icon: PenTool, unit: 'task', color: '#8B5CF6' },
  speaking: { label: 'Speaking', Icon: Mic, unit: 'task', color: '#F97316' },
};

function getSkillSections(test) {
  const sections = [];
  const type = test.type || 'reading';

  if (type === 'reading' && test.reading_passages?.length) {
    sections.push({
      skill: 'reading',
      count: test.reading_passages.length,
      items: test.reading_passages.map((p, i) => p.title || `Passage ${i + 1}`),
      questions: test.reading_passages.reduce((t, p) => t + (p.questions?.length || 0), 0),
    });
  }
  if (type === 'listening' && test.listening_sections?.length) {
    sections.push({
      skill: 'listening',
      count: test.listening_sections.length,
      items: test.listening_sections.map((s, i) => s.title || `Section ${i + 1}`),
      questions: test.listening_sections.reduce((t, s) => t + (s.questions?.length || 0), 0),
    });
  }
  if (type === 'writing' && test.writing_tasks?.length) {
    sections.push({
      skill: 'writing',
      count: test.writing_tasks.length,
      items: test.writing_tasks.map((w, i) => w.title || `Task ${i + 1}`),
      questions: test.writing_tasks.length,
    });
  }

  // Fallback
  if (sections.length === 0) {
    if (test.reading_passages?.length) {
      sections.push({
        skill: 'reading',
        count: test.reading_passages.length,
        items: test.reading_passages.map((p, i) => p.title || `Passage ${i + 1}`),
        questions: test.reading_passages.reduce((t, p) => t + (p.questions?.length || 0), 0),
      });
    }
    if (test.listening_sections?.length) {
      sections.push({
        skill: 'listening',
        count: test.listening_sections.length,
        items: test.listening_sections.map((s, i) => s.title || `Section ${i + 1}`),
        questions: test.listening_sections.reduce((t, s) => t + (s.questions?.length || 0), 0),
      });
    }
    if (test.writing_tasks?.length) {
      sections.push({
        skill: 'writing',
        count: test.writing_tasks.length,
        items: test.writing_tasks.map((w, i) => w.title || `Task ${i + 1}`),
        questions: test.writing_tasks.length,
      });
    }
  }

  return sections;
}

/** Flatten test into individual passage/section/task rows */
function getIndividualParts(test) {
  const parts = [];
  const type = test.type || 'reading';

  if ((type === 'reading') && test.reading_passages?.length) {
    test.reading_passages.forEach((p, i) => {
      parts.push({
        key: `reading-${i}`,
        skill: 'reading',
        index: i,
        label: `Passage ${i + 1}`,
        title: p.title || `Passage ${i + 1}`,
        questions: p.questions?.length || 0,
      });
    });
  }

  if ((type === 'listening') && test.listening_sections?.length) {
    test.listening_sections.forEach((s, i) => {
      parts.push({
        key: `listening-${i}`,
        skill: 'listening',
        index: i,
        label: `Section ${i + 1}`,
        title: s.title || `Section ${i + 1}`,
        questions: s.questions?.length || 0,
      });
    });
  }

  if ((type === 'writing') && test.writing_tasks?.length) {
    test.writing_tasks.forEach((w, i) => {
      parts.push({
        key: `writing-${i}`,
        skill: 'writing',
        index: i,
        label: `Task ${i + 1}`,
        title: w.title || `Task ${i + 1}`,
        questions: 1,
      });
    });
  }

  return parts;
}

function getTotalQuestions(test) {
  let total = 0;
  test.reading_passages?.forEach(p => { total += p.questions?.length || 0; });
  test.listening_sections?.forEach(s => { total += s.questions?.length || 0; });
  if (test.writing_tasks) total += test.writing_tasks.length;
  return total;
}

function getDuration(test) {
  const type = test.type || 'reading';
  if (type === 'reading') return '60 min';
  if (type === 'listening') return '30 min';
  if (type === 'writing') return '60 min';
  return '—';
}

function getDifficulty(test) {
  const type = test.type || 'reading';
  if (type === 'writing') return 'Advanced';
  return 'Intermediate';
}

function getTargetBand(difficulty) {
  if (difficulty === 'Beginner' || difficulty === 'Standard') return '5.0 – 6.0';
  if (difficulty === 'Intermediate') return '6.0 – 7.0';
  return '7.0 – 9.0';
}

function getSectionDuration(skill) {
  if (skill === 'reading') return '20 min each';
  if (skill === 'listening') return '10 min each';
  if (skill === 'writing') return '20–40 min each';
  return '—';
}

export default function TestDetail() {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    api
      .getTestById(id)
      .then((res) => setTest(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  /* Loading Skeleton */
  if (loading) {
    return (
      <div className="page test-detail">
        <div className="td-page-container">
          {/* Back link skeleton */}
          <div style={{ height: 16, width: 140, background: '#E2E8F0', borderRadius: 8, marginBottom: 24 }} className="td-skeleton-pulse" />

          {/* Hero skeleton */}
          <div className="td-hero">
            <div className="td-hero-inner">
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <div style={{ height: 28, width: 100, background: '#EEF2FF', borderRadius: 8 }} className="td-skeleton-pulse" />
                <div style={{ height: 28, width: 90, background: '#ECFDF5', borderRadius: 8 }} className="td-skeleton-pulse" />
              </div>
              <div style={{ height: 40, width: '60%', background: '#E2E8F0', borderRadius: 8, marginBottom: 24 }} className="td-skeleton-pulse" />
              <div style={{ display: 'flex', gap: 24 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: '#F1F5F9', borderRadius: 12 }} className="td-skeleton-pulse" />
                    <div>
                      <div style={{ height: 10, width: 50, background: '#E2E8F0', borderRadius: 4, marginBottom: 6 }} className="td-skeleton-pulse" />
                      <div style={{ height: 14, width: 60, background: '#E2E8F0', borderRadius: 4 }} className="td-skeleton-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Body skeleton */}
          <div className="td-body">
            <div className="td-content">
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 32, height: 180 }} className="td-skeleton-pulse" />
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, height: 120 }} className="td-skeleton-pulse" />
            </div>
            <div className="td-sidebar">
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, height: 350 }} className="td-skeleton-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="page"><p className="error">Error: {error}</p></div>;
  if (!test) {
    return (
      <div className="page test-detail">
        <div className="td-page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>
            Test Not Found
          </h2>
          <p style={{ color: '#64748B', marginBottom: 32 }}>
            The test you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link to="/tests" className="td-btn-primary" style={{ display: 'inline-flex', width: 'auto', padding: '0 24px' }}>
            <ArrowLeft size={16} />
            Back to Tests
          </Link>
        </div>
      </div>
    );
  }

  const type = test.type || 'reading';
  const skillSections = getSkillSections(test);
  const totalQuestions = getTotalQuestions(test);
  const duration = getDuration(test);
  const difficulty = getDifficulty(test);
  const diffKey = difficulty.toLowerCase();
  const category = (test.category || '').trim() || 'General';
  const sectionCount = skillSections.reduce((s, sec) => s + sec.count, 0);
  const individualParts = getIndividualParts(test);

  const overviewText = `This ${(SKILL_CONFIG[type]?.label || 'practice').toLowerCase()} test contains ${skillSections.map(sec => {
    const cfg = SKILL_CONFIG[sec.skill];
    return `${sec.count} ${cfg.unit}${sec.count !== 1 ? 's' : ''}`;
  }).join(', ')
    }${totalQuestions > 0 ? ` with a total of ${totalQuestions} questions` : ''}. Complete all sections to get your estimated IELTS band score.`;

  const STATS = [
    { icon: Clock, label: 'Duration', value: duration, colorClass: 'td-stat-icon--indigo' },
    { icon: HelpCircle, label: 'Questions', value: totalQuestions > 0 ? String(totalQuestions) : '—', colorClass: 'td-stat-icon--amber' },
    { icon: BarChart3, label: 'Sections', value: String(sectionCount), colorClass: 'td-stat-icon--emerald' },
    { icon: Target, label: 'Target Band', value: getTargetBand(difficulty), colorClass: 'td-stat-icon--rose' },
  ];

  const FEATURES = [
    'Định dạng đề thi thực tế', // Định dạng đề thi thực tế
    'Chế độ luyện tập có thời gian', // Chế độ luyện tập có thời gian
    'Ước tính BAND điểm', // Ước tính điểm
  ];

  const TIPS = [
    'Tạo ra điều kiện giống như khi thi thật', // Tạo ra điều kiện giống như khi thi thật
    'Hoàn thành tất cả các phần trong một nếu có thể', // Hoàn thành tất cả các phần trong một lần ngồi nếu có thể
    'Kiểm tra lại các câu trả lời sai sau khi hoàn thành', // Kiểm tra lại các câu trả lời sai sau khi hoàn thành
  ];

  return (
    <div className="page test-detail">
      <div className="td-page-container">
        {/* Back Link */}
        <Link to="/tests" className="td-back-link">
          <ArrowLeft size={16} />
          Back to all tests
        </Link>

        {/* Hero Section */}
        <div className="td-hero">
          <div className="td-hero-deco-1" />
          <div className="td-hero-deco-2" />

          <div className="td-hero-inner">
            {/* Tags: Category + Difficulty */}
            <div className="td-hero-tags">
              <span className="td-tag td-tag--category">
                {category}
              </span>
              <span className="td-tag td-tag--difficulty" data-diff={diffKey}>
                <span className="td-diff-dot" />
                {difficulty}
              </span>
            </div>

            <h1>{test.title}</h1>

            {/* Stats Row */}
            <div className="td-hero-stats">
              {STATS.map((stat, i) => (
                <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                  {i > 0 && <div className="td-stat-divider" style={{ marginRight: 12 }} />}
                  <div className="td-stat">
                    <div className={`td-stat-icon ${stat.colorClass}`}>
                      <stat.icon />
                    </div>
                    <div className="td-stat-text">
                      <span className="td-stat-label">{stat.label}</span>
                      <span className="td-stat-value">{stat.value}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="td-body">
          {/* Left Column */}
          <div className="td-content">
            {/* Overview */}
            {/* <div className="td-overview">
              <div className="td-section-heading">
                <span className="td-heading-bar" />
                <h2>Overview</h2>
              </div>
              <p>{overviewText}</p>

            
              <div className="td-features-grid">
                {FEATURES.map(feature => (
                  <div key={feature} className="td-feature-item">
                    <CheckCircle2 />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div> */}

            {/* Section Breakdown — per part rows */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-1 h-5 bg-[#6366F1] rounded-full" />
              <h2
                className="text-[#0F172A]"
                style={{ fontSize: "1.25rem", fontWeight: 600 }}
              >
                Section Breakdown
              </h2>
            </div>
            <div className="td-parts-list">
              {individualParts.map((part, idx) => {
                const cfg = SKILL_CONFIG[part.skill];
                const PartIcon = cfg.Icon;
                return (
                  <div key={part.key} className="td-part-row" data-skill={part.skill}>
                    <div className="td-part-number">{idx + 1}</div>
                    <div className="td-part-icon">
                      <PartIcon />
                    </div>
                    <div className="td-part-info">
                      <h4 className="td-part-title">{part.title}</h4>
                      <div className="td-part-meta">
                        <span className="td-part-label">{part.label}</span>
                        <span className="td-dot">·</span>
                        <span>{part.questions} question{part.questions !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <Link
                      to={`/tests/${id}/exam?part=${part.index}&mode=single`}
                      className="td-part-start-btn"
                    >
                      <Play />
                      Start
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column — Sticky Panel */}
          <div className="td-sidebar">
            <div className="td-sidebar-sticky">
              {/* Action Panel */}
              <div className="td-action-panel">
                {/* Progress Ring Header */}
                <div className="td-progress-header">
                  <div className="td-progress-ring">
                    <svg viewBox="0 0 64 64">
                      <circle className="td-ring-bg" cx="32" cy="32" r="28" />
                      <circle
                        className="td-ring-fill"
                        cx="32" cy="32" r="28"
                        strokeDasharray={`0 ${2 * Math.PI * 28}`}
                      />
                    </svg>
                    <div className="td-progress-icon">
                      <Trophy />
                    </div>
                  </div>
                  <div className="td-progress-text">
                    <h4>Sẵn sàng bắt đầu</h4>
                    <p>Hoàn thành tất cả {sectionCount} sections</p>
                  </div>
                </div>

                {/* Summary Rows */}
                <div className="td-summary-rows">
                  <div className="td-info-row">
                    <span className="td-info-label">Thời gian</span>
                    <span className="td-info-value">{duration}</span>
                  </div>
                  <div className="td-info-row">
                    <span className="td-info-label">Câu hỏi</span>
                    <span className="td-info-value">{totalQuestions > 0 ? totalQuestions : '—'}</span>
                  </div>
                  <div className="td-info-row">
                    <span className="td-info-label">Sections</span>
                    <span className="td-info-value">{sectionCount}</span>
                  </div>
                  <div className="td-info-row">
                    <span className="td-info-label">Difficulty</span>
                    <span className="td-diff-badge" data-diff={diffKey}>
                      <span className="td-diff-dot" />
                      {difficulty}
                    </span>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="td-cta-group">
                  <Link to={`/tests/${id}/exam`} className="td-btn-primary">
                    Bắt đầu bài kiểm tra
                    <ArrowRight />
                  </Link>
                </div>
              </div>

              {/* Tips Card */}
              <div className="td-tips-card">
                <div className="td-tips-header">
                  <Sparkles />
                  <span>Pro Tips</span>
                </div>
                <ul className="td-tips-list">
                  {TIPS.map(tip => (
                    <li key={tip}>
                      <span className="td-tip-dot" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Help Card */}
              <div className="td-help-card">
                <h4>Chưa sẵn sàng?</h4>
                <p>Hãy xem các hướng dẫn và chiến lược học tập cho từng phần.</p>
                <Link to="/practice" className="td-help-btn">
                  Xem hướng dẫn
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
