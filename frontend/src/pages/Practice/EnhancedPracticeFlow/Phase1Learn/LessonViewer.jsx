import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './LessonViewer.css';

const LessonViewer = ({ module, onClose, onStartQuiz, isCompleted }) => {
    const [activeTab, setActiveTab] = useState('lesson');

    return (
        <div className="lesson-viewer">
            <div className="lesson-header">
                <button onClick={onClose} className="close-button">
                    ← Back to Modules
                </button>
                <div className="lesson-title-section">
                    <div className="lesson-icon">{module.icon}</div>
                    <div>
                        <h1 className="lesson-title">{module.title}</h1>
                        <p className="lesson-meta">
                            <span>⏱️ {module.estimatedMinutes} minutes</span>
                            {isCompleted && <span className="completed-tag">✓ Completed</span>}
                        </p>
                    </div>
                </div>
            </div>

            <div className="lesson-tabs">
                <button
                    className={`tab ${activeTab === 'lesson' ? 'active' : ''}`}
                    onClick={() => setActiveTab('lesson')}
                >
                    📖 Lesson
                </button>
                {module.content?.examples && module.content.examples.length > 0 && (
                    <button
                        className={`tab ${activeTab === 'examples' ? 'active' : ''}`}
                        onClick={() => setActiveTab('examples')}
                    >
                        📝 Examples
                    </button>
                )}
                {module.content?.keyPoints && module.content.keyPoints.length > 0 && (
                    <button
                        className={`tab ${activeTab === 'keypoints' ? 'active' : ''}`}
                        onClick={() => setActiveTab('keypoints')}
                    >
                        💡 Key Points
                    </button>
                )}
            </div>

            <div className="lesson-content">
                {activeTab === 'lesson' && (
                    <div className="lesson-text">
                        <ReactMarkdown>{module.content.lesson}</ReactMarkdown>
                    </div>
                )}

                {activeTab === 'examples' && (
                    <div className="examples-section">
                        <h2>Examples</h2>
                        {module.content.examples.map((example, index) => (
                            <div key={index} className="example-card">
                                <div className="example-number">Example {index + 1}</div>
                                <p>{example}</p>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'keypoints' && (
                    <div className="keypoints-section">
                        <h2>Key Takeaways</h2>
                        <ul className="keypoints-list">
                            {module.content.keyPoints.map((point, index) => (
                                <li key={index} className="keypoint-item">
                                    <span className="keypoint-icon">✓</span>
                                    {point}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="lesson-footer">
                {module.content?.checkpointQuiz && module.content.checkpointQuiz.length > 0 && (
                    <div className="quiz-prompt">
                        <div className="quiz-info">
                            <p className="quiz-text">
                                📝 Test your understanding with a quick quiz ({module.content.checkpointQuiz.length} questions)
                            </p>
                            <p className="quiz-note">You need 70% to pass</p>
                        </div>
                        <button onClick={onStartQuiz} className="btn-start-quiz">
                            {isCompleted ? 'Retake Quiz' : 'Take Quiz'} →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LessonViewer;
