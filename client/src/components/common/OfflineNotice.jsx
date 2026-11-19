import React, { useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff } from 'lucide-react';

const subscribe = (callback) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};
const getOnline = () => navigator.onLine;

/** A discreet pill at the top of the screen while the browser has no connection. */
export default function OfflineNotice() {
  const online = useSyncExternalStore(subscribe, getOnline, () => true);
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="pointer-events-none fixed inset-x-0 top-3 z-[120] flex justify-center px-4"
        >
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-fg">
            <WifiOff className="h-4 w-4 text-amber-400" aria-hidden="true" />
            You are offline. Showing cached library data.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
