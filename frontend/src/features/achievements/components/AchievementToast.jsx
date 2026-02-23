import { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Zap, X } from 'lucide-react';
import './AchievementToast.css';

const MAX_QUEUE_ITEMS = 4;
const MAX_ACHIEVEMENTS_PER_EVENT = 2;
const XP_TOAST_THROTTLE_MS = 8000;

function getAchievementToastId(achievement) {
    return (
        achievement?.achievementKey ||
        achievement?.key ||
        achievement?._id ||
        `${achievement?.title || 'achievement'}:${achievement?.tier || ''}:${achievement?.xpReward || 0}`
    );
}

export default function AchievementToast() {
    const [queue, setQueue] = useState([]);
    const [current, setCurrent] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const timerRef = useRef(null);
    const fadeTimerRef = useRef(null);
    const seenAchievementIdsRef = useRef(new Set());
    const lastXpToastAtRef = useRef(0);

    useEffect(() => {
        const handleUnlock = (e) => {
            const { achievements, xpResult } = e.detail || {};

            if (achievements && achievements.length > 0) {
                const uniqueAchievements = achievements
                    .filter(Boolean)
                    .map((item) => ({ ...item, __toastId: getAchievementToastId(item) }))
                    .filter((item) => item.__toastId && !seenAchievementIdsRef.current.has(item.__toastId));

                uniqueAchievements.forEach((item) => {
                    seenAchievementIdsRef.current.add(item.__toastId);
                });

                const nextItems = uniqueAchievements.slice(0, MAX_ACHIEVEMENTS_PER_EVENT);
                const hiddenCount = uniqueAchievements.length - nextItems.length;

                if (hiddenCount > 0) {
                    nextItems.push({
                        type: 'summary',
                        title: `${hiddenCount} more achievement${hiddenCount > 1 ? 's' : ''} unlocked`,
                        description: 'Open the Achievements page to see all rewards.',
                        tier: 'gold',
                        __toastId: `summary:${Date.now()}:${hiddenCount}`,
                    });
                }

                if (nextItems.length > 0) {
                    setQueue((prev) => [...prev, ...nextItems].slice(0, MAX_QUEUE_ITEMS));
                }
                return;
            }

            if (xpResult && xpResult.xpGained > 0) {
                const now = Date.now();
                if (now - lastXpToastAtRef.current < XP_TOAST_THROTTLE_MS) return;
                lastXpToastAtRef.current = now;
                setQueue((prev) => [
                    ...prev,
                    {
                        type: 'xpOnly',
                        title: `+${xpResult.xpGained} XP`,
                        description: 'Ho\u00e0n th\u00e0nh b\u00e0i t\u1eadp',
                        __toastId: `xp:${now}:${xpResult.xpGained}`,
                    },
                ].slice(0, MAX_QUEUE_ITEMS));
            }
        };

        window.addEventListener('achievements-unlocked', handleUnlock);
        return () => {
            window.removeEventListener('achievements-unlocked', handleUnlock);
            clearTimeout(timerRef.current);
            clearTimeout(fadeTimerRef.current);
        };
    }, []);

    const dismiss = useCallback((options = {}) => {
        const { clearQueue = false } = options;
        clearTimeout(timerRef.current);
        clearTimeout(fadeTimerRef.current);
        setIsVisible(false);
        if (clearQueue) {
            setQueue([]);
        }
        fadeTimerRef.current = setTimeout(() => setCurrent(null), 300);
    }, []);

    useEffect(() => {
        if (!current && queue.length > 0) {
            const [next, ...rest] = queue;
            setQueue(rest);
            setCurrent(next);
            setIsVisible(true);
        }
    }, [queue, current]);

    useEffect(() => {
        if (!current) return undefined;
        timerRef.current = setTimeout(() => dismiss(), 5000);
        return () => clearTimeout(timerRef.current);
    }, [current, dismiss]);

    if (!current) return null;

    return (
        <div className={`ach-toast-container ${isVisible ? 'visible' : ''}`}>
            <div className={`ach-toast tier-${current.tier || 'bronze'}`}>
                <button className="ach-toast-close" onClick={() => dismiss({ clearQueue: true })}>
                    <X size={16} />
                </button>
                <div className="ach-toast-icon">
                    {current.type === 'xpOnly' ? <Zap size={24} /> : (current.icon || <Trophy />)}
                </div>
                <div className="ach-toast-content">
                    <div className="ach-toast-header">
                        {current.type === 'xpOnly' ? 'Nh\u1eadn kinh nghi\u1ec7m' : 'M\u1edf kh\u00f3a th\u00e0nh t\u1ef1u!'}
                    </div>
                    <h4 className="ach-toast-title">{current.title}</h4>
                    <p className="ach-toast-desc">{current.description}</p>
                    {current.xpReward && (
                        <div className="ach-toast-xp">
                            <Zap size={12} /> +{current.xpReward} XP
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
