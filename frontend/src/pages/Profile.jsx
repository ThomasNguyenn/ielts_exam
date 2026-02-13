import { useState, useEffect } from 'react';
import { api } from '../api/client';
import './Profile.css';

// Calculate overall score (Average of 4 skills, rounded to nearest 0.5)
const calculateOverall = (targets) => {
    const { listening, reading, writing, speaking } = targets;
    const avg = (listening + reading + writing + speaking) / 4;
    return Math.round(avg * 2) / 2;
};

import LevelProgress from '../components/LevelProgress';
import StudyDashboardWidget from '../components/StudyDashboardWidget';



// Logic to calculate progress to next level (Replicating backend)
const calculateLevelProgress = (xp) => {
    let level = 1;
    let xpForNextLevel = 500;
    let gap = 500;
    let prevLevelXP = 0;

    while (xp >= xpForNextLevel) {
        prevLevelXP = xpForNextLevel;
        level++;
        gap += 250;
        xpForNextLevel += gap;
    }

    const currentLevelXP = xp - prevLevelXP;
    const requiredXP = xpForNextLevel - prevLevelXP;
    const progress = Math.min(100, Math.max(0, (currentLevelXP / requiredXP) * 100));

    return {
        level,
        progress,
        currentLevelXP: Math.floor(currentLevelXP),
        requiredXP: Math.floor(requiredXP),
        totalXP: xp
    };
};

export default function Profile() {

    const [profile, setProfile] = useState({
        name: '',
        xp: 0,
        level: 1,
        targets: {
            listening: 0,
            reading: 0,
            writing: 0,
            speaking: 0
        }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (api.isAuthenticated()) {
            fetchProfile();
        } else {
            setProfile(prev => ({ ...prev, name: 'Guest' }));
            setLoading(false);
        }
    }, []);


    const fetchProfile = async () => {
        try {
            const res = await api.getProfile();
            if (res.success) {
                setProfile({
                    name: res.data.name,
                    xp: res.data.xp || 0,
                    level: res.data.level || 1,
                    role: res.data.role, // Capture role
                    targets: {
                        listening: res.data.targets?.listening || 0,
                        reading: res.data.targets?.reading || 0,
                        writing: res.data.targets?.writing || 0,
                        speaking: res.data.targets?.speaking || 0
                    }
                });
            }
        } catch (err) {
            setError('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleTargetChange = (skill, value) => {
        const numValue = parseFloat(value);
        setProfile(prev => ({
            ...prev,
            targets: {
                ...prev.targets,
                [skill]: isNaN(numValue) ? 0 : numValue
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const res = await api.updateProfile(profile);
            if (res.success) {
                setIsEditing(false);
                const currentUser = api.getUser();
                if (currentUser && currentUser.name !== profile.name) {
                    api.setUser({ ...currentUser, name: profile.name });
                    window.location.reload();
                }
            }
        } catch (err) {
            setError(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };



    const overallScore = calculateOverall(profile.targets);

    // Calculate level stats
    const levelStats = calculateLevelProgress(profile.xp || 0);
    // Override for Admin
    if (profile.role === 'admin') {
        levelStats.level = 100;
        levelStats.progress = 100;
        levelStats.currentLevelXP = "MAX";
        levelStats.requiredXP = "MAX";
    }

    if (loading) return <div className="page p-4">Loading...</div>;

    return (
        <div className="profile-page">
            <div className="profile-header-card">
                <div className="profile-avatar-section">
                    {/* Use LevelProgress's icon logic or a big avatar */}
                    <div className="profile-big-avatar">
                        <LevelProgress user={{ ...profile, level: levelStats.level, xp: profile.xp }} />
                    </div>
                    <div className="profile-info-main">
                        <h1>{profile.name}</h1>
                        <span className="profile-role-badge">{profile.role === 'admin' ? 'Administrator' : 'Student'}</span>
                    </div>
                </div>

                <div className="profile-gamification-stats">
                    <div className="xp-progress-container">
                        <div className="xp-info-row">
                            <span className="current-level-label">Level {levelStats.level}</span>
                            <span className="xp-values">{levelStats.currentLevelXP} / {levelStats.requiredXP} XP</span>
                        </div>
                        <div className="xp-progress-bar-bg">
                            <div className="xp-progress-bar-fill" style={{ width: `${levelStats.progress}%` }}></div>
                        </div>
                        <div className="next-level-hint">
                            {profile.role !== 'admin' && (
                                <span>{levelStats.requiredXP - levelStats.currentLevelXP} XP to Level {levelStats.level + 1}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Study Plan Section */}
            <div className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="section-icon">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Lộ trình học tập
            </div>
            <div style={{ marginBottom: '2rem' }}>
                <StudyDashboardWidget />
            </div>

            <div className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="section-icon">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                </svg>
                Mục tiêu của bạn
            </div>

            {/* ... (Existing error and form code ) */}
            {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

            {!isEditing ? (
                <div className="targets-container">
                    {/* Overall Card */}
                    <div className="score-card overall">
                        <div className="card-header">
                            <span className="card-label">Overall score</span>
                            {/* Edit button */}
                            {api.isAuthenticated() && (
                                <button className="edit-btn" onClick={() => setIsEditing(true)} title="Edit Targets">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                            )}
                        </div>
                        <span className="card-value">{overallScore.toFixed(1)}</span>
                    </div>

                    {/* Individual Skills */}
                    {['reading', 'listening', 'writing', 'speaking'].map(skill => (
                        <div key={skill} className="score-card skill">
                            <span className="card-label" style={{ textTransform: 'capitalize' }}>{skill}</span>
                            <span className="card-value">{profile.targets[skill].toFixed(1)}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="edit-container">
                    {/* ... (Existing form content) */}
                    <h3 style={{ marginBottom: '1.5rem', fontWeight: 600 }}>Edit Targets</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label>Name</label>
                            <input
                                type="text"
                                value={profile.name}
                                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-grid">
                            {['listening', 'reading', 'writing', 'speaking'].map(skill => (
                                <div key={skill} className="form-group">
                                    <label style={{ textTransform: 'capitalize' }}>{skill}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="9"
                                        step="0.5"
                                        value={profile.targets[skill]}
                                        onChange={(e) => handleTargetChange(skill, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="edit-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setIsEditing(false)}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
