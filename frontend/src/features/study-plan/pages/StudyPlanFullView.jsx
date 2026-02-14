import React, { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import { Link, useNavigate } from 'react-router-dom';
import PaginationControls from '@/shared/components/PaginationControls';

const PAGE_SIZE = 30;

export default function StudyPlanFullView() {
    const navigate = useNavigate();
    const [plan, setPlan] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [history, setHistory] = useState([]);
    const [view, setView] = useState('upcoming'); // 'upcoming' or 'history'
    const [loading, setLoading] = useState(true);
    const [upcomingPage, setUpcomingPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const [upcomingPagination, setUpcomingPagination] = useState(null);
    const [historyPagination, setHistoryPagination] = useState(null);

    useEffect(() => {
        fetchData();
    }, [upcomingPage, historyPage]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [planRes, historyRes] = await Promise.all([
                api.getMyPlan({ page: upcomingPage, limit: PAGE_SIZE }),
                api.getStudyHistory({ page: historyPage, limit: PAGE_SIZE })
            ]);

            setPlan(planRes.plan);
            setTasks(planRes.tasks || []);
            setHistory(historyRes.tasks || []);
            setUpcomingPagination(planRes.pagination || null);
            setHistoryPagination(historyRes.pagination || null);
            console.log("Tasks loaded in FullView:", planRes.tasks);
        } catch (error) {
            console.error("Error fetching data", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    if (!plan && view === 'upcoming') return <div>Chưa có lộ trình. <Link to="/study-plan/setup">Tạo ngay</Link></div>;

    // Grouping Logic
    const groupTasksByDate = (taskList) => {
        return taskList.reduce((acc, task) => {
            const dateStr = new Date(task.date || task.completedAt).toLocaleDateString();
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(task);
            return acc;
        }, {});
    };

    const displayTasks = view === 'upcoming' ? tasks : history;
    const tasksByDate = groupTasksByDate(displayTasks);

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: '#64748b'
                        }}
                    >
                        ← Quay lại
                    </button>
                    <h2 style={{ margin: 0 }}>Lộ trình học tập chi tiết</h2>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.5rem', borderRadius: '8px' }}>
                    <button
                        onClick={() => setView('upcoming')}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            border: 'none',
                            background: view === 'upcoming' ? '#fff' : 'transparent',
                            boxShadow: view === 'upcoming' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            fontWeight: view === 'upcoming' ? 600 : 400,
                            cursor: 'pointer'
                        }}
                    >
                        Upcoming
                    </button>
                    <button
                        onClick={() => setView('history')}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            border: 'none',
                            background: view === 'history' ? '#fff' : 'transparent',
                            boxShadow: view === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            fontWeight: view === 'history' ? 600 : 400,
                            cursor: 'pointer'
                        }}
                    >
                        History ({historyPagination?.totalItems ?? history.length})
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {Object.keys(tasksByDate).length === 0 ? (
                    <p style={{ color: '#64748b', fontStyle: 'italic' }}>No tasks found.</p>
                ) : (
                    Object.entries(tasksByDate).map(([date, dayTasks]) => (
                        <div key={date} style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                            <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>{date}</h4>
                            {dayTasks.map(task => (
                                <div key={task._id || task.referenceId} style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: task.status === 'completed' ? '#aaa' : '#333' }}>
                                    <span style={{ marginRight: '0.5rem' }}>{task.status === 'completed' ? '✅ ' : '⬜ '}</span>
                                    {task.link ? (
                                        <Link to={task.link} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dotted #ccc' }}>
                                            {task.title}
                                        </Link>
                                    ) : (
                                        <span>{task.title}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            <PaginationControls
                pagination={view === 'upcoming' ? upcomingPagination : historyPagination}
                loading={loading}
                itemLabel="tasks"
                onPageChange={(nextPage) => {
                    if (view === 'upcoming') {
                        setUpcomingPage(nextPage);
                    } else {
                        setHistoryPage(nextPage);
                    }
                }}
            />
        </div>
    );
}
