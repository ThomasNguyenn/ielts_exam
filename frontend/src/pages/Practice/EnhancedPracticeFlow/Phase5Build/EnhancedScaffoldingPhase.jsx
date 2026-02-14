import React, { useState, useEffect } from 'react';
import { api } from '../../../../api/client';
import { useNotification } from '../../../../components/NotificationContext';
import './EnhancedScaffoldingPhase.css';

const EnhancedScaffoldingPhase = ({ question, outline, onNext, onBack }) => {
    const [paragraphs, setParagraphs] = useState({
        intro: '',
        body1: '',
        body2: '',
        body3: '',
        conclusion: ''
    });
    const [currentSection, setCurrentSection] = useState('intro');
    const [feedback, setFeedback] = useState({});
    const [scores, setScores] = useState({});
    const [loading, setLoading] = useState(false);
    const [showHelp, setShowHelp] = useState(true);

    const { showNotification } = useNotification();
    const isTask1 = question.task_type === 'task1' || question.task_type === 1;

    const sections = isTask1 ? [
        { id: 'intro', label: 'Introduction', minWords: 25, tips: 'Paraphrase the question. Describe what the visual shows.' },
        { id: 'overview', label: 'Overview', minWords: 30, tips: 'Summarize 2-3 main trends. NO specific numbers here.' },
        { id: 'body1', label: 'Body Paragraph 1', minWords: 60, tips: 'Describe first group/trend with specific data.' },
        { id: 'body2', label: 'Body Paragraph 2', minWords: 60, tips: 'Describe second group/trend.Compare with first if applicable.' }
    ] : [
        { id: 'intro', label: 'Introduction', minWords: 40, tips: 'Paraphrase topic + state your thesis clearly' },
        { id: 'body1', label: 'Body Paragraph 1', minWords: 70, tips: 'Topic sentence + Explanation + Example + Link (PEEL)' },
        { id: 'body2', label: 'Body Paragraph 2', minWords: 70, tips: 'Second main argument with PEEL structure' },
        { id: 'body3', label: 'Body Paragraph 3 (Optional)', minWords: 60, tips: 'Additional point or counter-argument if needed' },
        { id: 'conclusion', label: 'Conclusion', minWords: 35, tips: 'Restate thesis + summarize main points' }
    ];

    const handleParagraphChange = (sectionId, value) => {
        setParagraphs(prev => ({
            ...prev,
            [sectionId]: value
        }));
    };

    const getWordCount = (text) => {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    };

    const handleGetFeedback = async (sectionId) => {
        const paragraph = paragraphs[sectionId];
        if (!paragraph || paragraph.trim() === '') {
            showNotification('Please write something first!', 'warning');
            return;
        }

        setLoading(true);
        try {
            const res = await api.checkParagraph({
                questionId: question._id,
                sectionType: sectionId,
                content: paragraph,
                outline: outline
            });

            setFeedback(prev => ({
                ...prev,
                [sectionId]: res.feedback
            }));

            setScores(prev => ({
                ...prev,
                [sectionId]: res.score || 0
            }));

            showNotification('Feedback received!', 'success');
        } catch (e) {
            showNotification(e.message || 'Failed to get feedback', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        const completedParagraphs = Object.entries(paragraphs)
            .filter(([key, value]) => value && value.trim() !== '')
            .length;

        if (completedParagraphs < 2) {
            showNotification('Please complete at least 2 paragraphs before continuing', 'warning');
            return;
        }

        onNext({ paragraphs, scores, feedback });
    };

    const currentSectionData = sections.find(s => s.id === currentSection);
    const wordCount = getWordCount(paragraphs[currentSection] || '');
    const progress = Math.min((wordCount / currentSectionData.minWords) * 100, 100);

    return (
        <div className="enhanced-scaffolding-phase">
            {/* Header */}
            <div className="scaffolding-header">
                <button onClick={onBack} className="btn-back">
                    ← Back
                </button>
                <div className="header-content">
                    <h1>🏗️ Build Your Essay</h1>
                    <p>Practice paragraph by paragraph with instant feedback</p>
                </div>
                <button
                    className="btn-help-toggle"
                    onClick={() => setShowHelp(!showHelp)}
                >
                    {showHelp ? '❌ Hide Help' : '💡 Show Help'}
                </button>
            </div>

            <div className="scaffolding-container">
                {/* Left Panel - Question & Outline Reference */}
                <div className="left-panel">
                    <div className="reference-card">
                        <h3>📋 Your Outline</h3>
                        {outline && Object.entries(outline.outline || outline).map(([key, value]) => (
                            value && (
                                <div key={key} className="outline-item">
                                    <div className="outline-label">{key}:</div>
                                    <div className="outline-value">{value}</div>
                                </div>
                            )
                        ))}
                    </div>

                    <div className="question-reference">
                        <h3>Question</h3>
                        {question.image_url && (
                            <img src={question.image_url} alt="Task" className="question-img" />
                        )}
                        <p>{question.prompt}</p>
                    </div>
                </div>

                {/* Middle Panel - Writing Area */}
                <div className="middle-panel">
                    {/* Section Navigator */}
                    <div className="section-navigator">
                        {sections.map(section => {
                            const sectionWordCount = getWordCount(paragraphs[section.id] || '');
                            const isComplete = sectionWordCount >= section.minWords;
                            const hasContent = sectionWordCount > 0;

                            return (
                                <button
                                    key={section.id}
                                    className={`section-tab ${currentSection === section.id ? 'active' : ''} ${isComplete ? 'complete' : ''} ${hasContent ? 'in-progress' : ''}`}
                                    onClick={() => setCurrentSection(section.id)}
                                >
                                    <div className="tab-label">{section.label}</div>
                                    <div className="tab-status">
                                        {isComplete ? '✓' : hasContent ? `${sectionWordCount}w` : ''}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Writing Section */}
                    <div className="writing-section">
                        <div className="section-header">
                            <h3>{currentSectionData.label}</h3>
                            <div className="word-counter">
                                <span className={wordCount >= currentSectionData.minWords ? 'complete' : ''}>
                                    {wordCount} / {currentSectionData.minWords} words
                                </span>
                            </div>
                        </div>

                        {showHelp && (
                            <div className="section-tips">
                                💡 <strong>Tip:</strong> {currentSectionData.tips}
                            </div>
                        )}

                        <div className="progress-bar-container">
                            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                        </div>

                        <textarea
                            className="paragraph-editor"
                            placeholder={`Write your ${currentSectionData.label.toLowerCase()}...`}
                            value={paragraphs[currentSection] || ''}
                            onChange={(e) => handleParagraphChange(currentSection, e.target.value)}
                            rows={12}
                        />

                        <div className="section-actions">
                            <button
                                className="btn-feedback"
                                onClick={() => handleGetFeedback(currentSection)}
                                disabled={loading || !paragraphs[currentSection]}
                            >
                                {loading ? '🔄 Analyzing...' : '🤖 Get Feedback'}
                            </button>

                            {scores[currentSection] && (
                                <div className="section-score">
                                    Score: <span className="score-value">{scores[currentSection]}/10</span>
                                </div>
                            )}
                        </div>

                        {/* Feedback Display */}
                        {feedback[currentSection] && (
                            <div className="feedback-panel">
                                <h4>🤖 AI Feedback</h4>
                                <div className="feedback-content">
                                    {feedback[currentSection]}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Final Actions */}
                    <div className="final-actions">
                        <div className="completion-summary">
                            <span>Completed: {Object.values(paragraphs).filter(p => p && p.trim() !== '').length} / {sections.length} sections</span>
                        </div>
                        <button
                            className="btn-continue"
                            onClick={handleNext}
                        >
                            Continue to Full Essay →
                        </button>
                    </div>
                </div>

                {/* Right Panel - Writing Guides */}
                {showHelp && (
                    <div className="right-panel">
                        <div className="guide-card">
                            <h3>✍️ Writing Guides</h3>

                            <div className="guide-section">
                                <h4>PEEL Structure</h4>
                                <ul>
                                    <li><strong>P</strong>oint - Topic sentence</li>
                                    <li><strong>E</strong>xplanation - Why/How</li>
                                    <li><strong>E</strong>xample - Specific case</li>
                                    <li><strong>L</strong>ink - Connect back to thesis</li>
                                </ul>
                            </div>

                            <div className="guide-section">
                                <h4>Linking Words</h4>
                                <div className="linking-chips">
                                    <span>Furthermore</span>
                                    <span>However</span>
                                    <span>For instance</span>
                                    <span>Therefore</span>
                                    <span>Moreover</span>
                                    <span>In contrast</span>
                                    <span>Consequently</span>
                                </div>
                            </div>

                            <div className="guide-section">
                                <h4>Quick Tips</h4>
                                <ul>
                                    <li>Vary sentence length</li>
                                    <li>Use academic vocabulary</li>
                                    <li>Avoid repetition</li>
                                    <li>Check spelling & grammar</li>
                                    <li>Stay relevant to question</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnhancedScaffoldingPhase;
