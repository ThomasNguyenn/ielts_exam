import React, { useMemo } from 'react';

const HighlightedEssay = ({ essay, analysis, onHighlightClick, selectedCriterion = 'all' }) => {
  const processedContent = useMemo(() => {
    if (!essay) return [];

    let allIssues = [];

    if (analysis) {
      if (Array.isArray(analysis)) {
        allIssues = analysis.filter((item) => {
          if (selectedCriterion === 'all') return true;
          return item.criterion === selectedCriterion;
        });
      } else {
        const keys = ['task_response', 'coherence_cohesion', 'lexical_resource', 'grammatical_range_accuracy'];

        keys.forEach((key) => {
          if (selectedCriterion === 'all' || selectedCriterion === key) {
            const sectionData = analysis[key];
            let issues = [];

            if (Array.isArray(sectionData)) {
              issues = sectionData;
            } else if (sectionData && sectionData.issues && Array.isArray(sectionData.issues)) {
              issues = sectionData.issues;
            }

            if (issues.length > 0) {
              const mapped = issues.map((issue) => ({
                text_snippet: issue.text_snippet || issue.original,
                comment: issue.explanation || issue.comment,
                correction: issue.improved || issue.correction,
                band_impact: issue.band_impact,
                band6_replacement: issue.band6_replacement,
                band65_replacement: issue.band65_replacement,
                type: issue.type || 'issue',
                criterion: key,
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

      parts.forEach((part) => {
        if (part.type !== 'text') {
          newParts.push(part);
          return;
        }

        if (part.text.includes(snippet)) {
          const split = part.text.split(snippet);
          for (let i = 0; i < split.length; i += 1) {
            if (split[i]) newParts.push({ text: split[i], type: 'text' });
            if (i < split.length - 1) {
              newParts.push({
                text: snippet,
                type: 'highlight',
                feedbackType: item.type,
                data: item,
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

  const resolveHighlightClass = (part) => {
    const criterion = part?.data?.criterion;
    if (criterion === 'task_response') return 'highlight-task';
    if (criterion === 'grammatical_range_accuracy') return 'highlight-grammar';
    if (criterion === 'lexical_resource') return 'highlight-vocab';
    if (criterion === 'coherence_cohesion') return 'highlight-coherence';

    if (part.feedbackType === 'error') return 'highlight-grammar';
    if (part.feedbackType === 'suggestion') return 'highlight-coherence';
    return 'highlight-vocab';
  };

  try {
    return (
      <div className="highlighted-essay">
        {(Array.isArray(processedContent) ? processedContent : []).map((part, index) => {
          if (part.type === 'highlight') {
            return (
              <span
                key={index}
                className={resolveHighlightClass(part)}
                onClick={() => onHighlightClick && onHighlightClick(part.data)}
                title="Click for AI feedback"
              >
                {part.text}
              </span>
            );
          }
          return <span key={index}>{part.text}</span>;
        })}
      </div>
    );
  } catch (err) {
    console.error('HighlightedEssay render crash:', err);
    return <div className="highlighted-essay">{essay}</div>;
  }
};

export default HighlightedEssay;
