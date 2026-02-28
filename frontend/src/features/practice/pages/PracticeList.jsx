import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import LibraryBooksOutlined from '@mui/icons-material/LibraryBooksOutlined';
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined';
import FilterListOutlined from '@mui/icons-material/FilterListOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/shared/api/client';
import { getWritingTaskTypeLabel, getWritingTaskTypeOptions } from '@/shared/constants/writingTaskTypes';
import './SpeakingList.css';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 350;
const CARD_DESCRIPTION_FALLBACK =
  'Practice this writing prompt with AI feedback to improve structure, coherence, and lexical accuracy.';

const toText = (value = '') => String(value || '').trim();

const resolveCardImage = (row) => toText(row?.image_url || row?.imageUrl);

const buildPageTokens = (page, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const anchors = new Set([1, totalPages, page - 1, page, page + 1]);
  const points = [...anchors]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b);

  const tokens = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[i - 1];

    if (i > 0 && current - previous > 1) {
      tokens.push('...');
    }

    tokens.push(current);
  }

  return tokens;
};

const taskTypeMeta = {
  task1: { label: 'Task 1: Visual Report', chip: 'Task 1' },
  task2: { label: 'Task 2: Essay', chip: 'Task 2' },
};

const taskBadgeClass = (taskType) =>
  taskType === 'task1'
    ? 'sp2-card-badge sp2-card-badge--p1'
    : 'sp2-card-badge sp2-card-badge--p2';

const getVariantOptions = (tasks, selectedTaskType) => {
  const scopedRows = tasks.filter((item) => (
    selectedTaskType === 'all' || toText(item?.task_type).toLowerCase() === selectedTaskType
  ));

  const availableVariants = new Set(
    scopedRows.map((item) => toText(item?.writing_task_type)).filter(Boolean),
  );

  let baseOptions = [];
  if (selectedTaskType === 'task1') {
    baseOptions = getWritingTaskTypeOptions('task1');
  } else if (selectedTaskType === 'task2') {
    baseOptions = getWritingTaskTypeOptions('task2');
  } else {
    const merged = [...getWritingTaskTypeOptions('task1'), ...getWritingTaskTypeOptions('task2')];
    baseOptions = Array.from(new Map(merged.map((option) => [option.value, option])).values());
  }

  const orderedAvailable = baseOptions.filter((option) => availableVariants.has(option.value));
  const additionalOptions = [...availableVariants]
    .filter((value) => !baseOptions.some((option) => option.value === value))
    .map((value) => ({ value, label: getWritingTaskTypeLabel(value) || value }));

  return [
    { value: 'all', label: 'All categories' },
    ...orderedAvailable,
    ...additionalOptions,
  ];
};

