import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import PaginationControls from '@/shared/components/PaginationControls';
import { BarChart3 } from 'lucide-react';
import './ScoreDashboard.css';

export default function ScoreDashboard() {
    const PAGE_SIZE = 20;
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [retryingAllFailedLogs, setRetryingAllFailedLogs] = useState(false);
    const { showNotification } = useNotification();
    const currentUser = api.getUser() || {};
    const isAdmin = String(currentUser?.role || '').toLowerCase() === 'admin';

    useEffect(() => {
        fetchUsers(currentPage);
    }, [currentPage]);

    const fetchUsers = async (page = 1) => {
        try {
            setLoading(true);
            const response = await api.getAdminUsersScores({ page, limit: PAGE_SIZE });
            if (response.success) {
                setUsers(response.data || []);
                setPagination(response.pagination || null);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSeeMore = (userId, userName) => {
        navigate(`/scores/${userId}`, { state: { userName } });
    };

    const handleRetryAllFailedSpeakingLogs = async () => {
        if (!isAdmin || retryingAllFailedLogs) return;
        try {
            setRetryingAllFailedLogs(true);
            const response = await api.retryFailedSpeakingErrorLogsBulk({
                window_hours: 24,
                limit: 200,
            });
            const data = response?.data || {};
            const requeued = Number(data?.requeued || 0);
            const scanned = Number(data?.scanned || 0);
            showNotification(`Queued retry for ${requeued}/${scanned} failed speaking log sessions.`, 'success');
        } catch (error) {
            showNotification(error?.message || 'Failed to queue bulk retry for speaking logs', 'error');
        } finally {
            setRetryingAllFailedLogs(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatScore = (scoreData) => {
        if (!scoreData) return <span className="no-score">N/A</span>;
        return (
            <div className="band-score">
                <span className="score-value">{scoreData.score ?? '0'} / {scoreData.total ?? '0'}</span>
                <span className="score-meta">{new Date(scoreData.submitted_at).toLocaleDateString()}</span>
            </div>
        );
    };

    const getRoleBadgeClass = (role) => {
        switch (role) {
            case 'admin': return 'type-writing';
            case 'teacher': return 'type-reading';
            default: return 'type-listening';
        }
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
            <button
                className="btn-see-more"
                onClick={() => navigate('/')}
                style={{ marginBottom: '1rem' }}
            >
                &larr; Back to home
            </button>
            <h1>User Score Dashboard</h1>

            <div className="dashboard-toolbar">
                <div className="search-section">
                    <input
                        type="text"
                        placeholder="Search by name, email, or role..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {isAdmin && (
                    <button
                        className="btn-admin-bulk-retry"
                        onClick={handleRetryAllFailedSpeakingLogs}
                        disabled={retryingAllFailedLogs}
                        title="Retry failed speaking error logs across students"
                    >
                        {retryingAllFailedLogs ? 'Retrying...' : 'Retry Failed Speaking Logs (All Students)'}
                    </button>
                )}
            </div>

            <div className="scores-table-container">
                <table className="scores-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Reading</th>
                            <th>Listening</th>
                            <th>Writing</th>
                            <th>Speaking</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user._id}>
                                <td>
                                    <div className="student-info">
                                        <span className="student-name">{user.name}</span>
                                        <span className="student-email">{user.email}</span>
                                    </div>
                                </td>
                                <td>
                                    <span className={`attempt-type ${getRoleBadgeClass(user.role)}`} style={{ margin: 0 }}>
                                        {user.role}
                                    </span>
                                </td>
                                <td>{formatScore(user.latestScores?.reading)}</td>
                                <td>{formatScore(user.latestScores?.listening)}</td>
                                <td>{formatScore(user.latestScores?.writing)}</td>
                                <td>{formatScore(user.latestScores?.speaking)}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <button
                                            className="btn-see-more"
                                            onClick={() => handleSeeMore(user._id, user.name)}
                                        >
                                            See more
                                        </button>
                                        <Link
                                            to={`/analytics/student/${user._id}`}
                                            className="btn-see-more"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
                                        >
                                            <BarChart3 size={14} /> Analytics
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredUsers.length === 0 && (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        No users found.
                    </div>
                )}
            </div>

            <PaginationControls
                pagination={pagination}
                onPageChange={setCurrentPage}
                loading={loading}
                itemLabel="users"
            />
        </div>
    );
}
