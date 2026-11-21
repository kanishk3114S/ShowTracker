import React from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarClock, Compass, Flame, Home, Library, LayoutDashboard, UserRound, LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSignIn } from '../auth/SignInContext';
import { prefetchNav } from '../../routes/pages';

const itemClass = ({ isActive }) =>
  `relative flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
    isActive ? 'text-accent' : 'text-fg-muted'
  }`;

/** Bottom dock for phones (hidden from the md breakpoint up). 48px+ touch targets. */
export default function MobileNav() {
  const { isAuthenticated, profile, loading } = useAuth();
  const { openSignIn } = useSignIn();
  if (loading) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-ink-base/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-1">
        {isAuthenticated ? (
          <>
            <NavLink to="/dashboard" className={itemClass} onTouchStart={() => prefetchNav('/dashboard', isAuthenticated)}>
              <LayoutDashboard className="h-5 w-5" aria-hidden="true" /> Home
            </NavLink>
            <NavLink to="/explore" className={itemClass} onTouchStart={() => prefetchNav('/explore', isAuthenticated)}>
              <Compass className="h-5 w-5" aria-hidden="true" /> Explore
            </NavLink>
            <NavLink to="/trending" className={itemClass} onTouchStart={() => prefetchNav('/trending', isAuthenticated)}>
              <Flame className="h-5 w-5" aria-hidden="true" /> Trending
            </NavLink>
            <NavLink to="/library" className={itemClass} onTouchStart={() => prefetchNav('/library', isAuthenticated)}>
              <Library className="h-5 w-5" aria-hidden="true" /> Library
            </NavLink>
            <NavLink to="/upcoming" className={itemClass} onTouchStart={() => prefetchNav('/upcoming', isAuthenticated)}>
              <CalendarClock className="h-5 w-5" aria-hidden="true" /> Upcoming
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
            <NavLink to="/explore" className={itemClass} onTouchStart={() => prefetchNav('/explore', isAuthenticated)}>
              <Compass className="h-5 w-5" aria-hidden="true" /> Explore
            </NavLink>
            <NavLink to="/trending" className={itemClass} onTouchStart={() => prefetchNav('/trending', isAuthenticated)}>
              <Flame className="h-5 w-5" aria-hidden="true" /> Trending
            </NavLink>
            <button type="button" onClick={openSignIn} className="flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-accent">
              <LogIn className="h-5 w-5" aria-hidden="true" /> Sign in
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
