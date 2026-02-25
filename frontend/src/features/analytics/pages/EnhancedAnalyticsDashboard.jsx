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
    { value: 'all', label: 'Toan bo thoi gian' },
    { value: '7d', label: '7 ngay gan day' },
    { value: '30d', label: '30 ngay gan day' },
    { value: '90d', label: '90 ngay gan day' },
];

const SKILL_OPTIONS = [
    { value: 'all', label: 'Tat ca ky nang' },
    { value: 'reading', label: 'Đọc' },
    { value: 'listening', label: 'Nghe' },
    { value: 'writing', label: 'Viết' },
    { value: 'speaking', label: 'Nói' },
];

const TASK_TYPE_LABELS = {
    unknown: 'Khong xac dinh',
    reading: 'Reading',
    listening: 'Listening',
    writing: 'Writing',
    speaking: 'Speaking',
    task1: 'Task 1',
    task2: 'Task 2',
    part1: 'Part 1',
    part2: 'Part 2',
    part3: 'Part 3',
    true_false_not_given: 'True / False / Not Given',
    yes_no_not_given: 'Yes / No / Not Given',
    multiple_choice: 'Multiple Choice',
    matching_headings: 'Matching Headings',
    matching_information: 'Matching Information',
    matching_features: 'Matching Features',
    matching_info: 'Matching Information',
    matching: 'Matching',
    note_completion: 'Note Completion',
    summary_completion: 'Summary Completion',
    sentence_completion: 'Sentence Completion',
    table_completion: 'Table Completion',
    flow_chart_completion: 'Flow-chart Completion',
    flowchart_completion: 'Flow-chart Completion',
    diagram_completion: 'Diagram Completion',
    map_labeling: 'Map Labeling',
    short_answer: 'Short Answer',
    form_completion: 'Form Completion',
};

