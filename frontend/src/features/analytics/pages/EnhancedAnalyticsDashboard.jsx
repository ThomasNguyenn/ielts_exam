import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Activity, Target, Brain, Flame } from 'lucide-react';
import { api } from '@/shared/api/client';
import './AnalyticsDashboard.css'; // Reuse existing styles
import './EnhancedAnalytics.css'; // New styles for heatmap and AI

export default function EnhancedAnalyticsDashboard() {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(null);
    const [aiInsights, setAiInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingAi, setLoadingAi] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        async function fetchDashboard() {
            setLoading(true);
            try {
                // Fetch the new aggregated errors endpoint
                const response = await api.getAnalyticsErrors();
                setDashboard(response?.data || null);
            } catch (err) {
                setError(err?.message || 'Failed to load error analytics.');
            } finally {
                setLoading(false);
            }
        }
        fetchDashboard();
    }, [studentId]);

    const fetchAiInsights = async () => {
        setLoadingAi(true);
        try {
            const response = await api.getAnalyticsAIInsights();
            setAiInsights(response?.data || null);
        } catch (err) {
            console.error("AI Insight error", err);
        } finally {
            setLoadingAi(false);
        }
    };

    if (loading) {
        return <div className="analytics-loading">Đang tải bảng phân tích lỗi...</div>;
    }

    if (error) {
        return (
            <div className="analytics-error-card">
                <p>{error}</p>
                <button type="button" onClick={() => window.location.reload()}>Thử lại</button>
            </div>
        );
    }

    const { totalErrors, heatmapData, cognitiveData } = dashboard || {};

    // Heatmap color logic
    const getHeatmapColor = (value) => {
        if (!value || value === 0) return '#f8fafc'; // empty
        if (value < 3) return '#fef08a'; // yellow-200
        if (value < 6) return '#fb923c'; // orange-400
        return '#ef4444'; // red-500
    };

    // Extract all unique error codes across all task types to build columns
    const allCodesSet = new Set();
    heatmapData?.forEach(row => {
        Object.keys(row).forEach(key => {
            if (key !== 'taskType') allCodesSet.add(key);
        });
    });
    const allCodes = Array.from(allCodesSet).sort();

    return (
        <div className="analytics-dashboard">
            {studentId && (
                <button type="button" className="analytics-back-btn" onClick={() => navigate(-1)}>
                    Quay lại
                </button>
            )}

            <div className="analytics-header">
                <h1>Bản đồ Phân tích Nhược điểm (Error Taxonomy)</h1>
                <p>Khám phá cấu trúc lỗi kỹ năng IELTS của bạn bằng AI</p>
            </div>

            <div className="analytics-stats-grid">
                <div className="analytics-stat-card">
                    <div className="analytics-stat-top">
                        <span className="analytics-stat-label">Tổng Lỗi Ghi Nhận</span>
                        <span className="analytics-stat-icon-wrap" style={{ backgroundColor: `#ef444414` }}>
                            <Activity className="analytics-stat-icon" style={{ color: '#ef4444' }} />
                        </span>
                    </div>
                    <p className="analytics-stat-value">{totalErrors || 0}</p>
                    <p className="analytics-stat-change">Từ tất cả các phiên làm bài</p>
                </div>

                <div className="analytics-stat-card ai-insight-trigger" onClick={fetchAiInsights}>
                    <div className="analytics-stat-top">
                        <span className="analytics-stat-label">AI Nhận Xét</span>
                        <span className="analytics-stat-icon-wrap" style={{ backgroundColor: `#8b5cf614` }}>
                            <Brain className="analytics-stat-icon" style={{ color: '#8b5cf6' }} />
                        </span>
                    </div>
                    {loadingAi ? (
                        <p className="analytics-stat-value" style={{ fontSize: '1rem', marginTop: '10px' }}>AI đang phân tích...</p>
                    ) : (
                        <p className="analytics-stat-value" style={{ fontSize: '1rem', marginTop: '10px', color: '#8b5cf6', cursor: 'pointer' }}>
                            {aiInsights ? 'Cập nhật lại nhận xét' : 'Nhấp để AI phân tích lỗi'}
                        </p>
                    )}
                </div>
            </div>

            {aiInsights && (
                <div className="analytics-card ai-insights-panel">
                    <h3><Brain size={20} /> Đánh giá chuyên sâu từ AI</h3>

                    <div className="ai-insight-section overview">
                        <h4>Tổng quan</h4>
                        <p>{aiInsights.overview}</p>
                    </div>

                    <div className="ai-insight-cols">
                        <div className="ai-insight-section actionable">
                            <h4>Chiến lược khắc phục</h4>
                            <ul>
                                {aiInsights.actionable_advice?.map((adv, idx) => (
                                    <li key={idx}>{adv}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="ai-insight-section practice">
                            <h4>Ưu tiên luyện tập</h4>
                            <div className="tags">
                                {aiInsights.recommended_practice?.map((prac, idx) => (
                                    <span key={idx} className="practice-tag"><Target size={14} /> {prac}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="ai-insight-section encouragement">
                        <p><em>"{aiInsights.encouragement}"</em></p>
                    </div>
                </div>
            )}

            <div className="analytics-charts-grid">
                <div className="analytics-card analytics-card-wide">
                    <h3><Flame size={20} /> Vết Hằn Lỗi (Error Heatmap)</h3>
                    <p>Ma trận tần suất lỗi theo từng dạng bài</p>

                    <div className="heatmap-container">
                        {(!heatmapData || heatmapData.length === 0) ? (
                            <div className="analytics-empty">Chưa đủ dữ liệu để tạo bản đồ lỗi.</div>
                        ) : (
                            <div className="heatmap-grid" style={{ gridTemplateColumns: `150px repeat(${allCodes.length}, minmax(40px, 1fr))` }}>
                                {/* Header Row */}
                                <div className="heatmap-cell header corner">Dạng Bài</div>
                                {allCodes.map(code => (
                                    <div key={code} className="heatmap-cell header code" title={code}>{code}</div>
                                ))}

                                {/* Data Rows */}
                                {heatmapData.map((row, idx) => (
                                    <React.Fragment key={idx}>
                                        <div className="heatmap-cell row-label" title={row.taskType}>{row.taskType}</div>
                                        {allCodes.map(code => {
                                            const val = row[code] || 0;
                                            return (
                                                <div
                                                    key={`${row.taskType}-${code}`}
                                                    className="heatmap-cell data"
                                                    style={{ backgroundColor: getHeatmapColor(val) }}
                                                    title={`Code: ${code} | Count: ${val}`}
                                                >
                                                    {val > 0 ? val : ''}
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                        <div className="heatmap-legend">
                            <span><i style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} /> 0</span>
                            <span><i style={{ backgroundColor: '#fef08a' }} /> 1-2</span>
                            <span><i style={{ backgroundColor: '#fb923c' }} /> 3-5</span>
                            <span><i style={{ backgroundColor: '#ef4444' }} /> 6+</span>
                        </div>
                    </div>
                </div>

                <div className="analytics-card analytics-card-wide">
                    <h3><BarChart3 size={20} /> Phân bố theo Kỹ năng nhận thức (Cognitive Skill)</h3>
                    <p>Các rào cản nhận thức thường gặp nhất khi làm bài</p>

                    {(!cognitiveData || cognitiveData.length === 0) ? (
                        <div className="analytics-empty">Chưa có dữ liệu nhận thức.</div>
                    ) : (
                        <div className="analytics-bar-wrap" style={{ height: '300px', marginTop: '20px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={cognitiveData} layout="vertical" margin={{ left: 50, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
