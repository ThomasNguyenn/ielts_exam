import React from 'react';
import './SkillModuleCard.css';

const SkillModuleCard = ({ module, index, isUnlocked, isCompleted, onClick }) => {
    return (
        <div
            className={`skill-module-card ${!isUnlocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}`}
            onClick={isUnlocked ? onClick : undefined}
        >
            <div className="module-header">
                <div className="module-number">
                    {isCompleted ? (
                        <span className="check-icon">✓</span>
                    ) : !isUnlocked ? (
                        <span className="lock-icon">🔒</span>
                    ) : (
                        <span>{module.moduleNumber}</span>
                    )}
                </div>
                <div className="module-icon">{module.icon}</div>
            </div>

            <div className="module-body">
                <h3 className="module-title">{module.title}</h3>
                <p className="module-description">{module.description}</p>

                <div className="module-meta">
                    <span className="meta-item">
                        <span className="meta-icon">⏱️</span>
                        {module.estimatedMinutes} min
                    </span>
                    {module.content?.checkpointQuiz?.length > 0 && (
                        <span className="meta-item">
                            <span className="meta-icon">📝</span>
                            {module.content.checkpointQuiz.length} questions
                        </span>
                    )}
                </div>
            </div>

            <div className="module-footer">
                {isCompleted ? (
                    <div className="status-badge completed-badge">
                        <span>✓</span> Completed
                    </div>
                ) : !isUnlocked ? (
                    <div className="status-badge locked-badge">
                        <span>🔒</span> Locked
                    </div>
                ) : (
                    <div className="status-badge start-badge">
                        Start Learning →
                    </div>
                )}
            </div>
        </div>
    );
};

export default SkillModuleCard;
