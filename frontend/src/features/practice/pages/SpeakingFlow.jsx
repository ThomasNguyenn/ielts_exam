import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import RecordingPhase from './RecordingPhase';
import SpeakingResultPhase from './SpeakingResultPhase';
import './Practice.css';

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

const normalizeSpeakingSessionPayload = (response) => {
  if (!response) return {};
  if (response.data?.data) return response.data.data;
  if (response.data) return response.data;
  return response;
};

const getSpeakingSessionId = (payload) => (
  payload?.session_id ||
  payload?._id ||
  payload?.id ||
  null
);

const getPollDelayMs = (attempt) => {
  const jitterMs = Math.floor(Math.random() * 500) - 250;

  if (attempt < 3) {
    return Math.max(1200, 1500 + jitterMs);
  }

  if (attempt < 10) {
    return Math.max(1800, 2400 + jitterMs);
  }

  const baseMs = 3500;
  const backoffMs = Math.min(Math.floor((attempt - 10) / 5) * 800, 3200);
  return Math.max(2500, baseMs + backoffMs + jitterMs);
};

const parseAnalysisObject = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const hasMeaningfulAnalysis = (analysis) => (
  Boolean(analysis) && typeof analysis === 'object' && Object.keys(analysis).length > 0
);

const isUnavailableAnalysisPayload = (analysis) => {
  if (!analysis || typeof analysis !== 'object') return false;

  const generalFeedback = String(analysis?.general_feedback || '').toLowerCase();
  if (
    generalFeedback.includes('ai scoring temporarily unavailable') ||
    generalFeedback.includes('he thong tam thoi khong cham duoc')
  ) {
    return true;
  }

  const scores = [
    Number(analysis?.band_score || 0),
    Number(analysis?.fluency_coherence?.score || 0),
    Number(analysis?.lexical_resource?.score || 0),
    Number(analysis?.grammatical_range?.score || 0),
    Number(analysis?.pronunciation?.score || 0),
  ];

  return scores.every((score) => Number.isFinite(score) && score === 0);
};

const normalizeScoringState = (payload = {}) => {
  const explicit = String(payload?.scoring_state || '').trim().toLowerCase();
  if (explicit) return explicit;

  const status = String(payload?.status || '').trim().toLowerCase();
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'provisional_ready') return 'provisional_ready';
  return 'processing';
};

const buildFallbackAnalysis = () => ({
  band_score: 0,
  general_feedback: 'AI result is unavailable for this attempt.',
  sample_answer: 'N/A',
  fluency_coherence: { score: 0, feedback: 'N/A' },
  lexical_resource: { score: 0, feedback: 'N/A' },
  grammatical_range: { score: 0, feedback: 'N/A' },
  pronunciation: { score: 0, feedback: 'N/A' },
  pronunciation_heatmap: [],
  focus_areas: [],
  intonation_pacing: { pace_wpm: 0, pitch_variation: 'Needs Work', feedback: '' },
  vocabulary_upgrades: [],
  grammar_corrections: [],
  next_step: 'Practice this topic again to generate a detailed report.',
});

const buildSpeakingResultPayload = (payload = {}, fallbackSessionId = null) => {
  const parsedAnalysis = parseAnalysisObject(payload?.analysis);
  const parsedProvisional = parseAnalysisObject(payload?.provisional_analysis);
  const usableFinalAnalysis = hasMeaningfulAnalysis(parsedAnalysis) && !isUnavailableAnalysisPayload(parsedAnalysis);
  const activeAnalysis = usableFinalAnalysis
    ? parsedAnalysis
    : (hasMeaningfulAnalysis(parsedProvisional) ? parsedProvisional : parsedAnalysis);

  return {
    ...payload,
    session_id: getSpeakingSessionId(payload) || fallbackSessionId || null,
    scoring_state: normalizeScoringState(payload),
    transcript: payload?.transcript || '',
    analysis: activeAnalysis || buildFallbackAnalysis(),
    ai_source: payload?.ai_source || null,
    provisional_analysis: parsedProvisional || null,
    provisional_source: payload?.provisional_source || null,
    provisional_ready_at: payload?.provisional_ready_at || null,
  };
};

