import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Assuming router usage
import WritingSidebar from './WritingSidebar';
import HighlightedEssay from './HighlightedEssay';
import './Practice.css'; // Ensure we reuse or add styles here

const WritingScoreDashboard = ({ result, onRestart }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('feedback');
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [selectedCriterion, setSelectedCriterion] = useState('all'); // 'all', 'task_response', etc.

    return (
        <div className="writing-dashboard">
            <div className="dashboard-header">
                <h2>IELTS Writing Analysis</h2>
                <div className="dashboard-actions">
                    <button className="btn-secondary" onClick={() => navigate('/tests')}>Start New Session</button>
                    {/* <button className="btn-primary">Download PDF</button> */}
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Left: Essay & Annotations */}
                <div className="essay-column">
                    <div className="essay-card">
                        <div className="essay-header">
                            <h3>Your Essay</h3>
                            <span className="word-count">
                                {result.fullEssay ? result.fullEssay.split(/\s+/).length : 0} words
                            </span>
                        </div>

                        <div className="essay-content-wrapper">
                            <HighlightedEssay
                                essay={result.fullEssay || ""} // Ensure we pass the essay text
                                analysis={result.detailed_analysis || result}
                                selectedCriterion={selectedCriterion}
                                onHighlightClick={setSelectedFeedback}
                            />
                        </div>
                    </div>

                    {/* Feedback Detail Box (Floating or below) */}
                    {selectedFeedback && (
                        <div className="feedback-detail-box">
                            <div className="feedback-header">
                                <span className={`feedback-type ${selectedFeedback.type || 'issue'}`}>
                                    {selectedFeedback.type ? selectedFeedback.type.toUpperCase() : 'FEEDBACK'}
                                </span>
                                <button className="close-btn" onClick={() => setSelectedFeedback(null)}>×</button>
                            </div>
                            <p className="feedback-comment">{selectedFeedback.explanation || selectedFeedback.comment}</p>
                            {(selectedFeedback.improved || selectedFeedback.correction) && (
                                <div className="feedback-correction">
                                    <strong>Suggestion: </strong>
                                    <span>{selectedFeedback.improved || selectedFeedback.correction}</span>
                                </div>
                            )}
                            {selectedFeedback.band6_replacement && (
                                <div className="feedback-correction" style={{ marginTop: '0.5rem' }}>
                                    <strong>Band 6.0 Replacement: </strong>
                                    <span style={{ color: '#059669' }}>{selectedFeedback.band6_replacement}</span>
                                </div>
                            )}
                            {selectedFeedback.band65_replacement && (
                                <div className="feedback-correction" style={{ marginTop: '0.25rem' }}>
                                    <strong>Band 6.5 Replacement: </strong>
                                    <span style={{ color: '#047857' }}>{selectedFeedback.band65_replacement}</span>
                                </div>
                            )}
                            {selectedFeedback.band_impact && (
                                <div className="feedback-impact" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#dc2626' }}>
                                    <strong>Impact: </strong>
                                    <span>{selectedFeedback.band_impact}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Model Essay Card */}
                    {result.sample_essay && (
                        <div className="essay-card" style={{ marginTop: '2rem', border: '1px solid #e2e8f0', borderTop: '4px solid #10b981' }}>
                            <div className="essay-header">
                                <h3 style={{ color: '#059669' }}>Band 8.0 Model Essay</h3>
                                <span className="word-count" style={{ background: '#d1fae5', color: '#065f46' }}>
                                    {result.sample_essay.split(/\s+/).length} words
                                </span>
                            </div>
                            <div className="essay-content-wrapper" style={{ padding: '1.5rem', background: '#f0fdf4', lineHeight: '1.8', color: '#1e293b' }}>
                                {result.sample_essay.split('\n').map((para, idx) => (
                                    <p key={idx} style={{ marginBottom: '1rem' }}>{para}</p>
                                ))}
                            </div>
                        </div>
                    )}


                </div>

                {/* Right: Sidebar */}
                <div className="sidebar-column">
                    <WritingSidebar
                        result={result}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        selectedCriterion={selectedCriterion}
                        setSelectedCriterion={setSelectedCriterion}
                    />
                </div>
            </div>
        </div>
    );
};

export default WritingScoreDashboard;
