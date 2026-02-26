import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import WritingAnalysisLoading from './WritingAnalysisLoading';
import WritingFastResultView from './WritingFastResultView';
import WritingDetailResultView from './WritingDetailResultView';
import './WritingAIResult.css';

const WRITING_AI_TIMER_KEY_PREFIX = 'writing-ai-start:';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatElapsed = (totalSeconds) => {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const hasDetailResult = (submission) =>
  Boolean(
    submission?.ai_result &&
    (submission?.is_ai_graded || submission?.scoring_state === 'detail_ready' || submission?.status === 'scored'),
  );

const hasFastResult = (submission) =>
  Boolean(
    submission?.ai_fast_result &&
    (submission?.is_ai_fast_graded || submission?.scoring_state === 'fast_ready' || submission?.scoring_state === 'detail_processing'),
  );

const mapFastResult = (submission) => ({
  ...submission.ai_fast_result,
  task_title: submission?.writing_answers?.[0]?.task_title || '',
});

const mapDetailResult = (submission) => {
  const raw = submission?.ai_result || {};
  const hasTaskArray = Array.isArray(raw?.tasks) && raw.tasks.length > 0;
  const selectedTask = hasTaskArray
    ? raw.tasks.find((task) => task?.task_type === 'task2') || raw.tasks[0]
    : null;
  const selectedResult = selectedTask?.result || raw;
  const answer = submission?.writing_answers?.[0] || null;

  return {
    band_score: Number.isFinite(Number(selectedTask?.band_score))
      ? Number(selectedTask.band_score)
      : Number(selectedResult?.band_score || raw?.band_score || 0),
    criteria_scores: selectedResult?.criteria_scores || raw?.criteria_scores || {},
    feedback: selectedResult?.feedback || raw?.feedback || [],
    analysis: {
      task_response: Array.isArray(selectedResult?.task_response) ? selectedResult.task_response : [],
      coherence_cohesion: Array.isArray(selectedResult?.coherence_cohesion) ? selectedResult.coherence_cohesion : [],
      lexical_resource: Array.isArray(selectedResult?.lexical_resource) ? selectedResult.lexical_resource : [],
      grammatical_range_accuracy: Array.isArray(selectedResult?.grammatical_range_accuracy)
        ? selectedResult.grammatical_range_accuracy
        : [],
    },
    task_title: selectedTask?.task_title || answer?.task_title || '',
    task_prompt: selectedTask?.task_prompt || '',
    prompt_text: selectedTask?.prompt || raw?.prompt || '',
    fullEssay: answer?.answer_text || '',
  };
};

export default function WritingAIResult() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [viewMode, setViewMode] = useState('fast');
  const [fastResult, setFastResult] = useState(null);
  const [detailResult, setDetailResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analysisFinished, setAnalysisFinished] = useState(false);
  const [error, setError] = useState('');
  const [fastError, setFastError] = useState('');
  const [waitStartedAt, setWaitStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timerKey = useMemo(() => (id ? `${WRITING_AI_TIMER_KEY_PREFIX}${id}` : null), [id]);

  const updateTimerStart = useCallback(() => {
    if (!timerKey) return;
    const now = Date.now();
    let startedAt = now;
    try {
      const stored = Number(sessionStorage.getItem(timerKey));
      if (Number.isFinite(stored) && stored > 0) {
        startedAt = stored;
      } else {
        sessionStorage.setItem(timerKey, String(now));
      }
    } catch {
      startedAt = now;
    }
    setWaitStartedAt(startedAt);
    setElapsedSeconds(Math.max(0, Math.floor((now - startedAt) / 1000)));
  }, [timerKey]);

  useEffect(() => {
    if (!waitStartedAt || !detailLoading) return undefined;

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - waitStartedAt) / 1000)));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [waitStartedAt, detailLoading]);

  const fetchStatus = useCallback(async () => {
    const response = await api.getSubmissionStatus(id);
    const nextSubmission = response?.data || null;
    if (!nextSubmission) {
      throw new Error('Submission not found');
    }
    setSubmission(nextSubmission);
    return nextSubmission;
  }, [id]);

  const applyFastView = useCallback((nextSubmission) => {
    if (!hasFastResult(nextSubmission)) return false;
    setFastResult(mapFastResult(nextSubmission));
    setViewMode('fast');
    return true;
  }, []);

  const applyDetailView = useCallback((nextSubmission) => {
    if (!hasDetailResult(nextSubmission)) return false;
    setDetailResult(mapDetailResult(nextSubmission));
    setViewMode('detail');
    return true;
  }, []);

  const pollUntilDetailReady = useCallback(async () => {
    const maxAttempts = 120; // around 4 minutes
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const current = await fetchStatus();
      if (hasDetailResult(current)) {
        return current;
      }
      if (current?.status === 'failed' || current?.scoring_state === 'failed') {
        throw new Error('Detailed scoring failed. Please retry.');
      }
      await wait(2000);
    }
    throw new Error('Detailed scoring is taking longer than expected.');
  }, [fetchStatus]);

  const triggerFastScoring = useCallback(async () => {
    const response = await api.scoreSubmissionAIFast(id);
    const nextSubmission = response?.data || null;
    if (!nextSubmission) {
      throw new Error('Fast scoring did not return any result.');
    }
    setSubmission(nextSubmission);
    return nextSubmission;
  }, [id]);

  const startDetailScoring = useCallback(async () => {
    setFastError('');
    setError('');
    setAnalysisFinished(false);
    setDetailLoading(true);
    updateTimerStart();

    try {
      const response = await api.scoreSubmissionAI(id);
      const payload = response?.data || {};

      if (payload?.queued || payload?.status === 'processing' || payload?.scoring_state === 'detail_processing') {
        const doneSubmission = await pollUntilDetailReady();
        applyDetailView(doneSubmission);
      } else if (hasDetailResult(payload)) {
        setSubmission(payload);
        applyDetailView(payload);
      } else {
        const refreshed = await fetchStatus();
        if (!applyDetailView(refreshed)) {
          throw new Error('Detailed scoring result is unavailable.');
        }
      }

      setAnalysisFinished(true);
    } catch (detailError) {
      setDetailLoading(false);
      setAnalysisFinished(false);
      setError(detailError?.message || 'Detailed scoring failed.');
    }
  }, [applyDetailView, fetchStatus, id, pollUntilDetailReady, updateTimerStart]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      setError('');
      setFastError('');

      try {
        const current = await fetchStatus();
        if (cancelled) return;

        if (applyDetailView(current)) return;

        if (current?.scoring_state === 'detail_processing') {
          setDetailLoading(true);
          updateTimerStart();
          const doneSubmission = await pollUntilDetailReady();
          if (cancelled) return;
          applyDetailView(doneSubmission);
          setAnalysisFinished(true);
          return;
        }

        if (applyFastView(current)) return;

        const fastSubmission = await triggerFastScoring();
        if (cancelled) return;

        if (!applyFastView(fastSubmission)) {
          setFastError('Fast scoring returned empty result. Please retry.');
        }
      } catch (bootError) {
        if (!cancelled) {
          setDetailLoading(false);
          setAnalysisFinished(false);
          setError(bootError?.message || 'Failed to load writing AI result.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [applyDetailView, applyFastView, fetchStatus, id, pollUntilDetailReady, triggerFastScoring, updateTimerStart]);

  const handleDetailAnimationComplete = useCallback(() => {
    setDetailLoading(false);
    if (timerKey) {
      try {
        sessionStorage.removeItem(timerKey);
      } catch {
        // ignore storage errors
      }
    }
  }, [timerKey]);

  if (loading) {
    return (
      <div className="writing-ai-shell">
        <div className="writing-ai-container">
          <section className="writing-fast-banner">
            <h2>Loading Writing AI Result</h2>
            <p>Please wait while we prepare your scoring data.</p>
          </section>
        </div>
      </div>
    );
  }

  if (error && !fastResult && !detailResult) {
    return (
      <div className="writing-ai-shell">
        <div className="writing-ai-container">
          <section className="writing-fast-error">
            <p>{error}</p>
            <button type="button" onClick={() => navigate('/tests')}>Back to Dashboard</button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <>
      {viewMode === 'detail' && detailResult ? (
        <WritingDetailResultView
          submission={submission}
          detailResult={detailResult}
          onBack={() => navigate('/tests')}
        />
      ) : (
        <WritingFastResultView
          submission={submission}
          fastResult={fastResult || { criteria_scores: {} }}
          onBack={() => navigate('/tests')}
          onRequestDetail={startDetailScoring}
          onRetryFast={async () => {
            try {
              setFastError('');
              const refreshed = await triggerFastScoring();
              if (!applyFastView(refreshed)) {
                setFastError('Fast scoring returned empty result. Please retry.');
              }
            } catch (retryError) {
              setFastError(retryError?.message || 'Failed to run fast scoring.');
            }
          }}
          isDetailLoading={detailLoading}
          fastError={fastError}
        />
      )}

      {detailLoading ? (
        <WritingAnalysisLoading
          isFinished={analysisFinished}
          onAnimationComplete={handleDetailAnimationComplete}
          elapsedLabel={formatElapsed(elapsedSeconds)}
        />
      ) : null}
    </>
  );
}
