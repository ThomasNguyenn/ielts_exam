import { useState, useEffect } from 'react';
import { api } from '../api/client';
import './Profile.css';

// Calculate overall score (Average of 4 skills, rounded to nearest 0.5)
const calculateOverall = (targets) => {
    const { listening, reading, writing, speaking } = targets;
    const avg = (listening + reading + writing + speaking) / 4;
    return Math.round(avg * 2) / 2;
};

export default function Profile() {
    const [profile, setProfile] = useState({
        name: '',
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

    if (loading) return <div className="page p-4">Loading...</div>;

    return (
        <div className="profile-page">
            <div className="profile-header">
                <h1>Welcome back, {profile.name}</h1>
            </div>

            <div className="section-title">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="section-icon">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                </svg>
                Mục tiêu của bạn
            </div>

            {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

            {!isEditing ? (
                <div className="targets-container">
                    {/* Overall Card */}
                    <div className="score-card overall">
                        <div className="card-header">
                            <span className="card-label">Overall score</span>
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
