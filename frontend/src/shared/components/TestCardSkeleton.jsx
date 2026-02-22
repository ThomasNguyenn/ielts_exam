import React from 'react';
import '@/features/tests/components/TestCard.css';

export default function TestCardSkeleton() {
    return (
        <div className="tc" style={{ border: '1px solid #E2E8F0' }}>
            {/* Title */}
            <div style={{ height: 18, background: '#E2E8F0', borderRadius: 8, width: '80%', marginBottom: 12 }} className="animate-pulse" />

            {/* Skill Tags */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                <div style={{ height: 24, width: 70, background: '#EFF6FF', borderRadius: 8 }} className="animate-pulse" />
            </div>

            {/* Meta Row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                <div style={{ height: 14, width: 60, background: '#E2E8F0', borderRadius: 6 }} className="animate-pulse" />
                <div style={{ width: 4, height: 4, background: '#CBD5E1', borderRadius: 50 }} />
                <div style={{ height: 14, width: 50, background: '#E2E8F0', borderRadius: 6 }} className="animate-pulse" />
                <div style={{ height: 20, width: 70, background: '#EEF2FF', borderRadius: 50 }} className="animate-pulse" />
                <div style={{ height: 20, width: 60, background: '#FEF3C7', borderRadius: 50 }} className="animate-pulse" />
            </div>

            {/* Description */}
            <div style={{ height: 14, background: '#E2E8F0', borderRadius: 6, width: '100%', marginBottom: 6 }} className="animate-pulse" />
            <div style={{ height: 14, background: '#E2E8F0', borderRadius: 6, width: '60%', marginBottom: 16 }} className="animate-pulse" />

            {/* Attempts */}
            <div style={{ background: '#F8FAFC', borderRadius: 10, height: 52, marginBottom: 16 }} className="animate-pulse" />

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                <div style={{ height: 40, background: '#EEF2FF', borderRadius: 12, flex: 1 }} className="animate-pulse" />
                <div style={{ height: 40, background: '#F8FAFC', borderRadius: 12, width: 90 }} className="animate-pulse" />
            </div>
        </div>
    );
}
