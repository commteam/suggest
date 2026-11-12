import { AnimatePresence, motion } from 'framer-motion';

/**
 * 카메라 플래시. flashKey 가 바뀔 때마다 한 번 터집니다.
 * intensity 0~1, full=true 이면 화면 전체가 하얗게.
 */
export function CameraFlash({ flashKey, intensity = 0.9, full = false }: { flashKey: number; intensity?: number; full?: boolean }) {
  return (
    <AnimatePresence>
      {flashKey > 0 && (
        <motion.div
          key={flashKey}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[80]"
          style={{
            background: full
              ? '#ffffff'
              : 'radial-gradient(circle at 50% 45%, #ffffff 0%, #dbe8ff 35%, rgba(219,232,255,0.6) 70%, rgba(219,232,255,0.3) 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, intensity, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: full ? 1.1 : 0.5, times: [0, 0.12, 1], ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}
