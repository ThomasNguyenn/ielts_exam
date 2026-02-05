import { useState } from 'react';
import { api } from '../api/client';
import { useNotification } from './NotificationContext';
import './VocabHighlighter.css';

export default function VocabHighlighter({ children, testId, passageId }) {
    const { showNotification } = useNotification();
    const [showPopup, setShowPopup] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [selectedContext, setSelectedContext] = useState('');
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    const [saving, setSaving] = useState(false);

    const handleMouseUp = (e) => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (!text || text.length === 0) {
            setShowPopup(false);
            return;
        }

        // Get the full sentence as context
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const parentText = container.parentElement?.textContent || container.textContent || '';

        // Extract sentence containing the selected word
        const context = extractSentence(parentText, text);

        setSelectedText(text);
        setSelectedContext(context);

        // Position popup near selection
        const rect = range.getBoundingClientRect();
        setPopupPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
        });

        setShowPopup(true);
    };

    const extractSentence = (fullText, selectedWord) => {
        // Find the position of the selected word
        const wordIndex = fullText.toLowerCase().indexOf(selectedWord.toLowerCase());
        if (wordIndex === -1) return fullText.substring(0, 100);

        // Find sentence boundaries (., !, ?)
        let start = fullText.lastIndexOf('.', wordIndex);
        let end = fullText.indexOf('.', wordIndex);

        if (start === -1) start = 0;
        else start += 1;

        if (end === -1) end = fullText.length;
        else end += 1;

        return fullText.substring(start, end).trim();
    };

    const handleSaveWord = async () => {
        if (!selectedText) return;

        setSaving(true);
        try {
            await api.addVocabulary({
                word: selectedText,
                context: selectedContext,
                source_test_id: testId,
                source_passage_id: passageId
            });

            // Show success feedback
            setShowPopup(false);
            showNotification(`"${selectedText}" saved to vocabulary!`, 'success');

            // Clear selection
            window.getSelection().removeAllRanges();
        } catch (error) {
            console.error('Error saving vocabulary:', error);
            if (error.message.includes('already in your vocabulary')) {
                showNotification('This word is already in your vocabulary list!', 'warning');
            } else {
                showNotification('Failed to save word. Please try again.', 'error');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        setShowPopup(false);
        window.getSelection().removeAllRanges();
    };

    return (
        <div className="vocab-highlighter" onMouseUp={handleMouseUp}>
            {children}

            {showPopup && (
                <>
                    <div className="vocab-popup-overlay" onClick={handleClose} />
                    <div
                        className="vocab-popup"
                        style={{
                            left: `${popupPosition.x}px`,
                            top: `${popupPosition.y}px`,
                            transform: 'translate(-50%, -100%)'
                        }}
                    >
                        <div className="vocab-popup-content">
                            <div className="vocab-popup-word">{selectedText}</div>
                            <div className="vocab-popup-context">"{selectedContext}"</div>
                            <div className="vocab-popup-actions">
                                <button
                                    onClick={handleSaveWord}
                                    className="btn btn-primary btn-sm"
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : '📚 Save to Vocabulary'}
                                </button>
                                <button onClick={handleClose} className="btn btn-ghost btn-sm">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
