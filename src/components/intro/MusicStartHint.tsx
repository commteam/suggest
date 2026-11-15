import { AnimatePresence, motion } from 'framer-motion';
import { Music } from 'lucide-react';

/** 자동 재생이 막힌 동안 화면 아래쪽에 작게 표시 */
/** raised: 첫 화면처럼 하단에 [관리자] 링크가 있을 때 한 칸 위로 */
export function MusicStartHint({ show, raised = false }: { show: boolean; raised?: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.p
          role="status"
          aria-live="polite"
          className={`pointer-events-none fixed ${raised ? 'bottom-12 sm:bottom-14' : 'bottom-5'} left-1/2 z-[96] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line/80 bg-[#060b17]/80 px-3.5 py-1.5 text-xs whitespace-nowrap text-[#c3cfe3] backdrop-blur`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.4 }}
        >
          <Music className="h-3.5 w-3.5 text-accent" aria-hidden />
          화면을 한 번 누르면 음악이 시작됩니다
        </motion.p>
      )}
    </AnimatePresence>
  );
}
