import { useState, useEffect, useRef } from 'react';

/** Enhanced audio player for IELTS listening with volume control */
export default function IELTSAudioPlayer({ audioUrl }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });

    // Auto-play as per IELTS test
    audio.play().then(() => {
      setIsPlaying(true);
    }).catch(err => {
      console.error('Audio autoplay failed:', err);
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

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
    <div className="ielts-audio-player">
      <div className="audio-progress-container">
        <div className="audio-progress-bar">
          <div className="audio-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="audio-time-display">
          <span>{formatTime(currentTime)} </span>
          <span style={{ color: isPlaying ? '#22c55e' : '#6b7280' }}>
            {isPlaying ? '▶ Playing...' : '⏸ Paused'}
          </span>
          <span> {formatTime(duration)}</span>
        </div>
      </div>
      
      <div className="audio-volume-control">
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
    </div>
  );
}
