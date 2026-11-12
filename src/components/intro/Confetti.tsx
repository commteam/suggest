import { useEffect, useRef } from 'react';
import { canvasDpr, particleBudget } from '@/lib/perf';
import { CONFETTI_MS } from './introConfig';

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  shape: 0 | 1;
  wobble: number;
}

/**
 * 금색·아이보리·스카이블루 색종이. burstKey 가 바뀔 때마다 한 번 터집니다.
 * scale 로 양을 조절(발표 모드 개별 공개는 작게).
 */
export function Confetti({ burstKey, scale = 1, originX = 0.5 }: { burstKey: number; scale?: number; originX?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!burstKey) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = canvasDpr();
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() || '#d9b45a';
    const colors = [accent, accent, '#f3d98b', '#f4ecd8', '#fffaf0', '#5b8def', '#9cc0ff'];
    const n = Math.round(260 * particleBudget() * scale);
    const pieces: Piece[] = Array.from({ length: n }, (_, i) => {
      const fromSide = scale >= 1 && i % 3 !== 0;
      const left = i % 2 === 0;
      return {
        x: fromSide ? (left ? -10 : w + 10) : w * originX + (Math.random() - 0.5) * w * 0.5,
        y: fromSide ? h * (0.55 + Math.random() * 0.3) : -20 - Math.random() * h * 0.3,
        vx: fromSide ? (left ? 1 : -1) * (4 + Math.random() * 7) : (Math.random() - 0.5) * 3,
        vy: fromSide ? -(9 + Math.random() * 9) : 1 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() < 0.8 ? 0 : 1,
        wobble: Math.random() * Math.PI * 2,
      };
    });
    const start = performance.now();
    let last = start;
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(48, now - last) / 16.67;
      last = now;
      const elapsed = now - start;
      const fade = elapsed > CONFETTI_MS - 1200 ? Math.max(0, (CONFETTI_MS - elapsed) / 1200) : 1;
      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of pieces) {
        p.vy += 0.22 * dt;
        p.vx *= Math.pow(0.985, dt);
        p.vy = Math.min(p.vy, 4.2);
        p.wobble += 0.12 * dt;
        p.x += (p.vx + Math.sin(p.wobble) * 0.8) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > h + 30) continue;
        alive++;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.wobble));
        ctx.fillStyle = p.color;
        if (p.shape === 0) ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (alive > 0 && elapsed < CONFETTI_MS) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  }, [burstKey, scale, originX]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[70] h-full w-full" />;
}
