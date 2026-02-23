import React, { useState, useEffect } from 'react';

const ANALYSIS_STEPS = [
    "Äang phÃ¢n tÃ­ch má»Ÿ bÃ i...",
    "Äang phÃ¢n tÃ­ch thÃ¢n bÃ i...",
    "Äang phÃ¢n tÃ­ch káº¿t luáº­n...",
    "Äang phÃ¢n tÃ­ch tá»« vá»±ng...",
    "Äang kiá»ƒm tra ngá»¯ phÃ¡p...",
    "Äang phÃ¢n tÃ­ch phong cÃ¡ch viáº¿t..."
];

const WritingAnalysisLoading = ({ isFinished, onAnimationComplete, elapsedLabel = '00:00' }) => {
    const [progress, setProgress] = useState(0);
    const [activeStepIndex, setActiveStepIndex] = useState(0);

    // Progress Bar Simulation
    useEffect(() => {
        let interval;
        if (isFinished) {
            // If finished, speed up to 100
            interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        setTimeout(onAnimationComplete, 500); // Small delay before unmounting
                        return 100;
                    }
                    return prev + 5; // Fast increment
                });
            }, 50);
        } else {
            // Slow simulation up to 90%
            interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) return 90; // Stall at 90
                    // Slow down as we get closer to 90
                    const increment = Math.max(0.2, (90 - prev) / 100);
                    return prev + increment;
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isFinished, onAnimationComplete]);

    // Step Cycling
    useEffect(() => {
        if (isFinished) {
            setActiveStepIndex(ANALYSIS_STEPS.length); // All done
            return;
        }

        // Cycle through steps based on approximate progress chunks (just for visual effect)
        // Or simpler: change every X seconds
        const stepInterval = setInterval(() => {
            setActiveStepIndex(prev => {
                if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
                return prev;
            });
        }, 3000); // Change step every 3 seconds

        return () => clearInterval(stepInterval);
    }, [isFinished]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-slate-100 flex flex-col items-center relative overflow-hidden animate-fade-in-up">

                {/* Decorative Background Blob */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-400 to-[#6366F1]"></div>

                {/* Main Spinner/Icon */}
                <div className="mb-6 relative">
                    <div className="w-16 h-16 border-4 border-slate-100 border-t-[#6366F1] rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-[#6366F1] rounded-full"></div>
                    </div>
                </div>

                {/* Text Content */}
                <h2 className="text-2xl font-black text-slate-800 mb-2">Äang phÃ¢n tÃ­ch bÃ i viáº¿t</h2>
                <p className="text-slate-500 font-medium mb-3">Vui lòng chờ trong giây lát...</p>
                <p className="text-slate-600 font-semibold mb-8">Thời gian chờ: {elapsedLabel}</p>

                {/* Steps List */}
                <div className="w-full space-y-3 mb-8 pl-4">
                    {ANALYSIS_STEPS.map((step, index) => {
                        const isCompleted = index < activeStepIndex || isFinished;
                        const isActive = index === activeStepIndex && !isFinished;

                        return (
                            <div key={index} className="flex items-center gap-3 transition-all duration-500">
                                <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                    {isCompleted ? (
                                        <svg className="w-5 h-5 text-emerald-500 animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : isActive ? (
                                        <div className="w-4 h-4 border-2 border-teal-200 border-r-teal-500 rounded-full animate-spin"></div>
                                    ) : (
                                        <div className="w-2 h-2 bg-slate-200 rounded-full ml-1"></div>
                                    )}
                                </div>
                                <span className={`text-sm font-semibold transition-colors duration-300 transform 
                                    ${isActive ? 'text-teal-600 scale-105 origin-left' : isCompleted ? 'text-emerald-700' : 'text-slate-300'}`}>
                                    {step}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div
                        className="h-full bg-gradient-to-r from-teal-400 to-[#6366F1] transition-all duration-100 ease-out"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <div className="w-full flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <span>Processing</span>
                    <span>{Math.round(progress)}%</span>
                </div>

                {/* Random Tip Box (Optional) */}
                <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200 w-full text-center">
                    <div className="flex justify-center mb-2 text-2xl">ðŸŽ¯</div>
                    <p className="text-xs text-slate-500 italic">
                        "Khi Ä‘Æ°a vÃ­ dá»¥, hÃ£y tháº­t cá»¥ thá»ƒ. Äá»«ng nÃ³i chung chung."
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WritingAnalysisLoading;

