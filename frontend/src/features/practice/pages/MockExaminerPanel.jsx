import React, { useMemo, useState } from 'react';
import { api } from '@/shared/api/client';
import './MockExaminerPanel.css';

const normalizeTurns = (turns = []) =>
    (Array.isArray(turns) ? turns : [])
        .filter((turn) => ['examiner', 'candidate'].includes(String(turn?.role || '').toLowerCase()))
        .map((turn) => ({
            role: String(turn.role).toLowerCase(),
            message: String(turn.message || '').trim(),
            createdAt: turn.createdAt || null,
        }))
        .filter((turn) => turn.message);

const extractMockData = (response) => {
    if (response?.data?.data) return response.data.data;
    if (response?.data) return response.data;
    return response || {};
};

export default function MockExaminerPanel({ sessionId, topicPrompt }) {
    const [turns, setTurns] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [started, setStarted] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [pressureFeedback, setPressureFeedback] = useState('');
    const [finalAssessment, setFinalAssessment] = useState('');
    const [error, setError] = useState('');

    const examinerTurnCount = useMemo(
        () => turns.filter((turn) => turn.role === 'examiner').length,
        [turns],
    );

    const applyServerPayload = (payload) => {
        const normalizedTurns = normalizeTurns(payload.turns || []);
        setTurns(normalizedTurns);
        setPressureFeedback(String(payload.pressure_feedback || '').trim());
        setFinalAssessment(String(payload.final_assessment || '').trim());
        setCompleted(Boolean(payload.completed));
        setStarted(true);
    };

    const startConversation = async () => {
        if (!sessionId || started) return;

        setLoading(true);
        setError('');
        try {
            const response = await api.runMockExaminerTurn(sessionId, {});
            const payload = extractMockData(response);
            applyServerPayload(payload);
        } catch (err) {
            setError(err.message || 'Unable to start mock examiner mode.');
        } finally {
            setLoading(false);
        }
    };

    const sendAnswer = async (event) => {
        event.preventDefault();
        if (!sessionId || !started || completed) return;

        const answer = input.trim();
        if (!answer) return;

        setLoading(true);
        setError('');
        try {
            const response = await api.runMockExaminerTurn(sessionId, { userAnswer: answer });
            const payload = extractMockData(response);
            applyServerPayload(payload);
            setInput('');
        } catch (err) {
            setError(err.message || 'Failed to send answer.');
        } finally {
            setLoading(false);
        }
    };

    if (!sessionId) return null;

    return (
        <section className="mock-examiner-card">
            <div className="mock-examiner-head">
                <div>
                    <p className="mock-examiner-label">AI Mock Examiner</p>
                    <h3>Conversational Mode</h3>
                </div>
                <span className="mock-examiner-count">Turns: {examinerTurnCount}</span>
            </div>

            <p className="mock-examiner-intro">
                Multi-turn follow-up questions to simulate real Part 3 pressure for this topic:
                <span className="mock-topic"> {topicPrompt}</span>
            </p>

            {!started && (
                <button
                    type="button"
                    onClick={startConversation}
                    className="mock-start-btn"
                    disabled={loading}
                >
                    {loading ? 'Starting...' : 'Start Conversational Mock Exam'}
                </button>
            )}

            {turns.length > 0 && (
                <div className="mock-chat">
                    {turns.map((turn, index) => (
                        <div
                            key={`${turn.role}-${index}`}
                            className={`mock-turn ${turn.role === 'examiner' ? 'mock-turn--examiner' : 'mock-turn--candidate'}`}
                        >
                            <p className="mock-turn-role">
                                {turn.role === 'examiner' ? 'Examiner' : 'You'}
                            </p>
                            <p>{turn.message}</p>
                        </div>
                    ))}
                </div>
            )}

            {pressureFeedback && (
                <div className="mock-feedback">
                    <strong>Pressure note:</strong> {pressureFeedback}
                </div>
            )}

            {finalAssessment && (
                <div className="mock-final-assessment">
                    <strong>Final assessment:</strong> {finalAssessment}
                </div>
            )}

            {started && !completed && (
                <form className="mock-input-row" onSubmit={sendAnswer}>
                    <input
                        type="text"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Type your spoken response..."
                        disabled={loading}
                    />
                    <button type="submit" disabled={loading || !input.trim()}>
                        {loading ? 'Sending...' : 'Send'}
                    </button>
                </form>
            )}

            {completed && (
                <p className="mock-complete-text">
                    Conversation completed. Start a new speaking attempt to reset this mock examiner session.
                </p>
            )}

            {error && <p className="mock-error-text">{error}</p>}
        </section>
    );
}
