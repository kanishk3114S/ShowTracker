import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext({ toast: () => {} });

/** Non-blocking notices (e.g. "could not save, change undone"). Announced politely to screen readers. */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (message, { tone = 'error', ms = 5000 } = {}) => {
      const id = nextId.current++;
      // identical message already on screen: don't stack duplicates
      setItems((prev) => [...prev.filter((t) => t.message !== message), { id, message, tone }].slice(-3));
      if (ms) setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss]
  );
  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[120] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      >
        <AnimatePresence>
          {items.map((t) => {
            const Icon = t.tone === 'success' ? CheckCircle2 : AlertTriangle;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm text-fg"
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${t.tone === 'success' ? 'text-emerald-400' : 'text-[#ff9b9b]'}`} aria-hidden="true" />
                <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="rounded p-0.5 text-fg-subtle transition hover:text-fg"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
