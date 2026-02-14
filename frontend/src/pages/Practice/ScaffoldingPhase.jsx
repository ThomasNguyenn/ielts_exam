import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';

const ScaffoldingPhase = ({ question, onNext }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [translations, setTranslations] = useState({}); // { index: user_input }
    const [checked, setChecked] = useState({}); // { index: boolean }

    useEffect(() => {
        const fetchMaterials = async () => {
            try {
                const res = await api.getMaterials(question._id);
                setData(res);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchMaterials();
    }, [question]);

    if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Generating Learning Materials...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-10 h-[calc(100vh-140px)]">
            {/* Left Sidebar: Learning Materials */}
            <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">

                {/* Vocabulary Section */}
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 sticky top-0 bg-white z-10 py-2">
                        <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs">A</span>
                        Vocabulary (Band 7+)
                    </h3>
                    <div className="space-y-4">
                        {data?.vocab?.map((v, i) => (
                            <div key={i} className="group bg-white rounded-xl p-4 border border-rose-100 shadow-sm hover:shadow-md transition-all hover:border-rose-200">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-extrabold text-rose-600 text-lg group-hover:text-rose-700 transition-colors">{v.word}</span>
                                    <span className="text-xs font-bold px-2 py-1 bg-rose-50 text-rose-600 rounded-md">Vocab</span>
                                </div>
                                <p className="text-slate-600 text-sm mb-3 font-medium">{v.meaning}</p>
                                <div className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100">
                                    <span className="font-semibold text-slate-400 not-italic mr-1">Collocation:</span>
                                    {v.collocation}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Structures Section */}
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 sticky top-0 bg-white z-10 py-2 mt-4">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">B</span>
                        Structures
                    </h3>
                    <div className="space-y-4">
                        {data?.structures?.map((s, i) => (
                            <div key={i} className="group bg-white rounded-xl p-4 border border-emerald-100 shadow-sm hover:shadow-md transition-all hover:border-emerald-200">
                                <div className="font-mono text-sm font-bold text-emerald-600 mb-2 bg-emerald-50 inline-block px-2 py-1 rounded">
                                    {s.structure}
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    <span className="font-bold text-emerald-700 block mb-1 text-xs uppercase tracking-wide">Example:</span>
                                    {s.example}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content: Translation Drill */}
            <div className="lg:col-span-8 flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center shadow-sm z-10">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-2xl">📝</span> Translation Drill
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">Translate these sentences using the vocabulary provided on the left.</p>
                    </div>
                    {question.image_url && (
                        <button
                            className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                            onClick={() => window.open(question.image_url, '_blank')}
                        >
                            View Task Image ↗
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Prompt Display */}
                    <div className="bg-[#FFF9F1] p-4 rounded-xl border border-rose-100 text-slate-700 text-sm mb-6">
                        <span className="font-bold text-[#d03939] block mb-1 text-xs uppercase tracking-wider">Topic Prompt</span>
                        {question.prompt}
                    </div>

                    {data?.translations?.map((t, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                            <div className="p-5 border-b border-slate-50 bg-slate-50/30">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Sentence {i + 1}</span>
                                <p className="text-lg font-medium text-slate-800">{t.vietnamese}</p>
                            </div>

                            <div className="p-5 bg-white space-y-4">
                                <textarea
                                    className="w-full p-4 rounded-lg bg-slate-50 border-2 border-slate-100 focus:border-[#d03939] focus:bg-white focus:ring-0 transition-all outline-none resize-none font-medium text-slate-700"
                                    rows="3"
                                    placeholder="Type your English translation here..."
                                    onChange={(e) => setTranslations({ ...translations, [i]: e.target.value })}
                                />

                                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${checked[i] ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100 flex gap-3">
                                        <div className="flex-shrink-0 mt-1">
                                            <div className="w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 text-xs font-bold">✓</div>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">Reference Answer</span>
                                            <p className="text-emerald-900 font-medium">{t.english_ref}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
                    <button
                        onClick={() => {
                            const allChecked = {};
                            data?.translations?.forEach((_, i) => allChecked[i] = true);
                            setChecked(allChecked);
                        }}
                        className="px-5 py-2.5 text-slate-600 font-bold hover:text-[#d03939] hover:bg-rose-50 rounded-lg transition-colors text-sm"
                    >
                        Reveal All Answers
                    </button>
                    <button
                        onClick={() => onNext(data)}
                        className="flex items-center gap-2 px-8 py-3 bg-[#d03939] text-white rounded-xl font-bold hover:bg-[#b53232] transition-all shadow-lg shadow-rose-200 transform hover:-translate-y-0.5"
                    >
                        Start Writing <span className="text-xl">&rarr;</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScaffoldingPhase;
