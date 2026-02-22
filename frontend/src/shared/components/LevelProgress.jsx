import React from 'react';
import './LevelProgress.css';

const getLevelTitle = (level) => {
    if (level >= 100) return "Legend";
    if (level >= 50) return "Grandmaster";
    if (level >= 20) return "Master";
    if (level >= 10) return "Elite";
    if (level >= 5) return "Advanced";
    if (level >= 2) return "Intermediate";
    return "Beginner";
};

// Icons (Simple SVG paths)
const Icons = {
    Seed: () => <svg viewBox="0 0 24 24" fill="currentColor" className="level-svg"><path d="M17.44 14.88c-1.38-3.03-3.6-5.46-6.3-7.14.28 2.01.03 4.19-1 6.13-1.07 2.03-2.61 3.59-4.23 4.75 3.19.49 6.27-.42 8.65-2.28 1.13-.88 2.39-2.07 2.88-1.46zM2 12c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2 2 6.48 2 12z" /></svg>, // Beginner
    Shield: () => <svg viewBox="0 0 24 24" fill="currentColor" className="level-svg"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" /></svg>, // Intermediate
    Star: () => <svg viewBox="0 0 24 24" fill="currentColor" className="level-svg"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>, // Advanced/Elite
    Crown: () => <svg viewBox="0 0 24 24" fill="currentColor" className="level-svg"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11h-14zm14 3c0 .66-.45 1.2-1.1 1.4-1.25.3-3.25.6-5.9.6s-4.65-.3-5.9-.6C5.45 20.2 5 19.66 5 19c0-.55.45-1 1-1h12c.55 0 1 .45 1 1z" /></svg> // Master/Admin
};

const getLevelIcon = (level) => {
    if (level >= 20) return <Icons.Crown />;
    if (level >= 5) return <Icons.Star />;
    if (level >= 2) return <Icons.Shield />;
    return <Icons.Seed />;
};

export default function LevelProgress({ user }) {
    if (!user) return null;

    let level = user.level || 1;
    let xp = user.xp || 0;

    // Admin Override
    if (user.role === 'admin') {
        level = 100;
        // Optional: override XP to show "Max" or similar, but let's leave it or set a high number
        xp = "MAX";
    }

    const title = getLevelTitle(level);
    const Icon = user.role === 'admin' ? <Icons.Crown /> : getLevelIcon(level);

    return (
        <div className={`level-badge ${user.role === 'admin' ? 'level-badge-admin' : ''}`} title={`Total XP: ${xp}`}>
            <div className="level-icon-wrapper">
                {Icon}
            </div>
            <div className="level-info">
                <span className="level-title">{title}</span>
                <span className="level-number-text">Lv. {level}</span>
            </div>
            {/* XP Bar could go here if needed */}
        </div>
    );
}
