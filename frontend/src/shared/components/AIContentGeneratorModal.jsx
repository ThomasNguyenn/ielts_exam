import React, { useState } from 'react';
import { api } from '@/shared/api/client';
import './AIContentGeneratorModal.css';

export default function AIContentGeneratorModal({ isOpen, onClose, onGenerated, type = 'passage' }) {
    const [rawText, setRawText] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!rawText.trim() && !imageUrl.trim()) {
            setError("Please provide either text or an image URL.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const imageUrls = imageUrl.trim() ? [imageUrl.trim()] : [];
            const res = await api.parseContent({ rawText, imageUrls, type });

            if (res.success && res.data) {
                onGenerated(res.data);
                onClose();
            } else {
                setError(res.message || "Failed to generate content.");
            }
        } catch (err) {
            console.error(err);
            setError(err.message || "An error occurred during generation.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
                <div className="modal-header flex justify-between">
                    <h2>Soạn đề AI ({type === 'passage' ? 'Reading' : 'Listening'})</h2>
                    <button onClick={onClose} className="close-button">×</button>
                </div>
                <div className="modal-body">
                    <p className="form-hint">
                        Paste raw text (from PDF/Website) or provide an image URL of the questions.
                        The AI will attempt to structure it automatically.
                    </p>

                    {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

                    <div className="form-row">
                        <label>Raw Text / Context</label>
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            rows={10}
                            placeholder="Paste the full reading passage and questions here..."
                            style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                        />
                    </div>

                    <div className="form-row">
                        <label>Image URL (Optional)</label>
                        <input
                            type="text"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://example.com/screenshot.png"
                        />
                        <small className="form-hint">
                            If you have a screenshot of the questions (e.g. matching features), paste the URL here.
                        </small>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
                    <button className="btn-manage-add" onClick={handleGenerate} disabled={loading}>
                        {loading ? 'Analyzing & Generating...' : 'Generate Content'}
                    </button>
                </div>
            </div>
        </div>
    );
}
