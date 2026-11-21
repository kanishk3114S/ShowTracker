/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useState, lazy, Suspense } from 'react';

// Lazy-load the sign-in modal dialog and its artwork so they do not block initial page load.
const Modal = lazy(() => import('../ui/Modal'));
const SignInPanel = lazy(() => import('./SignInPanel'));

const SignInContext = createContext({ openSignIn: () => {}, closeSignIn: () => {} });

/** Lets any button open the cinematic sign-in modal (header, landing CTAs, trackers). */
export function SignInProvider({ children }) {
  const [open, setOpen] = useState(false);
  const openSignIn = useCallback(() => setOpen(true), []);
  const closeSignIn = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openSignIn, closeSignIn }), [openSignIn, closeSignIn]);

  return (
    <SignInContext.Provider value={value}>
      {children}
      {open && (
        <Suspense fallback={null}>
          <Modal open={open} onClose={closeSignIn} bare size="xl" ariaLabel="Sign in to ShowTracker">
            <SignInPanel />
          </Modal>
        </Suspense>
      )}
    </SignInContext.Provider>
  );
}

export const useSignIn = () => useContext(SignInContext);
