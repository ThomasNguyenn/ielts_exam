import React from 'react';
import { Clock, FileQuestion, Check, Lock, ChevronRight } from 'lucide-react';
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
                        <span className="check-icon"><Check size={16} strokeWidth={3} /></span>
                    ) : !isUnlocked ? (
                        <span className="lock-icon"><Lock size={16} /></span>
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
                        <span className="meta-icon"><Clock size={14} /></span>
                        {module.estimatedMinutes} min
                    </span>
                    {module.content?.checkpointQuiz?.length > 0 && (
                        <span className="meta-item">
                            <span className="meta-icon"><FileQuestion size={14} /></span>
                            {module.content.checkpointQuiz.length} questions
                        </span>
                    )}
                </div>
            </div>

            <div className="module-footer">
                {isCompleted ? (
                    <div className="status-badge completed-badge">
                        <Check size={14} style={{ marginRight: '4px' }} /> Completed
                    </div>
                ) : !isUnlocked ? (
                    <div className="status-badge locked-badge">
                        <Lock size={14} style={{ marginRight: '4px' }} /> Locked
                    </div>
                ) : (
                    <div className="status-badge start-badge">
                        Start Learning <ChevronRight size={14} style={{ marginLeft: '4px' }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SkillModuleCard;