export default function PracticeList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskType, setSelectedTaskType] = useState('all');
  const [selectedVariant, setSelectedVariant] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setErrorMessage('');
    api.getWritings()
      .then((res) => {
        if (!active) return;
        const rows = Array.isArray(res?.data) ? res.data : [];
        setTasks(rows);
      })
      .catch((error) => {
        if (!active) return;
        setTasks([]);
        setErrorMessage(error?.message || 'Unable to load writing prompts.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === searchQuery) return undefined;

    const timer = setTimeout(() => {
      setSearchQuery(next);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput, searchQuery]);

  const variantOptions = useMemo(
    () => getVariantOptions(tasks, selectedTaskType),
    [tasks, selectedTaskType],
  );

  useEffect(() => {
    setSelectedVariant('all');
  }, [selectedTaskType]);

  useEffect(() => {
    if (variantOptions.some((option) => option.value === selectedVariant)) return;
    setSelectedVariant('all');
  }, [selectedVariant, variantOptions]);

  const filteredTasks = useMemo(() => tasks.filter((item) => {
    const title = toText(item?.title).toLowerCase();
    const prompt = toText(item?.prompt).toLowerCase();
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      title.includes(searchLower) ||
      prompt.includes(searchLower);

    const taskType = toText(item?.task_type).toLowerCase();
    const matchesTaskType = selectedTaskType === 'all' || taskType === selectedTaskType;

    const variant = toText(item?.writing_task_type);
    const matchesVariant = selectedVariant === 'all' || variant === selectedVariant;

    return matchesSearch && matchesTaskType && matchesVariant;
  }), [tasks, searchQuery, selectedTaskType, selectedVariant]);

  const totalItems = filteredTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    if (safePage === currentPage) return;
    setCurrentPage(safePage);
  }, [safePage, currentPage]);

  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTasks.slice(start, start + PAGE_SIZE);
  }, [filteredTasks, safePage]);

  const pageTokens = useMemo(() => buildPageTokens(safePage, totalPages), [safePage, totalPages]);

  const task1Count = tasks.filter((item) => toText(item?.task_type).toLowerCase() === 'task1').length;
  const task2Count = tasks.filter((item) => toText(item?.task_type).toLowerCase() === 'task2').length;
  const progressPercent = totalItems > 0
    ? Math.max(1, Math.min(100, Math.round((visibleRows.length / totalItems) * 100)))
    : 0;

  const isFiltering = searchInput.trim() !== searchQuery;

  const handleTaskTypeToggle = (taskType) => {
    setCurrentPage(1);
    setSelectedTaskType((prev) => (prev === taskType ? 'all' : taskType));
  };

  const handleVariantSelect = (variant) => {
    setCurrentPage(1);
    setSelectedVariant(variant);
  };

  if (loading) {
    return (
      <div className="sp2-page" data-testid="practice-list-loading">
        <div className="sp2-skeleton-hero" />
        <div className="sp2-skeleton-wrap">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={`sk-${idx}`} className="sp2-skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="sp2-page">
      <main className="sp2-main">
        <section className="sp2-hero animate-fade-in">
          <div className="sp2-hero-copy">
            <div className="sp2-kicker">
              <span className="sp2-kicker-dot" />
              New Prompts Added
            </div>
            <h1>Writing Excellence</h1>
            <p>
              Build IELTS writing confidence with curated Task 1 and Task 2 prompts.
              Practice with AI support to improve structure and score consistency.
            </p>
            <div className="sp2-search-wrap">
              <SearchOutlined className="sp2-icon sp2-search-icon" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Find a writing prompt (e.g. 'Education', 'Technology')"
                aria-label="Search writing prompt"
              />
            </div>
          </div>

          <div className="sp2-hero-stats">
            <article className="sp2-stat-card">
              <div className="sp2-stat-icon">
                <LibraryBooksOutlined className="sp2-icon" />
              </div>
              <p className="sp2-stat-number">{tasks.length}</p>
              <p className="sp2-stat-label">Active Prompts</p>
            </article>

            <article className="sp2-stat-card sp2-stat-card--gradient">
              <div className="sp2-stat-head">
                <div className="sp2-stat-icon sp2-stat-icon--light">
                  <TrendingUpOutlined className="sp2-icon" />
                </div>
                <span className="sp2-stat-pill">Focus</span>
              </div>
              <div className="sp2-stat-progress">
                <p className="sp2-stat-number">
                  {visibleRows.length}
                  <span> / {Math.max(totalItems, visibleRows.length)}</span>
                </p>
                <p className="sp2-stat-label">Prompts Loaded</p>
                <div className="sp2-progress-track">
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </article>
          </div>
        </section>

        <div className="sp2-divider" />

        <div className="sp2-content">
          <aside className={`sp2-sidebar ${mobileFiltersOpen ? 'sp2-sidebar--open' : ''}`}>
            <button
              type="button"
              className="sp2-mobile-filter-toggle"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              aria-expanded={mobileFiltersOpen}
              aria-controls="writing-filters"
            >
              <span>Filter Prompts</span>
              <FilterListOutlined className="sp2-icon" />
            </button>

            <ScrollArea id="writing-filters" type="auto" className="sp2-filter-block sp2-filter-block--scroll">
              <div className="sp2-filter-block__content">
                <h3>Task Type</h3>
                <div className="sp2-filter-list">
                  {[
                    { value: 'task1', count: task1Count },
                    { value: 'task2', count: task2Count },
                  ].map(({ value, count }) => {
                    const isActive = selectedTaskType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`sp2-part-option ${isActive ? 'is-active' : ''}`}
                        onClick={() => handleTaskTypeToggle(value)}
                      >
                        <span className="sp2-check" aria-hidden="true">
                          {isActive ? 'X' : ''}
                        </span>
                        {taskTypeMeta[value].label}
                        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>

            <ScrollArea type="auto" className="sp2-filter-block sp2-filter-block--scroll">
              <div className="sp2-filter-block__content">
                <h3>Categories</h3>
                <div className="sp2-topic-pills">
                  {variantOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`sp2-topic-pill ${selectedVariant === option.value ? 'is-active' : ''}`}
                      onClick={() => handleVariantSelect(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </aside>

          <section className={`sp2-grid-wrap ${isFiltering ? 'is-fetching' : ''}`}>
            {errorMessage && tasks.length === 0 ? (
              <div className="sp2-empty">
                <h3>Unable to load writing prompts</h3>
                <p>{errorMessage}</p>
              </div>
            ) : null}

            {!errorMessage && totalItems === 0 ? (
              <div className="sp2-empty">
                <h3>No prompts found</h3>
                <p>Try another search term or remove active filters.</p>
              </div>
            ) : null}

            <div className="sp2-card-grid">
              {visibleRows.map((item, index) => {
                const cardImage = resolveCardImage(item);
                const cardCoverStyle = cardImage ? { backgroundImage: `url("${cardImage}")` } : undefined;
                const taskType = toText(item?.task_type).toLowerCase() === 'task1' ? 'task1' : 'task2';
                const category = getWritingTaskTypeLabel(toText(item?.writing_task_type)) || 'General';
                const title = toText(item?.title) || toText(item?.prompt) || 'Writing Prompt';
                const description = toText(item?.prompt) || CARD_DESCRIPTION_FALLBACK;

                return (
                  <article key={item?._id || `${title}-${index}`} className="sp2-card">
                    <div
                      className={`sp2-card-cover ${cardImage ? '' : 'sp2-card-cover--fallback'}`.trim()}
                      style={cardCoverStyle}
                    >
                      <div className="sp2-card-overlay" />
                      <span className={taskBadgeClass(taskType)}>{taskTypeMeta[taskType].chip}</span>
                      <span className="sp2-card-category">{category}</span>
                    </div>

                    <div className="sp2-card-body">
                      <h3>{title}</h3>
                      <p>{description}</p>
                      <Link to={`/practice/${item?._id}`} className="sp2-primary-cta">
                        <EditOutlined className="sp2-icon" />
                        Practice with AI
                        <ArrowForwardOutlined className="sp2-icon" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 ? (
              <div className="sp2-pagination" aria-label="Writing prompt pagination">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  <ChevronLeftOutlined className="sp2-icon" />
                </button>

                {pageTokens.map((token, idx) => {
                  if (token === '...') {
                    return <span key={`ellipsis-${idx}`}>...</span>;
                  }

                  const page = Number(token);
                  const isActive = page === safePage;
                  return (
                    <button
                      key={`page-${page}`}
                      type="button"
                      className={isActive ? 'is-active' : ''}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  <ChevronRightOutlined className="sp2-icon" />
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
