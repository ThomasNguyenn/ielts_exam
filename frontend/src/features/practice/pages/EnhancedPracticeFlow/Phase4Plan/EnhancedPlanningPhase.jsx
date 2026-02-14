import React, { useState, useEffect } from 'react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import { task1Templates, task2Templates, ideaBank, linkingPhrases } from './planningTemplates';
import VisualMindMap from './VisualMindMap';
import './EnhancedPlanningPhase.css';

const EnhancedPlanningPhase = ({ question, onNext, onBack }) => {
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [outline, setOutline] = useState({});
    const [currentSection, setCurrentSection] = useState(null);
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showIdeaBank, setShowIdeaBank] = useState(false);
    const [showLinkingPhrases, setShowLinkingPhrases] = useState(false);
    const [viewMode, setViewMode] = useState('outline'); // 'outline' or 'mindmap'

    const { showNotification } = useNotification();
    const isTask1 = question.task_type === 'task1' || question.task_type === 1;

    useEffect(() => {
        // Auto-select first template based on task type
        let template;
        if (isTask1) {
            template = task1Templates.lineGraph;
        } else {
            template = task2Templates.opinion;
        }

        setSelectedTemplate(template);

        // Initialize outline with empty values
        const initialOutline = {};
        Object.keys(template.structure).forEach(section => {
            initialOutline[section] = '';
        });
        setOutline(initialOutline);

        // Set intro as default section
        setCurrentSection('intro');
    }, [question]);

    const initializeOutline = () => {
        if (!selectedTemplate) return;

        const initialOutline = {};
        Object.keys(selectedTemplate.structure).forEach(section => {
            initialOutline[section] = '';
        });
        setOutline(initialOutline);
    };

    const handleTemplateChange = (template) => {
        setSelectedTemplate(template);
        const initialOutline = {};
        Object.keys(template.structure).forEach(section => {
            initialOutline[section] = '';
        });
        setOutline(initialOutline);
        // Set intro as default section
        setCurrentSection('intro');
    };

    const handleOutlineChange = (section, value) => {
        setOutline(prev => ({
            ...prev,
            [section]: value
        }));
    };

    const handleAIReview = async () => {
        setLoading(true);
        try {
            const res = await api.checkOutline({
                questionId: question._id,
                outline,
                templateType: selectedTemplate.name
            });
            setFeedback(res.feedback);
            showNotification('AI feedback received!', 'success');
        } catch (e) {
            showNotification(e.message || 'Failed to get AI feedback', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (Object.values(outline).every(val => !val || val.trim() === '')) {
            showNotification('Please fill in at least one section of your outline', 'warning');
            return;
        }
        onNext({ outline, templateType: selectedTemplate.name });
    };

    const getTopicForIdeaBank = () => {
        const promptLower = question.prompt.toLowerCase();
        if (promptLower.includes('education') || promptLower.includes('university') || promptLower.includes('school')) return 'education';
        if (promptLower.includes('technology') || promptLower.includes('computer') || promptLower.includes('internet')) return 'technology';
        if (promptLower.includes('environment') || promptLower.includes('pollution') || promptLower.includes('climate')) return 'environment';
        if (promptLower.includes('health') || promptLower.includes('medical') || promptLower.includes('fitness')) return 'health';
        if (promptLower.includes('global') || promptLower.includes('culture') || promptLower.includes('trade')) return 'globalisation';
        return null;
    };

    const topicKey = getTopicForIdeaBank();
    const ideaBankData = topicKey ? ideaBank[topicKey] : null;

    return (
        <div className="enhanced-planning-phase">
            {/* Header */}
            <div className="planning-header">
                <button onClick={onBack} className="btn-back">
                    ← Back
                </button>
                <div className="header-content">
                    <h1>📝 Plan Your Essay</h1>
                    <p>Use our guided templates to create a strong outline</p>
                </div>
            </div>

            <div className="planning-container">
                {/* Left Column - Question & Template Selector */}
                <div className="left-panel">
                    {/* Question Display */}
                    <div className="question-card">
                        <h3>Question</h3>
                        {question.image_url && (
                            <div className="question-image">
                                <img src={question.image_url} alt="Task visual" />
                            </div>
                        )}
                        <p className="question-text">{question.prompt}</p>
                    </div>

                    {/* Template Selector */}
                    <div className="template-selector-card">
                        <h3>Choose Structure</h3>
                        {isTask1 ? (
                            <div className="template-options">
                                {Object.entries(task1Templates).map(([key, template]) => (
                                    <button
                                        key={key}
                                        className={`template - option ${selectedTemplate?.name === template.name ? 'active' : ''} `}
                                        onClick={() => handleTemplateChange(template)}
                                    >
                                        {template.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="template-options">
                                {Object.entries(task2Templates).map(([key, template]) => (
                                    <button
                                        key={key}
                                        className={`template - option ${selectedTemplate?.name === template.name ? 'active' : ''} `}
                                        onClick={() => handleTemplateChange(template)}
                                    >
                                        <div className="template-name">{template.name}</div>
                                        {template.questionPattern && (
                                            <div className="template-pattern">{template.questionPattern}</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Helper Tools */}
                    <div className="helper-tools">
                        <button
                            className={`tool - btn ${viewMode === 'outline' ? 'active' : ''} `}
                            onClick={() => setViewMode('outline')}
                        >
                            📋 Outline
                        </button>
                        <button
                            className={`tool - btn ${viewMode === 'mindmap' ? 'active' : ''} `}
                            onClick={() => setViewMode('mindmap')}
                        >
                            🗺️ Mind Map
                        </button>
                    </div>

                    <div className="helper-tools">
                        {!isTask1 && ideaBankData && (
                            <button
                                className="tool-btn"
                                onClick={() => setShowIdeaBank(!showIdeaBank)}
                            >
                                💡 Idea Bank
                            </button>
                        )}
                        <button
                            className="tool-btn"
                            onClick={() => setShowLinkingPhrases(!showLinkingPhrases)}
                        >
                            🔗 Linking Phrases
                        </button>
                    </div>

                    {/* Idea Bank Panel */}
                    {showIdeaBank && ideaBankData && (
                        <div className="idea-bank-panel">
                            <h4>💡 Ideas for this topic</h4>

                            {ideaBankData.arguments && (
                                <>
                                    <div className="idea-section">
                                        <h5>Arguments For:</h5>
                                        <ul>
                                            {ideaBankData.arguments.for.map((arg, idx) => (
                                                <li key={idx}>{arg}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="idea-section">
                                        <h5>Arguments Against:</h5>
                                        <ul>
                                            {ideaBankData.arguments.against.map((arg, idx) => (
                                                <li key={idx}>{arg}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            )}

                            {ideaBankData.examples && (
                                <div className="idea-section">
                                    <h5>Examples:</h5>
                                    <ul>
                                        {ideaBankData.examples.map((ex, idx) => (
                                            <li key={idx}>{ex}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {ideaBankData.vocabulary && (
                                <div className="idea-section">
                                    <h5>Topic Vocabulary:</h5>
                                    <div className="vocab-tags">
                                        {ideaBankData.vocabulary.map((word, idx) => (
                                            <span key={idx} className="vocab-tag">{word}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Linking Phrases Panel */}
                    {showLinkingPhrases && (
                        <div className="linking-phrases-panel">
                            <h4>🔗 Useful Linking Phrases</h4>
                            {Object.entries(linkingPhrases).map(([category, phrases]) => (
                                <div key={category} className="phrase-category">
                                    <h5>{category.charAt(0).toUpperCase() + category.slice(1)}:</h5>
                                    <div className="phrase-tags">
                                        {phrases.map((phrase, idx) => (
                                            <span key={idx} className="phrase-tag">{phrase}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Column - Outline Builder or Mind Map */}
                <div className="right-panel">
                    {viewMode === 'mindmap' ? (
                        <VisualMindMap
                            outline={outline}
                            onOutlineChange={handleOutlineChange}
                            essayStructure={selectedTemplate?.structure || {}}
                        />
                    ) : (
                        <div className="outline-builder-card">
                            <div className="card-header">
                                <h3>Your Outline</h3>
                                {selectedTemplate && (
                                    <span className="template-badge">{selectedTemplate.name}</span>
                                )}
                            </div>

                            {selectedTemplate && (
                                <>
                                    {/* Section Navigator (Tabs) */}
                                    <div className="section-navigator">
                                        {Object.entries(selectedTemplate.structure).map(([sectionKey, sectionData]) => {
                                            const hasContent = outline[sectionKey] && outline[sectionKey].trim() !== '';
                                            const wordCount = outline[sectionKey] ? outline[sectionKey].trim().split(/\s+/).filter(w => w.length > 0).length : 0;

                                            return (
                                                <button
                                                    key={sectionKey}
                                                    className={`section-tab ${currentSection === sectionKey ? 'active' : ''} ${hasContent ? 'complete' : ''}`}
                                                    onClick={() => setCurrentSection(sectionKey)}
                                                >
                                                    <div className="tab-label">{sectionData.label}</div>
                                                    <div className="tab-status">
                                                        {hasContent ? `${wordCount}w` : ''}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Current Section Editor */}
                                    {currentSection && selectedTemplate.structure[currentSection] && (
                                        <div className="current-section-editor">
                                            <div className="section-header-main">
                                                <h4>{selectedTemplate.structure[currentSection].label}</h4>
                                                {selectedTemplate.structure[currentSection].tips && (
                                                    <div className="tip-badge" title={selectedTemplate.structure[currentSection].tips}>
                                                        💡
                                                    </div>
                                                )}
                                            </div>

                                            {selectedTemplate.structure[currentSection].template && (
                                                <div className="template-hint">
                                                    📋 Template: {selectedTemplate.structure[currentSection].template}
                                                </div>
                                            )}

                                            {selectedTemplate.structure[currentSection].example && (
                                                <div className="example-hint">
                                                    ✨ Example: {selectedTemplate.structure[currentSection].example}
                                                </div>
                                            )}

                                            <textarea
                                                className="outline-input"
                                                placeholder={`Write your ${selectedTemplate.structure[currentSection].label.toLowerCase()}...`}
                                                value={outline[currentSection] || ''}
                                                onChange={(e) => handleOutlineChange(currentSection, e.target.value)}
                                                rows={8}
                                            />

                                            {selectedTemplate.structure[currentSection].keyPhrases && (
                                                <div className="key-phrases">
                                                    <span className="phrases-label">Useful phrases:</span>
                                                    {selectedTemplate.structure[currentSection].keyPhrases.map((phrase, idx) => (
                                                        <span key={idx} className="phrase-chip">{phrase}</span>
                                                    ))}
                                                </div>
                                            )}

                                            {selectedTemplate.structure[currentSection].tips && (
                                                <div className="section-tips">
                                                    💡 {selectedTemplate.structure[currentSection].tips}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* AI Feedback Section */}
                            {feedback && (
                                <div className="ai-feedback-section">
                                    <h4>🤖 AI Coach Feedback</h4>
                                    <div className="feedback-content">
                                        {feedback}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="action-buttons">
                                <button
                                    className="btn-ai-review"
                                    onClick={handleAIReview}
                                    disabled={loading}
                                >
                                    {loading ? '🔄 Analyzing...' : '🤖 Get AI Feedback'}
                                </button>
                                <button
                                    className="btn-next"
                                    onClick={handleNext}
                                >
                                    Continue to Writing →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EnhancedPlanningPhase;
