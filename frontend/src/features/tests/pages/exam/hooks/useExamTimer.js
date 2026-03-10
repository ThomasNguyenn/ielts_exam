import { useEffect, useMemo, useRef, useState } from 'react';

const getWarningLevel = (timeRemaining) => {
  if (timeRemaining === null) return 'normal';
  if (timeRemaining <= 0) return 'expired';
  if (timeRemaining <= 300) return '5min';
  if (timeRemaining <= 600) return '10min';
  return 'normal';
};

export default function useExamTimer({ durationSec, enabled, onExpire }) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerRef = useRef(null);
  const expireTriggeredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const shouldRun = enabled && timeRemaining !== null && timeRemaining > 0;

    if (!shouldRun) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) return;

    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return prev;

        if (prev <= 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }

          if (!expireTriggeredRef.current) {
            expireTriggeredRef.current = true;
            onExpireRef.current?.();
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);
  }, [enabled, timeRemaining]);

  const warningLevel = useMemo(() => getWarningLevel(timeRemaining), [timeRemaining]);

  const resetTimer = (nextDurationSec = durationSec) => {
    expireTriggeredRef.current = false;
    const value = Number(nextDurationSec);
    setTimeRemaining(Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null);
  };

  const pauseTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    expireTriggeredRef.current = false;
  };

  const expire = () => {
    if (expireTriggeredRef.current) return;
    expireTriggeredRef.current = true;
    setTimeRemaining(0);
    onExpireRef.current?.();
  };

  return {
    timeRemaining,
    warningLevel,
    setTimeRemaining,
    resetTimer,
    startTimer,
    pauseTimer,
    expire,
  };
}
