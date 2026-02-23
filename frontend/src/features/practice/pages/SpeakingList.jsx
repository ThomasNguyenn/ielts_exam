import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import PracticeCardSkeleton from '@/shared/components/PracticeCardSkeleton';
import PaginationControls from '@/shared/components/PaginationControls';
import { Mic, Search, ArrowRight, MessageSquare, ChevronDown, Filter } from 'lucide-react';
import './SpeakingList.css';

const PAGE_SIZE = 12;

function useAnimatedCount(target, durationMs = 1600) {
    const safeTarget = Number.isFinite(Number(target)) ? Number(target) : 0;
    const [value, setValue] = useState(0);
    const valueRef = useRef(0);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        const mediaQuery = typeof window !== 'undefined' && window.matchMedia
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : null;

        if (mediaQuery?.matches) {
            setValue(safeTarget);
            return undefined;
        }

        const startValue = valueRef.current;
        const delta = safeTarget - startValue;
        if (delta === 0) return undefined;

        const startTime = performance.now();
        let rafId = 0;

        const tick = (now) => {
            const progress = Math.min((now - startTime) / durationMs, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(startValue + (delta * eased)));

            if (progress < 1) {
                rafId = requestAnimationFrame(tick);
            } else {
                setValue(safeTarget);
            }
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [safeTarget, durationMs]);

    return value;
}

/* Assign a badge style per part number */
const partBadgeClass = (part) => {
    if (part === 1) return 'sp-card-badge--p1';
    if (part === 2) return 'sp-card-badge--p2';
    return 'sp-card-badge--p3';
};

