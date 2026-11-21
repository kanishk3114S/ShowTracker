import React from 'react';
import { NavLink } from 'react-router-dom';
import Logo from '../ui/Logo';
import Button from '../ui/Button';
import UserMenu from './UserMenu';
import Container from './Container';
import { useAuth } from '../../hooks/useAuth';
import { useSignIn } from '../auth/SignInContext';
import { prefetchNav } from '../../routes/pages';

export function navItems(isAuthenticated) {
  return isAuthenticated
    ? [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/explore', label: 'Explore' },
        { to: '/trending', label: 'Trending' },
        { to: '/library', label: 'My Library' },
        { to: '/upcoming', label: 'Upcoming' }
      ]
    : [
        { to: '/explore', label: 'Explore' },
        { to: '/trending', label: 'Trending' }
      ];
}

/** Sticky top navigation, shared by every page. Adapts to signed-in and signed-out visitors. */
export default function TopHeader() {
  const { isAuthenticated, loading } = useAuth();
  const { openSignIn } = useSignIn();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-ink-base/70 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo to={isAuthenticated ? '/dashboard' : '/'} />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {navItems(isAuthenticated).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onPointerEnter={() => prefetchNav(item.to, isAuthenticated)}
                onFocus={() => prefetchNav(item.to, isAuthenticated)}
                onTouchStart={() => prefetchNav(item.to, isAuthenticated)}
                className={({ isActive }) =>
                  `relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-fg' : 'text-fg-muted hover:text-fg'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span
                        className="absolute inset-x-3 -bottom-[17px] h-0.5 rounded-full bg-accent"
                        aria-hidden="true"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="skeleton h-9 w-24 rounded-lg" aria-hidden="true" />
          ) : isAuthenticated ? (
            <UserMenu />
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={openSignIn} className="hidden sm:inline-flex">
                Sign in
              </Button>
              <Button variant="primary" size="sm" onClick={openSignIn}>
                Get started
              </Button>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
