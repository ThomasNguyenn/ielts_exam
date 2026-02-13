import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import WritingScoreDashboard from './WritingScoreDashboard';
import './Practice.css';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function WritingAIResult() {
    const { id } = useParams(); // Submission ID
    const navigate = useNavigate();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scoring, setScoring] = useState(false);
    const [error, setError] = useState(null);

    const mapToDashboard = (submission) => {
        if (!submission?.writing_answers || submission.writing_answers.length === 0) {
            setError('No answer found in submission');
            return;
        }

        const answer = submission.writing_answers[0];
        const aiResult = submission.ai_result || {};

        setResult({
            ...aiResult,
            fullEssay: answer.answer_text,
            task_title: answer.task_title,
        });
    };

    const pollSubmission = async (submissionId) => {
        const maxAttempts = 120; // ~4 minutes
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const statusRes = await api.getSubmissionStatus(submissionId);
            const submission = statusRes?.data || {};

            if ((submission.status === 'scored' || submission.is_ai_graded) && submission.ai_result) {
                mapToDashboard(submission);
                return;
            }

            if (submission.status === 'failed') {
                throw new Error('AI scoring failed. Please try again later.');
            }

            await wait(2000);
        }

        throw new Error('AI scoring is taking longer than expected.');
    };

    useEffect(() => {
        if (!id) return;

        const loadResult = async () => {
            try {
                setLoading(true);
                const statusRes = await api.getSubmissionStatus(id);
                const submission = statusRes?.data;

                if (!submission) {
                    setError('Submission not found');
                    return;
                }

                if ((submission.status === 'scored' || submission.is_ai_graded) && submission.ai_result) {
                    mapToDashboard(submission);
                    return;
                }

                setScoring(true);

                try {
                    const scoreRes = await api.scoreSubmissionAI(id);
                    const payload = scoreRes?.data;

                    if (payload?.status === 'processing' || payload?.queued) {
                        await pollSubmission(id);
                    } else if (payload?.ai_result || payload?.is_ai_graded) {
                        mapToDashboard(payload);
                    } else {
                        await pollSubmission(id);
                    }
                } catch (requestError) {
                    // If request to trigger scoring is forbidden/limited, continue polling.
                    await pollSubmission(id);
                }
            } catch (err) {
                console.error(err);
                setError(err.message || 'Failed to load result');
            } finally {
                setScoring(false);
                setLoading(false);
            }
        };

        loadResult();
    }, [id]);

    if (loading || scoring) {
        return (
            <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div className="spinner"></div>
                <h2>{scoring ? 'AI is analyzing your writing...' : 'Loading results...'}</h2>
                <p className="muted">This can take up to 30-120 seconds depending on queue load.</p>
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
                onRestart={() => navigate('/tests')}
            />
        </div>
    );
}
