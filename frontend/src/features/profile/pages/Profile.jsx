import React, { useState, useEffect } from "react";
import { api } from "@/shared/api/client";
import "./Profile.css";
import StudyDashboardWidget from '@/shared/components/StudyDashboardWidget';
import {
    Award,
    BookOpen,
    Headphones,
    Pen,
    Mic,
    Target,
    Star,
    Zap,
    TrendingUp,
    Trophy,
    Flame,
    Settings,
    X,
} from "lucide-react";

// Helpers
const calculateOverall = (targets) => {
    const { listening, reading, writing, speaking } = targets || { listening: 0, reading: 0, writing: 0, speaking: 0 };
    const avg = (listening + reading + writing + speaking) / 4;
    return Math.round(avg * 2) / 2;
};

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

const SKILLS = {
    reading: { label: "Reading", color: "#6366F1", icon: BookOpen },
    writing: { label: "Writing", color: "#10B981", icon: Pen },
    listening: { label: "Listening", color: "#0EA5E9", icon: Headphones },
    speaking: { label: "Speaking", color: "#F59E0B", icon: Mic },
};

const achievements = [
    { icon: Flame, label: "7-Day Streak", color: "#F59E0B" },
    { icon: Trophy, label: "Top Scorer", color: "#F59E0B" },
    { icon: Star, label: "Perfect Quiz", color: "#F59E0B" },
    { icon: Zap, label: "Speed Reader", color: "#F59E0B" },
];

