import { lazy, Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard'));
const EnhancedAnalyticsDashboard = lazy(() => import('./EnhancedAnalyticsDashboard'));

const VALID_TABS = new Set(['overview', 'taxonomy']);

export default function AnalyticsContainer() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = useMemo(() => {
        const tab = String(searchParams.get('tab') || 'overview').trim().toLowerCase();
        return VALID_TABS.has(tab) ? tab : 'overview';
    }, [searchParams]);

    const setActiveTab = (nextTab) => {
        const normalized = String(nextTab || '').trim().toLowerCase();
        const target = VALID_TABS.has(normalized) ? normalized : 'overview';
        const next = new URLSearchParams(searchParams);

        if (target === 'overview') next.delete('tab');
        else next.set('tab', target);

        setSearchParams(next, { replace: true });
    };

    const fallback = (
        <div className="analytics-loading">Đang tải bảng phân tích...</div>
    );

    return (
        <div className="analytics-container-wrapper" style={{ padding: '0', maxWidth: '1200px', margin: '0 auto' }}>
            <div
                className="analytics-tabs-nav"
                style={{
                    display: 'flex',
                    gap: '1rem',
                    borderBottom: '1px solid #e2e8f0',
                    margin: '2rem 2rem 0 2rem',
                }}
            >
                <button
                    className={`analytics-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'overview' ? '2px solid #6366f1' : '2px solid transparent',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'overview' ? '600' : '500',
                        color: activeTab === 'overview' ? '#4f46e5' : '#64748b',
                        fontSize: '1rem',
                        transition: 'all 0.2s',
                    }}
                >
                    Tổng quan
                </button>
                <button
                    className={`analytics-tab-btn ${activeTab === 'taxonomy' ? 'active' : ''}`}
                    onClick={() => setActiveTab('taxonomy')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'taxonomy' ? '2px solid #6366f1' : '2px solid transparent',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'taxonomy' ? '600' : '500',
                        color: activeTab === 'taxonomy' ? '#4f46e5' : '#64748b',
                        fontSize: '1rem',
                        transition: 'all 0.2s',
                    }}
                >
                    Bản đồ Phân tích Nhược điểm
                </button>
            </div>

            <div className="analytics-tab-content">
                <Suspense fallback={fallback}>
                    {activeTab === 'overview' ? <AnalyticsDashboard /> : <EnhancedAnalyticsDashboard />}
                </Suspense>
            </div>
        </div>
    );
}
