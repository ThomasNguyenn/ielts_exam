import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useExamTimer from '../src/features/tests/pages/exam/hooks/useExamTimer';

describe('useExamTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes warning levels by time thresholds', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useExamTimer({
      durationSec: 3600,
      enabled: true,
      onExpire,
    }));

    act(() => {
      result.current.setTimeRemaining(601);
    });
    expect(result.current.warningLevel).toBe('normal');

    act(() => {
      result.current.setTimeRemaining(600);
    });
    expect(result.current.warningLevel).toBe('10min');

    act(() => {
      result.current.setTimeRemaining(300);
    });
    expect(result.current.warningLevel).toBe('5min');
  });

  it('counts down and triggers expire callback once', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useExamTimer({
      durationSec: 120,
      enabled: true,
      onExpire,
    }));

    act(() => {
      result.current.setTimeRemaining(2);
    });

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(result.current.timeRemaining).toBe(0);
    expect(result.current.warningLevel).toBe('expired');
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
