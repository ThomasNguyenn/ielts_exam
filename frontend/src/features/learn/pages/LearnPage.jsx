import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined';
import MicOutlined from '@mui/icons-material/MicOutlined';
import TimelineOutlined from '@mui/icons-material/TimelineOutlined';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import './LearnPage.css';

const CATEGORY_ORDER = ['listening', 'reading', 'writing', 'speaking'];
const DIFFICULTY_ORDER = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const CATEGORY_META = {
  listening: {
    label: 'Listening',
    description:
      'Master active listening strategies, identify key information quickly, and handle accent variety in IELTS audio.',
    Icon: HeadphonesOutlined,
  },
  reading: {
    label: 'Reading',
    description:
      'Build skimming, scanning, and inference skills to improve speed and accuracy across IELTS Reading passages.',
    Icon: MenuBookOutlined,
  },
  writing: {
    label: 'Writing',
    description:
      'Develop clear arguments, stronger structure, and high-impact language for IELTS Writing Task 1 and Task 2.',
    Icon: EditNoteOutlined,
  },
  speaking: {
    label: 'Speaking',
    description:
      'Improve fluency, lexical range, and response strategy for all IELTS Speaking parts.',
    Icon: MicOutlined,
  },
};

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'popularity', label: 'Popularity' },
  { key: 'difficulty', label: 'Difficulty' },
];

const FALLBACK_CATEGORIES = CATEGORY_ORDER.map((category) => ({
  category,
  moduleCount: 0,
  totalMinutes: 0,
}));

const normalizeCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return CATEGORY_ORDER.includes(normalized) ? normalized : 'writing';
};

const normalizeDifficulty = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return DIFFICULTY_ORDER[normalized] ? normalized : 'beginner';
};

const normalizeModule = (module = {}) => ({
  ...module,
  category: normalizeCategory(module.category),
  difficulty: normalizeDifficulty(module.difficulty),
  tag: String(module.tag || '').trim(),
  path: String(module.path || '').trim(),
  estimatedMinutes: Number(module.estimatedMinutes) > 0 ? Number(module.estimatedMinutes) : 0,
  popularityCount: Number(module.popularityCount) > 0 ? Number(module.popularityCount) : 0,
});

const formatMinutes = (totalMinutes) => {
  const minutes = Math.max(0, Number(totalMinutes) || 0);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain > 0 ? `${hours}h ${remain}m` : `${hours}h`;
};

const byNewest = (a, b) => {
  const aTime = new Date(a.createdAt || 0).getTime();
  const bTime = new Date(b.createdAt || 0).getTime();
  if (bTime !== aTime) return bTime - aTime;
  return (a.order || 0) - (b.order || 0);
};

const byPopularity = (a, b) => {
  if ((b.popularityCount || 0) !== (a.popularityCount || 0)) {
    return (b.popularityCount || 0) - (a.popularityCount || 0);
  }
  return byNewest(a, b);
};

const byDifficulty = (a, b) => {
  if (DIFFICULTY_ORDER[a.difficulty] !== DIFFICULTY_ORDER[b.difficulty]) {
    return DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
  }
  return (a.order || 0) - (b.order || 0);
};