export default function SpeakingFlow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('recording');
  const [result, setResult] = useState(null);
  const [provisionalSnapshot, setProvisionalSnapshot] = useState(null);
  const [processingStartedAt, setProcessingStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const { showNotification } = useNotification();
  const provisionalNoticeShownRef = useRef(false);

  useEffect(() => {
    if (!id) return;

    api.getSpeakingById(id)
      .then((res) => {
        if (!res?._id) throw new Error('Topic not found');
        setTopic(res);
      })
      .catch((err) => {
        console.error(err);
        navigate('/practice');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (phase !== 'processing' || !processingStartedAt) return undefined;

    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - processingStartedAt) / 1000)));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [phase, processingStartedAt]);

  const syncProvisionalState = (payload = {}, { notify = false } = {}) => {
    const parsedProvisional = parseAnalysisObject(payload?.provisional_analysis);
    if (!hasMeaningfulAnalysis(parsedProvisional)) return;

    setProvisionalSnapshot({
      session_id: getSpeakingSessionId(payload),
      analysis: parsedProvisional,
      source: payload?.provisional_source || null,
      ready_at: payload?.provisional_ready_at || null,
      scoring_state: normalizeScoringState(payload),
    });

    if (notify && !provisionalNoticeShownRef.current) {
      provisionalNoticeShownRef.current = true;
      showNotification('Provisional band is ready. Final AI score is still processing.', 'info');
    }
  };

  const pollSpeakingResult = async (sessionId) => {
    const maxAttempts = 45;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const statusRes = await api.getSpeakingSession(sessionId);
      const session = normalizeSpeakingSessionPayload(statusRes);
      const scoringState = normalizeScoringState(session);
      const legacyStatus = String(session?.status || '').trim().toLowerCase();

      syncProvisionalState(session, { notify: true });

      if (scoringState === 'completed' || legacyStatus === 'completed') {
        setResult(buildSpeakingResultPayload(session, sessionId));
        setProcessingStartedAt(null);
        setPhase('result');
        return;
      }

      if (scoringState === 'failed' || legacyStatus === 'failed') {
        throw new Error('AI grading failed. Please retry.');
      }

      await wait(getPollDelayMs(attempt));
    }

    throw new Error('AI grading timed out. Please check again in a minute.');
  };

  const handleRecordingComplete = async (audioBlob, extraData = {}) => {
    const startedAt = Date.now();
    setProvisionalSnapshot(null);
    provisionalNoticeShownRef.current = false;
    setProcessingStartedAt(startedAt);
    setElapsedSeconds(0);
    setPhase('processing');
    try {
      const formData = new FormData();
      formData.append('questionId', id);
      formData.append('audio', audioBlob, 'speaking-answer.webm');

      if (extraData.transcript) formData.append('transcript', extraData.transcript);
      if (extraData.duration) formData.append('duration', extraData.duration);
      if (extraData.wpm) formData.append('wpm', extraData.wpm);
      if (extraData.stats) {
        formData.append('metrics', JSON.stringify(extraData.stats));
      }

      const res = await api.submitSpeaking(formData);
      const submitPayload = normalizeSpeakingSessionPayload(res);
      const sessionId = getSpeakingSessionId(submitPayload);
      const scoringState = normalizeScoringState(submitPayload);
      const statusValue = String(submitPayload?.status || '').toLowerCase().trim();
      const parsedAnalysis = parseAnalysisObject(submitPayload?.analysis);
      const hasAnalysis = hasMeaningfulAnalysis(parsedAnalysis);

      syncProvisionalState(submitPayload, { notify: true });

      if (scoringState === 'failed' || statusValue === 'failed') {
        throw new Error('AI grading failed. Please retry.');
      }

      const shouldPoll =
        Boolean(sessionId) &&
        !hasAnalysis &&
        (
          submitPayload?.queued === true ||
          scoringState === 'processing' ||
          scoringState === 'provisional_ready' ||
          statusValue === 'processing' ||
          statusValue === 'queued' ||
          statusValue === 'pending' ||
          !statusValue
        );

      if (shouldPoll) {
        await pollSpeakingResult(sessionId);
        return;
      }

      setResult(buildSpeakingResultPayload(submitPayload, sessionId));
      setProcessingStartedAt(null);
      setPhase('result');
    } catch (error) {
      console.error('Submission failed:', error);
      showNotification('Error while processing audio. Please try again.', 'error');
      setProcessingStartedAt(null);
      setPhase('recording');
    }
  };

  if (loading) return <div className="practice-container">Loading topic...</div>;

  const isResultPhase = phase === 'result';
  const containerStyle = {
    maxWidth: isResultPhase ? '1280px' : '900px',
    margin: '2rem auto',
    padding: '0 1rem',
  };
  const contentStyle = isResultPhase
    ? {
      background: 'transparent',
      padding: 0,
      borderRadius: 0,
      boxShadow: 'none',
      border: 'none',
      minHeight: 'unset',
    }
    : {
      background: 'white',
      padding: '2rem',
      borderRadius: '16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
    };

  return (
    <div className="practice-flow-container" style={containerStyle}>
      {!isResultPhase && (
        <div className="practice-header">
          <button onClick={() => navigate('/speaking')} className="btn-ghost" style={{ marginBottom: '1rem' }}>
            {'<-'} Back to list
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span className="badge badge-purple" style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 12px', borderRadius: '50px', fontSize: '0.8rem', fontWeight: 700 }}>
              PART {topic.part}
            </span>
            <h1 style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{topic.title}</h1>
          </div>
        </div>
      )}

      <div className="practice-content" style={contentStyle}>
        {phase === 'recording' && (
          <RecordingPhase
            topic={topic}
            onComplete={handleRecordingComplete}
          />
        )}

        {phase === 'processing' && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ marginBottom: '2rem' }} />
            <h2>AI is grading your speaking answer...</h2>
            <p className="muted">Your submission is queued and being processed in background.</p>
            <p className="muted" style={{ marginTop: '0.75rem', fontWeight: 600 }}>
              Waiting time: {formatElapsed(elapsedSeconds)}
            </p>
            {provisionalSnapshot?.analysis && (
              <div style={{
                marginTop: '1.5rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '1rem 1.25rem',
                textAlign: 'left',
                maxWidth: '640px',
                marginInline: 'auto',
              }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: '#0f172a' }}>Provisional Band Ready</strong>
                  <span style={{
                    background: '#1d4ed8',
                    color: '#fff',
                    fontWeight: 700,
                    borderRadius: '999px',
                    padding: '0.15rem 0.6rem',
                    fontSize: '0.8rem',
                  }}
                  >
                    {provisionalSnapshot.analysis?.band_score ?? '-'}
                  </span>
                </div>
                <p className="muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                  This is a fast estimate ({provisionalSnapshot?.source || 'formula_v1'}). Final score will replace it once AI completes.
                </p>
              </div>
            )}
          </div>
        )}

        {phase === 'result' && (
          <SpeakingResultPhase
            result={result}
            topic={topic}
            onRetry={() => {
              setResult(null);
              setProvisionalSnapshot(null);
              provisionalNoticeShownRef.current = false;
              setProcessingStartedAt(null);
              setElapsedSeconds(0);
              setPhase('recording');
            }}
          />
        )}
      </div>
    </div>
  );
}
