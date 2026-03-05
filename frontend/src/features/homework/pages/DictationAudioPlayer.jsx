import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const formatTime = (seconds) => {
  const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const CustomSlider = ({ value = 0, onChange, className }) => {
  const safeValue = Number.isFinite(Number(value)) ? Math.min(Math.max(Number(value), 0), 100) : 0;

  return (
    <motion.div
      className={cn("relative h-1 w-full cursor-pointer rounded-full bg-white/20", className)}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percentage = (x / rect.width) * 100;
        onChange(Math.min(Math.max(percentage, 0), 100));
      }}
    >
      <motion.div
        className="absolute left-0 top-0 h-full rounded-full bg-white"
        style={{ width: `${safeValue}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${safeValue}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </motion.div>
  );
};

export default function DictationAudioPlayer({ src, title, className }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  const isValidSrc = useMemo(() => String(src || "").trim() !== "", [src]);

  const syncAudioMetrics = () => {
    if (!audioRef.current) return;
    const nextDuration = Number(audioRef.current.duration || 0);
    const nextCurrentTime = Number(audioRef.current.currentTime || 0);
    const nextProgress = nextDuration > 0 ? (nextCurrentTime / nextDuration) * 100 : 0;
    setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
    setCurrentTime(Number.isFinite(nextCurrentTime) ? nextCurrentTime : 0);
    setProgress(Number.isFinite(nextProgress) ? nextProgress : 0);
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const seekToProgress = (value) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const nextTime = (Number(value) / 100) * audioRef.current.duration;
    if (!Number.isFinite(nextTime)) return;
    audioRef.current.currentTime = nextTime;
    syncAudioMetrics();
  };

  const skipBySeconds = (delta) => {
    if (!audioRef.current || !Number.isFinite(Number(delta))) return;
    const nextDuration = Number(audioRef.current.duration || 0);
    const nextCurrentTime = Number(audioRef.current.currentTime || 0);
    const safeDuration = Number.isFinite(nextDuration) ? nextDuration : 0;
    const target = Math.min(Math.max(nextCurrentTime + Number(delta), 0), safeDuration || 0);
    audioRef.current.currentTime = target;
    syncAudioMetrics();
  };

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.loop = isRepeat;
  }, [isRepeat]);

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }
  }, [src]);

  if (!isValidSrc) {
    return (
      <div className={cn("rounded-xl border border-dashed p-3 text-xs text-muted-foreground", className)}>
        Upload or paste an audio URL to preview dictation.
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className={cn(
          "relative mx-auto flex h-auto w-full max-w-[360px] flex-col overflow-hidden rounded-3xl bg-[#11111198] p-3 shadow-[0_0_20px_rgba(0,0,0,0.2)] backdrop-blur-sm",
          className,
        )}
        initial={{ opacity: 0, filter: "blur(10px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(10px)" }}
        transition={{ duration: 0.3, ease: "easeInOut", delay: 0.1, type: "spring" }}
        layout
      >
        <audio
          ref={audioRef}
          onTimeUpdate={syncAudioMetrics}
          onLoadedMetadata={syncAudioMetrics}
          onEnded={() => setIsPlaying(false)}
          src={src}
          className="hidden"
        />

        <motion.div className="relative flex flex-col" layout animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <motion.div className="flex w-full flex-col gap-y-2">
            {title ? <motion.h3 className="mt-1 text-center text-base font-bold text-white">{title}</motion.h3> : null}

            <motion.div className="flex flex-col gap-y-1">
              <CustomSlider value={progress} onChange={seekToProgress} className="w-full" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">{formatTime(currentTime)}</span>
                <span className="text-sm text-white">{formatTime(duration)}</span>
              </div>
            </motion.div>

            <motion.div className="flex w-full items-center justify-center">
              <div className="flex w-fit items-center gap-2 rounded-[16px] bg-[#11111198] p-2">
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsShuffle((prev) => !prev);
                    }}
                    className={cn(
                      "h-8 w-8 rounded-full text-white hover:bg-[#111111d1] hover:text-white",
                      isShuffle && "bg-[#111111d1] text-white",
                    )}
                  >
                    <Shuffle className="h-5 w-5" />
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      skipBySeconds(-10);
                    }}
                    className="h-8 w-8 rounded-full text-white hover:bg-[#111111d1] hover:text-white"
                  >
                    <SkipBack className="h-5 w-5" />
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      void togglePlay();
                    }}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-white hover:bg-[#111111d1] hover:text-white"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      skipBySeconds(10);
                    }}
                    className="h-8 w-8 rounded-full text-white hover:bg-[#111111d1] hover:text-white"
                  >
                    <SkipForward className="h-5 w-5" />
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsRepeat((prev) => !prev);
                    }}
                    className={cn(
                      "h-8 w-8 rounded-full text-white hover:bg-[#111111d1] hover:text-white",
                      isRepeat && "bg-[#111111d1] text-white",
                    )}
                  >
                    <Repeat className="h-5 w-5" />
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
