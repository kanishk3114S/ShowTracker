import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import Container from '../../components/layout/Container';
import Button from '../../components/ui/Button';
import GhostMark from '../../components/cinema/GhostMark';
import { Reveal } from '../../components/ui/motion';
import { useDocumentHead } from '../../hooks/useDocumentHead';

/** Cinematic 404: the reel ran out. Not indexed by search engines. */
export default function NotFound() {
  useDocumentHead({ title: '404 — Scene Not Found — ShowTracker', description: 'This page could not be found.', noindex: true });
  return (
    <Container className="max-w-2xl py-20 sm:py-28">
      <Reveal>
        <div className="glass relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.12),transparent_70%)]" aria-hidden="true" />
          <div className="sprockets absolute inset-x-6 top-4" aria-hidden="true" />
          <div className="sprockets absolute inset-x-6 bottom-4" aria-hidden="true" />
          <GhostMark text="SCENE 404 · CUT" position="center" />
          <p className="relative font-mono text-xs font-semibold uppercase tracking-[0.3em] text-accent">Error 404</p>
          <h1 className="relative mt-3 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">Scene Not Found</h1>
          <p className="relative mx-auto mt-3 max-w-sm text-sm leading-relaxed text-fg-muted">
            This page isn&rsquo;t in the reel. The link may be old, or the title may have moved.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button as={Link} to="/explore" variant="primary" leftIcon={Compass}>
              Explore titles
            </Button>
            <Button as={Link} to="/" variant="secondary" leftIcon={Home}>
              Home
            </Button>
          </div>
        </div>
      </Reveal>
    </Container>
  );
}
