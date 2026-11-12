import { motion } from 'framer-motion';
import { DOT_COUNT } from './introConfig';

export function GoldDots({ lit }: { lit: number }) {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6" role="presentation">
      {Array.from({ length: DOT_COUNT }).map((_, i) => {
        const on = i < lit;
        return (
          <motion.span
            key={i}
            className="block h-3 w-3 rounded-full sm:h-3.5 sm:w-3.5"
            initial={false}
            animate={{
              scale: on ? [1, 1.7, 1] : 1,
              opacity: on ? 1 : 0.35,
            }}
            transition={{ duration: 0.5 }}
            style={{
              background: on ? 'var(--g-metal)' : 'transparent',
              border: '1px solid color-mix(in oklab, var(--c-accent) 70%, transparent)',
              boxShadow: on ? '0 0 14px var(--c-accent), 0 0 32px color-mix(in oklab, var(--c-accent) 55%, transparent)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
