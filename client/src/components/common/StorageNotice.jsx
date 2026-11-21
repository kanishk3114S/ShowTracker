import React, { useState, lazy, Suspense } from 'react';
import { EyeOff, Lock, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';

const Modal = lazy(() => import('../ui/Modal'));

export const CONSENT_KEY = 'showtracker_cookie_consent';

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false; // storage blocked: just show the notice, it works without it
  }
}

function PrivacyPoints() {
  const points = [
    [ShieldCheck, 'Essential storage only', 'We keep you signed in (a session) and remember small preferences such as the library view. Your library data is cached in this tab so pages open instantly, and wiped when you sign out.'],
    [EyeOff, 'No tracking, no ads', 'There are no advertising cookies, no analytics trackers and no third-party profiling.'],
    [Lock, 'You choose what is public', 'Your profile and your library are two separate switches in Settings. A private profile is invisible to everyone else, and a public profile can still keep its library private.'],
    [Lock, 'Notes never leave your account', 'Your personal notes are private to you. They are never shown on your public profile, in public lists or to other users.']
  ];
  return (
    <ul className="space-y-4">
      {points.map(([Icon, title, text]) => (
        <li key={title} className="flex gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-accent">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-fg">{title}</span>
            <span className="mt-0.5 block text-sm leading-relaxed text-fg-muted">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Essential-storage (cookie) notice.
 *
 * File and element names deliberately avoid the words "cookie" and "banner": ad and cookie-notice blockers (Brave Shields,
 * uBlock, ...) block URLs and hide elements that match them, which used to stop this module from loading at all.
 * ShowTracker only uses what it needs to work (session, cache, preferences),
 * so there is nothing to opt in or out of: "Got it" simply remembers that the notice was read.
 */
export default function StorageNotice() {
  const [visible, setVisible] = useState(() => !readConsent());
  const [infoOpen, setInfoOpen] = useState(false);

  const accept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'accepted');
    } catch {
      /* blocked storage: the banner just closes for this visit */
    }
    setVisible(false);
  };

  return (
    <>
      {visible && (
        <aside
          role="region"
          aria-label="Storage and privacy notice"
          className="animate-fade-up fixed inset-x-4 bottom-20 z-[60] rounded-2xl border border-white/10 bg-ink-surface/90 p-4 shadow-2xl backdrop-blur-xl md:inset-x-auto md:bottom-6 md:left-6 md:max-w-md"
        >
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-accent">
              <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <p className="text-sm leading-relaxed text-fg-muted">
              We use essential cookies and local storage to keep you signed in and preserve your personal library. No advertising or tracking cookies are used.
            </p>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInfoOpen(true)}>
              Privacy info
            </Button>
            <Button size="sm" variant="primary" onClick={accept}>
              Got it
            </Button>
          </div>
        </aside>
      )}

      {infoOpen && (
        <Suspense fallback={null}>
          <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title="Your privacy on ShowTracker" description="What we store, and what stays yours.">
            <PrivacyPoints />
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" onClick={() => setInfoOpen(false)}>
                Close
              </Button>
            </div>
          </Modal>
        </Suspense>
      )}
    </>
  );
}
