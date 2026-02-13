import React from 'react';

export default function VocabCardSkeleton() {
    return (
        <div className="vocab-card animate-pulse" style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
            <div className="vocab-card-header mb-2 flex justify-between items-start">
                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                <div className="h-6 bg-gray-200 rounded-full w-20"></div>
            </div>

            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>

            <div className="space-y-2 mb-4">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>

            <div className="flex justify-between items-center mt-4">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
            </div>
        </div>
    );
}
