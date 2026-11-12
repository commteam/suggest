import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/** 발표 모드: 해당 액자만 남기고 주변을 어둡게 + 위에서 떨어지는 빛 */
export function RevealSpotlight({ targetId }: { targetId: string | null }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!targetId) return;
    let raf = 0;
    const track = () => {
      const el = document.querySelector<HTMLElement>(`[data-frame-id="${targetId}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
      raf = requestAnimationFrame(track);
    };
    raf = requestAnimationFrame(track);
    return () => cancelAnimationFrame(raf);
  }, [targetId]);

  const show = !!targetId && !!rect;
  const cx = rect ? rect.left + rect.width / 2 : 0;
  const cy = rect ? rect.top + rect.height / 2 : 0;
  const r = rect ? Math.max(rect.width, rect.height) * 0.75 : 0;
  const coneH = rect ? rect.bottom + 24 : 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[35]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            background: `radial-gradient(circle ${r}px at ${cx}px ${cy}px, rgba(219,232,255,0.12) 0%, rgba(219,232,255,0.04) 55%, rgba(2,5,13,0.82) 100%)`,
          }}
        >
          <div
            className="absolute top-0"
            style={{
              left: cx - r,
              width: r * 2,
              height: coneH,
              background: 'linear-gradient(to bottom, rgba(219,232,255,0.04), rgba(219,232,255,0.16) 60%, rgba(219,232,255,0) 100%)',
              clipPath: 'polygon(46% 0, 54% 0, 92% 100%, 8% 100%)',
              filter: 'blur(6px)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
