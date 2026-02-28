import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import LibraryBooksOutlined from '@mui/icons-material/LibraryBooksOutlined';
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined';
import FilterListOutlined from '@mui/icons-material/FilterListOutlined';
import MicOutlined from '@mui/icons-material/MicOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/shared/api/client';
import './SpeakingList.css';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 350;
const CARD_DESCRIPTION_FALLBACK =
  'Practice this topic with AI feedback to improve fluency, vocabulary, and pronunciation.';

const toText = (value = '') => String(value || '').trim();
const toCueCardPreview = (value = '') =>
  String(value || '')
    .split(/\r?\n/)
    .map((item) => item.replace(/^[\s\-*•]+/, '').trim())
    .find(Boolean) || '';

const resolveCardImage = (row) => toText(row?.image_url || row?.imageUrl);

const normalizeListResponse = (res) => {
  const rows = Array.isArray(res?.data) ? res.data : [];
  const pagination = res?.pagination || null;

  if (!pagination) {
    const totalItems = rows.length;
    return {
      rows,
      pagination: {
        page: 1,
        totalPages: 1,
        totalItems,
        hasPrevPage: false,
        hasNextPage: false,
      },
    };
  }

  return {
    rows,
    pagination: {
      page: Number(pagination.page || 1),
      totalPages: Math.max(1, Number(pagination.totalPages || 1)),
      totalItems: Number(pagination.totalItems || rows.length),
      hasPrevPage: Boolean(pagination.hasPrevPage),
      hasNextPage: Boolean(pagination.hasNextPage),
    },
  };
};

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

const partMeta = {
  1: { label: 'Part 1: Introduction', chip: 'Part 1' },
  2: { label: 'Part 2: Cue Card', chip: 'Part 2' },
  3: { label: 'Part 3: Discussion', chip: 'Part 3' },
};

const partBadgeClass = (part) => {
  if (Number(part) === 1) return 'sp2-card-badge sp2-card-badge--p1';
  if (Number(part) === 2) return 'sp2-card-badge sp2-card-badge--p2';
  return 'sp2-card-badge sp2-card-badge--p3';
};

