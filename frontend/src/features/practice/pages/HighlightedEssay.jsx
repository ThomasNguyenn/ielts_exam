import React, { useMemo } from 'react';

const HighlightedEssay = ({ essay, analysis, onHighlightClick, selectedCriterion = 'all' }) => {
    // Basic implementation: Find unique matches and wrap them.
    // Ideally, the backend would return indices, but we'll try string matching for now.

    const processedContent = useMemo(() => {
        if (!essay) return [];

        let allIssues = [];

        // Normalize existing analysis structure to array of issues
        if (analysis) {
            if (Array.isArray(analysis)) {
                // New Flat Array Structure (or legacy)
                // Filter by selectedCriterion if it exists on the item
                allIssues = analysis.filter(item => {
                    if (selectedCriterion === 'all') return true;
                    // If item doesn't have a criterion field, generic items show in 'all' only? 
                    // Or if we want to be safe, show them always? 
                    // Better: if item.criterion matches selectedCriterion.
                    return item.criterion === selectedCriterion;
                });
            } else {
                // ... Object Structure handling ...
                const keys = ['task_response', 'coherence_cohesion', 'lexical_resource', 'grammatical_range_accuracy'];

                keys.forEach(key => {
                    // Filter: Only include if selectedCriterion is 'all' OR matches the key
                    if (selectedCriterion === 'all' || selectedCriterion === key) {
                        const sectionData = analysis[key];
                        let issues = [];

                        if (Array.isArray(sectionData)) {
                            // User's NEW Structure: key is direct array
                            issues = sectionData;
                        } else if (sectionData && sectionData.issues && Array.isArray(sectionData.issues)) {
                            // Previous Object Structure: key.issues is array
                            issues = sectionData.issues;
                        }

                        if (issues.length > 0) {
                            // Map to component's expected format
                            const mapped = issues.map(issue => ({
                                text_snippet: issue.text_snippet || issue.original,
                                comment: issue.explanation || issue.comment,
                                correction: issue.improved || issue.correction,
                                band_impact: issue.band_impact,
                                band6_replacement: issue.band6_replacement, // New field
                                band65_replacement: issue.band65_replacement, // New field
                                type: issue.type || 'issue',
                                criterion: key
                            }));
                            allIssues = [...allIssues, ...mapped];
                        }
                    }
                });
            }
        }

        if (allIssues.length === 0) return [{ text: essay, type: 'text' }];

        let parts = [{ text: essay, type: 'text' }];

        allIssues.forEach((item) => {
            const snippet = item.text_snippet;
            if (!snippet) return;

            const newParts = [];
            // eslint-disable-next-line no-unused-vars
            let snippetFound = false;

            parts.forEach(part => {
                if (part.type !== 'text') {
                    newParts.push(part);
                    return;
                }

                if (part.text.includes(snippet)) {
                    const split = part.text.split(snippet);
                    for (let i = 0; i < split.length; i++) {
                        if (split[i]) newParts.push({ text: split[i], type: 'text' });
                        if (i < split.length - 1) {
                            newParts.push({
                                text: snippet,
                                type: 'highlight',
                                feedbackType: item.type,
                                data: item
                            });
                        }
                    }
                } else {
                    newParts.push(part);
                }
            });
            parts = newParts;
        });

        return parts;
    }, [essay, analysis, selectedCriterion]);

    try {
        return (
            <div className="highlighted-essay">
                {(Array.isArray(processedContent) ? processedContent : []).map((part, index) => {
                    if (part.type === 'highlight') {
                        let className = 'border-b-2 rounded px-0.5 cursor-pointer transition-colors duration-200';
                        if (part.feedbackType === 'error') className += ' bg-red-100 border-red-400 text-red-900';
                        else if (part.feedbackType === 'good') className += ' bg-emerald-100 border-emerald-400 text-emerald-900';
                        else className += ' bg-blue-100 border-blue-400 text-blue-900';

                        return (
                            <span
                                key={index}
                                className={className}
                                onClick={() => onHighlightClick && onHighlightClick(part.data)}
                                title="Click for feedback"
                            >
                                {part.text}
                                {part.feedbackType === 'error' && <span className="highlight-icon">⚠️</span>}
                                {part.feedbackType === 'good' && <span className="highlight-icon">✨</span>}
                            </span>
                        );
                    }
                    return <span key={index}>{part.text}</span>;
                })}
            </div>
        );
    } catch (err) {
        console.error("HighlightedEssay render crash:", err);
        return <div className="highlighted-essay">{essay}</div>;
    }
};

export default HighlightedEssay;
