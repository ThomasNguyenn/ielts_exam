import React, { useState } from 'react';
import { api } from '../../api/client';
import { useNotification } from '../../components/NotificationContext';


const IdeationPhase = ({ question, onNext }) => {
    const [outline, setOutline] = useState({
        mainIdeas: ['', '', ''],
        developmentMethod: 'Explanatory',
        topicSentences: ['', '', '']
    });
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(false);
    const [savedSessionId, setSavedSessionId] = useState(null);

    const { showNotification } = useNotification();

    const handleAIReview = async () => {
        setLoading(true);
        try {
            const res = await api.checkOutline({ questionId: question._id, outline });
            setFeedback(res.feedback);
            if (res.session_id) setSavedSessionId(res.session_id);
            return res.session_id;
        } catch (e) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6 lg:p-10">
            {/* Left Column: Topic & Form */}
            <div className="flex flex-col gap-6">
                {/* Topic Card */}
                <div className="bg-[#FFF9F1] rounded-xl p-6 border border-rose-100">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#d03939] mb-3">Topic</h2>
                    <div className="flex flex-col gap-4">
                        {question.image_url && (
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                <img
                                    src={question.image_url}
                                    alt="Task Graph/Chart"
                                    className="max-w-full max-h-[400px] object-contain mx-auto"
                                />
                            </div>
                        )}
                        <div className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{question.prompt}</div>
                    </div>
                </div>

                {/* Outline Form */}
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-rose-100 text-[#d03939] flex items-center justify-center text-xs">1</span>
                        My Outline
                    </h3>

                    <div className="space-y-5">
                        <div className="group">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {question.task_type === 'task1' || question.task_type === 1
                                    ? 'Structure (Overview)'
                                    : 'Development Method'}
                            </label>
                            {question.task_type === 'task1' || question.task_type === 1 ? (
                                <input
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#d03939] focus:border-[#d03939] transition-all shadow-sm outline-none"
                                    placeholder="E.g., Intro + Overview + Body 1 (Group A) + Body 2 (Group B)"
                                    value={outline.developmentMethod}
                                    onChange={e => setOutline({ ...outline, developmentMethod: e.target.value })}
                                />
                            ) : (
                                <select
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#d03939] focus:border-[#d03939] transition-all shadow-sm outline-none bg-white cursor-pointer hover:border-rose-300"
                                    value={outline.developmentMethod}
                                    onChange={e => setOutline({ ...outline, developmentMethod: e.target.value })}
                                >
                                    <option>Cause & Effect</option>
                                    <option>Problem & Solution</option>
                                    <option>Discussion (Agree/Disagree)</option>
                                    <option>Explanatory</option>
                                </select>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {question.task_type === 'task1' || question.task_type === 1
                                    ? 'Key Features'
                                    : 'Main Ideas (3 key points)'}
                            </label>
                            <div className="space-y-3">
                                {outline.mainIdeas.map((idea, i) => (
                                    <input
                                        key={i}
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#d03939] focus:border-[#d03939] transition-all shadow-sm outline-none"
                                        placeholder={question.task_type === 'task1' || question.task_type === 1 ? `Feature ${i + 1}` : `Idea ${i + 1}`}
                                        value={idea}
                                        onChange={e => {
                                            const newIdeas = [...outline.mainIdeas];
                                            newIdeas[i] = e.target.value;
                                            setOutline({ ...outline, mainIdeas: newIdeas });
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {question.task_type === 'task1' || question.task_type === 1
                                    ? 'Grouping Details'
                                    : 'Topic Sentences'}
                            </label>
                            <div className="space-y-3">
                                {outline.topicSentences.map((sent, i) => (
                                    <input
                                        key={i}
                                        className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#d03939] focus:border-[#d03939] transition-all shadow-sm outline-none"
                                        placeholder={question.task_type === 'task1' || question.task_type === 1 ? `Detail Group ${i + 1}` : `Topic Sentence ${i + 1}`}
                                        value={sent}
                                        onChange={e => {
                                            const newSent = [...outline.topicSentences];
                                            newSent[i] = e.target.value;
                                            setOutline({ ...outline, topicSentences: newSent });
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleAIReview}
                            disabled={loading}
                            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5
                                ${loading
                                    ? 'bg-slate-400 cursor-not-allowed shadow-none'
                                    : 'bg-[#d03939] hover:bg-[#b53232] shadow-rose-200'}`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Analyzing...
                                </span>
                            ) : (
                                'Check with AI'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Column: AI Feedback */}
            <div className="lg:pl-8 lg:border-l border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">2</span>
                    AI Feedback
                </h3>

                {feedback ? (
                    <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-fade-in">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 p-6 flex justify-between items-center">
                            <span className="font-bold text-slate-600">Overall Score</span>
                            <div className={`text-2xl font-black ${feedback.coherence_score >= 80 ? 'text-emerald-500' : (feedback.coherence_score >= 60 ? 'text-amber-500' : 'text-red-500')}`}>
                                {feedback.coherence_score}<span className="text-sm text-slate-400 font-medium">/100</span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            <div>
                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">General Feedback</h4>
                                <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    {feedback.general_feedback}
                                </p>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">Improvements</h4>
                                <ul className="space-y-3">
                                    {feedback.improvements.map((imp, i) => (
                                        <li key={i} className="flex gap-3 text-slate-700">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-50 text-[#d03939] flex items-center justify-center text-xs font-bold mt-0.5">•</span>
                                            <span className="leading-relaxed">{imp}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100">
                            <button
                                onClick={() => onNext({ outline, sessionId: savedSessionId })}
                                className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                                Continue to Scaffolding <span className="text-lg">&rarr;</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-3xl">🤖</div>
                        <h4 className="text-slate-800 font-bold mb-2">Waiting for Input</h4>
                        <p className="text-slate-500 text-sm max-w-xs">Fill out your outline on the left and click "Check with AI" to get instant feedback.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IdeationPhase;
