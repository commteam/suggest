import { useEffect, useRef, useState } from 'react';
import { createAutostart } from '@/lib/audio/autostart';
import type { MusicSource } from '@/lib/audio/music/MusicPlayer';
import { sound } from '@/lib/audio/SoundEngine';

/**
 * 공개 사이트가 열리자마자 배경음악을 최대한 빨리 시작합니다.
 * - 소리가 꺼져 있으면(관람자 선택 또는 관리자 기본값) 시도하지 않음
 * - 자동 재생이 허용되면 바로 재생(2초 페이드인)
 * - 차단되면 화면 어디서든 첫 조작에서 시작, 그동안 needsGesture=true (안내 문구 표시용)
 */
export function useMusicAutostart(enabled: boolean, source: MusicSource) {
  const [blocked, setBlocked] = useState(false);
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    if (!enabled) {
      sound.autostartState = 'off';
      return;
    }
    if (sound.musicPlaying) return; // 이미 재생 중(예: 처음 화면으로 돌아옴)
    const start = () => {
      sound.unlock();
      sound.prepareMusic(sourceRef.current);
      sound.startMusic(sourceRef.current);
    };
    const auto = createAutostart({
      probe: () => sound.probeAutoplay(),
      startWithoutGesture: start,
      startFromGesture: start,
      isRunning: () => sound.waitRunning(),
      onBlockedChange: (b) => {
        setBlocked(b);
        sound.autostartState = b ? 'blocked' : 'playing';
      },
    });
    sound.autostartState = 'probing';
    void auto.begin().then((r) => {
      if (r === 'playing') sound.autostartState = 'playing';
    });
    return () => auto.dispose();
  }, [enabled]);

  return { needsGesture: enabled && blocked };
}
