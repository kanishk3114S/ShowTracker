import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Flame, Home, Library, LayoutDashboard, UserRound, LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSignIn } from '../auth/SignInContext';

const itemClass = ({ isActive }) =>
  `relative flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
    isActive ? 'text-copper' : 'text-fg-muted'
  }`;

/** Bottom dock for phones (hidden from the md breakpoint up). 48px+ touch targets. */
export default function MobileNav() {
  const { isAuthenticated, profile, loading } = useAuth();
  const { openSignIn } = useSignIn();
  if (loading) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-ink-base/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-1">
        {isAuthenticated ? (
          <>
            <NavLink to="/dashboard" className={itemClass}>
              <LayoutDashboard className="h-5 w-5" aria-hidden="true" /> Home
            </NavLink>
            <NavLink to="/explore" className={itemClass}>
              <Compass className="h-5 w-5" aria-hidden="true" /> Explore
            </NavLink>
            <NavLink to="/trending" className={itemClass}>
              <Flame className="h-5 w-5" aria-hidden="true" /> Trending
            </NavLink>
            <NavLink to="/library" className={itemClass}>
              <Library className="h-5 w-5" aria-hidden="true" /> Library
            </NavLink>
            <NavLink to={profile?.username ? `/u/${profile.username}` : '/settings'} className={itemClass}>
              <UserRound className="h-5 w-5" aria-hidden="true" /> Profile
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/" end className={itemClass}>
              <Home className="h-5 w-5" aria-hidden="true" /> Home
            </NavLink>
            <NavLink to="/explore" className={itemClass}>
              <Compass className="h-5 w-5" aria-hidden="true" /> Explore
            </NavLink>
            <NavLink to="/trending" className={itemClass}>
              <Flame className="h-5 w-5" aria-hidden="true" /> Trending
            </NavLink>
            <button type="button" onClick={openSignIn} className="flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-copper">
              <LogIn className="h-5 w-5" aria-hidden="true" /> Sign in
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
