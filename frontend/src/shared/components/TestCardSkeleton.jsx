import React from 'react';
import '@/features/tests/pages/TestList.css';

export default function TestCardSkeleton() {
    return (
        <div className="test-card animate-pulse border-gray-200">
            {/* Header Skeleton */}
            <div className="test-card-header mb-4">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="flex gap-2">
                    <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                    <div className="h-6 bg-gray-200 rounded-full w-12"></div>
                </div>
            </div>

            {/* Description Lines */}
            <div className="space-y-2 mb-6">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>

            {/* Attempts Area Stub */}
            <div className="bg-gray-100 rounded-xl h-20 mb-6 w-full"></div>

            {/* Action Buttons */}
            <div className="test-card-actions mt-auto flex gap-3">
                <div className="h-10 bg-gray-200 rounded-lg flex-1"></div>
                <div className="h-10 bg-gray-200 rounded-lg flex-1"></div>
            </div>
        </div>
    );
}
