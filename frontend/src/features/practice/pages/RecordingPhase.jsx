import React, { useEffect, useMemo, useRef, useState } from 'react';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import MicRounded from '@mui/icons-material/MicRounded';
import StopCircleOutlined from '@mui/icons-material/StopCircleOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import { useNotification } from '@/shared/context/NotificationContext';
import './RecordingPhase.css';

const AUTO_RESUME_FALLBACK_MS = 20000;
const AUDIO_BITS_PER_SECOND = 64000;
const CHUNK_TIMESLICE_MS = 1000;
const WAVE_BAR_COUNT = 15;
const BASE_WAVE_LEVELS = [14, 28, 22, 36, 18, 42, 28, 16, 24, 12, 40, 26, 15, 30, 20];

const normalizeSpeakingPart = (value) => {
  const parsed = Number(value);
  if ([1, 2, 3].includes(parsed)) return parsed;

  const normalized = String(value || '').trim().toLowerCase();
  if (['part1', 'part 1', 'p1'].includes(normalized)) return 1;
  if (['part2', 'part 2', 'p2'].includes(normalized)) return 2;
  if (['part3', 'part 3', 'p3'].includes(normalized)) return 3;
  return 0;
};

const getSupportedRecordingMimeType = () => {
  if (typeof window === 'undefined' || !window.MediaRecorder?.isTypeSupported) {
    return null;
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];

  return candidates.find((type) => window.MediaRecorder.isTypeSupported(type)) || null;
};

const toConversationQuestions = (topic) => {
  const part = normalizeSpeakingPart(topic?.part);
  if (part !== 3) return [];

  const scriptedQuestions = Array.isArray(topic?.conversation_script?.questions)
    ? topic.conversation_script.questions
    : [];

  if (scriptedQuestions.length > 0) {
    return scriptedQuestions
      .map((item, index) => ({
        key: `${item.type || 'q'}-${index}`,
        text: String(item?.text || '').trim(),
        audioUrl: item?.audio_url || null,
      }))
      .filter((item) => item.text);
  }

  const fallback = [];
  const prompt = String(topic?.prompt || '').trim();
  if (prompt) {
    fallback.push({ key: 'prompt-0', text: prompt, audioUrl: null });
  }

  (topic?.sub_questions || []).forEach((question, index) => {
    const text = String(question || '').trim();
    if (!text) return;
    fallback.push({ key: `sub-${index}`, text, audioUrl: null });
  });

  return fallback;
};

