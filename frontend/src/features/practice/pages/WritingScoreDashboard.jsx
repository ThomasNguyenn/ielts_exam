import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Assuming router usage
import WritingSidebar from './WritingSidebar';
import HighlightedEssay from './HighlightedEssay';
import './Practice.css'; // Ensure we reuse or add styles here

const WritingScoreDashboard = ({ result, onRestart }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('feedback');
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [selectedCriterion, setSelectedCriterion] = useState('all'); // 'all', 'task_response', etc.


    return (
        <div className="h-[calc(100vh-140px)] flex flex-col p-6 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-1">Writing Analysis</h2>
                    <p className="text-sm text-slate-500 font-medium">Detailed feedback and scoring breakdown</p>
                </div>
                <div className="flex gap-3">
                    <button
                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
                        onClick={() => navigate('/tests')}
                    >
                        Return to Tests
                    </button>
                    <button
                        className="px-5 py-2.5 bg-[#d03939] text-white rounded-xl font-bold hover:bg-[#b53232] transition-colors shadow-lg shadow-rose-200"
                        onClick={onRestart}
                    >
                        New Practice
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0 ">
                {/* Left: Essay & Annotations */}
                <div className="lg:col-span-8 flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar pb-20">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidde mb-6">
                        <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <span className="w-2 h-6 bg-[#d03939] rounded-full"></span>
                                Your Essay
                            </h3>
                            <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-slate-500 border border-slate-200 shadow-sm">
                                {result.fullEssay ? result.fullEssay.split(/\s+/).length : 0} words
                            </span>
                        </div>

                        <div className="p-8 font-serif text-lg leading-loose text-slate-800">
                            <HighlightedEssay
                                essay={result.fullEssay || ""}
                                analysis={result.detailed_analysis || result}
                                selectedCriterion={selectedCriterion}
                                onHighlightClick={setSelectedFeedback}
                            />
                        </div>
                    </div>

                    {/* Feedback Detail Box (Floating or below) */}
                    {selectedFeedback && (
                        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 lg:translate-x-0 lg:left-auto lg:right-6 lg:bottom-6 z-50 w-[90%] lg:w-[400px] animate-fade-in-up">
                            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 ring-1 ring-black/5">
                                <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                    <span className={`px-2 py-1 rounded text-xs font-black uppercase tracking-wider
                                        ${selectedFeedback.type === 'error' ? 'bg-red-100 text-red-600' :
                                            selectedFeedback.type === 'good' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {selectedFeedback.type ? selectedFeedback.type.toUpperCase() : 'FEEDBACK'}
                                    </span>
                                    <button
                                        className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 flex items-center justify-center font-bold"
                                        onClick={() => setSelectedFeedback(null)}
                                    >×</button>
                                </div>
                                <div className="p-5 space-y-4">
                                    <p className="text-slate-700 font-medium">{selectedFeedback.explanation || selectedFeedback.comment}</p>

                                    {(selectedFeedback.improved || selectedFeedback.correction) && (
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <strong className="block text-xs uppercase text-slate-400 font-bold mb-1">Suggestion</strong>
                                            <span className="text-[#d03939] font-semibold">{selectedFeedback.improved || selectedFeedback.correction}</span>
                                        </div>
                                    )}

                                    {selectedFeedback.band6_replacement && (
                                        <div className="flex flex-col gap-1 text-sm">
                                            <strong className="text-emerald-600">Band 6.0:</strong>
                                            <span className="text-slate-600">{selectedFeedback.band6_replacement}</span>
                                        </div>
                                    )}
                                    {selectedFeedback.band65_replacement && (
                                        <div className="flex flex-col gap-1 text-sm">
                                            <strong className="text-emerald-700">Band 6.5:</strong>
                                            <span className="text-slate-600">{selectedFeedback.band65_replacement}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Model Essay Card */}
                    {result.sample_essay && (
                        <div className="bg-emerald-50/30 rounded-2xl shadow-sm border border-emerald-100 ">
                            <div className="bg-emerald-50/50 px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
                                <h3 className="font-bold text-emerald-800 flex items-center gap-2">
                                    <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                                    Band 8.0 Model Essay
                                </h3>
                                <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-emerald-600 border border-emerald-200 shadow-sm">
                                    {result.sample_essay.split(/\s+/).length} words
                                </span>
                            </div>
                            <div className="p-8 font-serif text-lg leading-loose text-slate-800 space-y-4">
                                {result.sample_essay.split('\n').map((para, idx) => (
                                    <p key={idx}>{para}</p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Sidebar */}
                <div className="lg:col-span-4 h-full overflow-hidden">
                    <WritingSidebar
                        result={result}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        selectedCriterion={selectedCriterion}
                        setSelectedCriterion={setSelectedCriterion}
                    />
                </div>
            </div>
        </div>
    );
};

export default WritingScoreDashboard;
