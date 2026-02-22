import React, { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import { Link, useNavigate } from 'react-router-dom';
import PaginationControls from '@/shared/components/PaginationControls';
import { ArrowLeft, History, CalendarDays, CheckCircle2, Circle, ChevronRight, Calendar } from 'lucide-react';
import './StudyPlanFullView.css';

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
        } catch (error) {
            console.error("Error fetching data", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="study-plan-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 1rem', width: 40, height: 40, border: '4px solid #eef2ff', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ color: '#64748b', fontWeight: 600 }}>Tải lộ trình học tập...</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!plan && view === 'upcoming') {
        return (
            <div className="study-plan-container">
                <div className="plan-empty-state">
                    <div className="plan-empty-icon">
                        <Calendar size={40} />
                    </div>
                    <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Chưa có lộ trình học tập</h2>
                    <p style={{ color: '#64748b', maxWidth: 400, margin: '0 auto' }}>
                        Tạo lộ trình học tập cá nhân hóa dựa trên mục tiêu thực tế của bạn để đạt điểm số mong ước.
                    </p>
                    <Link to="/study-plan/setup" className="empty-state-btn">
                        Thiết lập lộ trình ngay
                    </Link>
                </div>
            </div>
        );
    }

    // Grouping Logic
    const groupTasksByDate = (taskList) => {
        return taskList.reduce((acc, task) => {
            const dateObj = new Date(task.date || task.completedAt);
            const dateStr = dateObj.toLocaleDateString('vi-VN', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;

            if (!acc[key]) {
                acc[key] = {
                    dayText: dateObj.toLocaleDateString('vi-VN', { weekday: 'short' }),
                    numText: dateObj.getDate(),
                    fullLabel: dateStr,
                    tasks: []
                };
            }
            acc[key].tasks.push(task);
            return acc;
        }, {});
    };

    const displayTasks = view === 'upcoming' ? tasks : history;
    const tasksByDate = groupTasksByDate(displayTasks);

    const getTaskTypeInfo = (task) => {
        if (task.link?.includes('/practice') || task.title?.toLowerCase().includes('luyện tập')) return { label: 'Thực hành', class: 'badge-practice' };
        if (task.link?.includes('/learn') || task.title?.toLowerCase().includes('bài học')) return { label: 'Bài học', class: 'badge-lesson' };
        if (task.link?.includes('/test') || task.title?.toLowerCase().includes('thi')) return { label: 'Kiểm tra', class: 'badge-exam' };
        return { label: 'Nhiệm vụ', class: 'badge-practice' };
    };

    return (
        <div className="study-plan-container">
            {/* Header Area */}
            <div className="plan-header">
                <div className="plan-title-wrapper">
                    <button onClick={() => navigate(-1)} className="btn-back">
                        <ArrowLeft size={18} /> Quay lại
                    </button>
                    <h2 className="plan-title">Lộ trình chi tiết</h2>
                </div>

                <div className="view-switcher">
                    <button
                        onClick={() => setView('upcoming')}
                        className={`view-btn ${view === 'upcoming' ? 'active' : ''}`}
                    >
                        <CalendarDays size={18} /> Kế hoạch
                    </button>
                    <button
                        onClick={() => setView('history')}
                        className={`view-btn ${view === 'history' ? 'active' : ''}`}
                    >
                        <History size={18} /> Lịch sử ({historyPagination?.totalItems ?? history.length})
                    </button>
                </div>
            </div>

            {/* Timeline UI */}
            <div className="plan-timeline">
                {Object.keys(tasksByDate).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontStyle: 'italic', background: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
                        Không có nhiệm vụ nào trong danh sách.
                    </div>
                ) : (
                    Object.values(tasksByDate).map((dayGroup, index) => (
                        <div key={index} className="day-block">
                            <div className="date-marker">
                                <div className="date-dot"></div>
                                <div className="date-label">
                                    <span className="date-day">{dayGroup.dayText}</span>
                                    <span className="date-num">{dayGroup.numText}</span>
                                </div>
                            </div>

                            <div className="day-tasks">
                                <h4 style={{ margin: '0 0 1.25rem 0', color: '#475569', fontSize: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <CalendarDays size={16} /> {dayGroup.fullLabel}
                                </h4>

                                <div className="task-list">
                                    {dayGroup.tasks.map((task) => {
                                        const isCompleted = task.status === 'completed';
                                        const typeInfo = getTaskTypeInfo(task);
                                        const Wrapper = task.link ? Link : 'div';
                                        const wrapperProps = task.link ? { to: task.link, className: `task-item ${isCompleted ? 'completed' : ''}` } : { className: `task-item ${isCompleted ? 'completed' : ''}` };

                                        return (
                                            <Wrapper key={task._id || task.referenceId} {...wrapperProps}>
                                                <div className="task-icon-wrap">
                                                    {isCompleted ? (
                                                        <CheckCircle2 size={22} className="icon-completed" />
                                                    ) : (
                                                        <Circle size={22} className="icon-pending" />
                                                    )}
                                                </div>

                                                <div className="task-content">
                                                    <h5 className="task-title">{task.title}</h5>
                                                    <span className={`task-type-badge ${typeInfo.class}`}>
                                                        {typeInfo.label}
                                                    </span>
                                                </div>

                                                {task.link && (
                                                    <div className="task-action">
                                                        <ChevronRight size={20} />
                                                    </div>
                                                )}
                                            </Wrapper>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="pagination-wrapper">
                <PaginationControls
                    pagination={view === 'upcoming' ? upcomingPagination : historyPagination}
                    loading={loading}
                    itemLabel={view === 'upcoming' ? "nhiệm vụ sắp tới" : "nhiệm vụ lịch sử"}
                    onPageChange={(nextPage) => {
                        if (view === 'upcoming') {
                            setUpcomingPage(nextPage);
                        } else {
                            setHistoryPage(nextPage);
                        }
                    }}
                />
            </div>
        </div>
    );
}
