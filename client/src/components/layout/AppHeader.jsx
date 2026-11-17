import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Film } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-[#1C2230] text-white' : 'text-[#9CA3AF] hover:text-white'
  }`;

/** Shared top navigation for catalog pages (works for signed-in and signed-out visitors). */
export default function AppHeader() {
  const { isAuthenticated, loading } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b border-[#2A3245] bg-[#151922]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-5">
          <Link to={isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-red-600 to-amber-500">
              <Film className="h-5 w-5 text-white" />
            </span>
            <span className="hidden text-lg font-bold tracking-tight text-white sm:inline">ShowTracker</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            <NavLink to="/explore" className={linkClass}>
              Explore
            </NavLink>
            <NavLink to="/trending" className={linkClass}>
              Trending
            </NavLink>
            {isAuthenticated && (
              <NavLink to="/library" className={linkClass}>
                My Library
              </NavLink>
            )}
          </nav>
        </div>
        {!loading && (
          <Link
            to={isAuthenticated ? '/dashboard' : '/'}
            className="rounded-lg border border-[#2A3245] bg-[#1C2230] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2A3245]"
          >
            {isAuthenticated ? 'Dashboard' : 'Sign in'}
          </Link>
        )}
      </div>
    </header>
  );
}
