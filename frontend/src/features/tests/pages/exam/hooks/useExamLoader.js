import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/shared/api/client';

export default function useExamLoader(examId) {
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadSeq, setReloadSeq] = useState(0);
  const requestSeqRef = useRef(0);

  const reload = useCallback(() => {
    setReloadSeq((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!examId) {
      setExam(null);
      setLoading(false);
      setError('Missing exam id.');
      return undefined;
    }

    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .getExam(examId, controller ? { signal: controller.signal } : {})
      .then((response) => {
        if (cancelled || requestSeq !== requestSeqRef.current) return;
        setExam(response?.data || null);
        setError(null);
      })
      .catch((err) => {
        if (cancelled || requestSeq !== requestSeqRef.current) return;
        if (err?.name === 'AbortError') return;
        setExam(null);
        setError(err?.message || 'Failed to load exam.');
      })
      .finally(() => {
        if (cancelled || requestSeq !== requestSeqRef.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (controller) {
        controller.abort();
      }
    };
  }, [examId, reloadSeq]);

  return {
    exam,
    loading,
    error,
    reload,
  };
}
