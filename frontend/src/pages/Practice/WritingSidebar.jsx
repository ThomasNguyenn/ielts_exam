import React from 'react';

const WritingSidebar = ({ result, activeTab, setActiveTab, selectedCriterion, setSelectedCriterion }) => {
    return (
        <div className="writing-sidebar">
            <div className="sidebar-header">
                <div
                    className={`overall-score-box ${selectedCriterion === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCriterion('all')}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="score-circle">
                        <span className="score-number">{result.band_score}</span>
                        <span className="score-max">/9.0</span>
                    </div>
                    <div className="score-label">Overall Band</div>
                </div>
            </div>

            <div className="criteria-grid">
                <div
                    className={`criterion-card ${selectedCriterion === 'task_response' ? 'active' : ''}`}
                    onClick={() => setSelectedCriterion('task_response')}
                >
                    <div className="criterion-header">
                        <span>Task Response</span>
                        <span className="criterion-score">{result.criteria_scores?.task_response}</span>
                    </div>
                </div>
                <div
                    className={`criterion-card ${selectedCriterion === 'coherence_cohesion' ? 'active' : ''}`}
                    onClick={() => setSelectedCriterion('coherence_cohesion')}
                >
                    <div className="criterion-header">
                        <span>Coherence</span>
                        <span className="criterion-score">{result.criteria_scores?.coherence_cohesion}</span>
                    </div>
                </div>
                <div
                    className={`criterion-card ${selectedCriterion === 'lexical_resource' ? 'active' : ''}`}
                    onClick={() => setSelectedCriterion('lexical_resource')}
                >
                    <div className="criterion-header">
                        <span>Lexical</span>
                        <span className="criterion-score">{result.criteria_scores?.lexical_resource}</span>
                    </div>
                </div>
                <div
                    className={`criterion-card ${selectedCriterion === 'grammatical_range_accuracy' ? 'active' : ''}`}
                    onClick={() => setSelectedCriterion('grammatical_range_accuracy')}
                >
                    <div className="criterion-header">
                        <span>Grammar</span>
                        <span className="criterion-score">{result.criteria_scores?.grammatical_range_accuracy}</span>
                    </div>
                </div>
            </div>

            <div className="sidebar-tabs">
                <button
                    className={`tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
                    onClick={() => setActiveTab('feedback')}
                >
                    Review Feedback
                </button>
                {/* <button
                    className={`tab-btn ${activeTab === 'model' ? 'active' : ''}`}
                    onClick={() => setActiveTab('model')}
                >
                    Model Essay
                </button> */}
            </div>

            <div className="sidebar-content">
                {activeTab === 'feedback' && (
                    <div className="feedback-list">
                        <h4>General Feedback</h4>
                        <ul>
                            {result.feedback?.map((f, i) => (
                                <li key={i}>{f}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {activeTab === 'model' && (
                    <div className="model-essay-content">
                        <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{result.corrected_essay}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WritingSidebar;
