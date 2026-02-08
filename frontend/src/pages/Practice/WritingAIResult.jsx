import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import WritingScoreDashboard from './WritingScoreDashboard';
import './Practice.css';

export default function WritingAIResult() {
    const { id } = useParams(); // Submission ID
    const navigate = useNavigate();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scoring, setScoring] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!id) return;

        const loadResult = async () => {
            try {
                setLoading(true);
                // 1. Fetch submission status
                const res = await api.getSubmissionById(id);
                const submission = res.data;

                if (!submission) {
                    setError("Submission not found");
                    return;
                }

                // 2. If 'pending', assume we need to trigger AI scoring (or wait for it)
                // BUT user flow: Submit -> Redirect Here. 
                // If it's not scored yet, we should trigger it.
                if (submission.status === 'pending' || !submission.is_ai_graded) {
                    setScoring(true);
                    const scoreRes = await api.scoreSubmissionAI(id);
                    if (scoreRes.success) {
                        const updatedSubmission = scoreRes.data;
                        mapToDashboard(updatedSubmission);
                    } else {
                        setError("AI Scoring failed. Please try again later.");
                    }
                    setScoring(false);
                } else {
                    // Already scored
                    mapToDashboard(submission);
                }
            } catch (err) {
                console.error(err);
                setError(err.message || "Failed to load result");
            } finally {
                setLoading(false);
            }
        };

        loadResult();
    }, [id]);

    const mapToDashboard = (submission) => {
        // Map submission data to WritingScoreDashboard result prop
        // We assume single task for now as per requirement
        if (!submission.writing_answers || submission.writing_answers.length === 0) {
            setError("No answer found in submission");
            return;
        }

        const answer = submission.writing_answers[0];
        const aiResult = submission.ai_result || {};

        setResult({
            ...aiResult,
            fullEssay: answer.answer_text,
            task_title: answer.task_title
        });
    };

    if (loading || scoring) {
        return (
            <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div className="spinner"></div>
                <h2>{scoring ? "AI is analyzing your writing..." : "Loading results..."}</h2>
                <p className="muted">This may take up to 30-60 seconds.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page">
                <p className="error">{error}</p>
                <button className="btn-primary" onClick={() => navigate('/tests')}>Back to Tests</button>
            </div>
        );
    }

    return (
        <div className="page writing-result-page">
            <WritingScoreDashboard
                result={result}
                onRestart={() => navigate('/tests')} // Or direct back to test start?
            />
        </div>
    );
}
