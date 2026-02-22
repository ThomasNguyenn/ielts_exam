import { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Zap, X } from 'lucide-react';
import './AchievementToast.css';

export default function AchievementToast() {
    const [queue, setQueue] = useState([]);
    const [current, setCurrent] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        const handleUnlock = (e) => {
            const { achievements, xpResult } = e.detail;

            if (achievements && achievements.length > 0) {
                setQueue(prev => [...prev, ...achievements]);
            } else if (xpResult && xpResult.xpGained > 0) {
                setQueue(prev => [...prev, { type: 'xpOnly', title: `+${xpResult.xpGained} XP`, description: 'Hoàn thành bài tập' }]);
            }
        };

        window.addEventListener('achievements-unlocked', handleUnlock);
        return () => window.removeEventListener('achievements-unlocked', handleUnlock);
    }, []);

    const dismiss = useCallback(() => {
        clearTimeout(timerRef.current);
        setIsVisible(false);
        setTimeout(() => setCurrent(null), 300); // wait for CSS fade-out
    }, []);

    // Show next item from queue
    useEffect(() => {
        if (queue.length > 0 && !current) {
            const next = queue[0];
            setQueue(prev => prev.slice(1));
            setCurrent(next);
            setIsVisible(true);

            timerRef.current = setTimeout(dismiss, 5000);
        }

        return () => clearTimeout(timerRef.current);
    }, [queue, current, dismiss]);

    if (!current) return null;

    return (
        <div className={`ach-toast-container ${isVisible ? 'visible' : ''}`}>
            <div className={`ach-toast tier-${current.tier || 'bronze'}`}>
                <button className="ach-toast-close" onClick={dismiss}>
                    <X size={16} />
                </button>
                <div className="ach-toast-icon">
                    {current.type === 'xpOnly' ? <Zap size={24} /> : (current.icon || <Trophy />)}
                </div>
                <div className="ach-toast-content">
                    <div className="ach-toast-header">
                        {current.type === 'xpOnly' ? 'Nhận kinh nghiệm' : 'Mở khóa thành tựu!'}
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
