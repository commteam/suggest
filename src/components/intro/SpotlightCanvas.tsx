import { useEffect, useRef } from 'react';
import { canvasDpr, particleBudget } from '@/lib/perf';

interface Props {
  /** 목표 밝기 0~1 (부드럽게 따라감) */
  intensity: number;
  /** true 면 빔이 중앙으로 모임 */
  focus?: boolean;
  reduced?: boolean;
  className?: string;
}

interface Mote {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  a: number;
}

/** 스포트라이트 3줄기 좌우 스윕 + 빛 속 먼지 */
export function SpotlightCanvas({ intensity, focus = false, reduced = false, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef({ intensity, focus });

  useEffect(() => {
    target.current = { intensity, focus };
  }, [intensity, focus]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = canvasDpr();
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const moteCount = Math.round(90 * particleBudget());
    const motes: Mote[] = Array.from({ length: moteCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.4,
      vy: -0.00004 - Math.random() * 0.00008,
      vx: (Math.random() - 0.5) * 0.00005,
      a: 0.2 + Math.random() * 0.6,
    }));

    let cur = target.current.intensity;
    let focusAmt = target.current.focus ? 1 : 0;
    let raf = 0;
    let last = performance.now();
    const beams = [
      { ox: 0.18, phase: 0, speed: 0.42, base: 0.32 },
      { ox: 0.5, phase: 2.1, speed: 0.35, base: 0 },
      { ox: 0.82, phase: 4.2, speed: 0.47, base: -0.32 },
    ];

    const draw = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const t = now / 1000;
      cur += (target.current.intensity - cur) * Math.min(1, dt / 380);
      focusAmt += ((target.current.focus ? 1 : 0) - focusAmt) * Math.min(1, dt / 700);
      ctx.clearRect(0, 0, w, h);
      if (cur < 0.005) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.globalCompositeOperation = 'lighter';
      const len = Math.hypot(w, h) * 1.15;
      for (const b of beams) {
        const sway = reduced ? 0 : Math.sin(t * b.speed + b.phase) * 0.38;
        // 원점에서 화면 중앙을 향하는 각도로 수렴
        const ox = b.ox * w;
        const oy = -h * 0.08;
        const toCenter = Math.atan2(h * 0.62 - oy, w * 0.5 - ox) - Math.PI / 2;
        const angle = (b.base + sway) * (1 - focusAmt) + toCenter * focusAmt;
        const spread = 0.17 - focusAmt * 0.05;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(angle);
        const g = ctx.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, `rgba(255,255,255,${0.55 * cur})`);
        g.addColorStop(0.25, `rgba(219,232,255,${0.22 * cur})`);
        g.addColorStop(1, 'rgba(219,232,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.lineTo(Math.tan(spread) * len, len);
        ctx.lineTo(-Math.tan(spread) * len, len);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // 바닥 조명 웅덩이
        const fx = ox - Math.sin(angle) * (h * 0.9);
        const fy = h * 0.9;
        const pool = ctx.createRadialGradient(fx, fy, 0, fx, fy, w * 0.16);
        pool.addColorStop(0, `rgba(219,232,255,${0.16 * cur})`);
        pool.addColorStop(1, 'rgba(219,232,255,0)');
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.ellipse(fx, fy, w * 0.16, h * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const m of motes) {
        if (!reduced) {
          m.y += m.vy * dt;
          m.x += m.vx * dt + Math.sin(t + m.r) * 0.00002 * dt;
          if (m.y < -0.02) {
            m.y = 1.02;
            m.x = Math.random();
          }
        }
        ctx.fillStyle = `rgba(219,232,255,${m.a * cur * 0.5})`;
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [reduced]);

  return <canvas ref={ref} aria-hidden className={className ?? 'pointer-events-none absolute inset-0 h-full w-full'} />;
}
