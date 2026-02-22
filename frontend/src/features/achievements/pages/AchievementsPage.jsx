import { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import { Trophy, Medal, Award, Lock, Star, Zap, Crown, ChevronRight } from 'lucide-react';
import './AchievementsPage.css';

const CATEGORY_LABELS = {
    all: 'Tất cả',
    streak: 'Chuỗi ngày',
    test: 'Bài test',
    writing: 'Viết',
    speaking: 'Nói',
    module: 'Module',
    score: 'Điểm số',
    vocabulary: 'Từ vựng',
    xp: 'XP & Cấp độ',
};

const TIER_LABELS = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', diamond: 'Kim Cương' };

export default function AchievementsPage() {
    const [activeTab, setActiveTab] = useState('achievements');
    const [activeCategory, setActiveCategory] = useState('all');
    const [definitions, setDefinitions] = useState([]);
    const [userAchievements, setUserAchievements] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [myRank, setMyRank] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [defRes, myRes, lbRes, rankRes] = await Promise.all([
                api.getAchievementDefinitions(),
                api.getMyAchievements(),
                api.getLeaderboard({ limit: 20 }),
                api.getMyRank(),
            ]);

            if (defRes.success) setDefinitions(defRes.data || []);
            if (myRes.success) setUserAchievements(myRes.data || []);
            if (lbRes.success) setLeaderboard(lbRes.data || []);
            if (rankRes.success) setMyRank(rankRes.data || null);
        } catch (error) {
            console.error('Failed to fetch achievements data:', error);
        } finally {
            setLoading(false);
        }
    };

    const unlockedKeys = new Set(userAchievements.map(a => a.achievementKey));
    const unlockedCount = unlockedKeys.size;
    const totalCount = definitions.length;

    const filteredAchievements = definitions.filter(ach =>
        activeCategory === 'all' || ach.category === activeCategory
    );

    // Sort: unlocked first, then by order
    const sortedAchievements = [...filteredAchievements].sort((a, b) => {
        const aUnlocked = unlockedKeys.has(a.key) ? 0 : 1;
        const bUnlocked = unlockedKeys.has(b.key) ? 0 : 1;
        if (aUnlocked !== bUnlocked) return aUnlocked - bUnlocked;
        return (a.order || 0) - (b.order || 0);
    });

    const getUnlockDate = (key) => {
        const a = userAchievements.find(u => u.achievementKey === key);
        return a ? new Date(a.unlockedAt).toLocaleDateString('vi-VN') : null;
    };

    if (loading) {
        return (
            <div className="ach-page">
                <div className="ach-loading">
                    <Trophy size={32} style={{ opacity: 0.4, marginBottom: '1rem' }} />
                    <p>Đang tải thành tựu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ach-page">
            {/* Hero */}
            <div className="ach-hero">
                <div className="ach-hero-inner">
                    <h1>
                        <Trophy size={28} />
                        Thành tựu & <span>Bảng xếp hạng</span>
                    </h1>
                    <p>Theo dõi tiến trình và so sánh với các học viên khác</p>

                    <div className="ach-stats-row">
                        <div className="ach-stat-chip">
                            <Award size={16} />
                            <strong>{unlockedCount}</strong> / {totalCount} thành tựu
                        </div>
                        {myRank && (
                            <>
                                <div className="ach-stat-chip">
                                    <Zap size={16} />
                                    <strong>{(myRank.xp || 0).toLocaleString()}</strong> XP
                                </div>
                                <div className="ach-stat-chip">
                                    <Star size={16} />
                                    Level <strong>{myRank.level}</strong> — {myRank.levelTitle}
                                </div>
                                <div className="ach-stat-chip">
                                    <Medal size={16} />
                                    Hạng <strong>#{myRank.rank}</strong>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="ach-body">
                {/* Tabs */}
                <div className="ach-tabs">
                    <button
                        className={`ach-tab ${activeTab === 'achievements' ? 'active' : ''}`}
                        onClick={() => setActiveTab('achievements')}
                    >
                        <Trophy size={16} /> Thành tựu
                    </button>
                    <button
                        className={`ach-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('leaderboard')}
                    >
                        <Crown size={16} /> Bảng xếp hạng
                    </button>
                </div>

                {/* ── Achievements Tab ── */}
                {activeTab === 'achievements' && (
                    <>
                        <div className="ach-filters">
                            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                <button
                                    key={key}
                                    className={`ach-filter-btn ${activeCategory === key ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {sortedAchievements.length === 0 ? (
                            <div className="ach-empty">Chưa có thành tựu nào trong danh mục này.</div>
                        ) : (
                            <div className="ach-grid">
                                {sortedAchievements.map(ach => {
                                    const isUnlocked = unlockedKeys.has(ach.key);
                                    const date = getUnlockDate(ach.key);

                                    return (
                                        <div
                                            key={ach.key}
                                            className={`ach-card tier-${ach.tier} ${isUnlocked ? 'unlocked' : 'locked'}`}
                                        >
                                            <div className="ach-card-header">
                                                <div className="ach-card-icon">{ach.icon}</div>
                                                <div>
                                                    <h3 className="ach-card-title">{ach.title}</h3>
                                                    <div className="ach-card-tier">{TIER_LABELS[ach.tier]}</div>
                                                </div>
                                            </div>
                                            <p className="ach-card-desc">{ach.description}</p>
                                            <div className="ach-card-footer">
                                                <span className="ach-xp-badge">
                                                    <Zap size={12} /> +{ach.xpReward} XP
                                                </span>
                                                {isUnlocked ? (
                                                    <span className="ach-card-date">✅ {date}</span>
                                                ) : (
                                                    <span className="ach-lock-badge">
                                                        <Lock size={12} /> Chưa mở khóa
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {/* ── Leaderboard Tab ── */}
                {activeTab === 'leaderboard' && (
                    <>
                        {/* Podium for top 3 */}
                        {leaderboard.length >= 3 && (
                            <div className="ach-podium">
                                {[1, 0, 2].map(i => {
                                    const student = leaderboard[i];
                                    const classes = ['silver', 'gold', 'bronze'][i] || '';
                                    const medals = ['🥈', '🥇', '🥉'];
                                    return (
                                        <div key={student._id} className={`ach-podium-card ${classes}`}>
                                            <div className="ach-podium-rank">{medals[i]}</div>
                                            <div className="ach-podium-name">{student.name}</div>
                                            <div className="ach-podium-xp">{(student.xp || 0).toLocaleString()} XP</div>
                                            <div className="ach-podium-level">
                                                Level {student.level} — {student.levelTitle}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Full table */}
                        <table className="ach-lb-table">
                            <thead>
                                <tr>
                                    <th>Hạng</th>
                                    <th>Học viên</th>
                                    <th>Cấp độ</th>
                                    <th>XP</th>
                                    <th>Thành tựu</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map(student => (
                                    <tr key={student._id}>
                                        <td>
                                            <span className="ach-lb-rank">#{student.rank}</span>
                                        </td>
                                        <td>
                                            <span className="ach-lb-name">{student.name}</span>
                                        </td>
                                        <td>
                                            <span className="ach-lb-level-badge">
                                                <Star size={10} /> Lv.{student.level} {student.levelTitle}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="ach-lb-xp">{(student.xp || 0).toLocaleString()}</span>
                                        </td>
                                        <td>{student.totalAchievements || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {leaderboard.length === 0 && (
                            <div className="ach-empty">Chưa có dữ liệu xếp hạng.</div>
                        )}

                        {/* My rank card */}
                        {myRank && (
                            <div className="ach-my-rank">
                                <div>
                                    <div className="ach-my-rank-label">Thứ hạng của bạn</div>
                                    <div className="ach-my-rank-value">#{myRank.rank}</div>
                                </div>
                                <div>
                                    <div className="ach-my-rank-label">XP</div>
                                    <div className="ach-my-rank-value">{(myRank.xp || 0).toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="ach-my-rank-label">Cấp độ</div>
                                    <div className="ach-my-rank-value">Lv.{myRank.level}</div>
                                </div>
                                <div>
                                    <div className="ach-my-rank-label">Thành tựu</div>
                                    <div className="ach-my-rank-value">{myRank.totalAchievements || 0}</div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
