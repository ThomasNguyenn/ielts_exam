import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/shared/api/client';
import PaginationControls from '@/shared/components/PaginationControls';
import './ScoreDashboard.css';

export default function UserScoreDetail() {
    const PAGE_SIZE = 20;
    const { userId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const userName = location.state?.userName || null;
    const [attempts, setAttempts] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');

    useEffect(() => {
        setCurrentPage(1);
    }, [userId, activeFilter]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await api.getAdminUserAttempts(userId, {
                    type: activeFilter,
                    page: currentPage,
                    limit: PAGE_SIZE,
                });
                if (response.success) {
                    setAttempts(response.data || []);
                    setPagination(response.pagination || null);
                }
            } catch (error) {
                console.error('Failed to fetch user details:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId, activeFilter, currentPage]);

    const calculateBandScore = (score, type) => {
        if (score === null || score === undefined) return null;

        const listeningMap = [
            { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
            { min: 32, band: 7.5 }, { min: 30, band: 7.0 }, { min: 26, band: 6.5 },
            { min: 23, band: 6.0 }, { min: 18, band: 5.5 }, { min: 16, band: 5.0 },
            { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
            { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
            { min: 1, band: 1.0 }, { min: 0, band: 0 },
        ];

        const readingMap = [
            { min: 39, band: 9.0 }, { min: 37, band: 8.5 }, { min: 35, band: 8.0 },
            { min: 33, band: 7.5 }, { min: 30, band: 7.0 }, { min: 27, band: 6.5 },
            { min: 23, band: 6.0 }, { min: 19, band: 5.5 }, { min: 15, band: 5.0 },
            { min: 13, band: 4.5 }, { min: 10, band: 4.0 }, { min: 8, band: 3.5 },
            { min: 6, band: 3.0 }, { min: 4, band: 2.5 }, { min: 2, band: 2.0 },
            { min: 1, band: 1.0 }, { min: 0, band: 0 },
        ];

        if (type === 'writing') return null;
        const mapping = type === 'listening' ? listeningMap : readingMap;
        const band = mapping.find(m => score >= m.min);
        return band ? band.band.toFixed(1) : '0.0';
    };

    if (loading) {
        return (
            <div className="score-dashboard">
                <div className="loading-container">
                    <div className="loader"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="score-dashboard">
            <div className="attempts-header">
                <div>
                    <button
                        className="btn-see-more"
                        onClick={() => navigate('/scores')}
                        style={{ marginBottom: '1rem' }}
                    >
                        &larr; Back to list
                    </button>
                </div>
                <div>
                    <h1>{userName ? `${userName}` : 'Chi tiết bài làm'}</h1>
                    {userName ? (
                        <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem' }}>
                            Lịch sử bài làm và điểm số
                        </p>
                    ) : (
                        <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem' }}>
                            User ID: {userId}
                        </p>
                    )}
                </div>
            </div>

            <div className="filter-tabs" style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem' }}>
                {['all', 'reading', 'listening', 'writing'].map(filter => (
                    <button
                        key={filter}
                        className={`filter-tab ${activeFilter === filter ? 'active' : ''}`}
                        onClick={() => setActiveFilter(filter)}
                    >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                ))}
            </div>

            <div className="attempts-grid">
                {attempts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '5rem', background: 'white', borderRadius: '1.5rem', border: '1px solid #e2e8f0', width: '100%' }}>
                        <h2 style={{ color: '#94a3b8' }}>No data for this filter yet.</h2>
                    </div>
                ) : (
                    attempts.map(attempt => (
                        <div key={attempt._id} className="attempt-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span className={`attempt-type type-${attempt.type}`}>
                                    {attempt.type}
                                </span>
                                {(attempt.type === 'reading' || attempt.type === 'listening') && attempt.score !== null && (
                                    <span className="band-badge">
                                        Band {calculateBandScore(attempt.score, attempt.type)}
                                    </span>
                                )}
                            </div>
                            <h3 className="attempt-test-title">
                                {attempt.test_id?.title || 'Unknown test'}
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                                Submitted: {new Date(attempt.submitted_at).toLocaleString()}
                            </p>

                            <div className="attempt-stats">
                                <div className="stat-item">
                                    <span className="stat-label">Score</span>
                                    <span className="stat-value">
                                        {attempt.score !== null ? `${attempt.score}/${attempt.total}` : 'Pending grading'}
                                    </span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Time</span>
                                    <span className="stat-value">
                                        {attempt.time_taken_ms ? `${Math.floor(attempt.time_taken_ms / 60000)}m ${Math.floor((attempt.time_taken_ms % 60000) / 1000)}s` : 'N/A'}
                                    </span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Percent</span>
                                    <span className="stat-value">
                                        {attempt.percentage !== null ? `${attempt.percentage}%` : 'N/A'}
                                    </span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Wrong/Skipped</span>
                                    <span className="stat-value">
                                        {attempt.wrong ?? 0} / {attempt.skipped ?? 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <PaginationControls
                pagination={pagination}
                onPageChange={setCurrentPage}
                loading={loading}
                itemLabel="attempts"
            />
        </div>
    );
}
