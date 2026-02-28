import React, { useMemo } from 'react';

const normalizeSpace = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildFlexibleSnippetRegex = (snippet = '') => {
  const normalized = normalizeSpace(snippet);
  if (!normalized) return null;

  const tokens = normalized.split(' ').map((token) => escapeRegExp(token)).filter(Boolean);
  if (tokens.length === 0) return null;

  return new RegExp(tokens.join('\\s+'), 'gi');
};

const splitTextWithSnippet = (text = '', snippet = '', payload = {}) => {
  const regex = buildFlexibleSnippetRegex(snippet);
  if (!regex) return null;

  let match;
  let cursor = 0;
  const output = [];

  while ((match = regex.exec(text)) !== null) {
    const [matchedText] = match;
    if (!matchedText) continue;

    const start = match.index;
    if (start > cursor) {
      output.push({ text: text.slice(cursor, start), type: 'text' });
    }

    output.push({
      text: matchedText,
      type: 'highlight',
      feedbackType: payload.type,
      data: payload,
    });
    cursor = start + matchedText.length;
  }

  if (output.length === 0) return null;
  if (cursor < text.length) {
    output.push({ text: text.slice(cursor), type: 'text' });
  }

  return output;
};

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
                text_snippet: normalizeSpace(issue.text_snippet || issue.original),
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

    const dedupedIssues = [];
    const seen = new Set();
    allIssues.forEach((item) => {
      const key = `${item.criterion || 'unknown'}::${normalizeSpace(item.text_snippet).toLowerCase()}`;
      if (!item.text_snippet || seen.has(key)) return;
      seen.add(key);
      dedupedIssues.push(item);
    });
    dedupedIssues.sort((a, b) => String(b.text_snippet || '').length - String(a.text_snippet || '').length);

    let parts = [{ text: essay, type: 'text' }];

    dedupedIssues.forEach((item) => {
      const snippet = item.text_snippet;
      if (!snippet) return;

      const newParts = [];

      parts.forEach((part) => {
        if (part.type !== 'text') {
          newParts.push(part);
          return;
        }

        const splitWithMatch = splitTextWithSnippet(part.text, snippet, item);
        if (!splitWithMatch) {
          newParts.push(part);
          return;
        }
        newParts.push(...splitWithMatch);
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
