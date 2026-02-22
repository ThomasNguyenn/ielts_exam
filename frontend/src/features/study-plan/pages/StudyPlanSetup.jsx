import React, { useEffect, useState } from 'react';
import { api } from '@/shared/api/client';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '@/shared/context/NotificationContext';

export default function StudyPlanSetup({ onCreated, mode = 'create', initialData = null }) {
    const [targetDate, setTargetDate] = useState('');
    const [targetBand, setTargetBand] = useState(6.5);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const isEditMode = mode === 'edit';

    useEffect(() => {
        if (!initialData) return;

        const dateValue = initialData.targetDate
            ? new Date(initialData.targetDate).toISOString().split('T')[0]
            : '';

        setTargetDate(dateValue);
        setTargetBand(initialData.targetBand ?? 6.5);
    }, [initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isEditMode) {
                await api.updateStudyPlan({ targetDate, targetBand });
            } else {
                await api.createStudyPlan({ targetDate, targetBand });
            }

            if (onCreated) onCreated();
            else navigate('/dashboard');
        } catch (error) {
            console.error(`Failed to ${isEditMode ? 'update' : 'create'} plan`, error);
            showNotification(`Failed to ${isEditMode ? 'update' : 'create'} study plan: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="study-plan-setup" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#1e293b' }}>Thiết lập lộ trình học tập</h2>

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Ngày thi dự kiến</label>
                    <input
                        type="date"
                        required
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Mục tiêu Band Score</label>
                    <input
                        type="number"
                        min="0"
                        max="9"
                        step="0.5"
                        required
                        value={targetBand}
                        onChange={(e) => setTargetBand(Number(e.target.value))}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                    style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: '#6366F1', color: 'white', border: 'none', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                    {loading
                        ? (isEditMode ? 'Đang cập nhật lộ trình...' : 'Đang tạo lộ trình...')
                        : (isEditMode ? 'Cập nhật lộ trình' : 'Tạo lộ trình cá nhân hóa')}
                </button>
            </form>
        </div>
    );
}
