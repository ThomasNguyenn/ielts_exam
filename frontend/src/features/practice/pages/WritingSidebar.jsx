import React from 'react';

const WritingSidebar = ({ result, activeTab, setActiveTab, selectedCriterion, setSelectedCriterion }) => {

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Overall Score */}
            <div
                className={`bg-white rounded-2xl p-6 text-center border transition-all cursor-pointer relative overflow-hidden group
                    ${selectedCriterion === 'all'
                        ? 'border-[#d03939] shadow-lg shadow-rose-100 ring-4 ring-rose-50'
                        : 'border-slate-200 hover:border-rose-200 hover:shadow-md'}`}
                onClick={() => setSelectedCriterion('all')}
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-400 to-red-500"></div>
                <div className="relative z-10">
                    <div className="text-5xl font-black text-slate-800 mb-2 tracking-tighter">
                        {result.band_score}
                        <span className="text-lg text-slate-400 font-medium ml-1">/9.0</span>
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#d03939]">Overall Band Score</div>
                </div>
                {selectedCriterion === 'all' && (
                    <div className="absolute bottom-2 right-2 text-[#d03939] opacity-20">
                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    </div>
                )}
            </div>

            {/* Criteria Grid */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { id: 'task_response', label: 'Task Response', score: result.criteria_scores?.task_response },
                    { id: 'coherence_cohesion', label: 'Coherence', score: result.criteria_scores?.coherence_cohesion },
                    { id: 'lexical_resource', label: 'Lexical', score: result.criteria_scores?.lexical_resource },
                    { id: 'grammatical_range_accuracy', label: 'Grammar', score: result.criteria_scores?.grammatical_range_accuracy },
                ].map((item) => (
                    <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-all cursor-pointer text-center
                            ${selectedCriterion === item.id
                                ? 'bg-rose-50 border-[#d03939] text-[#d03939] shadow-sm'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-slate-50'}`}
                        onClick={() => setSelectedCriterion(item.id)}
                    >
                        <div className={`text-2xl font-black mb-1 ${selectedCriterion === item.id ? 'text-[#d03939]' : 'text-slate-700'}`}>
                            {item.score}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-wide truncate">
                            {item.label}
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                <button
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all
                        ${activeTab === 'feedback'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setActiveTab('feedback')}
                >
                    Review Feedback
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-white rounded-xl border border-slate-200 p-4 shadow-inner">
                {activeTab === 'feedback' && (
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2 top-0 bg-white pb-2 border-b border-slate-50">
                            General Feedback
                        </h4>
                        <ul className="space-y-3">
                            {result.feedback?.map((f, i) => (
                                <li key={i} className="text-sm text-slate-600 leading-relaxed flex gap-3">
                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#d03939] mt-2"></span>
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {activeTab === 'model' && (
                    <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                        {result.corrected_essay}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WritingSidebar;
