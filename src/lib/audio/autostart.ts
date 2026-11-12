/**
 * 첫 진입 배경음악 자동 시작 (브라우저와 분리된 순수 로직 — 단위 테스트 대상)
 *
 * 1) 열리자마자 자동 재생이 허용되는지 조용히 확인(probe)하고, 허용되면 바로 재생
 * 2) 차단되면 화면 어디서든 첫 사용자 조작(pointerdown·touchstart·keydown)에서 재생 시작
 *    - 일부 브라우저(Chrome 등)는 touchstart 를 "사용자 활성화"로 치지 않으므로
 *      pointerup·touchend·click 도 예비로 듣고, 실제로 소리가 나기 시작한 뒤에만 리스너를 제거
 * 3) 차단 상태 변화를 onBlockedChange 로 알려 안내 문구를 띄우거나 숨김
 */
export const GESTURE_EVENTS = ['pointerdown', 'touchstart', 'keydown'] as const;
export const FALLBACK_GESTURE_EVENTS = ['pointerup', 'touchend', 'click'] as const;
const ALL_EVENTS = [...GESTURE_EVENTS, ...FALLBACK_GESTURE_EVENTS];

type ListenerTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export interface AutostartDeps {
  /** 사용자 조작 없이 재생할 수 있는지 (실패·예외는 false) */
  probe(): Promise<boolean>;
  /** 자동 재생이 허용됐을 때 */
  startWithoutGesture(): void;
  /** 사용자 조작 이벤트 핸들러 안에서 (같은 호출 스택이어야 브라우저가 허용) */
  startFromGesture(): void;
  /** 실제로 소리가 나는 상태가 됐는지 */
  isRunning(): Promise<boolean>;
  onBlockedChange?(blocked: boolean): void;
  target?: ListenerTarget;
}

export type AutostartResult = 'playing' | 'blocked' | 'cancelled';

export function createAutostart(deps: AutostartDeps) {
  const target: ListenerTarget | undefined = deps.target ?? (typeof window !== 'undefined' ? window : undefined);
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  let disposed = false;
  let listening = false;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    stopListening();
    deps.onBlockedChange?.(false);
  };

  // 버튼 동작을 막지 않음(preventDefault 없음) — 음악만 같이 시작
  const onGesture = () => {
    if (disposed || done) return;
    try {
      deps.startFromGesture();
    } catch {
      return;
    }
    void deps.isRunning().then((ok) => {
      if (ok && !disposed) finish();
    });
  };

  function startListening() {
    if (listening || !target) return;
    listening = true;
    for (const e of ALL_EVENTS) target.addEventListener(e, onGesture, opts);
  }

  function stopListening() {
    if (!listening || !target) return;
    listening = false;
    for (const e of ALL_EVENTS) target.removeEventListener(e, onGesture, opts);
  }

  return {
    /** 자동 재생 시도. 확인하는 동안 들어온 조작도 놓치지 않도록 리스너를 먼저 등록 */
    async begin(): Promise<AutostartResult> {
      if (disposed) return 'cancelled';
      startListening();
      const allowed = await deps.probe().catch(() => false);
      if (disposed) return 'cancelled';
      if (done) return 'playing'; // 확인 중에 사용자가 이미 눌러서 시작됨
      if (allowed) {
        try {
          deps.startWithoutGesture();
          if (await deps.isRunning()) {
            if (!disposed) finish();
            return disposed ? 'cancelled' : 'playing';
          }
        } catch {
          /* 차단으로 처리 */
        }
      }
      if (disposed) return 'cancelled';
      if (!done) deps.onBlockedChange?.(true);
      return done ? 'playing' : 'blocked';
    },
    dispose() {
      disposed = true;
      stopListening();
    },
    get listening() {
      return listening;
    },
  };
}
