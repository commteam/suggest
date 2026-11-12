import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  buildCues,
  createScheduler,
  FINISHED_INTRO,
  INITIAL_INTRO,
  introReducer,
  type IntroCue,
} from '@/lib/intro/timeline';
import type { IntroMode } from '@/lib/data/types';

interface Options {
  mode: IntroMode;
  length: 'standard' | 'short';
  reduced: boolean;
  /** 처음부터 끝난 상태로 시작 (오프닝 꺼짐/이미 본 경우) */
  startFinished: boolean;
  /** 사운드 등 부수 효과 */
  onCue?: (cue: IntroCue) => void;
  /** 건너뛰기/언마운트 시 오디오 정리 */
  onCancel?: () => void;
  onDone?: () => void;
}

/**
 * 오프닝 타임라인. UI 와 분리된 상태 기계 + 스케줄러.
 * skip() 은 대기 중인 모든 타이머를 취소하고 onCancel 로 오디오를 정리합니다.
 */
export function useIntroTimeline({ mode, length, reduced, startFinished, onCue, onCancel, onDone }: Options) {
  const [state, dispatch] = useReducer(introReducer, startFinished ? FINISHED_INTRO : INITIAL_INTRO);
  const schedulerRef = useRef<ReturnType<typeof createScheduler> | null>(null);
  const cbRef = useRef({ onCue, onCancel, onDone });
  useEffect(() => {
    cbRef.current = { onCue, onCancel, onDone };
  }, [onCue, onCancel, onDone]);

  const cancel = useCallback(() => {
    schedulerRef.current?.cancel();
    schedulerRef.current = null;
  }, []);

  const start = useCallback(() => {
    cancel();
    cbRef.current.onCancel?.();
    dispatch({ type: 'start' });
    const scheduler = createScheduler();
    schedulerRef.current = scheduler;
    scheduler.run(buildCues({ mode, length, reduced }), (cue) => {
      dispatch({ type: 'cue', cue });
      cbRef.current.onCue?.(cue);
      if (cue.type === 'done') {
        schedulerRef.current = null;
        cbRef.current.onDone?.();
      }
    });
  }, [cancel, mode, length, reduced]);

  const skip = useCallback(() => {
    cancel();
    cbRef.current.onCancel?.();
    dispatch({ type: 'finish' });
    cbRef.current.onDone?.();
  }, [cancel]);

  const reset = useCallback(() => {
    cancel();
    cbRef.current.onCancel?.();
    dispatch({ type: 'reset' });
  }, [cancel]);

  const finishSilently = useCallback(() => {
    cancel();
    dispatch({ type: 'finish' });
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { state, start, skip, reset, finishSilently };
}
