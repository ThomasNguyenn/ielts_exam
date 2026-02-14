import React, { useState, useEffect, useRef } from 'react';
import { useNotification } from '../../../../components/NotificationContext';
import './EnhancedWritingPhase.css';

const EnhancedWritingPhase = ({ question, outline, scaffoldedParagraphs, onNext, onBack }) => {
    const [essay, setEssay] = useState('');
    const [wordCount, setWordCount] = useState(0);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [showAssistant, setShowAssistant] = useState(true);
    const [showOutline, setShowOutline] = useState(true);
    const [autoSaveStatus, setAutoSaveStatus] = useState('saved');
    const [selectedWord, setSelectedWord] = useState(null);
    const [synonyms, setSynonyms] = useState([]);
    const [coherenceScore, setCoherenceScore] = useState(0);

    const { showNotification } = useNotification();
    const editorRef = useRef(null);
    const timerRef = useRef(null);
    const isTask1 = question.task_type === 'task1' || question.task_type === 1;
    const targetWords = isTask1 ? 150 : 250;
    const recommendedTime = isTask1 ? 20 : 40; // minutes

    useEffect(() => {
        // Initialize with scaffolded paragraphs if available
        if (scaffoldedParagraphs) {
            const combined = Object.values(scaffoldedParagraphs.paragraphs || {})
                .filter(p => p && p.trim())
                .join('\n\n');
            setEssay(combined);
        }

        // Start timer
        timerRef.current = setInterval(() => {
            setTimeElapsed(prev => prev + 1);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    useEffect(() => {
        // Update word count
        const words = essay.trim().split(/\s+/).filter(w => w.length > 0);
        setWordCount(words.length);

        // Auto-save
        setAutoSaveStatus('saving');
        const saveTimeout = setTimeout(() => {
            // Save to localStorage
            localStorage.setItem(`essay_draft_${question._id}`, essay);
            setAutoSaveStatus('saved');
        }, 1000);

        // Calculate basic coherence score (simplified)
        const coherence = calculateCoherence(essay);
        setCoherenceScore(coherence);

        return () => clearTimeout(saveTimeout);
    }, [essay]);

    const calculateCoherence = (text) => {
        // Simplified coherence calculation based on linking words
        const linkingWords = [
            'however', 'furthermore', 'moreover', 'therefore', 'consequently',
            'nevertheless', 'additionally', 'for instance', 'for example',
            'in conclusion', 'to summarize', 'firstly', 'secondly', 'finally'
        ];

        const lowerText = text.toLowerCase();
        const linkingCount = linkingWords.filter(word => lowerText.includes(word)).length;
        const paragraphs = text.split('\n\n').filter(p => p.trim()).length;

        // Basic scoring: linking words per paragraph
        const score = Math.min(100, Math.round((linkingCount / Math.max(paragraphs, 1)) * 25));
        return score;
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleWordClick = (word) => {
        // In a real implementation, this would call a thesaurus API
        setSelectedWord(word);
        const mockSynonyms = getMockSynonyms(word);
        setSynonyms(mockSynonyms);
    };

    const getMockSynonyms = (word) => {
        // Mock synonym suggestions
        const synonymMap = {
            'important': ['crucial', 'significant', 'vital', 'essential'],
            'good': ['beneficial', 'advantageous', 'positive', 'favorable'],
            'bad': ['detrimental', 'harmful', 'adverse', 'negative'],
            'many': ['numerous', 'countless', 'abundant', 'substantial'],
            'people': ['individuals', 'citizens', 'populace', 'society'],
            'think': ['believe', 'consider', 'argue', 'contend'],
            'show': ['demonstrate', 'illustrate', 'reveal', 'indicate']
        };
        return synonymMap[word.toLowerCase()] || [];
    };

    const replaceSynonym = (synonym) => {
        if (!selectedWord) return;
        setEssay(prev => prev.replace(selectedWord, synonym));
        setSelectedWord(null);
        setSynonyms([]);
    };

    const getProgressColor = () => {
        const percentage = (wordCount / targetWords) * 100;
        if (percentage < 60) return '#ef4444';
        if (percentage < 80) return '#f59e0b';
        if (percentage < 100) return '#10b981';
        return '#6366f1';
    };

    const handleSubmit = () => {
        if (wordCount < targetWords * 0.6) {
            showNotification(`Please write at least ${Math.round(targetWords * 0.6)} words before submitting`, 'warning');
            return;
        }
        onNext({ essay, wordCount, timeElapsed });
    };

    const timeWarning = timeElapsed / 60 > recommendedTime * 0.8;

    return (
        <div className="enhanced-writing-phase">
            {/* Header */}
            <div className="writing-header">
                <button onClick={onBack} className="btn-back">
                    ← Back
                </button>
                <div className="header-stats">
                    <div className="stat-item">
                        <span className="stat-label">Words:</span>
                        <span className="stat-value" style={{ color: getProgressColor() }}>
                            {wordCount} / {targetWords}
                        </span>
                    </div>
                    <div className={`stat-item ${timeWarning ? 'warning' : ''}`}>
                        <span className="stat-label">Time:</span>
                        <span className="stat-value">{formatTime(timeElapsed)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">Coherence:</span>
                        <span className="stat-value">{coherenceScore}%</span>
                    </div>
                    <div className="auto-save-indicator">
                        {autoSaveStatus === 'saving' ? '💾 Saving...' : '✅ Saved'}
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="btn-toggle-assistant"
                        onClick={() => setShowAssistant(!showAssistant)}
                    >
                        {showAssistant ? '❌ Hide Assistant' : '💡 Show Assistant'}
                    </button>
                </div>
            </div>

            <div className={`writing-container ${!showAssistant ? 'full-width' : ''}`}>
                {/* Main Editor */}
                <div className="editor-panel">
                    <div className="editor-toolbar">
                        <h2>✍️ Write Your Essay</h2>
                        <div className="word-progress-bar">
                            <div
                                className="word-progress-fill"
                                style={{
                                    width: `${Math.min((wordCount / targetWords) * 100, 100)}%`,
                                    background: getProgressColor()
                                }}
                            />
                        </div>
                    </div>

                    <textarea
                        ref={editorRef}
                        className="essay-editor"
                        placeholder={`Start writing your ${isTask1 ? 'Task 1 report' : 'Task 2 essay'}...\n\nTip: Use your outline and scaffolded paragraphs as a guide.`}
                        value={essay}
                        onChange={(e) => setEssay(e.target.value)}
                        spellCheck={true}
                    />

                    <div className="editor-footer">
                        <div className="writing-tips">
                            💡 <strong>Quick Tips:</strong> Vary sentence length • Use academic vocabulary • Check coherence • Proofread
                        </div>
                        <button className="btn-submit-essay" onClick={handleSubmit}>
                            Submit for Review →
                        </button>
                    </div>
                </div>

                {/* Assistant Sidebar */}
                {showAssistant && (
                    <div className="assistant-sidebar">
                        {/* Question Reference */}
                        <div className="assistant-card">
                            <h3>📋 Question</h3>
                            {question.image_url && (
                                <img src={question.image_url} alt="Task" className="question-thumb" />
                            )}
                            <p className="question-text-small">{question.prompt}</p>
                        </div>

                        {/* Outline Reference */}
                        {outline && (
                            <div className="assistant-card collapsible">
                                <div
                                    className="card-header-toggle"
                                    onClick={() => setShowOutline(!showOutline)}
                                >
                                    <h3>📝 Your Outline</h3>
                                    <span>{showOutline ? '▼' : '▶'}</span>
                                </div>
                                {showOutline && (
                                    <div className="outline-ref">
                                        {Object.entries(outline.outline || outline).map(([key, value]) => (
                                            value && (
                                                <div key={key} className="outline-point">
                                                    <strong>{key}:</strong> {value}
                                                </div>
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Vocabulary Helper */}
                        <div className="assistant-card">
                            <h3>📚 Vocabulary Helper</h3>
                            <p className="helper-instruction">Click any word in your essay for synonyms</p>
                            {selectedWord && (
                                <div className="synonym-suggestions">
                                    <div className="selected-word">"{selectedWord}"</div>
                                    {synonyms.length > 0 ? (
                                        <div className="synonym-list">
                                            {synonyms.map((syn, idx) => (
                                                <button
                                                    key={idx}
                                                    className="synonym-chip"
                                                    onClick={() => replaceSynonym(syn)}
                                                >
                                                    {syn}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="no-synonyms">No suggestions available</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Coherence Meter */}
                        <div className="assistant-card">
                            <h3>🔗 Coherence Meter</h3>
                            <div className="coherence-meter">
                                <div
                                    className="coherence-bar"
                                    style={{ width: `${coherenceScore}%` }}
                                />
                            </div>
                            <div className="coherence-feedback">
                                {coherenceScore < 40 && '💡 Add more linking words'}
                                {coherenceScore >= 40 && coherenceScore < 70 && '👍 Good use of connectors'}
                                {coherenceScore >= 70 && '🌟 Excellent coherence!'}
                            </div>
                        </div>

                        {/* Linking Phrases Quick Reference */}
                        <div className="assistant-card">
                            <h3>🔗 Useful Linking Phrases</h3>
                            <div className="phrase-categories">
                                <div className="phrase-group">
                                    <h4>Adding:</h4>
                                    <span>Furthermore, Moreover, Additionally</span>
                                </div>
                                <div className="phrase-group">
                                    <h4>Contrasting:</h4>
                                    <span>However, Nevertheless, In contrast</span>
                                </div>
                                <div className="phrase-group">
                                    <h4>Cause/Effect:</h4>
                                    <span>Therefore, Consequently, As a result</span>
                                </div>
                                <div className="phrase-group">
                                    <h4>Examples:</h4>
                                    <span>For instance, For example, Such as</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnhancedWritingPhase;
