import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationContext';
import './EnhancedReviewPhase.css';

const EnhancedReviewPhase = ({ question, essay, sessionData, onRestart }) => {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEssay, setShowEssay] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // overview, skills, growth, essay
    const [reflection, setReflection] = useState('');
    const [savedReflection, setSavedReflection] = useState(false);

    const { showNotification } = useNotification();
    const navigate = useNavigate();

    useEffect(() => {
        submitEssay();
    }, []);

    const submitEssay = async () => {
        try {
            const response = await api.submitEssay({
                questionId: question._id,
                essay: essay.essay,
                outline: sessionData.outline,
                timeSpent: essay.timeElapsed,
                wordCount: essay.wordCount
            });
            setResults(response);
        } catch (error) {
            showNotification(error.message || 'Failed to submit essay', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReflection = async () => {
        try {
            await api.saveReflection({
                sessionId: results._id,
                reflection
            });
            setSavedReflection(true);
            showNotification('Reflection saved!', 'success');
        } catch (error) {
            showNotification('Failed to save reflection', 'error');
        }
    };

    const getBandColor = (score) => {
        if (score >= 8) return '#10b981';
        if (score >= 7) return '#3b82f6';
        if (score >= 6) return '#f59e0b';
        return '#ef4444';
    };

    const getSkillLevel = (score) => {
        if (score >= 8) return 'Expert';
        if (score >= 7) return 'Advanced';
        if (score >= 6) return 'Competent';
        if (score >= 5) return 'Developing';
        return 'Beginner';
    };

    if (loading) {
        return (
            <div className="enhanced-review-phase loading">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <h2>🤖 AI is analyzing your essay...</h2>
                    <p>This may take a moment</p>
                </div>
            </div>
        );
    }

    if (!results) {
        return (
            <div className="enhanced-review-phase error">
                <h2>❌ Failed to load results</h2>
                <button onClick={() => navigate('/practice')}>Back to Practice</button>
            </div>
        );
    }

    const overallBand = results.overallBand || 6.5;
    const skillScores = results.skillScores || {
        thesisClarity: 7,
        ideaDevelopment: 7,
        paragraphStructure: 6,
        vocabularyRange: 7,
        grammarAccuracy: 7,
        coherence: 7
    };

    const weakestSkills = Object.entries(skillScores)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3);

    const formatSkillName = (key) => {
        return key.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
    };

    return (
        <div className="enhanced-review-phase">
            {/* Header */}
            <div className="review-header">
                <div className="header-content">
                    <h1>📊 Your Results</h1>
                    <p>Comprehensive analysis and growth recommendations</p>
                </div>
                <div className="header-actions">
                    <button onClick={() => navigate('/practice')} className="btn-back-practice">
                        ← Back to Practice
                    </button>
                    <button onClick={onRestart} className="btn-try-again">
                        🔄 Try Another
                    </button>
                </div>
            </div>

            {/* Band Score Hero */}
            <div className="band-score-hero">
                <div className="score-circle" style={{ borderColor: getBandColor(overallBand) }}>
                    <div className="score-value" style={{ color: getBandColor(overallBand) }}>
                        {overallBand}
                    </div>
                    <div className="score-label">IELTS Band</div>
                </div>
                <div className="score-breakdown">
                    <div className="criterion-score">
                        <span className="criterion-label">Task Response</span>
                        <span className="criterion-value">{results.taskResponse || 7}</span>
                    </div>
                    <div className="criterion-score">
                        <span className="criterion-label">Coherence & Cohesion</span>
                        <span className="criterion-value">{results.coherenceCohesion || 7}</span>
                    </div>
                    <div className="criterion-score">
                        <span className="criterion-label">Lexical Resource</span>
                        <span className="criterion-value">{results.lexicalResource || 6}</span>
                    </div>
                    <div className="criterion-score">
                        <span className="criterion-label">Grammar Range & Accuracy</span>
                        <span className="criterion-value">{results.grammarAccuracy || 7}</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="review-tabs">
                <button
                    className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 Overview
                </button>
                <button
                    className={`tab ${activeTab === 'skills' ? 'active' : ''}`}
                    onClick={() => setActiveTab('skills')}
                >
                    🎯 Skill Breakdown
                </button>
                <button
                    className={`tab ${activeTab === 'growth' ? 'active' : ''}`}
                    onClick={() => setActiveTab('growth')}
                >
                    📈 Growth Plan
                </button>
                <button
                    className={`tab ${activeTab === 'essay' ? 'active' : ''}`}
                    onClick={() => setActiveTab('essay')}
                >
                    📝 Your Essay
                </button>
            </div>

            {/* Tab Content */}
            <div className="review-content">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="tab-content">
                        <div className="content-grid">
                            {/* Strengths */}
                            <div className="insight-card strengths">
                                <h3>💪 Strengths</h3>
                                <ul>
                                    {results.strengths?.map((strength, idx) => (
                                        <li key={idx}>{strength}</li>
                                    )) || [
                                        'Clear thesis statement',
                                        'Good use of examples',
                                        'Logical paragraph structure'
                                    ].map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>

                            {/* Areas for Improvement */}
                            <div className="insight-card improvements">
                                <h3>🎯 Areas for Improvement</h3>
                                <ul>
                                    {results.improvements?.map((improvement, idx) => (
                                        <li key={idx}>{improvement}</li>
                                    )) || [
                                        'Vary sentence structures more',
                                        'Use more academic vocabulary',
                                        'Improve coherence between paragraphs'
                                    ].map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>

                            {/* Quick Stats */}
                            <div className="insight-card stats">
                                <h3>📊 Statistics</h3>
                                <div className="stat-items">
                                    <div className="stat">
                                        <span className="stat-label">Words Written:</span>
                                        <span className="stat-value">{essay.wordCount}</span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-label">Time Taken:</span>
                                        <span className="stat-value">{Math.floor(essay.timeElapsed / 60)} min</span>
                                    </div>
                                    <div className="stat">
                                        <span className="stat-label">Paragraphs:</span>
                                        <span className="stat-value">{essay.essay.split('\n\n').filter(p => p.trim()).length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Feedback */}
                        <div className="feedback-card">
                            <h3>💬 Detailed Feedback</h3>
                            <div className="feedback-text">
                                {results.detailedFeedback || 'Your essay demonstrates a good understanding of the task. Continue to focus on developing your ideas with specific examples and varying your sentence structures for higher band scores.'}
                            </div>
                        </div>
                    </div>
                )}

                {/* Skills Tab */}
                {activeTab === 'skills' && (
                    <div className="tab-content">
                        <div className="skills-grid">
                            {Object.entries(skillScores).map(([skill, score]) => (
                                <div key={skill} className="skill-card">
                                    <div className="skill-header">
                                        <h4>{formatSkillName(skill)}</h4>
                                        <span className="skill-level" style={{ color: getBandColor(score) }}>
                                            {getSkillLevel(score)}
                                        </span>
                                    </div>
                                    <div className="skill-meter">
                                        <div
                                            className="skill-fill"
                                            style={{
                                                width: `${(score / 10) * 100}%`,
                                                background: getBandColor(score)
                                            }}
                                        />
                                    </div>
                                    <div className="skill-score">
                                        <span className="score">{score}</span>
                                        <span className="max">/10</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Skill Comparison Chart */}
                        <div className="comparison-card">
                            <h3>📊 Your Progress Journey</h3>
                            <p className="chart-description">Track how your skills have improved over time</p>
                            <div className="progress-placeholder">
                                <div className="placeholder-text">
                                    📈 Complete more essays to see your progress chart
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Growth Plan Tab */}
                {activeTab === 'growth' && (
                    <div className="tab-content">
                        <div className="growth-header">
                            <h2>🎯 Your Personalized Growth Plan</h2>
                            <p>Focus on these areas to improve your band score</p>
                        </div>

                        {/* Weakest Skills */}
                        <div className="focus-areas">
                            <h3>🎯 Priority Focus Areas</h3>
                            {weakestSkills.map(([skill, score], idx) => (
                                <div key={skill} className="focus-item">
                                    <div className="focus-rank">{idx + 1}</div>
                                    <div className="focus-details">
                                        <h4>{formatSkillName(skill)}</h4>
                                        <div className="focus-score">
                                            Current: <span style={{ color: getBandColor(score) }}>{score}/10</span>
                                        </div>
                                        <div className="focus-actions">
                                            <button className="action-btn">📚 Review Module</button>
                                            <button className="action-btn">✏️ Practice Exercise</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Recommended Next Steps */}
                        <div className="recommendations-card">
                            <h3>💡 Recommended Next Steps</h3>
                            <div className="recommendation-list">
                                <div className="recommendation">
                                    <span className="rec-icon">📝</span>
                                    <div className="rec-content">
                                        <h4>Practice Similar Questions</h4>
                                        <p>Try 2-3 more {question.task_type === 'task1' ? 'Task 1' : 'Task 2'} essays on similar topics</p>
                                    </div>
                                </div>
                                <div className="recommendation">
                                    <span className="rec-icon">📚</span>
                                    <div className="rec-content">
                                        <h4>Review Skill Modules</h4>
                                        <p>Revisit modules on your weakest skills</p>
                                    </div>
                                </div>
                                <div className="recommendation">
                                    <span className="rec-icon">🎯</span>
                                    <div className="rec-content">
                                        <h4>Set a Target</h4>
                                        <p>Aim for Band {Math.min(overallBand + 0.5, 9)} on your next essay</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Reflection Journal */}
                        <div className="reflection-card">
                            <h3>📔 Reflection Journal</h3>
                            <p>Take a moment to reflect on your learning</p>
                            <textarea
                                className="reflection-input"
                                placeholder="What did you learn from this essay? What will you focus on next time?"
                                value={reflection}
                                onChange={(e) => setReflection(e.target.value)}
                                rows={6}
                            />
                            <button
                                className="btn-save-reflection"
                                onClick={handleSaveReflection}
                                disabled={!reflection.trim() || savedReflection}
                            >
                                {savedReflection ? '✅ Saved' : '💾 Save Reflection'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Essay Tab */}
                {activeTab === 'essay' && (
                    <div className="tab-content">
                        <div className="essay-display">
                            <div className="essay-header">
                                <h3>📝 Your Essay</h3>
                                <div className="essay-meta">
                                    {essay.wordCount} words • {Math.floor(essay.timeElapsed / 60)} minutes
                                </div>
                            </div>
                            <div className="essay-content">
                                {essay.essay.split('\n\n').map((paragraph, idx) => (
                                    <p key={idx} className="essay-paragraph">
                                        {paragraph}
                                    </p>
                                ))}
                            </div>
                        </div>

                        {results.modelAnswer && (
                            <div className="model-essay-display">
                                <div className="model-header">
                                    <h3>⭐ Model Answer (Band 8+)</h3>
                                    <p>Compare your essay with this high-scoring example</p>
                                </div>
                                <div className="model-content">
                                    {results.modelAnswer}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnhancedReviewPhase;
