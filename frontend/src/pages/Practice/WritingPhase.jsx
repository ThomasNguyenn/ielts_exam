import React, { useState } from 'react';
import { useNotification } from '../../components/NotificationContext';
import { api } from '../../api/client';

const WritingPhase = ({ question, sessionId, outline, materials, onNext }) => {
    const [essay, setEssay] = useState('');
    const [loading, setLoading] = useState(false);
    const { showNotification } = useNotification();

    const handlePreSubmit = () => {
        if (!essay.trim()) return showNotification("Please write something!", "warning");

        // For Practice Mode, force AI Scoring automatically for ALL tasks
        // (Real Test logic only applies in Exam.jsx)
        handleSubmit('ai');
    };

    const handleSubmit = async (mode) => {
        setLoading(true);
        // setShowGradingChoice(false); // No longer needed
        try {
            const res = await api.submitPracticeWriting({
                sessionId,
                fullEssay: essay,
                gradingMode: mode
            });
            onNext(res);
        } catch (e) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-10 h-[calc(100vh-140px)]">
            {/* Left Sidebar: Reference Materials (Sticky) */}
            <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar h-full">
                {/* Topic Reference */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Topic</h4>
                    <div className="space-y-3">
                        {question.image_url && (
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <img
                                    src={question.image_url}
                                    alt="Task Graph/Chart"
                                    className="max-w-full max-h-[200px] object-contain mx-auto"
                                    onClick={() => window.open(question.image_url, '_blank')}
                                    style={{ cursor: 'zoom-in' }}
                                />
                            </div>
                        )}
                        <div className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-wrap">{question.prompt}</div>
                    </div>
                </div>

                {/* Outline Reference */}
                <div className="bg-[#FFF9F1] p-5 rounded-xl border border-rose-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#d03939] mb-3">
                        {question.task_type === 'task1' || question.task_type === 1 ? 'Key Features' : 'My Outline'}
                    </h4>
                    <ul className="space-y-2">
                        {outline?.mainIdeas?.map((idea, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-700">
                                <span className="text-[#d03939]">•</span>
                                {idea}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Vocab Reference */}
                {materials?.vocab?.length > 0 && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Suggested Vocab</h4>
                        <div className="flex flex-wrap gap-2">
                            {materials.vocab.map((v, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-1 bg-rose-50 border border-rose-100 text-[#d03939] text-xs font-bold rounded shadow-sm cursor-help"
                                    title={v.meaning}
                                >
                                    {v.word}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content: Editor */}
            <div className="lg:col-span-8 flex flex-col h-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative">
                {/* Editor Toolbar/Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        <span className="ml-2 text-sm font-bold text-slate-400 uppercase tracking-wider">Writer Mode</span>
                    </div>
                    <div className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                        Word Count: <span className="text-slate-800 font-bold">{essay.trim().split(/\s+/).filter(w => w).length}</span>
                    </div>
                </div>

                <textarea
                    className="flex-1 w-full p-8 text-lg text-slate-800 leading-8 resize-none outline-none font-serif placeholder:text-slate-300 focus:bg-[#fff9f9] transition-colors"
                    placeholder="Start writing your essay here..."
                    value={essay}
                    onChange={(e) => setEssay(e.target.value)}
                    spellCheck="false"
                />

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end items-center gap-4">
                    <span className="text-xs text-slate-400">
                        {essay.trim().length === 0 ? 'Start typing to see word count' : 'Keep writing...'}
                    </span>
                    <button
                        onClick={handlePreSubmit}
                        disabled={loading}
                        className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5
                            ${loading
                                ? 'bg-slate-400 cursor-not-allowed shadow-none'
                                : 'bg-[#d03939] hover:bg-[#b53232] shadow-rose-200'}`}
                    >
                        {loading ? 'Processing...' : 'Submit Essay'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WritingPhase;