export default function LearnPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState('writing');
  const [sortBy, setSortBy] = useState('newest');
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      setLoading(true);
      setErrorMessage('');
      const [categoriesResult, progressResult] = await Promise.allSettled([
        api.getSkillCategories(),
        api.getMyProgress(),
      ]);

      if (cancelled) return;

      let normalizedCategories = FALLBACK_CATEGORIES;
      let pageError = '';

      if (categoriesResult.status === 'fulfilled') {
        const incoming = Array.isArray(categoriesResult.value?.data) ? categoriesResult.value.data : [];
        const byKey = new Map(incoming.map((item) => [normalizeCategory(item.category), item]));
        normalizedCategories = CATEGORY_ORDER.map((category) => ({
          category,
          moduleCount: Number(byKey.get(category)?.moduleCount) || 0,
          totalMinutes: Number(byKey.get(category)?.totalMinutes) || 0,
        }));
      } else {
        pageError = categoriesResult.reason?.message || 'Failed to load learning categories';
        showNotification(pageError, 'error');
      }

      if (progressResult.status === 'fulfilled') {
        setProgress(progressResult.value?.data || null);
      } else {
        setProgress(null);
      }

      const firstNonEmpty = normalizedCategories.find((item) => item.moduleCount > 0)?.category;
      const defaultCategory = firstNonEmpty || normalizedCategories[0]?.category || 'writing';

      setCategories(normalizedCategories);
      setActiveCategory(defaultCategory);
      setErrorMessage(pageError);
      setLoading(false);
    };

    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [showNotification]);

  useEffect(() => {
    if (!activeCategory) return;

    let cancelled = false;
    const loadModules = async () => {
      setModulesLoading(true);
      setErrorMessage('');
      try {
        const response = await api.getSkillModules(activeCategory);
        if (!cancelled) {
          const nextModules = Array.isArray(response?.data) ? response.data : [];
          setModules(nextModules.map((module) => normalizeModule(module)));
        }
      } catch (error) {
        if (!cancelled) {
          setModules([]);
          setErrorMessage(error.message || 'Failed to load modules');
          showNotification(error.message || 'Failed to load modules', 'error');
        }
      } finally {
        if (!cancelled) {
          setModulesLoading(false);
        }
      }
    };

    loadModules();
    return () => {
      cancelled = true;
    };
  }, [activeCategory, showNotification]);

  const completedModuleIds = useMemo(
    () => new Set((progress?.completedModules || []).map((item) => String(item.moduleId))),
    [progress],
  );

  const sortedModules = useMemo(() => {
    const items = [...modules];

    if (sortBy === 'popularity') return items.sort(byPopularity);
    if (sortBy === 'difficulty') return items.sort(byDifficulty);
    return items.sort(byNewest);
  }, [modules, sortBy]);

  const groupedPaths = useMemo(() => {
    const groups = new Map();

    sortedModules.forEach((module) => {
      const key = module.path || 'General';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(module);
    });

    return Array.from(groups.entries()).map(([path, pathModules], index) => ({
      path,
      modules: pathModules,
      HeadingIcon: index === 0 ? TimelineOutlined : FlagOutlined,
    }));
  }, [sortedModules]);

  const activeCategoryMeta = CATEGORY_META[activeCategory] || CATEGORY_META.writing;

  const handleOpenModule = (moduleId) => {
    navigate(`/learn/${moduleId}`);
  };

  return (
    <div className="learn-catalog">
      <div className="learn-catalog__layout">
        <aside className="learn-catalog__sidebar" aria-label="Skill Categories">
          <h2 className="learn-catalog__sidebar-title">Skill Categories</h2>

          <div className="learn-catalog__category-list">
            {categories.map((item) => {
              const meta = CATEGORY_META[item.category] || CATEGORY_META.writing;
              const Icon = meta.Icon;
              const isActive = item.category === activeCategory;

              return (
                <button
                  key={item.category}
                  type="button"
                  className={`learn-catalog__category-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => setActiveCategory(item.category)}
                >
                  <span className="learn-catalog__category-icon">
                    <Icon fontSize="small" />
                  </span>
                  <span className="learn-catalog__category-content">
                    <span className="learn-catalog__category-name">{meta.label}</span>
                    <span className="learn-catalog__category-meta">
                      {item.moduleCount} Modules | {formatMinutes(item.totalMinutes)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="learn-catalog__content">
          <header className="learn-catalog__header">
            <div>
              <h1 className="learn-catalog__title">{activeCategoryMeta.label} Skills</h1>
              <p className="learn-catalog__description">{activeCategoryMeta.description}</p>
            </div>

            <div className="learn-catalog__sort" role="tablist" aria-label="Sort Modules">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`learn-catalog__sort-btn ${sortBy === option.key ? 'is-active' : ''}`}
                  onClick={() => setSortBy(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </header>

          {loading ? <p className="learn-catalog__status">Loading learn catalog...</p> : null}

          {errorMessage && <p className="learn-catalog__error">{errorMessage}</p>}

          {modulesLoading ? <p className="learn-catalog__status">Loading modules...</p> : null}

          {!modulesLoading && groupedPaths.length === 0 ? (
            <p className="learn-catalog__status">No modules available in this category yet.</p>
          ) : null}

          {!modulesLoading && groupedPaths.length > 0
            ? groupedPaths.map((group) => {
                const HeadingIcon = group.HeadingIcon;
                return (
                  <section key={group.path} className="learn-catalog__path-group">
                    <div className="learn-catalog__path-heading">
                      <HeadingIcon fontSize="small" />
                      <h2>{group.path}</h2>
                    </div>

                    <div className="learn-catalog__cards">
                      {group.modules.map((module) => {
                        const completed = completedModuleIds.has(String(module._id));
                        return (
                          <article
                            key={module._id}
                            className={`learn-catalog__card ${completed ? 'is-completed' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleOpenModule(module._id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleOpenModule(module._id);
                              }
                            }}
                          >
                            <div className="learn-catalog__card-top">
                              <span className="learn-catalog__tag">{module.tag || 'General'}</span>
                              <span className={`learn-catalog__difficulty difficulty-${module.difficulty}`}>
                                {module.difficulty}
                              </span>
                            </div>

                            <h3 className="learn-catalog__card-title">{module.title || 'Untitled Module'}</h3>
                            <p className="learn-catalog__card-description">{module.description || 'No description yet.'}</p>

                            <div className="learn-catalog__card-footer">
                              <span className="learn-catalog__duration">
                                <ScheduleOutlined fontSize="inherit" />
                                {module.estimatedMinutes}m
                              </span>

                              <button
                                type="button"
                                className={`learn-catalog__action ${completed ? 'is-completed' : ''}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenModule(module._id);
                                }}
                              >
                                {completed ? (
                                  <>
                                    <CheckCircleOutlined fontSize="inherit" /> Completed
                                  </>
                                ) : (
                                  'Learn Now'
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            : null}
        </section>
      </div>
    </div>
  );
}

