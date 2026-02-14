import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import StudyPlanSetup from '../legacy/StudyPlanSetup';

export default function StudyDashboardWidget() {
    const [plan, setPlan] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSetup, setShowSetup] = useState(false);

    useEffect(() => {
        fetchPlan();
    }, []);

    const fetchPlan = async () => {
        try {
            const res = await api.getMyPlan();
            setPlan(res.plan);

            if (res.tasks) {
                const now = new Date();
                now.setHours(0, 0, 0, 0); // Start of today

                const dailyTasks = res.tasks.filter(t => {
                    const tDate = new Date(t.date);
                    const isToday = tDate.toDateString() === new Date().toDateString();
                    const isOverdue = tDate < now && t.status !== 'completed';
                    return isToday || isOverdue;
                });
                setTasks(dailyTasks);
            }
        } catch (error) {
            console.error("Error fetching plan", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTask = async (task) => {
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';

        // Optimistic update
        setTasks(prev => prev.map(t =>
            t._id === task._id ? { ...t, status: newStatus } : t
        ));

        try {
            await api.updateTaskStatus(task, newStatus);
        } catch (error) {
            console.error("Update failed", error);
            fetchPlan(); // Revert on fail
        }
    };

    if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-xl"></div>;

    if (showSetup) {
        return (
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3>{plan ? 'Cập nhật lộ trình' : 'Thiết lập lộ trình mới'}</h3>
                    <button onClick={() => setShowSetup(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                </div>
                <StudyPlanSetup
                    initialData={plan}
                    mode={plan ? 'edit' : 'create'}
                    onCreated={() => { setShowSetup(false); fetchPlan(); }}
                />
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="study-widget-empty" style={{ padding: '2rem', background: 'white', borderRadius: '16px', border: '2px dashed #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>Chưa có lộ trình học?</h3>
                <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Tạo lộ trình cá nhân hóa để đạt Band Score mục tiêu.</p>
                <button
                    onClick={() => setShowSetup(true)}
                    className="btn-primary"
                    style={{
                        padding: '0.8rem 1.5rem',
                        borderRadius: '30px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                    }}
                >
                    Tạo lộ trình ngay
                </button>
            </div>
        );
    }

    // Calculate progress (Days remaining)
    const targetDate = new Date(plan.targetDate);
    const today = new Date();
    const daysLeft = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

    return (
        <div className="study-widget" style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Nhiệm vụ hôm nay</h3>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                        Còn <strong style={{ color: '#3b82f6' }}>{daysLeft} ngày</strong> tới kỳ thi
                    </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                        <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                            Target: {plan.targetBand}
                        </div>
                        <button
                            onClick={() => setShowSetup(true)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
                            title="Edit Plan"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    </div>
                    <div>
                        <Link to="/study-plan/full" style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'underline' }}>View Full Roadmap</Link>
                    </div>
                </div>
            </div>

            <div className="tasks-list">
                {tasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: '12px', color: '#15803d' }}>
                        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>🎉</span>
                        Tuyệt vời! Bạn đã hoàn thành hết nhiệm vụ hôm nay.
                    </div>
                ) : (
                    tasks.map(task => (
                        <div key={task._id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.8rem', padding: '1rem', background: task.status === 'completed' ? '#f8fafc' : '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', transition: 'all 0.2s' }}>
                            <div style={{ position: 'relative', width: '24px', height: '24px' }}>
                                <input
                                    type="checkbox"
                                    checked={task.status === 'completed'}
                                    onChange={() => handleToggleTask(task)}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        cursor: 'pointer',
                                        accentColor: '#3b82f6',
                                        opacity: 0,
                                        position: 'absolute',
                                        zIndex: 2,
                                        top: 0, left: 0
                                    }}
                                />
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    border: `2px solid ${task.status === 'completed' ? '#3b82f6' : '#cbd5e1'}`,
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: task.status === 'completed' ? '#3b82f6' : 'white',
                                    transition: 'all 0.2s'
                                }}>
                                    {task.status === 'completed' && <span style={{ color: 'white', fontSize: '14px' }}>✓</span>}
                                </div>
                            </div>

                            <div style={{ flex: 1, opacity: task.status === 'completed' ? 0.5 : 1 }}>
                                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.2rem' }}>{task.title}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }}></span>
                                    {task.type.replace('_', ' ')}
                                </div>
                            </div>

                            <Link
                                to={task.link || `/practice/${task.referenceId}`}
                                className="btn-start-task"
                                style={{
                                    color: task.status === 'completed' ? '#94a3b8' : '#3b82f6',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    background: task.status === 'completed' ? 'transparent' : '#eff6ff',
                                    fontSize: '0.9rem',
                                    pointerEvents: task.status === 'completed' ? 'none' : 'auto'
                                }}
                            >
                                {task.status === 'completed' ? 'Done' : 'Start'}
                            </Link>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
