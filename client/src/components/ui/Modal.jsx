import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };

/**
 * Accessible dialog: blurred backdrop, ESC to close, click-outside to close,
 * focus is trapped inside while open and restored to the trigger afterwards,
 * and the page behind does not scroll. Motion honors prefers-reduced-motion
 * through the app-wide MotionConfig.
 */
export default function Modal({ open, onClose, title, description, ariaLabel, bare = false, size = 'md', hideClose = false, children }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog (first focusable control, else the panel itself)
    const raf = requestAnimationFrame(() => {
      // Prefer an element marked data-autofocus (e.g. a textarea), else the first control.
      const target = panelRef.current?.querySelector('[data-autofocus]') ?? panelRef.current?.querySelector(FOCUSABLE);
      (target ?? panelRef.current)?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={!title ? ariaLabel : undefined}
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={`relative max-h-[92vh] w-full overflow-y-auto glass rounded-t-2xl shadow-lift outline-none sm:rounded-2xl ${SIZES[size]}`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {bare ? (
              <>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="absolute right-3 top-3 z-10 rounded-md bg-ink-base/60 p-1.5 text-fg-muted backdrop-blur transition hover:bg-ink-raised hover:text-fg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {children}
              </>
            ) : (
              <>
                {(title || !hideClose) && (
                  <div className="border-b border-ink-line">
                    <div className="sprockets mx-5 mt-3 opacity-70" aria-hidden="true" />
                    <div className="flex items-start justify-between gap-4 px-5 py-4">
                    <div>
                      {title && (
                        <h2 id={titleId} className="text-base font-semibold text-fg">
                          {title}
                        </h2>
                      )}
                      {description && (
                        <p id={descId} className="mt-0.5 text-sm text-fg-muted">
                          {description}
                        </p>
                      )}
                    </div>
                    {!hideClose && (
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="rounded-md p-1.5 text-fg-muted transition hover:bg-ink-raised hover:text-fg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    </div>
                  </div>
                )}
                <div className="p-5">{children}</div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
