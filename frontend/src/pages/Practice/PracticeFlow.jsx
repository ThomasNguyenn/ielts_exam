import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import IdeationPhase from './IdeationPhase';
import ScaffoldingPhase from './ScaffoldingPhase';
import WritingPhase from './WritingPhase';
import ResultPhase from './ResultPhase';
import WritingScoreDashboard from './WritingScoreDashboard';
import './Practice.css';

const PracticeFlow = () => {
    const [step, setStep] = useState(1);
    const [question, setQuestion] = useState(null);
    const [sessionId, setSessionId] = useState(null);

    // State shared across phases
    const [outline, setOutline] = useState(null);
    const [materials, setMaterials] = useState(null);
    const [gradingResult, setGradingResult] = useState(null);

    const { id } = useParams(); // Get ID from URL

    useEffect(() => {
        if (id) {
            fetchWritingById(id);
        } else {
            fetchRandomQuestion();
        }
    }, [id]);

    const fetchWritingById = async (writingId) => {
        try {
            const res = await api.getWritingById(writingId);
            if (res.success) {
                setQuestion(res.data);
            } else {
                console.error("Failed to fetch writing task");
            }
        } catch (error) {
            console.error("Error fetching writing task", error);
        }
    };

    const fetchRandomQuestion = async () => {
        try {
            const q = await api.getRandomQuestion();
            setQuestion(q);
        } catch (error) {
            console.error("Failed to fetch question", error);
        }
    };

    if (!question) return <div className="practice-container">Loading Question...</div>;

    const steps = [
        { id: 1, label: "Ideation" },
        { id: 2, label: "Scaffolding" },
        { id: 3, label: "Writing" },
        { id: 4, label: "Result" }
    ];

    return (
        <div className="practice-container">
            <div className="practice-header">
                <h1 className="practice-title">IELTS Writing Practice</h1>
                <div className="practice-stepper">
                    {steps.map((s) => (
                        <div key={s.id} className={`step-item ${step >= s.id ? 'active' : ''}`}>
                            <div className="step-number">{s.id}</div>
                            <span className="step-label">{s.label}</span>
                            {s.id < 4 && <div className="step-line"></div>}
                        </div>
                    ))}
                </div>
            </div>

            <div className="practice-content">
                {step === 1 && (
                    <IdeationPhase
                        question={question}
                        onNext={(data) => {
                            setOutline(data.outline);
                            setSessionId(data.sessionId);
                            setStep(2);
                        }}
                    />
                )}

                {step === 2 && (
                    <ScaffoldingPhase
                        question={question}
                        onNext={(data) => {
                            setMaterials(data);
                            setStep(3);
                        }}
                    />
                )}

                {step === 3 && (
                    <WritingPhase
                        question={question}
                        sessionId={sessionId}
                        outline={outline}
                        materials={materials}
                        onNext={(result) => {
                            setGradingResult(result);
                            setStep(4);
                        }}
                    />
                )}

                {step === 4 && (
                    gradingResult && gradingResult.gradingMode === 'standard' ? (
                        <div className="standard-success-container">
                            <div className="success-message">
                                <h2><span role="img" aria-label="check">✅</span> Essay Submitted!</h2>
                                <p>Your essay has been saved. Keep practicing!</p>
                                <button className="btn-primary" onClick={() => window.location.reload()}>Start New Session</button>
                            </div>
                        </div>
                    ) : (
                        gradingResult && gradingResult.band_score ? (
                            <WritingScoreDashboard
                                result={{ ...gradingResult, fullEssay: gradingResult.fullEssay || outline?.fullEssay }}
                                onRestart={() => window.location.reload()}
                            />
                        ) : (
                            <ResultPhase
                                result={gradingResult}
                                onRestart={() => window.location.reload()}
                            />
                        )
                    )
                )}
            </div>
        </div>
    );
};

export default PracticeFlow;
