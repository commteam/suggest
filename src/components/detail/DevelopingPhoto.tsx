import { motion, useReducedMotion } from 'framer-motion';
import { Silhouette } from '@/components/gallery/Silhouette';

/** "현상되듯" 밝은 블러에서 선명해지는 증명사진 (3:4, 금색 액자) */
export function DevelopingPhoto({ src, alt, replayKey }: { src: string | null; alt: string; replayKey: string }) {
  const reduce = useReducedMotion();
  return (
    <div
      className="rounded-[4px] p-[9px] shadow-[0_30px_60px_-10px_rgba(0,0,0,0.8),0_0_40px_color-mix(in_oklab,var(--c-accent)_25%,transparent)]"
      style={{ background: 'var(--g-frame)' }}
    >
      <div className="rounded-[2px] p-[2px]" style={{ background: 'var(--c-accent-dark)' }}>
        <div className="bg-[#0b1430] p-[8px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
          <div className="relative aspect-[3/4] overflow-hidden bg-[#0b1530]">
            {src ? (
              <motion.img
                key={replayKey}
                src={src}
                alt={alt}
                className="h-full w-full object-cover"
                initial={
                  reduce ? { opacity: 0 } : { filter: 'blur(16px) brightness(2.6) saturate(0.1) contrast(0.7)', opacity: 0.6 }
                }
                animate={reduce ? { opacity: 1 } : { filter: 'blur(0px) brightness(1) saturate(1) contrast(1)', opacity: 1 }}
                transition={{ duration: reduce ? 0.3 : 2.2, ease: [0.25, 0.6, 0.3, 1] }}
              />
            ) : (
              <motion.div
                key={replayKey}
                className="h-full w-full"
                role="img"
                aria-label={`${alt} (사진 없음)`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
              >
                <Silhouette />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
