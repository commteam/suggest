import { describe, expect, it, vi } from 'vitest';
import { createAutostart, FALLBACK_GESTURE_EVENTS, GESTURE_EVENTS } from './autostart';

function setup(opts: { allowed?: boolean; running?: boolean[] } = {}) {
  const target = new EventTarget();
  const add = vi.spyOn(target, 'addEventListener');
  const remove = vi.spyOn(target, 'removeEventListener');
  const runningSeq = [...(opts.running ?? [true])];
  const deps = {
    probe: vi.fn(async () => opts.allowed ?? false),
    startWithoutGesture: vi.fn(),
    startFromGesture: vi.fn(),
    isRunning: vi.fn(async () => (runningSeq.length > 1 ? runningSeq.shift()! : runningSeq[0])),
    onBlockedChange: vi.fn(),
    target,
  };
  const a = createAutostart(deps);
  return { a, deps, target, add, remove };
}
const fire = (t: EventTarget, type: string) => t.dispatchEvent(new Event(type));
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('배경음악 자동 시작', () => {
  it('자동 재생이 허용되면 바로 재생하고 리스너·안내 없음', async () => {
    const { a, deps, remove } = setup({ allowed: true });
    expect(await a.begin()).toBe('playing');
    expect(deps.startWithoutGesture).toHaveBeenCalledTimes(1);
    expect(deps.startFromGesture).not.toHaveBeenCalled();
    expect(deps.onBlockedChange).not.toHaveBeenCalledWith(true);
    expect(a.listening).toBe(false);
    expect(remove).toHaveBeenCalled();
  });

  it('차단되면 조용히 실패하고 첫 조작 리스너 등록 + 안내 표시', async () => {
    const { a, deps, add } = setup({ allowed: false });
    expect(await a.begin()).toBe('blocked');
    expect(deps.startWithoutGesture).not.toHaveBeenCalled();
    expect(deps.onBlockedChange).toHaveBeenLastCalledWith(true);
    const types = add.mock.calls.map((c) => c[0]);
    for (const e of [...GESTURE_EVENTS, ...FALLBACK_GESTURE_EVENTS]) expect(types).toContain(e);
    // 캡처 + passive (다른 버튼 동작을 막지 않음)
    expect(add.mock.calls[0][2]).toMatchObject({ capture: true, passive: true });
  });

  it.each(GESTURE_EVENTS)('차단 후 화면 어디서든 첫 %s 에서 음악 시작, 이후 리스너 제거·안내 숨김', async (ev) => {
    const { a, deps, target } = setup({ allowed: false });
    await a.begin();
    fire(target, ev);
    expect(deps.startFromGesture).toHaveBeenCalledTimes(1);
    await flush();
    expect(a.listening).toBe(false);
    expect(deps.onBlockedChange).toHaveBeenLastCalledWith(false);
    fire(target, 'pointerdown');
    expect(deps.startFromGesture).toHaveBeenCalledTimes(1); // 한 번만
  });

  it('touchstart 로 아직 소리가 안 나면 리스너 유지, 다음 touchend 에서 시작', async () => {
    const { a, deps, target } = setup({ allowed: false, running: [false, true] });
    await a.begin();
    fire(target, 'touchstart');
    await flush();
    expect(a.listening).toBe(true);
    expect(deps.onBlockedChange).not.toHaveBeenCalledWith(false);
    fire(target, 'touchend');
    await flush();
    expect(deps.startFromGesture).toHaveBeenCalledTimes(2);
    expect(a.listening).toBe(false);
    expect(deps.onBlockedChange).toHaveBeenLastCalledWith(false);
  });

  it('probe 예외도 차단으로 처리', async () => {
    const { a, deps } = setup();
    deps.probe.mockRejectedValueOnce(new DOMException('x', 'NotAllowedError'));
    expect(await a.begin()).toBe('blocked');
  });

  it('허용으로 판단했지만 실제로 소리가 안 나면 차단으로 처리', async () => {
    const { a, deps } = setup({ allowed: true, running: [false] });
    expect(await a.begin()).toBe('blocked');
    expect(deps.onBlockedChange).toHaveBeenLastCalledWith(true);
  });

  it('확인하는 동안 들어온 조작도 놓치지 않음', async () => {
    let resolveProbe: (v: boolean) => void = () => undefined;
    const { a, deps, target } = setup();
    deps.probe.mockImplementationOnce(() => new Promise<boolean>((r) => (resolveProbe = r)));
    const p = a.begin();
    fire(target, 'keydown');
    await flush();
    resolveProbe(false);
    expect(await p).toBe('playing');
    expect(deps.onBlockedChange).not.toHaveBeenCalledWith(true);
  });

  it('dispose 하면 리스너 제거, 이후 조작 무시', async () => {
    const { a, deps, target } = setup({ allowed: false });
    await a.begin();
    a.dispose();
    fire(target, 'pointerdown');
    expect(deps.startFromGesture).not.toHaveBeenCalled();
    expect(a.listening).toBe(false);
  });

  it('dispose 후 시작된 확인은 cancelled', async () => {
    const { a } = setup({ allowed: true });
    const p = a.begin();
    a.dispose();
    expect(await p).toBe('cancelled');
  });
});
