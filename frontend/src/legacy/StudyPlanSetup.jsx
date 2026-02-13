import React, { useState } from 'react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function StudyPlanSetup({ onCreated }) {
    const [step, setStep] = useState(1);
    const [targetDate, setTargetDate] = useState('');
    const [targetBand, setTargetBand] = useState(6.5);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.createStudyPlan({ targetDate, targetBand });
            if (onCreated) onCreated();
            else navigate('/dashboard'); // Or wherever
        } catch (error) {
            console.error("Failed to create plan", error);
            alert("Lỗi khi tạo lộ trình: " + error.message);
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
                        min="0" max="9" step="0.5"
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
                    style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                    {loading ? 'Đang tạo lộ trình...' : 'Tạo lộ trình cá nhân hóa'}
                </button>
            </form>
        </div>
    );
}
