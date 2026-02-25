import { useState, useEffect, useRef, useCallback } from 'react';

/** Enhanced audio player for IELTS listening with volume control */
export default function IELTSAudioPlayer({
  audioUrl,
  onEnded,
  initialTimeSec = 0,
  onTimeUpdate,
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const attemptPlay = useCallback((targetAudio = audioRef.current) => {
    if (!targetAudio) return Promise.resolve(false);

    const playPromise = targetAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      return playPromise
        .then(() => {
          if (audioRef.current !== targetAudio) return false;
          setIsPlaying(true);
          setAutoplayBlocked(false);
          return true;
        })
        .catch((err) => {
          if (audioRef.current !== targetAudio) return false;
          if (err?.name === 'AbortError') return false;
          if (err?.name === 'NotAllowedError') {
            setIsPlaying(false);
            setAutoplayBlocked(true);
            return false;
          }
          console.error('Audio autoplay failed:', err);
          setIsPlaying(false);
          return false;
        });
    }

    const playing = !targetAudio.paused;
    if (audioRef.current === targetAudio) {
      setIsPlaying(playing);
      if (playing) {
        setAutoplayBlocked(false);
      }
    }
    return Promise.resolve(playing);
  }, []);

  useEffect(() => {
    if (!audioUrl) return undefined;
    const safeInitialTime = Number.isFinite(initialTimeSec) && initialTimeSec > 0
      ? initialTimeSec
      : 0;
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audio.currentTime = 0;
    audioRef.current = audio;
    setAutoplayBlocked(false);
    setIsPlaying(false);

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      const maxSeekTime = Math.max((audio.duration || 0) - 0.1, 0);
      const seekTime = Math.min(safeInitialTime, maxSeekTime);
      if (seekTime > 0) {
        audio.currentTime = seekTime;
        setCurrentTime(seekTime);
        if (onTimeUpdate) onTimeUpdate(seekTime);
      } else {
        setCurrentTime(0);
        if (onTimeUpdate) onTimeUpdate(0);
      }
    };

    const handleTimeUpdate = () => {
      const nextTime = audio.currentTime;
      setCurrentTime(nextTime);
      if (onTimeUpdate) onTimeUpdate(nextTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    // Auto-play as per IELTS test (fallback handled for blocked autoplay).
    void attemptPlay(audio);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      if (!audio.paused) {
        audio.pause();
      }
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      audio.src = '';
    };
  }, [audioUrl, initialTimeSec, onEnded, onTimeUpdate, attemptPlay]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!autoplayBlocked) return undefined;

    const handleFirstInteraction = () => {
      void attemptPlay();
    };

    window.addEventListener('pointerdown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [autoplayBlocked, attemptPlay]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const getVolumeIcon = () => {
    if (volume === 0) return '🔇';
    if (volume < 0.5) return '🔉';
    return '🔊';
  };

  return (
    <div className="flex justify-center w-[100%]">
      <div className="ielts-audio-player w-[80%]">
        {/* <div className="audio-progress-container flex justify-center flex-col">
          <div className="audio-progress-bar">
            <div className="audio-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="audio-time-display flex justify-center">
            <span>{formatTime(currentTime)} </span>
            <span style={{ color: isPlaying ? '#22c55e' : '#6b7280', padding: '0 10px' }}>
              {isPlaying ? '▶ Playing...' : '⏸ Paused'}
            </span>
            <span> {formatTime(duration)}</span>
          </div>
        </div> */}

        <div className="audio-volume-control flex justify-center">
          <span className="volume-icon">{getVolumeIcon()}</span>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </div>
        {autoplayBlocked && (
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #fefce8 100%)',
              border: '1px solid #bfdbfe',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
            }}
          >
            <div style={{ minWidth: '220px', flex: '1 1 220px' }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: '#1e3a8a',
                }}
              >
                Google Chrome đang chặn autoplay
              </p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '0.82rem',
                  color: '#334155',
                  lineHeight: 1.35,
                }}
              >
                Bấm nút để bắt đầu audio và tiếp tục bài nghe.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void attemptPlay();
              }}
              style={{
                border: '1px solid #2563eb',
                background: '#3b82f6',
                color: '#fff',
                borderRadius: '8px',
                padding: '8px 14px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.25)',
              }}
            >
              Bắt đầu audio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
