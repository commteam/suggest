import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIntroTimeline } from './useIntroTimeline';

describe('useIntroTimeline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('건너뛰기: 타이머·오디오 정리 후 완료 상태', () => {
    const onCue = vi.fn();
    const onCancel = vi.fn();
    const onDone = vi.fn();
    const { result } = renderHook(() =>
      useIntroTimeline({ mode: 'cinematic', length: 'standard', reduced: false, startFinished: false, onCue, onCancel, onDone }),
    );
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.state.status).toBe('running');
    const cuesSoFar = onCue.mock.calls.length;
    onCancel.mockClear();

    act(() => result.current.skip());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe('done');
    expect(result.current.state.galleryIn).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(onCue.mock.calls.length).toBe(cuesSoFar);
  });

  it('언마운트 시 타이머 정리', () => {
    const { result, unmount } = renderHook(() =>
      useIntroTimeline({ mode: 'cinematic', length: 'short', reduced: false, startFinished: false }),
    );
    act(() => result.current.start());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('바로 입장: 2초 안에 갤러리, 처음 화면으로(reset) 하면 게이트', () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useIntroTimeline({ mode: 'instant', length: 'standard', reduced: false, startFinished: false, onCancel }),
    );
    expect(result.current.state.status).toBe('idle');
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.state.curtainsOpen).toBe(true); // 클릭 직후(0ms) 커튼 열림
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.state.status).toBe('done');
    expect(result.current.state.galleryIn).toBe(true);
    onCancel.mockClear();
    act(() => result.current.reset());
    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.curtainsOpen).toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('다시 시작: 완료 상태에서 다시 시작', () => {
    const { result } = renderHook(() =>
      useIntroTimeline({ mode: 'cinematic', length: 'short', reduced: false, startFinished: true }),
    );
    expect(result.current.state.status).toBe('done');
    act(() => result.current.start());
    expect(result.current.state.status).toBe('running');
    expect(result.current.state.curtainsOpen).toBe(false);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.state.status).toBe('done');
  });
});
