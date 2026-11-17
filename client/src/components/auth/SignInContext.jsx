/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import SignInPanel from './SignInPanel';

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
      <Modal open={open} onClose={closeSignIn} bare size="xl" ariaLabel="Sign in to ShowTracker">
        <SignInPanel />
      </Modal>
    </SignInContext.Provider>
  );
}

export const useSignIn = () => useContext(SignInContext);
