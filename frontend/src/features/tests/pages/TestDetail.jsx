import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import {
  ArrowLeft,
  Clock,
  HelpCircle,
  ArrowRight,
  BookOpen,
  PenTool,
  Headphones,
  Mic,
  Target,
  Trophy,
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
      <div className="test-detail-page">
        <div className="td-container">
          <div className="td-skeleton" style={{ height: 20, width: 140, marginBottom: 24 }} />
          
          <div className="td-header-card">
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <div className="td-skeleton" style={{ height: 24, width: 100, borderRadius: 20 }} />
              <div className="td-skeleton" style={{ height: 24, width: 80, borderRadius: 20 }} />
            </div>
            <div className="td-skeleton" style={{ height: 40, width: '60%', marginBottom: 24 }} />
            <div style={{ display: 'flex', gap: 32 }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="td-skeleton" style={{ height: 40, width: 120 }} />
              ))}
            </div>
          </div>

          <div className="td-main-grid">
            <div className="td-content-area">
              {[1, 2, 3].map(i => (
                <div key={i} className="td-skeleton" style={{ height: 80, width: '100%', marginBottom: 16, borderRadius: 16 }} />
              ))}
            </div>
            <div className="td-sidebar-area">
              <div className="td-skeleton" style={{ height: 300, width: '100%', borderRadius: 16 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="test-detail-page"><div className="td-container"><p className="error">Error: {error}</p></div></div>;
  if (!test) {
    return (
      <div className="test-detail-page">
        <div className="td-container" style={{ textAlign: 'center', paddingTop: 80 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>
            Test Not Found
          </h2>
          <p style={{ color: '#64748B', marginBottom: 32 }}>
            The test you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link to="/tests" className="td-btn-main" style={{ display: 'inline-flex', width: 'auto', padding: '0 24px' }}>
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
  const difficulty = getDifficulty(test) || 'Standard';
  const diffKey = difficulty.toLowerCase();
  const category = (test.category || '').trim() || 'General';
  const sectionCount = skillSections.reduce((s, sec) => s + sec.count, 0);
  const individualParts = getIndividualParts(test);

  const STATS = [
    { icon: Clock, label: 'Duration', value: duration },
    { icon: HelpCircle, label: 'Questions', value: totalQuestions > 0 ? String(totalQuestions) : '—' },
    { icon: Target, label: 'Target Band', value: getTargetBand(difficulty) },
  ];

  const TIPS = [
    'Mô phỏng điều kiện thi thật để rèn phản xạ thời gian.',
    'Nên hoàn thành toàn bộ bài trong một lần để giữ nhịp làm bài.',
    'Xem lại đáp án sai sau khi hoàn thành để cải thiện nhanh hơn.',
  ];

  return (
    <div className="test-detail-page">
      <div className="td-container">
        {/* Back Link */}
        <Link to="/tests" className="td-back-link">
          <ArrowLeft size={16} />
          Back to all tests
        </Link>

        {/* Header Card */}
        <div className="td-header-card">
          <div className="td-header-top">
            <span className="td-badge td-badge-category">{category}</span>
            <span className="td-badge td-badge-difficulty" data-diff={diffKey}>
              <span className="td-diff-dot" />
              {difficulty}
            </span>
          </div>

          <h1>{test.title}</h1>

          <div className="td-header-stats">
            {STATS.map((stat) => (
              <div key={stat.label} className="td-header-stat-item">
                <div className="td-stat-icon-box">
                  <stat.icon />
                </div>
                <div className="td-stat-info">
                  <span className="label">{stat.label}</span>
                  <span className="value">{stat.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="td-main-grid">
          {/* Main Content */}
          <div className="td-content-area">
            <div className="td-section-title">
              <Sparkles size={20} className="text-orange-500" />
              <h2>Section Breakdown</h2>
            </div>

            <div className="td-parts-list">
              {individualParts.map((part, idx) => {
                const cfg = SKILL_CONFIG[part.skill];
                const PartIcon = cfg.Icon;
                return (
                  <div key={part.key} className="td-part-card" data-skill={part.skill}>
                    <div className="td-part-icon-box">
                      <PartIcon />
                    </div>
                    <div className="td-part-info">
                      <h4>{part.title}</h4>
                      <div className="td-part-meta">
                        <span className="td-part-label">{part.label}</span>
                        <span className="td-dot">·</span>
                        <span>{part.questions} question{part.questions !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <Link
                      to={`/tests/${id}/exam?part=${part.index}&mode=single`}
                      className="td-part-btn"
                    >
                      Start Part
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="td-sidebar-area">
            {/* Ready Card */}
            <div className="td-sidebar-panel">
              <div className="td-progress-box">
                <div className="td-progress-icon">
                  <Trophy size={24} />
                </div>
                <div className="td-progress-text">
                  <h4>Sẵn sàng bắt đầu?</h4>
                  <p>Hoàn thành tất cả {sectionCount} sections</p>
                </div>
              </div>

              <div className="td-summary-list">
                <div className="td-summary-item">
                  <span className="label">Tổng thời gian</span>
                  <span className="value">{duration}</span>
                </div>
                <div className="td-summary-item">
                  <span className="label">Tổng câu hỏi</span>
                  <span className="value">{totalQuestions > 0 ? totalQuestions : '—'}</span>
                </div>
                <div className="td-summary-item">
                  <span className="label">Độ khó</span>
                  <span className="value">{difficulty}</span>
                </div>
              </div>

              <Link to={`/tests/${id}/exam`} className="td-btn-main">
                Bắt đầu toàn bộ bài thi
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
