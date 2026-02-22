import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import WritingScoreDashboard from './WritingScoreDashboard';
import WritingAnalysisLoading from './WritingAnalysisLoading';
import './Practice.css';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function WritingAIResult() {
    const { id } = useParams(); // Submission ID
    const navigate = useNavigate();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scoring, setScoring] = useState(false);
    const [error, setError] = useState(null);
    const [analysisFinished, setAnalysisFinished] = useState(false);

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

        // Trigger finish animation
        setAnalysisFinished(true);
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
                    // If already scored, we can skip animation or show it briefly?
                    // For better UX, let's just show it briefly so transition is smooth
                    // or if it's instant, maybe just setAnalysisFinished(true) immediately.
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
                // setLoading(false); // We don't turn off loading here anymore, we wait for animation
            }
        };

        loadResult();
    }, [id]);

    // Handler for when animation is done (100% progress)
    const handleAnimationComplete = () => {
        setLoading(false);
        setScoring(false);
    };

    if (loading || scoring) {
        return (
            <WritingAnalysisLoading
                isFinished={analysisFinished}
                onAnimationComplete={handleAnimationComplete}
            />
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
