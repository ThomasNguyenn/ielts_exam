import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { useNotification } from '../../../components/NotificationContext';
import LearnPhase from './Phase1Learn/LearnPhase';
import EnhancedPlanningPhase from './Phase4Plan/EnhancedPlanningPhase';
import EnhancedScaffoldingPhase from './Phase5Build/EnhancedScaffoldingPhase';
import EnhancedWritingPhase from './Phase6Write/EnhancedWritingPhase';
import EnhancedReviewPhase from './Phase7Review/EnhancedReviewPhase';
import '../Practice.css';
import './PracticeFlowContainer.css';

const PracticeFlowContainer = () => {
    const [currentPhase, setCurrentPhase] = useState(1); // 1-7
    const [question, setQuestion] = useState(null);
    const [sessionData, setSessionData] = useState({
        phase1Completed: false, // Learn phase
        outline: null,           // Ideation phase
        materials: null,         // Scaffolding phase
        essay: null,             // Writing phase
        gradingResult: null,     // Result phase
    });
    const [loading, setLoading] = useState(true);

    const { id } = useParams();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    useEffect(() => {
        loadQuestion();
    }, [id]);

    const loadQuestion = async () => {
        setLoading(true);
        try {
            if (id) {
                const res = await api.getWritingById(id);
                if (res.success) {
                    setQuestion(res.data);
                } else {
                    showNotification('Failed to load writing task', 'error');
                    navigate('/practice');
                }
            } else {
                const q = await api.getRandomQuestion();
                setQuestion(q);
            }
        } catch (error) {
            console.error('Error loading question:', error);
            showNotification('Error loading practice question', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePhaseComplete = (phaseNumber, data) => {
        const updates = { ...sessionData };

        switch (phaseNumber) {
            case 1: // Learn Phase
                updates.phase1Completed = true;
                break;
            case 2: // Planning Phase (outline)
                updates.outline = data;
                break;
            case 3: // Scaffolding Phase
                updates.scaffoldedParagraphs = data;
                break;
            case 4: // Writing Phase
                updates.essay = data;
                break;
            default:
                break;
        }

        setSessionData(updates);
        setCurrentPhase(phaseNumber + 1);
    };

    const handleBack = () => {
        if (currentPhase > 1) {
            setCurrentPhase(currentPhase - 1);
        } else {
            navigate('/practice');
        }
    };

    if (loading) {
        return (
            <div className="practice-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div className="loading-spinner"></div>
                <p>Loading practice question...</p>
            </div>
        );
    }

    if (!question) {
        return (
            <div className="practice-container" style={{ textAlign: 'center', padding: '4rem' }}>
                <h2>Question not found</h2>
                <button onClick={() => navigate('/practice')} className="btn">
                    Back to Practice List
                </button>
            </div>
        );
    }

    // Phase configuration
    const phases = [
        { number: 1, name: 'Learn', icon: '📚' },
        { number: 2, name: 'Analyze', icon: '🔍' },
        { number: 3, name: 'Plan', icon: '📝' },
        { number: 4, name: 'Write', icon: '✍️' },
        { number: 5, name: 'Review', icon: '🎯' },
    ];

    return (
        <div className="new-practice-flow">
            {/* Progress Header */}
            <div className="practice-flow-header">
                <div className="practice-flow-progress">
                    <div className="phase-steps">
                        {phases.map((phase, index) => (
                            <div
                                key={phase.number}
                                className={`phase-step ${currentPhase === phase.number ? 'active' : ''} ${currentPhase > phase.number ? 'completed' : ''}`}
                            >
                                <div className="phase-step-icon">{phase.icon}</div>
                                <div className="phase-step-name">{phase.name}</div>
                                {index < phases.length - 1 && (
                                    <div className={`phase-connector ${currentPhase > phase.number ? 'completed' : ''}`}></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Phase Content */}
            <div className="practice-flow-content">
                {currentPhase === 1 && (
                    <LearnPhase
                        onComplete={() => handlePhaseComplete(1, null)}
                        onBack={handleBack}
                    />
                )}

                {currentPhase === 2 && (
                    <EnhancedPlanningPhase
                        question={question}
                        onNext={(outline) => handlePhaseComplete(2, outline)}
                        onBack={handleBack}
                    />
                )}

                {currentPhase === 3 && (
                    <EnhancedScaffoldingPhase
                        question={question}
                        outline={sessionData.outline}
                        onNext={(scaffoldedParagraphs) => handlePhaseComplete(3, scaffoldedParagraphs)}
                        onBack={handleBack}
                    />
                )}

                {currentPhase === 4 && (
                    <EnhancedWritingPhase
                        question={question}
                        outline={sessionData.outline}
                        scaffoldedParagraphs={sessionData.scaffoldedParagraphs}
                        onNext={(essay) => handlePhaseComplete(4, essay)}
                        onBack={handleBack}
                    />
                )}

                {currentPhase === 5 && (
                    <EnhancedReviewPhase
                        question={question}
                        essay={sessionData.essay}
                        sessionData={sessionData}
                        onRestart={() => window.location.reload()}
                    />
                )}
            </div>
        </div>
    );
};

export default PracticeFlowContainer;