const toCueCardBullets = (topic) => {
  const normalizeLines = (value = '') => String(value || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\-*•]+/, '').trim())
    .filter(Boolean);

  const cueCard = topic?.cue_card;
  if (Array.isArray(cueCard) && cueCard.length > 0) {
    const normalized = cueCard
      .map((item) => String(item || '').replace(/^[\s\-*•]+/, '').trim())
      .filter(Boolean);
    if (normalized.length > 0) return normalized;
  }

  if (typeof cueCard === 'string' && cueCard.trim()) {
    const normalized = normalizeLines(cueCard);
    if (normalized.length > 0) return normalized;
  }

  const fallbackSubQuestions = Array.isArray(topic?.sub_questions) ? topic.sub_questions : [];
  return fallbackSubQuestions
    .map((item) => String(item || '').replace(/^[\s\-*•]+/, '').trim())
    .filter(Boolean);
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function RecordingPhase({ topic, onComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isRecorderPaused, setIsRecorderPaused] = useState(false);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [waveLevels, setWaveLevels] = useState(BASE_WAVE_LEVELS);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const autoResumeTimeoutRef = useRef(null);
  const questionAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  const conversationQuestions = useMemo(() => toConversationQuestions(topic), [topic]);
  const topicPart = normalizeSpeakingPart(topic?.part);
  const isPart3Conversational = topicPart === 3 && conversationQuestions.length > 1;
  const currentQuestion = isPart3Conversational ? conversationQuestions[questionIndex] : null;
  const atLastConversationQuestion = !isPart3Conversational || questionIndex >= conversationQuestions.length - 1;
  const cueBullets = useMemo(() => {
    return toCueCardBullets(topic);
  }, [topic]);
  const { showNotification } = useNotification();

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = setInterval(() => {
      setRecordingTime((value) => value + 1);
    }, 1000);
  };

  const clearAutoResumeTimeout = () => {
    if (autoResumeTimeoutRef.current) {
      clearTimeout(autoResumeTimeoutRef.current);
      autoResumeTimeoutRef.current = null;
    }
  };

  const clearWaveAnimation = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const resetQuestionFlow = () => {
    setQuestionIndex(0);
    setIsRecorderPaused(false);
    setIsAutoAdvancing(false);
    clearAutoResumeTimeout();
  };

  useEffect(() => {
    resetQuestionFlow();
    setAudioBlob(null);
    setRecordingTime(0);
    setIsRecording(false);
    setWaveLevels(BASE_WAVE_LEVELS);
  }, [topic?._id]);

  useEffect(() => {
    if (!audioBlob) {
      setAudioPreviewUrl('');
      return undefined;
    }

    const nextUrl = URL.createObjectURL(audioBlob);
    setAudioPreviewUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [audioBlob]);

  useEffect(() => () => {
    clearTimer();
    clearAutoResumeTimeout();
    clearWaveAnimation();
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
    }
  }, []);

  const visualize = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const step = Math.max(1, Math.floor(bufferLength / WAVE_BAR_COUNT));
      const nextLevels = Array.from({ length: WAVE_BAR_COUNT }, (_, index) => {
        const sample = dataArray[index * step] || 0;
        return Math.max(10, Math.min(70, Math.round((sample / 255) * 70)));
      });
      setWaveLevels(nextLevels);
    };

    draw();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      audioContext.createMediaStreamSource(stream).connect(analyser);

      const supportedMimeType = getSupportedRecordingMimeType();
      const recorderOptions = {
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        ...(supportedMimeType ? { mimeType: supportedMimeType } : {}),
      };

      mediaRecorderRef.current = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
        clearWaveAnimation();
        setWaveLevels(BASE_WAVE_LEVELS);
      };

      mediaRecorderRef.current.start(CHUNK_TIMESLICE_MS);
      setAudioBlob(null);
      setAudioPreviewUrl('');
      setIsRecording(true);
      setIsRecorderPaused(false);
      setIsAutoAdvancing(false);
      setRecordingTime(0);
      setWaveLevels(BASE_WAVE_LEVELS);
      startTimer();
      visualize();
    } catch (error) {
      console.error('Mic access denied:', error);
      showNotification('Please allow microphone access to record your answer.', 'warning');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setIsRecorderPaused(false);
    setIsAutoAdvancing(false);
    clearTimer();
    clearAutoResumeTimeout();
  };

  const resumeRecordingAfterAdvance = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecorderPaused(false);
      setIsAutoAdvancing(false);
      clearAutoResumeTimeout();
      return;
    }

    try {
      if (recorder.state === 'paused') {
        recorder.resume();
      }
    } catch (error) {
      console.error('Failed to resume recorder:', error);
    }

    setIsRecorderPaused(false);
    setIsAutoAdvancing(false);
    clearAutoResumeTimeout();
    startTimer();
  };

  const pauseAndGoNextQuestion = () => {
    if (!isPart3Conversational || !isRecording || isRecorderPaused || isAutoAdvancing || atLastConversationQuestion) return;
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    try {
      if (recorder.state === 'recording') {
        recorder.pause();
      }
    } catch (error) {
      console.error('Failed to pause recorder:', error);
    }

    setIsRecorderPaused(true);
    setIsAutoAdvancing(true);
    clearTimer();
    setQuestionIndex((value) => Math.min(value + 1, conversationQuestions.length - 1));
  };

  useEffect(() => {
    if (!isPart3Conversational || !isAutoAdvancing || !isRecording) return undefined;

    const audioEl = questionAudioRef.current;
    let removed = false;

    const completeAdvance = () => {
      if (removed) return;
      resumeRecordingAfterAdvance();
    };

    clearAutoResumeTimeout();
    autoResumeTimeoutRef.current = setTimeout(() => {
      completeAdvance();
    }, AUTO_RESUME_FALLBACK_MS);

    if (!currentQuestion?.audioUrl || !audioEl) {
      setTimeout(() => completeAdvance(), 600);
      return () => {
        removed = true;
        clearAutoResumeTimeout();
      };
    }

    const onEnded = () => completeAdvance();
    const onError = () => completeAdvance();

    audioEl.addEventListener('ended', onEnded);
    audioEl.addEventListener('error', onError);

    audioEl.currentTime = 0;
    audioEl.play().catch(() => {
      setTimeout(() => completeAdvance(), 600);
    });

    return () => {
      removed = true;
      audioEl.removeEventListener('ended', onEnded);
      audioEl.removeEventListener('error', onError);
      clearAutoResumeTimeout();
    };
  }, [currentQuestion?.audioUrl, isAutoAdvancing, isPart3Conversational, isRecording]);

  const resetForRetry = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setWaveLevels(BASE_WAVE_LEVELS);
    resetQuestionFlow();
  };

  const statusLabel = isRecording && !isRecorderPaused
    ? 'Recording'
    : isRecorderPaused || isAutoAdvancing
      ? 'Paused'
      : audioBlob
        ? 'Recorded'
        : 'Ready';

  const statusDescription = isRecording
    ? (isPart3Conversational
      ? 'Answer the current question, then tap Pause & Next Question.'
      : 'Speak clearly into your microphone...')
    : audioBlob
      ? 'Review your recording and submit for AI grading.'
      : 'Tap the microphone to start recording.';

  const tipText = isPart3Conversational
    ? 'Tip: For each question, answer naturally then use "Pause & Next Question". Recording resumes automatically.'
    : (topicPart === 2
      ? 'Tip: You have 1 minute to prepare your notes. Use bullet points to structure your answer.'
      : (topicPart === 1
        ? 'Tip: Keep answers concise (2-3 sentences), direct, and personal.'
        : 'Tip: Give clear opinions, explain your reasoning, and add a short example.'));

  const topicLabel = String(topic?.title || 'General').trim() || 'General';
  const part2QuestionTitle = String(
    topic?.part2_question_title || topic?.prompt || topic?.title || 'Speaking prompt unavailable',
  ).trim();
  const promptListLabel = topicPart === 2
    ? 'You should say:'
    : (topicPart === 1 ? 'Common questions:' : (topicPart === 3 ? 'Discussion points:' : 'Prompts:'));
  const emptyPromptMessage = topicPart === 2
    ? 'No cue card bullets available for this topic yet.'
    : 'No follow-up prompts available for this topic yet.';
  const taskKicker = topicPart === 3
    ? (isPart3Conversational ? 'Conversation Task' : 'Discussion Task')
    : (topicPart === 2 ? 'Cue Card Task' : (topicPart === 1 ? 'Introduction Task' : 'Speaking Task'));
  const cueHeading = isPart3Conversational
    ? String(currentQuestion?.text || topic?.prompt || 'Speaking prompt unavailable')
    : (topicPart === 2
      ? part2QuestionTitle
      : String(topic?.title || topic?.prompt || 'Speaking prompt unavailable'));

  return (
    <section className="rp2-page">
      <div className="rp2-shell">
        <div className="rp2-grid">
          <article className="rp2-card rp2-card--prompt">
            <div className="rp2-card-topline" />
            <div className="rp2-card-head">
              <span className="rp2-kicker">{taskKicker}</span>
              <span className="rp2-topic-badge">Topic: {topicLabel}</span>
            </div>

            <h2 className="rp2-title">{cueHeading}</h2>

            <div className="rp2-body">
              {isPart3Conversational ? (
                <>
                  <p className="rp2-part3-counter">
                    Question {questionIndex + 1} / {conversationQuestions.length}
                  </p>
                  {currentQuestion?.audioUrl ? (
                    <audio
                      ref={questionAudioRef}
                      key={`${currentQuestion.key}-${currentQuestion.audioUrl}`}
                      src={currentQuestion.audioUrl}
                      controls={!isRecording}
                      preload="auto"
                      className={`rp2-question-audio ${isRecording ? 'rp2-question-audio--hidden' : ''}`}
                    />
                  ) : (
                    <p className="rp2-audio-note">Read-aloud audio is not available yet for this question.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="rp2-bullet-title">{promptListLabel}</p>
                  {cueBullets.length > 0 ? (
                    <ul className="rp2-bullets">
                      {cueBullets.map((item, index) => (
                        <li key={`bullet-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rp2-audio-note">{emptyPromptMessage}</p>
                  )}
                </>
              )}
            </div>

            <div className="rp2-tip">
              <LightbulbOutlined className="rp2-tip-icon" />
              <p>{tipText}</p>
            </div>
          </article>

          <article className="rp2-card rp2-card--record">
            <div className="rp2-record-indicator" aria-live="polite">
              <span className={`rp2-dot ${isRecording && !isRecorderPaused ? 'is-live' : ''}`} />
              <span>{statusLabel}</span>
            </div>

            <div className="rp2-mic-stage">
              <div className="rp2-pulse rp2-pulse--outer" />
              <div className="rp2-pulse rp2-pulse--inner" />
              <button
                type="button"
                className="rp2-mic-btn"
                onClick={startRecording}
                disabled={isRecording || Boolean(audioBlob)}
                aria-label="Start recording"
              >
                <MicRounded />
              </button>
            </div>

            <div className={`rp2-wave ${isRecording && !isRecorderPaused ? 'is-live' : ''}`} aria-hidden="true">
              {waveLevels.map((height, index) => (
                <span
                  key={`wave-${index}`}
                  className="rp2-wave-bar"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>

            <p className="rp2-status-text">{statusDescription}</p>
            <p className="rp2-time">{formatTime(recordingTime)}</p>

            {isRecording ? (
              <div className="rp2-action-row">
                <button
                  type="button"
                  className="rp2-btn rp2-btn--ghost-danger"
                  onClick={stopRecording}
                  aria-label="Stop recording"
                >
                  <StopCircleOutlined />
                  Stop Recording
                </button>

                {isPart3Conversational && !atLastConversationQuestion ? (
                  <button
                    type="button"
                    className="rp2-btn rp2-btn--primary-outline"
                    onClick={pauseAndGoNextQuestion}
                    disabled={isRecorderPaused || isAutoAdvancing}
                    aria-label="Pause and go to next question"
                  >
                    {isAutoAdvancing ? 'Loading Next Question...' : 'Pause & Next Question'}
                    <ArrowForwardOutlined />
                  </button>
                ) : null}
              </div>
            ) : null}

            {audioBlob && !isRecording ? (
              <>
                <audio src={audioPreviewUrl} controls className="rp2-audio-preview" />
                {isPart3Conversational && !atLastConversationQuestion ? (
                  <p className="rp2-warning">
                    You have not reached the last question yet. Please record again and use Pause & Next Question.
                  </p>
                ) : null}
                <div className="rp2-action-row">
                  <button
                    type="button"
                    className="rp2-btn rp2-btn--outline"
                    onClick={resetForRetry}
                  >
                    Record Again
                  </button>
                  <button
                    type="button"
                    className="rp2-btn rp2-btn--submit"
                    onClick={() => onComplete(audioBlob)}
                    disabled={!atLastConversationQuestion}
                    title={atLastConversationQuestion ? '' : 'Please finish all Part 3 questions before submitting.'}
                  >
                    Submit for AI Grading
                  </button>
                </div>
              </>
            ) : null}
          </article>
        </div>
      </div>
    </section>
  );
}
