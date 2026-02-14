import React, { useEffect, useState } from 'react';
import { api } from '@/shared/api/client';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    LineChart, Line
} from 'recharts';

import { useParams, useNavigate } from 'react-router-dom';

export default function AnalyticsDashboard() {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [skills, setSkills] = useState(null);
    const [weaknesses, setWeaknesses] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                if (studentId) {
                    const res = await api.getAdminStudentAnalytics(studentId);
                    setSkills(res.skills);
                    setWeaknesses(res.weaknesses);
                    setHistory(res.history);
                } else {
                    const [skillsRes, weakRes, histRes] = await Promise.all([
                        api.getAnalyticsSkills(),
                        api.getAnalyticsWeaknesses(),
                        api.getAnalyticsHistory()
                    ]);
                    setSkills(skillsRes.skills);
                    setWeaknesses(weakRes.weaknesses);
                    setHistory(histRes.history);
                }
            } catch (error) {
                console.error("Failed to load analytics", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [studentId]);

    if (loading) return <div className="p-8 text-center">Loading Analytics...</div>;

    // Transform Skills Data for Radar Chart
    const radarData = skills ? [
        { subject: 'Reading', A: skills.reading, fullMark: 9 },
        { subject: 'Listening', A: skills.listening, fullMark: 9 },
        { subject: 'Writing', A: skills.writing, fullMark: 9 },
        { subject: 'Speaking', A: skills.speaking, fullMark: 9 },
    ] : [];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium transition-colors"
                >
                    ← Quay lại
                </button>
                <h1 className="text-3xl font-bold text-slate-800">📊 Deep Analytics</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Skills Radar */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-semibold mb-4 text-slate-700">Skill Breakdown</h2>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" />
                                <PolarRadiusAxis angle={30} domain={[0, 9]} />
                                <Radar name="My Skills" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                                <Tooltip />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Progress History */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-semibold mb-4 text-slate-700">Progress History</h2>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tickFormatter={(str) => new Date(str).toLocaleDateString()} />
                                <YAxis domain={[0, 9]} />
                                <Tooltip labelFormatter={(str) => new Date(str).toLocaleDateString()} />
                                <Legend />
                                <Line type="monotone" dataKey="score" stroke="#8884d8" activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Weakness Detective */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-semibold mb-6 text-slate-700">Weakness Detective 🕵️‍♂️</h2>
                <div className="space-y-4">
                    {weaknesses.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">Not enough data to analyze weaknesses yet. Take more tests!</p>
                    ) : (
                        weaknesses.map((w, idx) => (
                            <div key={idx} className="flex items-center gap-4">
                                <div className="w-48 text-sm font-medium text-slate-600 capitalize">
                                    {w.type ? w.type.replace(/_/g, ' ') : 'Unknown'}
                                </div>
                                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${w.accuracy < 50 ? 'bg-red-500' : w.accuracy < 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                        style={{ width: `${w.accuracy}%` }}
                                    ></div>
                                </div>
                                <div className="w-16 text-right text-sm font-bold text-slate-700">{Math.round(w.accuracy)}%</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
