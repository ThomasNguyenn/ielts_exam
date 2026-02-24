import React, { useRef, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import DOMPurify from 'dompurify';

/**
 * Tokenizes HTML string by wrapping independent words in <span> tags.
 * This allows stable highlighting by toggling classes on existing elements
 * rather than injecting new nodes (which causes reflow/jumps).
 */
export function tokenizeHtml(html) {
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

function sanitizeHtmlContent(rawHtml) {
  return DOMPurify.sanitize(String(rawHtml || ''), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: [
      'onerror',
      'onload',
      'onclick',
      'onmouseover',
      'onmouseenter',
      'onmouseleave',
      'onfocus',
      'onblur',
    ],
    ADD_ATTR: ['data-note', 'data-question-number'],
  });
}

/**
 * Checks if a node is an element marked as a word token
 */
function isTokenNode(node) {
  return node.nodeType === 1 && (node.classList.contains('token-word') || node.classList.contains('token-space'));
}

const NoteModal = ({ isOpen, onClose, onSave, initialValue = '' }) => {
  const [value, setValue] = useState(initialValue);
  const textAreaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setTimeout(() => textAreaRef.current?.focus(), 50);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="note-modal-overlay" onClick={onClose}>
      <div className="note-modal" onClick={e => e.stopPropagation()}>
        <div className="note-modal-header">
          <h3>Add Note</h3>
          <button type="button" onClick={onClose}>✕</button>
        </div>
        <textarea
          ref={textAreaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Enter your note here..."
        />
        <div className="note-modal-actions">
          <button type="button" className="btn-save" onClick={() => onSave(value)}>Save</button>
          <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};


const HighlightableContent = forwardRef(({ htmlContent, onUpdateHtml, id, tagName = 'div', className = '' }, ref) => {
  const internalContainerRef = useRef(null);
  // Allow parent to access the container ref
  useImperativeHandle(ref, () => internalContainerRef.current);
  
  const containerRef = internalContainerRef;
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

  const sanitizedHtml = useMemo(() => sanitizeHtmlContent(htmlContent), [htmlContent]);

  const processedHtml = useMemo(() => {
    // Determine if we need to tokenize
    if (sanitizedHtml && !sanitizedHtml.includes('token-word')) {
      return tokenizeHtml(sanitizedHtml);
    }
    return sanitizedHtml;
  }, [sanitizedHtml]);


  const [noteModal, setNoteModal] = useState({ isOpen: false, range: null, initialValue: '', editNode: null });

  // Initialize DOM
  useEffect(() => {
    if (containerRef.current && processedHtml) {
      if (containerRef.current.innerHTML !== processedHtml) {
        containerRef.current.innerHTML = processedHtml;
        attachClickListeners();
      }
    }
  }, [processedHtml]);

  const attachClickListeners = () => {
    if (!containerRef.current) return;
    
    // Highlights
    const highlights = containerRef.current.querySelectorAll('.ielts-highlight');
    highlights.forEach(node => {
      node.onclick = (e) => {
        e.stopPropagation();
        // Cycle through or remove? For now, click to remove for simplicity
        const classes = Array.from(node.classList).filter(c => c.startsWith('highlight-'));
        node.classList.remove('ielts-highlight', ...classes);
        node.onclick = null;
        triggerUpdate();
      };
    });

    // Notes
    const notes = containerRef.current.querySelectorAll('.note-marker');
    notes.forEach(node => {
      node.onclick = (e) => {
        e.stopPropagation();
        setNoteModal({
          isOpen: true,
          range: null,
          initialValue: node.getAttribute('data-note') || '',
          editNode: node
        });
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

    const rect = range.getBoundingClientRect();
    const wrapperRect = wrapperRef.current ? wrapperRef.current.getBoundingClientRect() : { top: 0, left: 0 };
    setTooltipPos({
      x: rect.left - wrapperRect.left + (rect.width / 2),
      y: rect.top - wrapperRect.top - 50
    });

    setCurrentRange(range);
    setShowTooltip(true);
  };

  const applyHighlight = (colorClass) => {
    if (!containerRef.current || !currentRange) return;

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

    const intersectingNodes = [];
    let node;
    while ((node = iterator.nextNode())) {
      if (currentRange.intersectsNode(node)) {
        intersectingNodes.push(node);
      }
    }

    if (intersectingNodes.length === 0) {
      setShowTooltip(false);
      return;
    }

    const allHighlightedSameColor = intersectingNodes.every(n => n.classList.contains(colorClass));

    intersectingNodes.forEach(node => {
      if (allHighlightedSameColor) {
        // Toggle off
        const classes = Array.from(node.classList).filter(c => c.startsWith('highlight-'));
        node.classList.remove('ielts-highlight', ...classes);
        node.onclick = null;
      } else {
        // Remove existing colors first
        const classes = Array.from(node.classList).filter(c => c.startsWith('highlight-'));
        node.classList.remove(...classes);
        
        node.classList.add('ielts-highlight', colorClass);
        node.onclick = (e) => {
          e.stopPropagation();
          const cls = Array.from(e.target.classList).filter(c => c.startsWith('highlight-'));
          e.target.classList.remove('ielts-highlight', ...cls);
          e.target.onclick = null;
          triggerUpdate();
        };
      }
    });

    window.getSelection().removeAllRanges();
    setShowTooltip(false);
    triggerUpdate();
  };

  const handleOpenNote = () => {
    setNoteModal({
      isOpen: true,
      range: currentRange,
      initialValue: '',
      editNode: null
    });
    setShowTooltip(false);
  };

  const handleSaveNote = (text) => {
    if (noteModal.editNode) {
      if (!text.trim()) {
        noteModal.editNode.remove();
      } else {
        noteModal.editNode.setAttribute('data-note', text);
      }
    } else if (noteModal.range && text.trim()) {
      // Find the last intersecting node to place marker after
      const node = noteModal.range.endContainer;
      const target = node.nodeType === 3 ? node.parentElement : node;
      
      const marker = document.createElement('span');
      marker.className = 'note-marker';
      marker.setAttribute('data-note', text);
      marker.textContent = '📝';
      marker.onclick = (e) => {
        e.stopPropagation();
        setNoteModal({
          isOpen: true,
          range: null,
          initialValue: marker.getAttribute('data-note') || '',
          editNode: marker
        });
      };
      
      // Insert after the selection
      if (noteModal.range.endContainer.nodeType === 3) {
        const span = document.createElement('span');
        noteModal.range.surroundContents(span); // This might be risky if range crosses elements
        span.after(marker);
      } else {
        noteModal.range.endContainer.appendChild(marker);
      }
    }
    
    setNoteModal({ isOpen: false, range: null, initialValue: '', editNode: null });
    window.getSelection().removeAllRanges();
    triggerUpdate();
  };

  const Tag = tagName;
  const displayStyle = tagName === 'span' ? 'inline-block' : 'flow-root';

  return (
    <div
      ref={wrapperRef}
      className={`highlightable-wrapper ${className}`}
      onMouseUp={handleMouseUp}
      style={{ position: 'relative', display: displayStyle }}
    >
      {showTooltip && (
        <div
          className="highlight-tooltip"
          style={{
            position: 'absolute',
            top: tooltipPos.y,
            left: tooltipPos.x,
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: '#ffffff',
            color: '#334155',
            border: '1px solid #e2e8f0',
            padding: '6px',
            borderRadius: '10px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'tooltipFadeIn 0.2s ease-out'
          }}
        >
          <button type="button" className="color-dot yellow" onMouseDown={(e) => { e.preventDefault(); applyHighlight('highlight-yellow'); }} title="Yellow Highlight"></button>
          <button type="button" className="color-dot pink" onMouseDown={(e) => { e.preventDefault(); applyHighlight('highlight-pink'); }} title="Pink Highlight"></button>
          <button type="button" className="color-dot blue" onMouseDown={(e) => { e.preventDefault(); applyHighlight('highlight-blue'); }} title="Blue Highlight"></button>
          <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }}></div>
          <button 
            type="button" 
            className="tooltip-action-btn"
            onMouseDown={(e) => { e.preventDefault(); handleOpenNote(); }}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '0.8rem', 
              fontWeight: '700', 
              color: '#6366F1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            📝 Note
          </button>
        </div>
      )}
      <Tag
        ref={containerRef}
        style={{ outline: 'none', display: displayStyle !== 'flow-root' ? 'inline' : 'block' }}
      />

      <NoteModal
        isOpen={noteModal.isOpen}
        onClose={() => setNoteModal({ isOpen: false, range: null, initialValue: '', editNode: null })}
        onSave={handleSaveNote}
        initialValue={noteModal.initialValue}
      />

    </div>
  );
});

export default HighlightableContent;

export function HighlightableWrapper({ children, onUpdateHtml, className = '', tagName = 'div', style = {} }) {
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [currentRange, setCurrentRange] = useState(null);
  const [noteModal, setNoteModal] = useState({ isOpen: false, range: null, initialValue: '', editNode: null });

  const attachClickListeners = () => {
    if (!containerRef.current) return;
    
    // Highlights
    const highlights = containerRef.current.querySelectorAll('.ielts-highlight');
    highlights.forEach(node => {
      node.onclick = (e) => {
        e.stopPropagation();
        const classes = Array.from(node.classList).filter(c => c.startsWith('highlight-'));
        node.classList.remove('ielts-highlight', ...classes);
        node.onclick = null;
        triggerUpdate();
      };
    });

    // Notes
    const notes = containerRef.current.querySelectorAll('.note-marker');
    notes.forEach(node => {
      node.onclick = (e) => {
        e.stopPropagation();
        setNoteModal({
          isOpen: true,
          range: null,
          initialValue: node.getAttribute('data-note') || '',
          editNode: node
        });
      };
    });
  };

  // Re-attach listeners whenever children update
  useEffect(() => {
    attachClickListeners();
  });

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

    const rect = range.getBoundingClientRect();
    const wrapperRect = wrapperRef.current ? wrapperRef.current.getBoundingClientRect() : { top: 0, left: 0 };
    setTooltipPos({
      x: rect.left - wrapperRect.left + (rect.width / 2),
      y: rect.top - wrapperRect.top - 50
    });

    setCurrentRange(range);
    setShowTooltip(true);
  };

  const applyHighlight = (colorClass) => {
    if (!containerRef.current || !currentRange) return;

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

    const intersectingNodes = [];
    let node;
    while ((node = iterator.nextNode())) {
      if (currentRange.intersectsNode(node)) {
        intersectingNodes.push(node);
      }
    }

    if (intersectingNodes.length === 0) {
      setShowTooltip(false);
      return;
    }

    const allHighlightedSameColor = intersectingNodes.every(n => n.classList.contains(colorClass));

    intersectingNodes.forEach(node => {
      if (allHighlightedSameColor) {
        const classes = Array.from(node.classList).filter(c => c.startsWith('highlight-'));
        node.classList.remove('ielts-highlight', ...classes);
        node.onclick = null;
      } else {
        const classes = Array.from(node.classList).filter(c => c.startsWith('highlight-'));
        node.classList.remove(...classes);
        node.classList.add('ielts-highlight', colorClass);
        node.onclick = (e) => {
          e.stopPropagation();
          const cls = Array.from(e.target.classList).filter(c => c.startsWith('highlight-'));
          e.target.classList.remove('ielts-highlight', ...cls);
          e.target.onclick = null;
          triggerUpdate();
        };
      }
    });

    window.getSelection().removeAllRanges();
    setShowTooltip(false);
    triggerUpdate();
  };

  const handleOpenNote = () => {
    setNoteModal({
      isOpen: true,
      range: currentRange,
      initialValue: '',
      editNode: null
    });
    setShowTooltip(false);
  };

  const handleSaveNote = (text) => {
    if (noteModal.editNode) {
      if (!text.trim()) {
        noteModal.editNode.remove();
      } else {
        noteModal.editNode.setAttribute('data-note', text);
      }
    } else if (noteModal.range && text.trim()) {
      const marker = document.createElement('span');
      marker.className = 'note-marker';
      marker.setAttribute('data-note', text);
      marker.textContent = '📝';
      marker.onclick = (e) => {
        e.stopPropagation();
        setNoteModal({ isOpen: true, range: null, initialValue: marker.getAttribute('data-note') || '', editNode: marker });
      };
      
      const node = noteModal.range.endContainer;
      if (node.nodeType === 3) {
          const span = document.createElement('span');
          noteModal.range.surroundContents(span);
          span.after(marker);
      } else {
          node.appendChild(marker);
      }
    }
    
    setNoteModal({ isOpen: false, range: null, initialValue: '', editNode: null });
    window.getSelection().removeAllRanges();
    triggerUpdate();
  };

  const Tag = tagName;
  const displayStyle = tagName === 'span' ? 'inline-block' : 'flow-root';

  return (
    <div
      ref={wrapperRef}
      className={`highlightable-wrapper ${className}`}
      onMouseUp={handleMouseUp}
      style={{ position: 'relative', display: displayStyle, ...style }}
    >
      {showTooltip && (
        <div
          className="highlight-tooltip"
          style={{
            position: 'absolute',
            top: tooltipPos.y,
            left: tooltipPos.x,
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: '#ffffff',
            color: '#334155',
            border: '1px solid #e2e8f0',
            padding: '6px',
            borderRadius: '10px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'tooltipFadeIn 0.2s ease-out'
          }}
        >
          <button type="button" className="color-dot yellow" onMouseDown={(e) => { e.preventDefault(); applyHighlight('highlight-yellow'); }} title="Yellow Highlight"></button>
          <button type="button" className="color-dot pink" onMouseDown={(e) => { e.preventDefault(); applyHighlight('highlight-pink'); }} title="Pink Highlight"></button>
          <button type="button" className="color-dot blue" onMouseDown={(e) => { e.preventDefault(); applyHighlight('highlight-blue'); }} title="Blue Highlight"></button>
          <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }}></div>
          <button 
            type="button" 
            className="tooltip-action-btn"
            onMouseDown={(e) => { e.preventDefault(); handleOpenNote(); }}
            style={{ background: 'none', border: 'none', fontSize: '0.8rem', fontWeight: '700', color: '#6366F1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            📝 Note
          </button>
        </div>
      )}
      <Tag
        ref={containerRef}
        className="highlight-content-root"
        style={{ outline: 'none', display: displayStyle !== 'flow-root' ? 'inline' : 'block' }}
      >
        {children}
      </Tag>

      <NoteModal
        isOpen={noteModal.isOpen}
        onClose={() => setNoteModal({ isOpen: false, range: null, initialValue: '', editNode: null })}
        onSave={handleSaveNote}
        initialValue={noteModal.initialValue}
      />
    </div>
  );
}

