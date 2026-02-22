import React from 'react';

export default function PracticeCardSkeleton() {
    return (
        <div className="practice-card animate-pulse" style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div className="h-6 bg-gray-200 rounded-full w-20"></div>
            </div>

            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>

            <div className="space-y-2 mb-6 flex-1">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>

            <div className="h-10 bg-gray-200 rounded-lg w-full"></div>
        </div>
    );
}
