import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import PracticeCardSkeleton from '../../components/PracticeCardSkeleton';
import PaginationControls from '../../components/PaginationControls';
import './Practice.css';

const PAGE_SIZE = 12;

export default function SpeakingList() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [uniqueTopics, setUniqueTopics] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState(null);

    useEffect(() => {
        api.getSpeakings({ topicsOnly: true })
            .then((res) => setUniqueTopics(res.topics || []))
            .catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        setLoading(true);
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
            .finally(() => setLoading(false));
    }, [currentPage, searchQuery, filterType, selectedTopic]);

    // Group current page tasks by topic
    const groupedTasks = tasks.reduce((groups, task) => {
        const topic = task.title;
        if (!groups[topic]) groups[topic] = [];
        groups[topic].push(task);
        return groups;
    }, {});

    Object.keys(groupedTasks).forEach(topic => {
        groupedTasks[topic].sort((a, b) => a.part - b.part);
    });

    if (loading) {
        return (
            <div className="page practice-list-page" style={{ maxWidth: '80vw', width: '100%', margin: '0 auto', padding: '2rem' }}>
                <div className="practice-header" style={{ marginBottom: '2rem', background: '#FFF9F1' }}>
                    <div className="h-10 bg-gray-200 rounded w-1/3 mb-4 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>

                <div className="practice-controls" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                    <div className="h-12 bg-gray-200 rounded-lg flex-1 animate-pulse" style={{ minWidth: '200px' }}></div>
                    <div className="h-12 bg-gray-200 rounded-lg w-48 animate-pulse"></div>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-10 w-24 bg-gray-200 rounded-full animate-pulse"></div>
                        ))}
                    </div>
                </div>

                <div className="practice-content-area">
                    <div className="topic-group">
                        <div className="topic-group-header mb-4">
                            <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                        </div>
                        <div className="topic-group-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <PracticeCardSkeleton key={i} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page practice-list-page" style={{ maxWidth: '80vw', width: '100%', margin: '0 auto', padding: '2rem' }}>
            <div className="practice-header" style={{ marginBottom: '2rem', background: '#FFF9F1' }}>
                <h1 style={{ fontSize: '2rem', color: '#d03939', marginBottom: '1rem' }}>
                    Thư viện luyện nói Speaking
                </h1>
                <p className="muted">Chọn chủ đề để bắt đầu luyện nói với AI feedback.</p>
            </div>

            <div className="practice-controls" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                <input
                    type="search"
                    placeholder="Tìm kiếm chủ đề..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="form-input"
                    style={{ flex: 1, minWidth: '200px', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />

                <select
                    value={selectedTopic}
                    onChange={(e) => {
                        setSelectedTopic(e.target.value);
                        setCurrentPage(1);
                    }}
                    className="form-select"
                    style={{ width: 'auto', minWidth: '200px', cursor: 'pointer' }}
                >
                    <option value="all">Tất cả chủ đề</option>
                    {uniqueTopics.map(topic => (
                        <option key={topic} value={topic}>{topic}</option>
                    ))}
                </select>

                <div className="filter-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                    {['all', '1', '2', '3'].map(type => (
                        <button
                            key={type}
                            onClick={() => {
                                setFilterType(type);
                                setCurrentPage(1);
                            }}
                            className={`btn ${filterType === type ? 'btn-active-red' : 'btn-ghost'}`}
                            style={{
                                textTransform: 'capitalize',
                                background: filterType === type ? '#d03939' : 'transparent',
                                color: filterType === type ? 'white' : '#64748b',
                                border: filterType === type ? 'none' : '1px solid #e2e8f0',
                                borderRadius: '50px',
                                padding: '0.5rem 1.25rem'
                            }}
                        >
                            {type === 'all' ? 'All Parts' : `Part ${type}`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="practice-content-area">
                {Object.keys(groupedTasks).length === 0 ? (
                    <div className="empty-state" style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
                        <p>Không tìm thấy chủ đề nào.</p>
                    </div>
                ) : (
                    Object.entries(groupedTasks).map(([topic, topicTasks]) => (
                        <div key={topic} className="topic-group">
                            <div className="topic-group-header">
                                <h3 className="topic-group-title" style={{ whiteSpace: 'pre-wrap' }}>{topic}</h3>
                                <span className="topic-group-count">{topicTasks.length} câu hỏi</span>
                            </div>
                            <div className="topic-group-content">
                                {topicTasks.map(t => (
                                    <div key={t._id} className="practice-card" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                            <span className="badge"
                                                style={{ background: '#fdf4e3', color: '#d03939', padding: '4px 12px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Part {t.part}
                                            </span>
                                        </div>
                                        <p className="muted" style={{ fontSize: '1rem', color: '#334155', lineHeight: '1.6', marginBottom: '1.5rem', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {t.prompt}
                                        </p>

                                        <Link to={`/practice/speaking/${t._id}`} className="btn-sidebar-start" style={{ textDecoration: 'none', background: '#3b82f6', color: 'white', padding: '0.75rem', borderRadius: '8px', textAlign: 'center', fontWeight: '600' }}>
                                            Bắt đầu trả lời
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <PaginationControls
                pagination={pagination}
                loading={loading}
                itemLabel="topics"
                onPageChange={setCurrentPage}
            />
        </div>
    );
}