export default function ProfilePage() {
    const [profile, setProfile] = useState({
        name: '',
        xp: 0,
        level: 1,
        role: 'student',
        targets: { listening: 0, reading: 0, writing: 0, speaking: 0 }
    });
    const [editForm, setEditForm] = useState({
        name: '',
        targets: { listening: 0, reading: 0, writing: 0, speaking: 0 },
    });
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [saveError, setSaveError] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            if (api.isAuthenticated()) {
                const res = await api.getProfile();
                if (res.success) {
                    const safeTargets = res.data.targets || { listening: 0, reading: 0, writing: 0, speaking: 0 };
                    setProfile({
                        name: res.data.name,
                        xp: res.data.xp || 0,
                        level: res.data.level || 1,
                        role: res.data.role || 'student',
                        targets: safeTargets
                    });
                    setEditForm({
                        name: res.data.name || '',
                        targets: {
                            reading: Number(safeTargets.reading || 0),
                            listening: Number(safeTargets.listening || 0),
                            writing: Number(safeTargets.writing || 0),
                            speaking: Number(safeTargets.speaking || 0),
                        },
                    });
                }
            }
        } catch (err) {
            console.error("Failed to load profile", err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate stats based on real data
    const levelStats = calculateLevelProgress(profile.xp || 0);

    // Admin Override
    if (profile.role === 'admin') {
        levelStats.level = 100;
        levelStats.progress = 100;
        levelStats.currentLevelXP = "MAX";
        levelStats.requiredXP = "MAX";
    }

    const overallScore = calculateOverall(profile.targets);

    const clampScore = (value) => {
        const numeric = Number.parseFloat(value);
        if (Number.isNaN(numeric)) return 0;
        const clamped = Math.max(0, Math.min(9, numeric));
        return Math.round(clamped * 2) / 2;
    };

    const handleTargetChange = (skill, value) => {
        setEditForm((prev) => ({
            ...prev,
            targets: {
                ...prev.targets,
                [skill]: value,
            },
        }));
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        setSaveMessage('');
        setSaveError('');

        try {
            const payload = {
                name: String(editForm.name || '').trim(),
                targets: {
                    reading: clampScore(editForm.targets.reading),
                    listening: clampScore(editForm.targets.listening),
                    writing: clampScore(editForm.targets.writing),
                    speaking: clampScore(editForm.targets.speaking),
                },
            };

            const res = await api.updateProfile(payload);
            if (!res?.success || !res?.data) {
                throw new Error('Failed to update profile');
            }

            const updatedTargets = res.data.targets || payload.targets;
            setProfile((prev) => ({
                ...prev,
                name: res.data.name || payload.name,
                targets: updatedTargets,
            }));
            setEditForm({
                name: res.data.name || payload.name,
                targets: {
                    reading: Number(updatedTargets.reading || 0),
                    listening: Number(updatedTargets.listening || 0),
                    writing: Number(updatedTargets.writing || 0),
                    speaking: Number(updatedTargets.speaking || 0),
                },
            });

            const currentUser = api.getUser();
            if (currentUser) {
                api.setUser({
                    ...currentUser,
                    name: res.data.name || payload.name,
                });
            }

            setSaveMessage('Profile updated successfully.');
        } catch (error) {
            console.error('Update profile failed:', error);
            setSaveError(error.message || 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading profile...</div>;

    return (
        <div className="space-y-8 p-6 w-full mx-auto bg-slate-50 min-h-screen">
            {/* Profile Summary Card */}
            <div
                className="rounded-2xl p-8 relative overflow-hidden"
                style={{
                    backgroundColor: "#FFFFFF",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                }}
            >
                {/* Decorative gradient stripe */}
                <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{
                        background: "linear-gradient(90deg, #6366F1, #818CF8, #6366F1)",
                    }}
                />

                <div className="flex flex-col lg:flex-row items-center gap-8">
                    {/* Info - Avatar Removed */}
                    <div className="flex items-center gap-6">
                        <div>
                            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
                                {profile.name}
                            </h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span
                                    className="px-3 py-1 rounded-lg"
                                    style={{
                                        backgroundColor: "rgba(99, 102, 241, 0.1)",
                                        color: "#6366F1",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                    }}
                                >
                                    {profile.role === 'admin' ? 'Administrator' : 'Student'}
                                </span>
                                <span
                                    className="px-3 py-1 rounded-lg flex items-center gap-1.5"
                                    style={{
                                        backgroundColor: "rgba(245, 158, 11, 0.1)",
                                        color: "#D97706",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                    }}
                                >
                                    <Zap className="w-3 h-3" />
                                    Level {levelStats.level}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* XP Progress */}
                    <div className="flex-1 w-full">
                        <div className="flex justify-between items-center mb-2">
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>
                                Experience Points
                            </span>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#6366F1" }}>
                                {levelStats.currentLevelXP.toLocaleString()} / {levelStats.requiredXP.toLocaleString()} XP
                            </span>
                        </div>
                        <div
                            className="w-full h-3 rounded-full overflow-hidden"
                            style={{ backgroundColor: "#E2E8F0" }}
                        >
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${levelStats.progress}%`,
                                    background: "linear-gradient(90deg, #6366F1, #818CF8)",
                                }}
                            />
                        </div>
                        {profile.role !== 'admin' && (
                            <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "6px" }}>
                                {levelStats.requiredXP - levelStats.currentLevelXP} XP to next level
                            </p>
                        )}
                    </div>

                    {/* Achievements */}
                    <div className="flex gap-3">
                        {achievements.map((ach) => (
                            <div
                                key={ach.label}
                                className="w-12 h-12 rounded-xl flex items-center justify-center group relative cursor-pointer transition-transform hover:scale-110"
                                style={{
                                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                                    border: "1px solid rgba(245, 158, 11, 0.2)",
                                }}
                                title={ach.label}
                            >
                                <ach.icon className="w-5 h-5" style={{ color: ach.color }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isSettingsOpen && (
                <div
                    className="rounded-2xl p-6"
                    style={{
                        backgroundColor: "#FFFFFF",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                    }}
                >
                    <div className="mb-5">
                        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>
                            Profile Settings
                        </h2>
                        <p style={{ fontSize: "14px", color: "#64748B", marginTop: "4px" }}>
                            Update your display name and target scores.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="lg:col-span-1">
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                                User Name
                            </label>
                            <input
                                type="text"
                                value={editForm.name}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                                placeholder="Your name"
                                style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "10px", padding: "10px 12px", fontSize: "14px" }}
                            />
                        </div>

                        {(["reading", "listening", "writing", "speaking"]).map((skillKey) => (
                            <div key={skillKey}>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px", textTransform: "capitalize" }}>
                                    {skillKey} Target
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="9"
                                    step="0.5"
                                    value={editForm.targets[skillKey]}
                                    onChange={(event) => handleTargetChange(skillKey, event.target.value)}
                                    style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "10px", padding: "10px 12px", fontSize: "14px" }}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSaveProfile}
                            disabled={saving}
                            style={{
                                border: "none",
                                borderRadius: "10px",
                                backgroundColor: saving ? "#94A3B8" : "#6366F1",
                                color: "#FFFFFF",
                                fontWeight: 700,
                                padding: "10px 16px",
                                cursor: saving ? "not-allowed" : "pointer",
                            }}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        {saveMessage && <span style={{ color: "#15803D", fontWeight: 600, fontSize: "14px" }}>{saveMessage}</span>}
                        {saveError && <span style={{ color: "#B91C1C", fontWeight: 600, fontSize: "14px" }}>{saveError}</span>}
                    </div>
                </div>
            )}

            {/* Target Scores */}
            <div className="mb-8">
                <div className="mb-6 flex justify-between gap-3">

                    <div>
                        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>
                            Target Scores
                        </h2>
                        <p style={{ fontSize: "14px", color: "#64748B", marginTop: "4px" }}>
                            Your personalized IELTS band score goals
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsSettingsOpen((value) => !value)}
                        aria-label={isSettingsOpen ? 'Close profile settings' : 'Open profile settings'}
                        title={isSettingsOpen ? 'Close profile settings' : 'Open profile settings'}
                        style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "10px",
                            border: "1px solid #E2E8F0",
                            backgroundColor: "#FFFFFF",
                            color: "#475569",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                        }}
                    >
                        {isSettingsOpen ? <X className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {/* Overall Score - Feature Card */}
                    <div
                        className="rounded-2xl p-6 relative overflow-hidden col-span-1"
                        style={{
                            backgroundColor: "#FFFFFF",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                            borderTop: "3px solid #F59E0B",
                        }}
                    >
                        <div
                            className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5"
                            style={{ backgroundColor: "#F59E0B", transform: "translate(30%, -30%)" }}
                        />
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="w-5 h-5" style={{ color: "#F59E0B" }} />
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748B" }}>
                                Overall Target
                            </span>
                        </div>
                        <p style={{ fontSize: "48px", fontWeight: 800, color: "#F59E0B", lineHeight: 1 }}>
                            {overallScore || 0}
                        </p>
                        <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "8px" }}>
                            Band Score
                        </p>
                        <div
                            className="mt-4 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                            style={{ backgroundColor: "rgba(245, 158, 11, 0.1)" }}
                        >
                            <Award className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "#D97706" }}>
                                University Requirement
                            </span>
                        </div>
                    </div>

                    {/* Skill Target Cards */}
                    {(["reading", "listening", "writing", "speaking"]).map((skillKey) => {
                        const skill = SKILLS[skillKey];
                        const score = profile.targets[skillKey] || 0;
                        return (
                            <div
                                key={skillKey}
                                className="rounded-2xl p-6 relative overflow-hidden"
                                style={{
                                    backgroundColor: "#FFFFFF",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
                                    borderLeft: `3px solid ${skill.color}`,
                                }}
                            >
                                <div
                                    className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-5"
                                    style={{ backgroundColor: skill.color, transform: "translate(30%, -30%)" }}
                                />
                                <div className="flex items-center gap-2 mb-4">
                                    <skill.icon className="w-4 h-4" style={{ color: skill.color }} />
                                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748B" }}>
                                        {skill.label}
                                    </span>
                                </div>
                                <p style={{ fontSize: "40px", fontWeight: 800, color: skill.color, lineHeight: 1 }}>
                                    {score}
                                </p>
                                <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "8px" }}>
                                    Target Band
                                </p>
                                <div className="mt-4 w-full h-1.5 rounded-full" style={{ backgroundColor: `${skill.color}15` }}>
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${(score / 9) * 100}%`,
                                            backgroundColor: skill.color,
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Dynamic Learning Roadmap */}
            <div className="mb-8">
                <StudyDashboardWidget />
            </div>
        </div>
    );
}