export default function SpeakingList() {
  const [topics, setTopics] = useState([]);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    totalItems: 0,
    hasPrevPage: false,
    hasNextPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPart, setSelectedPart] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const firstLoadCompletedRef = useRef(false);

  useEffect(() => {
    let active = true;

    api.getSpeakings({ topicsOnly: true })
      .then((res) => {
        if (!active) return;
        const values = Array.isArray(res?.topics) ? res.topics.map((item) => toText(item)).filter(Boolean) : [];
        setTopics(values);
      })
      .catch(() => {
        if (!active) return;
        setTopics([]);
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

  useEffect(() => {
    let active = true;

    if (firstLoadCompletedRef.current) {
      setIsFetching(true);
    }

    setErrorMessage('');

    api.getSpeakings({
      page: currentPage,
      limit: PAGE_SIZE,
      q: searchQuery || undefined,
      part: selectedPart !== 'all' ? selectedPart : undefined,
      topic: selectedTopic !== 'all' ? selectedTopic : undefined,
    })
      .then((res) => {
        if (!active) return;
        const normalized = normalizeListResponse(res || {});
        setRows(normalized.rows);
        setPagination(normalized.pagination);
      })
      .catch((error) => {
        if (!active) return;
        setRows([]);
        setPagination({
          page: currentPage,
          totalPages: 1,
          totalItems: 0,
          hasPrevPage: false,
          hasNextPage: false,
        });
        setErrorMessage(error?.message || 'Unable to load speaking topics.');
      })
      .finally(() => {
        if (!active) return;
        firstLoadCompletedRef.current = true;
        setLoading(false);
        setIsFetching(false);
      });

    return () => {
      active = false;
    };
  }, [currentPage, searchQuery, selectedPart, selectedTopic]);

  const totalItems = Number(pagination?.totalItems || 0);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  const safePage = Math.min(Math.max(1, Number(pagination?.page || currentPage)), totalPages);
  const pageTokens = useMemo(() => buildPageTokens(safePage, totalPages), [safePage, totalPages]);

  const progressPercent = totalItems > 0
    ? Math.max(1, Math.min(100, Math.round((rows.length / totalItems) * 100)))
    : 0;

  const handlePartToggle = (part) => {
    setCurrentPage(1);
    setSelectedPart((prev) => (prev === String(part) ? 'all' : String(part)));
  };

  const handleTopicSelect = (topic) => {
    setCurrentPage(1);
    setSelectedTopic(topic);
  };

  if (loading) {
    return (
      <div className="sp2-page" data-testid="speaking-list-loading">
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
              New Topics Added
            </div>
            <h1>Speaking Excellence</h1>
            <p>
              Refine your articulation with our elite collection of IELTS topics.
              Receive instant, AI-powered band score analysis.
            </p>
            <div className="sp2-search-wrap">
              <SearchOutlined className="sp2-icon sp2-search-icon" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Find a topic (e.g. 'Business', 'Travel')"
                aria-label="Search speaking topic"
              />
            </div>
          </div>

          <div className="sp2-hero-stats">
            <article className="sp2-stat-card">
              <div className="sp2-stat-icon">
                <LibraryBooksOutlined className="sp2-icon" />
              </div>
              <p className="sp2-stat-number">{totalItems}</p>
              <p className="sp2-stat-label">Active Topics</p>
            </article>

            <article className="sp2-stat-card sp2-stat-card--gradient">
              <div className="sp2-stat-head">
                <div className="sp2-stat-icon sp2-stat-icon--light">
                  <TrendingUpOutlined className="sp2-icon" />
                </div>
                <span className="sp2-stat-pill">Live</span>
              </div>
              <div className="sp2-stat-progress">
                <p className="sp2-stat-number">
                  {rows.length}
                  <span> / {Math.max(totalItems, rows.length)}</span>
                </p>
                <p className="sp2-stat-label">Topics Loaded</p>
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
              aria-controls="speaking-filters"
            >
              <span>Filter Topics</span>
              <FilterListOutlined className="sp2-icon" />
            </button>

            <ScrollArea id="speaking-filters" type="auto" className="sp2-filter-block sp2-filter-block--scroll">
              <div className="sp2-filter-block__content">
                <h3>Section</h3>
                <div className="sp2-filter-list">
                  {[1, 2, 3].map((part) => {
                    const isActive = selectedPart === String(part);
                    return (
                      <button
                        key={`part-${part}`}
                        type="button"
                        className={`sp2-part-option ${isActive ? 'is-active' : ''}`}
                        onClick={() => handlePartToggle(part)}
                      >
                        <span className="sp2-check" aria-hidden="true">
                          {isActive ? 'X' : ''}
                        </span>
                        {partMeta[part].label}
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
                  <button
                    type="button"
                    className={`sp2-topic-pill ${selectedTopic === 'all' ? 'is-active' : ''}`}
                    onClick={() => handleTopicSelect('all')}
                  >
                    All
                  </button>
                  {topics.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      className={`sp2-topic-pill ${selectedTopic === topic ? 'is-active' : ''}`}
                      onClick={() => handleTopicSelect(topic)}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </aside>

          <section className={`sp2-grid-wrap ${isFetching ? 'is-fetching' : ''}`}>
            {errorMessage && rows.length === 0 ? (
              <div className="sp2-empty">
                <h3>Unable to load speaking topics</h3>
                <p>{errorMessage}</p>
              </div>
            ) : null}

            {!errorMessage && rows.length === 0 ? (
              <div className="sp2-empty">
                <h3>No topics found</h3>
                <p>Try another search term or remove active filters.</p>
              </div>
            ) : null}

            <div className="sp2-card-grid">
              {rows.map((item, index) => {
                const cardImage = resolveCardImage(item);
                const cardCoverStyle = cardImage ? { backgroundImage: `url("${cardImage}")` } : undefined;
                const part = Number(item?.part || 1);
                const category = toText(item?.title) || 'General';
                const prompt = toText(item?.prompt) || 'Speaking prompt unavailable';
                const description =
                  toCueCardPreview(item?.cue_card) ||
                  toText(item?.sub_questions?.[0]) ||
                  CARD_DESCRIPTION_FALLBACK;

                return (
                  <article key={item?._id || `${category}-${index}`} className="sp2-card">
                    <div
                      className={`sp2-card-cover ${cardImage ? '' : 'sp2-card-cover--fallback'}`.trim()}
                      style={cardCoverStyle}
                    >
                      <div className="sp2-card-overlay" />
                      <span className={partBadgeClass(part)}>{partMeta[part]?.chip || `Part ${part}`}</span>
                      <span className="sp2-card-category">{category}</span>
                    </div>

                    <div className="sp2-card-body">
                      <h3>{prompt}</h3>
                      <p>{description}</p>
                      <Link to={`/practice/speaking/${item?._id}`} className="sp2-primary-cta">
                        <MicOutlined className="sp2-icon" />
                        Practice with AI
                        <ArrowForwardOutlined className="sp2-icon" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 ? (
              <div className="sp2-pagination" aria-label="Speaking topic pagination">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={!pagination.hasPrevPage || isFetching}
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
                      disabled={isFetching}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  aria-label="Next page"
                  disabled={!pagination.hasNextPage || isFetching}
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
