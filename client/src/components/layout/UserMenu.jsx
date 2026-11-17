import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, LogOut, Settings, UserRound, LayoutDashboard } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { useAuth } from '../../hooks/useAuth';

/** Avatar dropdown: identity, dashboard, public profile, settings, sign out. */
export default function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const name = profile?.display_name || user?.user_metadata?.full_name || profile?.username || 'You';
  const avatar = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const username = profile?.username;

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await signOut();
    } finally {
      navigate('/', { replace: true });
    }
  };

  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-muted transition hover:bg-ink-surface hover:text-fg';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border border-transparent py-0.5 pl-0.5 pr-2 transition hover:border-ink-edge hover:bg-ink-raised"
      >
        <Avatar src={avatar} name={name} size="md" />
        <ChevronDown className={`hidden h-3.5 w-3.5 text-fg-subtle transition sm:block ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-xl border border-ink-edge bg-ink-raised p-1.5 shadow-lift"
          >
            <div className="flex items-center gap-3 border-b border-ink-line px-3 pb-3 pt-2">
              <Avatar src={avatar} name={name} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{name}</p>
                {username && <p className="truncate text-xs text-fg-subtle">@{username}</p>}
              </div>
            </div>
            <div className="pt-1.5">
              <Link role="menuitem" to="/dashboard" className={item} onClick={() => setOpen(false)}>
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
              </Link>
              {username && (
                <Link role="menuitem" to={`/u/${username}`} className={item} onClick={() => setOpen(false)}>
                  <UserRound className="h-4 w-4" aria-hidden="true" /> Public profile
                </Link>
              )}
              <Link role="menuitem" to="/settings" className={item} onClick={() => setOpen(false)}>
                <Settings className="h-4 w-4" aria-hidden="true" /> Settings &amp; privacy
              </Link>
              <button type="button" role="menuitem" onClick={handleSignOut} className={`${item} hover:!text-[#ff9b9b]`}>
                <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
