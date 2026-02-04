import React, { useRef, useState, useEffect, useMemo } from 'react';

/**
 * Tokenizes HTML string by wrapping independent words in <span> tags.
 * This allows stable highlighting by toggling classes on existing elements
 * rather than injecting new nodes (which causes reflow/jumps).
 */
function tokenizeHtml(html) {
  if (!html) return '';
  
  // Create temp container to parse HTML
  const div = document.createElement('div');
  div.innerHTML = html;

  const walker = document.createTreeWalker(
    div,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  // Replace each text node with word-wrapped spans
  textNodes.forEach((textNode) => {
    const text = textNode.nodeValue;
    if (!text.trim()) return; // Skip empty/whitespace-only nodes

    const frag = document.createDocumentFragment();
    // Split by whitespace but keep delimiters to preserve spacing
    const parts = text.split(/(\s+)/);
    
    parts.forEach((part) => {
      if (!part) return;
      
      const span = document.createElement('span');
      if (part.trim() === '') {
        // Just whitespace
        span.className = 'token-space';
        span.textContent = part; // Preserve exact whitespace
      } else {
        // Actual word
        span.className = 'token-word'; // Marker class
        span.textContent = part;
      }
      frag.appendChild(span);
    });

    textNode.parentNode.replaceChild(frag, textNode);
  });

  return div.innerHTML;
}

/**
 * Checks if a node is an element marked as a word token
 */
function isTokenNode(node) {
  return node.nodeType === 1 && (node.classList.contains('token-word') || node.classList.contains('token-space'));
}

export default function HighlightableContent({ htmlContent, onUpdateHtml, id, tagName = 'div', className = '' }) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [currentRange, setCurrentRange] = useState(null);

  // We memoize the tokenization so it only runs when the source raw content actually changes (e.g. fresh load)
  // PROBLEM: If we persist the *tokenized* html, then on reload we get tokens.
  // If we run tokenizeHtml on that, we wrap text inside tokens -> <span token><span token>word</span></span>.
  // We need to avoid double-processing.
  // Simple heuristic: If raw HTML contains "token-word", assumes it's managed.
  // Better: Just fix `tokenizeHtml` to not wrap if parent is already `token-word`.
  
  const processedHtml = useMemo(() => {
    // Determine if we need to tokenize
    if (htmlContent && !htmlContent.includes('token-word')) {
        return tokenizeHtml(htmlContent);
    }
    return htmlContent;
  }, [htmlContent]);


  // Initialize DOM
  useEffect(() => {
    if (containerRef.current && processedHtml) {
        if (containerRef.current.innerHTML !== processedHtml) {
            containerRef.current.innerHTML = processedHtml;
            // Restore event listeners for click-to-remove
            attachClickListeners();
        }
    }
  }, [processedHtml]);

  const attachClickListeners = () => {
      if (!containerRef.current) return;
      const highlights = containerRef.current.querySelectorAll('.ielts-highlight');
      highlights.forEach(node => {
          node.onclick = (e) => {
             e.stopPropagation();
             // Remove highlight class only
             node.classList.remove('ielts-highlight');
             node.style.backgroundColor = '';
             node.onclick = null; // Remove handler
             triggerUpdate();
          };
      });
  };

  const triggerUpdate = () => {
      if (onUpdateHtml && containerRef.current) {
          onUpdateHtml(containerRef.current.innerHTML);
      }
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setShowTooltip(false);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!containerRef.current || !containerRef.current.contains(range.commonAncestorContainer)) {
      setShowTooltip(false);
      return;
    }

    // Position tooltip
    const rect = range.getBoundingClientRect();
    const wrapperRect = wrapperRef.current ? wrapperRef.current.getBoundingClientRect() : { top: 0, left: 0 };
    setTooltipPos({ 
        x: rect.left - wrapperRect.left + (rect.width / 2), 
        y: rect.top - wrapperRect.top - 40 
    });
    
    setCurrentRange(range);
    setShowTooltip(true);
  };

  const applyHighlight = () => {
    if (!containerRef.current || !currentRange) return;

    // Logic: Find all .token-word elements intersecting the range
    const iterator = document.createNodeIterator(
        containerRef.current,
        NodeFilter.SHOW_ELEMENT,
        {
            acceptNode: (node) => {
                if (node.classList.contains('token-word') || node.classList.contains('token-space')) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
            }
        }
    );

    let node;
    let modified = false;

    // Optimization: we could limit search, but iterating a few hundred nodes is fast.
    while ((node = iterator.nextNode())) {
        if (currentRange.intersectsNode(node)) {
            // Check if fully highlighted? Or just toggle on.
            // Requirement: "Highlight".
            if (!node.classList.contains('ielts-highlight')) {
                node.classList.add('ielts-highlight');
                // click-to-remove logic
                node.onclick = (e) => {
                    e.stopPropagation();
                    e.target.classList.remove('ielts-highlight');
                    e.target.onclick = null;
                    triggerUpdate();
                };
                modified = true;
            }
        }
    }

    if (modified) {
        window.getSelection().removeAllRanges();
        setShowTooltip(false);
        triggerUpdate();
    } else {
        // Fallback: User selected whitespace or non-token text?
        // Try simple contains?
        setShowTooltip(false);
    }
  };

  const Tag = tagName;
  const displayStyle = tagName === 'span' ? 'inline-block' : 'flow-root';

  return (
    <div 
        ref={wrapperRef}
        className={`highlightable-wrapper ${className}`} 
        onMouseUp={handleMouseUp}
        style={{position: 'relative', display: displayStyle}}
    >
      {showTooltip && (
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            applyHighlight();
          }}
          style={{
            position: 'absolute',
            top: tooltipPos.y,
            left: tooltipPos.x,
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: '#334155',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: '600',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{background:'#fef08a', width:'12px', height:'12px', borderRadius:'2px', border:'1px solid #ffffff40'}}></span>
          Highlight
        </button>
      )}
      <Tag 
        ref={containerRef}
        style={{outline: 'none', display: displayStyle !== 'flow-root' ? 'inline' : 'block'}}
      />
    </div>
  );
}
