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
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
            <div className="max-w-5xl mx-auto">
                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-extrabold text-[#d03939] mb-2">
                        IELTS Writing Practice
                    </h1>
                    <p className="text-slate-500">Master your writing skills with our step-by-step guided practice.</p>
                </div>

                {/* Stepper */}
                <div className="mb-12">
                    <div className="flex items-center justify-between max-w-3xl mx-auto relative cursor-default">
                        {/* Connecting Line Background */}
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 -translate-y-1/2 rounded-full"></div>

                        {/* Active Line Progress - dynamic width based on step */}
                        <div
                            className="absolute top-1/2 left-0 h-1 bg-[#d03939] -z-10 -translate-y-1/2 rounded-full transition-all duration-500 ease-in-out"
                            style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                        ></div>

                        {steps.map((s) => {
                            const isActive = step >= s.id;
                            const isCurrent = step === s.id;
                            return (
                                <div key={s.id} className="flex flex-col items-center relative group">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2 z-10
                                        ${isActive
                                                ? 'bg-[#d03939] border-[#d03939] text-white shadow-lg shadow-rose-200 scale-110'
                                                : 'bg-white border-slate-300 text-slate-400'
                                            }`}
                                    >
                                        {isActive ? (
                                            isCurrent ? s.id : <span className="text-lg">✓</span>
                                        ) : (
                                            s.id
                                        )}
                                    </div>
                                    <span
                                        className={`absolute top-12 text-xs font-bold uppercase tracking-wider transition-colors duration-300
                                        ${isActive ? 'text-[#d03939]' : 'text-slate-400'}`}
                                    >
                                        {s.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 min-h-[600px]">
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
                            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-4xl animate-bounce">
                                    ✅
                                </div>
                                <h2 className="text-3xl font-bold text-slate-800 mb-4">Essay Submitted!</h2>
                                <p className="text-slate-600 mb-8 text-lg max-w-md">Your essay has been saved successfully. Continue practicing to improve your score.</p>
                                <button
                                    className="px-8 py-3 bg-[#d03939] text-white rounded-xl font-bold hover:bg-[#b53232] transition-colors shadow-lg shadow-rose-200"
                                    onClick={() => window.location.reload()}
                                >
                                    Start New Session
                                </button>
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
        </div>
    );
};

export default PracticeFlow;
