import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import PracticeCardSkeleton from '@/shared/components/PracticeCardSkeleton';
import { PenTool, Search, ArrowRight, FileText, Sparkles } from 'lucide-react';
import './PracticeList.css';

export default function PracticeList() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, task1, task2

    useEffect(() => {
        setLoading(true);
        api.getWritings()
            .then((res) => {
                if (res.success) setTasks(res.data || []);
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const filteredTasks = tasks.filter(t => {
        const title = t.title || '';
        const prompt = t.prompt || '';
        const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            prompt.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = filterType === 'all' ||
            (filterType === 'task1' && t.task_type === 'task1') ||
            (filterType === 'task2' && t.task_type === 'task2');

        return matchesSearch && matchesType;
    });

    const task1Count = tasks.filter(t => t.task_type === 'task1').length;
    const task2Count = tasks.filter(t => t.task_type === 'task2').length;

    /* Skeleton loading */
    if (loading) {
        return (
            <div className="writing-page">
                <div style={{
                    background: 'linear-gradient(135deg, #4F46E5, #818CF8)',
                    borderRadius: '20px',
                    padding: '2.5rem 3rem',
                    marginBottom: '2rem'
                }}>
                    <div style={{ height: '2rem', width: '40%', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', marginBottom: '0.75rem' }} />
                    <div style={{ height: '1rem', width: '55%', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }} />
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                    <div style={{ flex: 1, minWidth: '200px', height: '44px', background: '#F1F5F9', borderRadius: '12px' }} />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ width: '80px', height: '36px', background: '#F1F5F9', borderRadius: '50px' }} />
                        ))}
                    </div>
                </div>

                <div className="wr-cards-grid">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <PracticeCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="writing-page">
            {/* ── Hero Banner ── */}
            <div className="wr-hero">
                <div className="wr-hero-content">
                    <div className="wr-hero-text">
                        <h1>✍️ Luyện viết Writing</h1>
                        <p>Chọn đề bài và luyện viết với AI chấm điểm chi tiết theo 4 tiêu chí IELTS.</p>
                    </div>
                    <div className="wr-hero-actions">
                        <Link to="/learn/skills" className="wr-hero-btn wr-hero-btn--primary">
                            <Sparkles size={16} />
                            Skill Workshop
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Controls ── */}
            <div className="wr-controls">
                <div className="wr-search-wrapper">
                    <Search className="wr-search-icon" />
                    <input
                        type="search"
                        placeholder="Tìm kiếm đề bài..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="wr-search"
                    />
                </div>

                <div className="wr-task-filters">
                    {[
                        { key: 'all', label: 'Tất cả', count: tasks.length },
                        { key: 'task1', label: 'Task 1', count: task1Count },
                        { key: 'task2', label: 'Task 2', count: task2Count }
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilterType(f.key)}
                            className={`wr-pill ${filterType === f.key ? 'wr-pill--active' : ''}`}
                        >
                            {f.label} ({f.count})
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Cards Grid ── */}
            {filteredTasks.length === 0 ? (
                <div className="wr-empty">
                    <div className="wr-empty-icon">
                        <FileText />
                    </div>
                    <h3>Không tìm thấy đề bài nào</h3>
                    <p>Thử tìm kiếm với từ khoá khác hoặc bỏ bộ lọc.</p>
                </div>
            ) : (
                <div className="wr-cards-grid">
                    {filteredTasks.map(t => (
                        <div key={t._id} className="wr-card">
                            <div className="wr-card-top">
                                <span className={`wr-card-badge ${t.task_type === 'task1' ? 'wr-card-badge--t1' : 'wr-card-badge--t2'}`}>
                                    {t.task_type === 'task1' ? 'Task 1' : 'Task 2'}
                                </span>
                                <div className="wr-card-icon">
                                    <PenTool />
                                </div>
                            </div>

                            <h3 className="wr-card-title">{t.title}</h3>
                            <p className="wr-card-prompt">{t.prompt}</p>

                            <Link to={`/practice/${t._id}`} className="wr-card-link">
                                Bắt đầu luyện tập
                                <ArrowRight />
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