export default function SpeakingList() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [uniqueTopics, setUniqueTopics] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    /* Close dropdown on outside click */
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /* Debounced search */
    useEffect(() => {
        if (searchInput === searchQuery) return;
        const timer = setTimeout(() => {
            setSearchQuery(searchInput);
            setCurrentPage(1);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchInput, searchQuery]);

    /* Fetch unique topics */
    useEffect(() => {
        api.getSpeakings({ topicsOnly: true })
            .then((res) => setUniqueTopics(res.topics || []))
            .catch((err) => console.error(err));
    }, []);

    /* Fetch tasks */
    useEffect(() => {
        if (!loading) setIsFetching(true);
        api.getSpeakings({
            page: currentPage,
            limit: PAGE_SIZE,
            q: searchQuery.trim() || undefined,
            part: filterType !== 'all' ? filterType : undefined,
            topic: selectedTopic !== 'all' ? selectedTopic.trim() : undefined
        })
            .then((res) => {
                setTasks(res.data || []);
                setPagination(res.pagination || null);
            })
            .catch((err) => console.error(err))
            .finally(() => {
                setLoading(false);
                setIsFetching(false);
            });
    }, [currentPage, searchQuery, filterType, selectedTopic]);

    /* Group tasks by topic */
    const groupedTasks = tasks.reduce((groups, task) => {
        const topic = task.title;
        if (!groups[topic]) groups[topic] = [];
        groups[topic].push(task);
        return groups;
    }, {});

    Object.keys(groupedTasks).forEach(topic => {
        groupedTasks[topic].sort((a, b) => a.part - b.part);
    });

    const totalItems = pagination?.totalItems ?? tasks.length;
    const animatedTotalItems = useAnimatedCount(totalItems, 1800);
    const animatedUniqueTopics = useAnimatedCount(uniqueTopics.length, 1800);
    const animatedParts = useAnimatedCount(3, 1800);

    /* Skeleton loading state */
    if (loading) {
        return (
            <div className="speaking-page">
                {/* Hero skeleton */}
                <div style={{
                    background: 'linear-gradient(135deg, #6366F1, #A855F7)',
                    padding: '3rem 2.5rem 4rem',
                    marginBottom: '0'
                }}>
                    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                        <div style={{ height: '2.25rem', width: '45%', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', marginBottom: '0.75rem' }} />
                        <div style={{ height: '1rem', width: '55%', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                    </div>
                </div>

                <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2rem' }}>
                    {/* Controls skeleton */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '-1.5rem', marginBottom: '2rem', background: 'white', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
                        <div style={{ flex: 1, minWidth: '200px', height: '42px', background: '#F1F5F9', borderRadius: '0.75rem' }} />
                        <div style={{ width: '180px', height: '42px', background: '#F1F5F9', borderRadius: '0.75rem' }} />
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} style={{ width: '78px', height: '36px', background: '#F1F5F9', borderRadius: '50px' }} />
                            ))}
                        </div>
                    </div>

                    {/* Cards skeleton */}
                    <div className="sp-cards-grid">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <PracticeCardSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="speaking-page">
            {/* ── Hero Banner ── */}
            <div className="sp-hero">
                <div className="sp-hero-content">
                    <div className="sp-hero-text">
                        <h1>🎙️ Luyện nói Speaking</h1>
                        <p>Chọn chủ đề và thực hành trả lời với AI feedback thông minh. Nâng band Speaking hiệu quả!</p>
                    </div>
                    <div className="sp-hero-stats">
                        <div className="sp-hero-stat">
                            <span className="sp-hero-stat-value">{animatedTotalItems}</span>
                            <span className="sp-hero-stat-label">Câu hỏi</span>
                        </div>
                        <div className="sp-hero-stat">
                            <span className="sp-hero-stat-value">{animatedUniqueTopics}</span>
                            <span className="sp-hero-stat-label">Chủ đề</span>
                        </div>
                        <div className="sp-hero-stat">
                            <span className="sp-hero-stat-value">{animatedParts}</span>
                            <span className="sp-hero-stat-label">Parts</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="sp-body">
                {/* ── Floating Controls Bar ── */}
                <div className="sp-controls">
                    <div className="sp-search-wrapper">
                        <Search className="sp-search-icon" />
                        <input
                            type="search"
                            placeholder="Tìm kiếm chủ đề..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="sp-search"
                        />
                    </div>

                    <div className="sp-dropdown" ref={dropdownRef}>
                        <button
                            type="button"
                            className={`sp-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                            <Filter size={16} className="sp-dropdown-icon" />
                            <span className="sp-dropdown-label">
                                {selectedTopic === 'all' ? 'Tất cả chủ đề' : selectedTopic}
                            </span>
                            <ChevronDown size={16} className={`sp-dropdown-chevron ${dropdownOpen ? 'rotated' : ''}`} />
                        </button>
                        {dropdownOpen && (
                            <div className="sp-dropdown-menu">
                                <button
                                    type="button"
                                    className={`sp-dropdown-item ${selectedTopic === 'all' ? 'active' : ''}`}
                                    onClick={() => { setSelectedTopic('all'); setCurrentPage(1); setDropdownOpen(false); }}
                                >
                                    Tất cả chủ đề
                                </button>
                                {uniqueTopics.map(topic => (
                                    <button
                                        type="button"
                                        key={topic}
                                        className={`sp-dropdown-item ${selectedTopic === topic ? 'active' : ''}`}
                                        onClick={() => { setSelectedTopic(topic); setCurrentPage(1); setDropdownOpen(false); }}
                                    >
                                        {topic}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="sp-part-filters">
                        {['all', '1', '2', '3'].map(type => (
                            <button
                                key={type}
                                onClick={() => {
                                    setFilterType(type);
                                    setCurrentPage(1);
                                }}
                                className={`sp-part-pill ${filterType === type ? 'sp-part-pill--active' : ''}`}
                            >
                                {type === 'all' ? 'Tất cả' : `Part ${type}`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Topic Groups ── */}
                <div className={isFetching ? 'sp-fetching' : ''}>
                    {Object.keys(groupedTasks).length === 0 ? (
                        <div className="sp-empty">
                            <div className="sp-empty-icon">
                                <MessageSquare />
                            </div>
                            <h3>Không tìm thấy chủ đề nào</h3>
                            <p>Thử tìm kiếm với từ khoá khác hoặc bỏ bộ lọc.</p>
                        </div>
                    ) : (
                        Object.entries(groupedTasks).map(([topic, topicTasks]) => (
                            <div key={topic} className="sp-topic-group">
                                <div className="sp-topic-header">
                                    <h3 className="sp-topic-title">{topic}</h3>
                                    <span className="sp-topic-count">{topicTasks.length} câu hỏi</span>
                                </div>

                                <div className="sp-cards-grid">
                                    {topicTasks.map(t => (
                                        <div key={t._id} className="sp-card">
                                            <div className="sp-card-top">
                                                <span className={`sp-card-badge ${partBadgeClass(t.part)}`}>
                                                    Part {t.part}
                                                </span>
                                                <div className="sp-card-mic">
                                                    <Mic />
                                                </div>
                                            </div>

                                            <p className="sp-card-prompt">{t.prompt}</p>

                                            <Link to={`/practice/speaking/${t._id}`} className="sp-card-link">
                                                Bắt đầu trả lời
                                                <ArrowRight />
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* ── Pagination ── */}
                <div className="sp-pagination">
                    <PaginationControls
                        pagination={pagination}
                        loading={loading || isFetching}
                        itemLabel="topics"
                        onPageChange={setCurrentPage}
                    />
                </div>
            </div>
        </div>
    );
}