const normalizeTaskType = (value) => String(value || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const canonicalTaskType = (value) => {
    const normalized = normalizeTaskType(value);
    if (
        normalized === 'multiple_choice' ||
        normalized === 'mult_choice' ||
        normalized === 'multiple_choice_single' ||
        normalized === 'multiple_choice_multi' ||
        normalized === 'mult_choice_multi'
    ) {
        return 'multiple_choice';
    }
    if (normalized === 'true_false_notgiven' || normalized === 'tfng') {
        return 'true_false_not_given';
    }
    if (normalized === 'yes_no_notgiven' || normalized === 'ynng') {
        return 'yes_no_not_given';
    }
    return normalized;
};

const formatTaskType = (taskType) => {
    const normalized = canonicalTaskType(taskType);
    if (TASK_TYPE_LABELS[normalized]) return TASK_TYPE_LABELS[normalized];
    return normalized
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

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
                setError(err?.message || 'Khong tai duoc du lieu phan tich loi.');
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
            setAiError(err?.message || 'Khong tao duoc nhan xet AI.');
        } finally {
            if (aiFetchVersionRef.current !== aiVersion) return;
            setLoadingAi(false);
        }
    };

    const openErrorDetailsPage = () => {
        const params = new URLSearchParams();
        if (rangeFilter !== 'all') params.set('range', rangeFilter);
        if (skillFilter !== 'all') params.set('skill', skillFilter);

        const basePath = studentId
            ? `/analytics/student/${studentId}/errors`
            : '/analytics/errors';
        const query = params.toString();
        navigate(query ? `${basePath}?${query}` : basePath);
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

    const { totalErrors, heatmapData, cognitiveData, codeLegend } = dashboard || {};
    const heatmapRows = Array.isArray(heatmapData) ? heatmapData : [];
    const canonicalHeatmapRows = heatmapRows.reduce((acc, row) => {
        const canonicalType = canonicalTaskType(row?.taskType);
        const current = acc.get(canonicalType) || { taskType: canonicalType };

        Object.entries(row || {}).forEach(([key, value]) => {
            if (key === 'taskType') return;
            const count = Number(value || 0);
            if (!Number.isFinite(count)) return;
            current[key] = Number(current[key] || 0) + count;
        });

        acc.set(canonicalType, current);
        return acc;
    }, new Map());
    const mergedHeatmapRows = Array.from(canonicalHeatmapRows.values());

    const codeTotals = mergedHeatmapRows.reduce((acc, row) => {
        Object.entries(row || {}).forEach(([key, value]) => {
            if (key === 'taskType') return;
            const count = Number(value || 0);
            if (!Number.isFinite(count) || count <= 0) return;
            acc[key] = (acc[key] || 0) + count;
        });
        return acc;
    }, {});

    const sortedCodes = Object.entries(codeTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([code]) => code);
    const visibleCodes = sortedCodes.slice(0, 12);

    const normalizedHeatmapRows = mergedHeatmapRows
        .map((row) => {
            const taskType = canonicalTaskType(row?.taskType);
            const values = visibleCodes.reduce((acc, code) => {
                acc[code] = Number(row?.[code] || 0);
                return acc;
            }, {});

            const total = Object.entries(row || {}).reduce((sum, [key, value]) => {
                if (key === 'taskType') return sum;
                return sum + Number(value || 0);
            }, 0);

            return {
                taskType,
                taskTypeLabel: formatTaskType(taskType),
                values,
                total,
            };
        })
        .sort((a, b) => b.total - a.total);

    const visibleCodeTotals = visibleCodes.reduce((acc, code) => {
        acc[code] = normalizedHeatmapRows.reduce((sum, row) => sum + Number(row.values?.[code] || 0), 0);
        return acc;
    }, {});
    const grandVisibleTotal = Object.values(visibleCodeTotals).reduce((sum, value) => sum + Number(value || 0), 0);
    const maxCellValue = Math.max(1, ...normalizedHeatmapRows.flatMap((row) => visibleCodes.map((code) => Number(row.values?.[code] || 0))));

    const getHeatmapColor = (value) => {
        const count = Number(value || 0);
        if (!count) return '#f8fafc';
        const ratio = Math.max(0, Math.min(1, count / maxCellValue));
        const lightness = 96 - ratio * 58;
        return `hsl(208 92% ${lightness}%)`;
    };

    const getHeatmapTextColor = (value) => {
        const count = Number(value || 0);
        if (!count) return '#94a3b8';
        const ratio = Math.max(0, Math.min(1, count / maxCellValue));
        return ratio >= 0.55 ? '#ffffff' : '#0f172a';
    };

    const resolveCodeLabel = (code) => {
        const dynamicLabel = codeLegend?.[code];
        if (dynamicLabel) return dynamicLabel;
        return TAXONOMY_LEGEND[code] || 'Chưa phân loại';
    };

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
                    <span>Khoang thoi gian</span>
                    <select value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value)}>
                        {RANGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>
                <label className="enhanced-analytics-filter">
                    <span>Ky nang</span>
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

                    <div className="heatmap-detail-action-row">
                        <button type="button" className="analytics-detail-btn" onClick={openErrorDetailsPage}>
                            Xem chi tiết từng lỗi
                        </button>
                    </div>
                    <div className="heatmap-container">
                        {normalizedHeatmapRows.length === 0 || visibleCodes.length === 0 ? (
                            <div className="analytics-empty">Chưa đủ dữ liệu để tạo bản đồ lỗi.</div>
                        ) : (
                            <div className="heatmap-v2-shell">
                                <div className="heatmap-v2-summary">
                                    <span className="heatmap-v2-chip">Dang cau hoi: <strong>{normalizedHeatmapRows.length}</strong></span>
                                    <span className="heatmap-v2-chip">Ma loi hien thi: <strong>{visibleCodes.length}</strong> / {sortedCodes.length}</span>
                                    <span className="heatmap-v2-chip">O cao nhat: <strong>{maxCellValue}</strong></span>
                                </div>

                                <div className="heatmap-v2-scroll">
                                    <div className="heatmap-v2-grid" style={{ gridTemplateColumns: `260px repeat(${visibleCodes.length}, minmax(88px, 1fr)) 90px` }}>
                                        <div className="heatmap-v2-cell heatmap-v2-header heatmap-v2-corner">Dang cau hoi</div>
                                        {visibleCodes.map((code) => (
                                            <div
                                                key={code}
                                                className="heatmap-v2-cell heatmap-v2-header heatmap-v2-code"
                                                title={`${code} - ${resolveCodeLabel(code)}`}
                                            >
                                                <span className="heatmap-v2-code-key">{code}</span>
                                                <span className="heatmap-v2-code-label">{resolveCodeLabel(code)}</span>
                                            </div>
                                        ))}
                                        <div className="heatmap-v2-cell heatmap-v2-header heatmap-v2-total-head">Tong</div>

                                        {normalizedHeatmapRows.map((row) => (
                                            <React.Fragment key={row.taskType}>
                                                <div className="heatmap-v2-cell heatmap-v2-row-label" title={row.taskType}>
                                                    <span className="heatmap-v2-row-main">{row.taskTypeLabel}</span>
                                                </div>
                                                {visibleCodes.map((code) => {
                                                    const value = Number(row.values?.[code] || 0);
                                                    return (
                                                        <div
                                                            key={`${row.taskType}-${code}`}
                                                            className="heatmap-v2-cell heatmap-v2-data"
                                                            style={{
                                                                backgroundColor: getHeatmapColor(value),
                                                                color: getHeatmapTextColor(value),
                                                            }}
                                                            title={`${row.taskTypeLabel} | ${code}: ${value}`}
                                                        >
                                                            {value > 0 ? value : ''}
                                                        </div>
                                                    );
                                                })}
                                                <div className="heatmap-v2-cell heatmap-v2-total-cell">{row.total}</div>
                                            </React.Fragment>
                                        ))}

                                        <div className="heatmap-v2-cell heatmap-v2-footer-label">Tong theo ma</div>
                                        {visibleCodes.map((code) => (
                                            <div key={`total-${code}`} className="heatmap-v2-cell heatmap-v2-footer-cell">
                                                {visibleCodeTotals[code] || 0}
                                            </div>
                                        ))}
                                        <div className="heatmap-v2-cell heatmap-v2-footer-cell">{grandVisibleTotal}</div>
                                    </div>
                                </div>

                                {sortedCodes.length > visibleCodes.length ? (
                                    <p className="heatmap-v2-note">
                                        Dang hien thi top {visibleCodes.length} ma loi co tan suat cao nhat de de theo doi.
                                    </p>
                                ) : null}
                            </div>
                        )}
                        <div className="heatmap-v2-legend">
                            <span><i style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }} /> 0</span>
                            <span><i style={{ backgroundColor: 'hsl(208 92% 82%)' }} /> Thap</span>
                            <span><i style={{ backgroundColor: 'hsl(208 92% 62%)' }} /> Trung binh</span>
                            <span><i style={{ backgroundColor: 'hsl(208 92% 38%)' }} /> Cao</span>
                        </div>
                    </div>
                </div>
                <div className="analytics-card analytics-card-wide">
                    <h3><BarChart3 size={20} /> Phân bố theo kỹ năng nhận thức</h3>
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

