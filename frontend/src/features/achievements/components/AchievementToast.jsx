import { useState, useEffect } from 'react';
import { Trophy, Zap, X } from 'lucide-react';
import './AchievementToast.css';

export default function AchievementToast() {
    const [queue, setQueue] = useState([]);
    const [current, setCurrent] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleUnlock = (e) => {
            const { achievements, xpResult } = e.detail;

            if (achievements && achievements.length > 0) {
                setQueue(prev => [...prev, ...achievements]);
            } else if (xpResult && xpResult.xpGained > 0) {
                // Just show XP gain if no achievements but XP gained
                setQueue(prev => [...prev, { type: 'xpOnly', title: `+${xpResult.xpGained} XP`, description: 'Hoàn thành bài tập' }]);
            }
        };

        window.addEventListener('achievements-unlocked', handleUnlock);
        return () => window.removeEventListener('achievements-unlocked', handleUnlock);
    }, []);

    useEffect(() => {
        if (queue.length > 0 && !current && !isVisible) {
            setCurrent(queue[0]);
            setIsVisible(true);
            setQueue(prev => prev.slice(1));

            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => setCurrent(null), 300); // Wait for transition
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [queue, current, isVisible]);

    if (!current) return null;

    return (
        <div className={`ach-toast-container ${isVisible ? 'visible' : ''}`}>
            <div className={`ach-toast tier-${current.tier || 'bronze'}`}>
                <button className="ach-toast-close" onClick={() => setIsVisible(false)}>
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
