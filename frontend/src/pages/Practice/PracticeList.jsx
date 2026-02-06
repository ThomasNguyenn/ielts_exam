import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import './Practice.css'; // Re-use practice styles if possible, or add new ones

export default function PracticeList() {
    const [writings, setWritings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, task1, task2

    useEffect(() => {
        api.getWritings()
            .then((res) => {
                if (res.success) setWritings(res.data || []);
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const filteredWritings = writings.filter(w => {
        const matchesSearch = w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            w.prompt.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'all' ||
            (filterType === 'task1' && w.task_type === 'task1') ||
            (filterType === 'task2' && w.task_type === 'task2');
        return matchesSearch && matchesType;
    });

    if (loading) return <div className="practice-container">Loading tasks...</div>;

    return (
        <div className="page practice-list-page" style={{ maxWidth: '80vw', width: '100%', margin: '0 auto', padding: '2rem' }}>
            <div className="practice-header" style={{ marginBottom: '2rem', background: '#FFF9F1' }}>
                <h1 style={{ fontSize: '2rem', color: '#d03939', marginBottom: '1rem' }}>Thư viện luyện viết Writing</h1>
                <p className="muted">Chọn chủ đề để bắt đầu luyện viết với AI feedback.</p>
            </div>

            <div className="practice-controls" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                <input
                    type="search"
                    placeholder="Tìm kiếm chủ đề..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, minWidth: '200px', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <div className="filter-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                    {['all', 'task1', 'task2'].map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
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
                            {type === 'all' ? 'All Tasks' : type === 'task1' ? 'Task 1' : 'Task 2'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="practice-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {filteredWritings.map(w => (
                    <div key={w._id} className="practice-card" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                            <span className={`badge ${w.task_type === 'task1' ? 'badge-blue' : 'badge-purple'}`}
                                style={{ background: '#fdf4e3', color: '#d03939', padding: '4px 12px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {w.task_type === 'task1' ? 'Task 1' : 'Task 2'}
                            </span>
                        </div>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#0f172a', fontWeight: 800, flex: 1 }}>{w.title}</h3>
                        <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {w.prompt}
                        </p>
                        {w.task_type === 'task1' || w.task_type === 1 ? (
                            <button className="btn btn-secondary" disabled style={{ textAlign: 'center', opacity: 0.6, cursor: 'not-allowed', borderRadius: '8px' }}>
                                Đang bảo trì
                            </button>
                        ) : (
                            <Link to={`/practice/${w._id}`} className="btn-sidebar-start" style={{ textDecoration: 'none' }}>
                                Bắt đầu luyện tập
                            </Link>
                        )}
                    </div>
                ))}
            </div>

            {filteredWritings.length === 0 && (
                <div className="empty-state" style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
                    <p>Không tìm thấy chủ đề nào.</p>
                </div>
            )}
        </div>
    );
}
