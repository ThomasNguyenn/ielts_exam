import React, { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import SkillModuleCard from './SkillModuleCard';
import LessonViewer from './LessonViewer';
import CheckpointQuiz from './CheckpointQuiz';
import './LearnPhase.css';

const LearnPhase = ({ onComplete, onBack }) => {
    const [modules, setModules] = useState([]);
    const [selectedModule, setSelectedModule] = useState(null);
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showQuiz, setShowQuiz] = useState(false);

    const { showNotification } = useNotification();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [modulesRes, progressRes] = await Promise.all([
                api.getSkillModules(),
                api.getMyProgress()
            ]);

            setModules(modulesRes.data || []);
            setProgress(progressRes.data || null);
        } catch (error) {
            console.error('Error loading modules:', error);
            showNotification('Failed to load skill modules', 'error');
        } finally {
            setLoading(false);
        }
    };

    const isModuleUnlocked = (module) => {
        if (!module.unlockRequirement?.previousModule) {
            return true; // First module is always unlocked
        }

        if (!progress?.completedModules) {
            return false;
        }

        // Check if previous module is completed
        const completed = progress.completedModules.find(
            cm => String(cm.moduleId) === String(module.unlockRequirement.previousModule)
        );

        return completed && completed.quizScore >= (module.unlockRequirement.minimumScore || 70);
    };

    const isModuleCompleted = (moduleId) => {
        if (!progress?.completedModules) return false;
        return progress.completedModules.some(cm => String(cm.moduleId) === String(moduleId));
    };

    const handleModuleClick = (module) => {
        if (!isModuleUnlocked(module)) {
            showNotification('Complete previous modules first', 'warning');
            return;
        }
        setSelectedModule(module);
        setShowQuiz(false);
    };

    const handleStartQuiz = () => {
        setShowQuiz(true);
    };

    const handleQuizComplete = async (score, passed) => {
        if (passed) {
            try {
                await api.markModuleComplete(selectedModule._id, score);
                showNotification(`Module completed! Score: ${score}%`, 'success');

                // Reload progress
                const progressRes = await api.getMyProgress();
                setProgress(progressRes.data);

                // Close module view
                setSelectedModule(null);
                setShowQuiz(false);
            } catch (error) {
                console.error('Error marking module complete:', error);
                showNotification('Failed to save progress', 'error');
            }
        } else {
            showNotification(`Quiz failed. Score: ${score}%. You need 70% to pass.`, 'error');
            setShowQuiz(false);
        }
    };

    const handleContinueToNext = () => {
        // Check if all modules completed
        if (modules.length > 0 && progress?.completedModules?.length >= modules.length) {
            onComplete();
        } else {
            setSelectedModule(null);
            showNotification('Complete all modules to proceed', 'info');
        }
    };

    if (loading) {
        return (
            <div className="learn-phase">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading skill modules...</p>
                </div>
            </div>
        );
    }

    if (selectedModule) {
        return (
            <div className="learn-phase">
                {!showQuiz ? (
                    <LessonViewer
                        module={selectedModule}
                        onClose={() => setSelectedModule(null)}
                        onStartQuiz={handleStartQuiz}
                        isCompleted={isModuleCompleted(selectedModule._id)}
                    />
                ) : (
                    <CheckpointQuiz
                        module={selectedModule}
                        onComplete={handleQuizComplete}
                        onBack={() => setShowQuiz(false)}
                    />
                )}
            </div>
        );
    }

    const completedCount = progress?.completedModules?.length || 0;
    const totalModules = modules.length;
    const progressPercentage = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

    return (
        <div className="learn-phase">
            <div className="phase-header">
                <button onClick={onBack} className="back-button">
                    ← Back
                </button>
                <div className="header-content">
                    <h1 className="phase-title">
                        <span className="phase-icon">📚</span>
                        Lí Thuyết IELTS WRITING
                    </h1>
                </div>
            </div>

            <div className="progress-overview">
                <div className="progress-stats">
                    <div className="stat">
                        <span className="stat-value">{completedCount}/{totalModules}</span>
                        <span className="stat-label">Modules Completed</span>
                    </div>
                    <div className="stat">
                        <span className="stat-value">{progressPercentage}%</span>
                        <span className="stat-label">Progress</span>
                    </div>
                </div>
                <div className="progress-bar-container">
                    <div
                        className="progress-bar-fill"
                        style={{ width: `${progressPercentage}%` }}
                    ></div>
                </div>
            </div>

            <div className="modules-grid">
                {modules.map((module, index) => (
                    <SkillModuleCard
                        key={module._id}
                        module={module}
                        index={index}
                        isUnlocked={isModuleUnlocked(module)}
                        isCompleted={isModuleCompleted(module._id)}
                        onClick={() => handleModuleClick(module)}
                    />
                ))}
            </div>

            {completedCount === totalModules && totalModules > 0 && (
                <div className="completion-banner">
                    <div className="completion-content">
                        <span className="completion-icon">🎉</span>
                        <div>
                            <h3>All Modules Completed!</h3>
                            <p>You're ready to start writing practice</p>
                        </div>
                    </div>
                    <button onClick={handleContinueToNext} className="btn-continue">
                        Continue to Practice →
                    </button>
                </div>
            )}
        </div>
    );
};

export default LearnPhase;
