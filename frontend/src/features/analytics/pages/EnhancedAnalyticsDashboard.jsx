import React, { useEffect, useRef, useState } from 'react';
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
import { Activity, Target, Brain, Flame, BarChart3 } from 'lucide-react';
import { api } from '@/shared/api/client';
import './AnalyticsDashboard.css'; // Reuse existing styles
import './EnhancedAnalytics.css'; // New styles for heatmap and AI

const TAXONOMY_LEGEND = {
    // Reading/Listening
    'R-A1': 'Sai chính tả',
    'R-A2': 'Sai hình thức Số nhiều/Số ít',
    'R-C1': 'Chọn sai từ khóa',
    'R-C3': 'Nhầm lẫn ý chính',
    'R-C4': 'Bẫy chi tiết',
    'R-C5': 'Hiểu sai phạm vi (Scope Error)',
    'R-T1': 'Nhầm lẫn Sự thật vs Ý kiến (TFNG)',
    'R-T2': 'Suy luận quá mức (TFNG)',
    'L-A1': 'Sai chính tả (Nghe)',
    'L-A2': 'Sai hình thức Số nhiều/Số ít (Nghe)',
    'L-C1': 'Nghe sót từ khóa',
    'L-C4': 'Bẫy thông tin làm nhiễu (Distractor)',

    // Writing
    'W1-T1': 'Thiếu/Sai Overview',
    'W1-L1': 'Từ vựng miêu tả xu hướng yếu',
    'W2-T1': 'Không trả lời hết các vế câu hỏi',
    'W2-C3': 'Ý tưởng rời rạc (Idea Jump)',
    'W2-G1': 'Lỗi câu phức',
    'W2-G3': 'Lỗi viết câu quá dài (Run-on)',
    'W2-L2': 'Sai kết hợp từ (Collocation)',

    // Speaking
    'S-F1': 'Ngập ngừng quá mức (Hesitation)',
    'S-F2': 'Lạm dụng từ chêm (Filler)',
    'S-P1': 'Nhấn âm sai (Word Stress)',
    'S-P2': 'Hỏng âm đuôi (Ending Sounds)',
    'S-G2': 'Dùng sai thì (Tense)',
};

const RANGE_OPTIONS = [
    { value: 'all', label: 'All time' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
];

const SKILL_OPTIONS = [
    { value: 'all', label: 'All skills' },
    { value: 'reading', label: 'Reading' },
    { value: 'listening', label: 'Listening' },
    { value: 'writing', label: 'Writing' },
    { value: 'speaking', label: 'Speaking' },
];

export default function EnhancedAnalyticsDashboard() {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(null);
    const [aiInsights, setAiInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingAi, setLoadingAi] = useState(false);
    const [error, setError] = useState('');
    const [aiError, setAiError] = useState('');
    const [rangeFilter, setRangeFilter] = useState('all');
    const [skillFilter, setSkillFilter] = useState('all');
    const fetchVersionRef = useRef(0);
    const aiFetchVersionRef = useRef(0);

    useEffect(() => {
        let cancelled = false;
        const fetchVersion = Date.now();
        fetchVersionRef.current = fetchVersion;
        aiFetchVersionRef.current = fetchVersion;

        async function fetchDashboard() {
            setLoading(true);
            setError('');
            setAiInsights(null);
            setAiError('');
            try {
                const params = {
                    range: rangeFilter !== 'all' ? rangeFilter : undefined,
                    skill: skillFilter !== 'all' ? skillFilter : undefined,
                };
                const response = studentId
                    ? await api.getAdminStudentAnalyticsErrors(studentId, params)
                    : await api.getAnalyticsErrors(params);
                if (cancelled || fetchVersionRef.current !== fetchVersion) return;
                setDashboard(response?.data || null);
            } catch (err) {
                if (cancelled || fetchVersionRef.current !== fetchVersion) return;
                setError(err?.message || 'Failed to load error analytics.');
            } finally {
                if (cancelled || fetchVersionRef.current !== fetchVersion) return;
                setLoading(false);
            }
        }
        fetchDashboard();
        return () => {
            cancelled = true;
        };
    }, [studentId, rangeFilter, skillFilter]);

    const fetchAiInsights = async () => {
        const aiVersion = Date.now();
        aiFetchVersionRef.current = aiVersion;
        setLoadingAi(true);
        setAiError('');
        try {
            const params = {
                range: rangeFilter !== 'all' ? rangeFilter : undefined,
                skill: skillFilter !== 'all' ? skillFilter : undefined,
            };
            const response = studentId
                ? await api.getAdminStudentAnalyticsAIInsights(studentId, params)
                : await api.getAnalyticsAIInsights(params);
            if (aiFetchVersionRef.current !== aiVersion) return;
            setAiInsights(response?.data || null);
        } catch (err) {
            if (aiFetchVersionRef.current !== aiVersion) return;
            console.error("AI Insight error", err);
            setAiError(err?.message || 'Failed to generate AI insights.');
        } finally {
            if (aiFetchVersionRef.current !== aiVersion) return;
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

            <div className="enhanced-analytics-filters">
                <label className="enhanced-analytics-filter">
                    <span>Range</span>
                    <select value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value)}>
                        {RANGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
                <label className="enhanced-analytics-filter">
                    <span>Skill</span>
                    <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}>
                        {SKILL_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
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

                <button
                    type="button"
                    className="analytics-stat-card ai-insight-trigger"
                    onClick={fetchAiInsights}
                    disabled={loadingAi}
                >
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
                </button>
                {aiError ? <p className="analytics-ai-error">{aiError}</p> : null}
            </div>

            {aiInsights && (
                <div className="analytics-card ai-insights-panel">
                    <h3><Brain size={20} /> Đánh giá chuyên sâu từ AI</h3>

                    <div className="ai-insight-section overview">
                        <h4>Tổng quan</h4>
                        <p>{aiInsights.feedback || aiInsights.overview}</p>
                    </div>

                    {!aiInsights.feedback && (
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
                    )}

                    {!aiInsights.feedback && (
                        <div className="ai-insight-section encouragement">
                            <p><em>{aiInsights.encouragement ? `"${aiInsights.encouragement}"` : ''}</em></p>
                        </div>
                    )}
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
                                    <div key={code} className="heatmap-cell header code" title={`${code} - ${TAXONOMY_LEGEND[code] || 'Lỗi chưa phân loại'}`}>
                                        {code}
                                    </div>
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
                                                    title={`Loại lỗi: ${code} (${TAXONOMY_LEGEND[code] || 'Lỗi chưa phân loại'}) \nSố lần: ${val}`}
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
