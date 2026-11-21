import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, BarChart3, Check, Compass, Eye, Library, Lock, Sparkles, Tv } from 'lucide-react';
import Container from '../../components/layout/Container';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { CategoryBadge } from '../../components/ui/Badge';
import PosterImage from '../../components/media/PosterImage';
import ProgressBar from '../../components/ui/ProgressBar';
import { Reveal } from '../../components/ui/motion';
import { useSignIn } from '../../components/auth/SignInContext';
import { useTrendingArtwork } from '../../hooks/useTrendingArtwork';

import { useDocumentHead } from '../../hooks/useDocumentHead';
/** Real trending posters in three tilted, floating columns. Renders nothing if the artwork API is unavailable. */
function HeroCollage({ posters }) {
  const picks = posters.slice(0, 9);
  if (picks.length < 6) return null;
  const columns = [picks.filter((_, i) => i % 3 === 0), picks.filter((_, i) => i % 3 === 1), picks.filter((_, i) => i % 3 === 2)];
  const offsets = ['mt-0', 'mt-14', 'mt-5'];
  const drift = [-12, 14, -8];

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
      <div className="relative grid grid-cols-3 gap-3 [perspective:1400px] sm:gap-4">
        {columns.map((col, c) => (
          <motion.div
            key={c}
            className={`space-y-3 [transform:rotateY(-14deg)_rotateX(5deg)] sm:space-y-4 ${offsets[c]}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 * c, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div animate={{ y: [0, drift[c], 0] }} transition={{ duration: 9 + c * 2, repeat: Infinity, ease: 'easeInOut' }} className="space-y-3 sm:space-y-4">
              {col.map((m) => (
                <div key={`${m.provider}:${m.externalId}`} className="relative">
                  <PosterImage src={m.posterUrl} alt="" className="aspect-[2/3] rounded-2xl border border-white/10 shadow-lift" />
                  <CategoryBadge type={m.mediaType} className="absolute left-2 top-2" />
                </div>
              ))}
            </motion.div>
          </motion.div>
        ))}
      </div>
      <div className="pointer-events-none absolute -inset-x-6 -bottom-10 h-1/2 bg-gradient-to-t from-ink-base via-ink-base/90 to-transparent" />
    </div>
  );
}

/** Micro-preview: episodes tick off one after another, with the progress bar following. */
function TickDemo() {
  const [done, setDone] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDone((n) => (n >= 4 ? 0 : n + 1)), 1500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mt-5 space-y-2" aria-hidden="true">
      <ProgressBar value={done} max={4} label="Example progress" />
      {[1, 2, 3, 4].map((n) => {
        const ticked = n <= done;
        return (
          <div
            key={n}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors duration-300 ${
              ticked ? 'border-accent/25 bg-accent/[0.06]' : 'border-white/10 bg-white/[0.03]'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                ticked ? 'border-accent bg-accent text-ink-base' : 'border-white/20'
              }`}
            >
              {ticked && <Check key={`${n}-${done}`} className="h-3 w-3 animate-check-pop" strokeWidth={3.5} />}
            </span>
            <span className="text-sm text-fg-muted">Episode {n}</span>
          </div>
        );
      })}
    </div>
  );
}

function CatalogPreview({ trio }) {
  if (trio.length < 3) return null;
  return (
    <div className="mt-5 flex items-end justify-center" aria-hidden="true">
      {trio.map((m, i) => (
        <div key={m.mediaType} className={`relative w-[30%] ${i === 1 ? 'z-10 -mx-3 -translate-y-2' : ''}`}>
          <PosterImage src={m.posterUrl} alt="" className="aspect-[2/3] rounded-xl border border-white/10 shadow-lift" />
          <CategoryBadge type={m.mediaType} className="absolute -bottom-2 left-1/2 -translate-x-1/2" />
        </div>
      ))}
    </div>
  );
}

function StatsPreview() {
  const bars = [
    { w: '86%', l: 'Titles' },
    { w: '64%', l: 'Episodes' },
    { w: '78%', l: 'Rating' }
  ];
  return (
    <div className="mt-5 space-y-3" aria-hidden="true">
      {bars.map((b) => (
        <div key={b.l}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{b.l}</p>
          <div className="h-1.5 rounded-full bg-white/[0.09]">
            <div className="h-full rounded-full bg-accent" style={{ width: b.w }} />
          </div>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-fg-subtle">Illustration of your live statistics</p>
    </div>
  );
}

function IconTile({ icon: Icon }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-accent">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function FeatureCard({ icon, title, children, preview }) {
  return (
    <Card className="h-full transition duration-300 hover:-translate-y-1 hover:border-white/20">
      <IconTile icon={icon} />
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{children}</p>
      {preview}
    </Card>
  );
}

export default function Landing() {
  useDocumentHead({ title: 'ShowTracker — One Account. One Library. Everything You Watch.', description: 'Track every anime, movie and TV show you watch in one private library, episode by episode, and share a profile you are proud of.' });
  const { openSignIn } = useSignIn();
  const { posters, groups } = useTrendingArtwork();
  const one = (type) => (groups[type] ?? []).find((m) => m.posterUrl);
  const trio = ['ANIME', 'MOVIE', 'TV'].map(one).filter(Boolean);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-dots mask-radial pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="bg-grid mask-radial pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <Container className="relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <Reveal>
              <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-fg-muted">
                <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Anime · Movies · TV in one library
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="text-5xl font-black leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
                Your watchlist.
                <br />
                Your stories.
                <br />
                <span className="text-accent">Your universe.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">Track every anime, movie and series you love, all in one personal library.</p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button variant="primary" size="lg" rightIcon={ArrowRight} onClick={openSignIn}>
                  Start tracking
                </Button>
                <Button as={Link} to="/explore" variant="secondary" size="lg" leftIcon={Compass}>
                  Explore titles
                </Button>
              </div>
              <p className="mt-4 text-xs text-fg-subtle">Free to use. Sign in with Google. Your notes stay private.</p>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <HeroCollage posters={posters} />
          </Reveal>
        </Container>
      </section>

      {/* Feature cards with live micro-previews */}
      <section className="relative overflow-hidden border-t border-white/[0.06] py-20">
        <Container>
          <Reveal inView>
            <p className="text-sm font-bold text-accent">Everything in one place</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Built for people who actually finish their watchlist.</h2>
          </Reveal>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <Reveal inView delay={0.02}>
              <FeatureCard icon={Tv} title="Episode-by-episode precision" preview={<TickDemo />}>
                Tick episodes off one at a time or a whole season at once. Progress and status update by themselves.
              </FeatureCard>
            </Reveal>
            <Reveal inView delay={0.09}>
              <FeatureCard icon={Library} title="One unified library" preview={<CatalogPreview trio={trio} />}>
                Anime from AniList, movies and series from TMDB: one status system, one rating scale, one place.
              </FeatureCard>
            </Reveal>
            <Reveal inView delay={0.16}>
              <FeatureCard icon={BarChart3} title="Live personal stats" preview={<StatsPreview />}>
                Titles, episodes watched, completions and your average rating, always calculated from your real library.
              </FeatureCard>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Privacy */}
      <section className="relative overflow-hidden border-t border-white/[0.06] py-20">
        <Container>
          <Reveal inView>
            <p className="text-sm font-bold text-accent">Privacy, on your terms</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Your numbers. Your rules.</h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: Eye, title: 'Public or private profile', text: 'Share a profile page, or keep it entirely to yourself with one switch.' },
              { icon: Lock, title: 'Library privacy, separately', text: 'Show your profile but hide your library, progress and statistics.' },
              { icon: Sparkles, title: 'Notes are always private', text: 'Personal notes never appear on any public page, whatever you choose.' }
            ].map((f, i) => (
              <Reveal inView delay={0.07 * i} key={f.title}>
                <Card className="h-full transition duration-300 hover:-translate-y-1 hover:border-white/20">
                  <IconTile icon={f.icon} />
                  <h3 className="mt-4 text-base font-bold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.text}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden border-t border-white/[0.06] pb-4 pt-20">
        <Container>
          <Reveal inView>
            <div className="glass relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12">
              <div className="bg-dots mask-radial pointer-events-none absolute inset-0" aria-hidden="true" />
              <h2 className="relative text-3xl font-black tracking-tight text-white sm:text-5xl">Ready to build your library?</h2>
              <p className="relative mx-auto mt-3 max-w-lg text-fg-muted">Sign in once and pick up exactly where you left off, on any device.</p>
              <div className="relative mt-8 flex flex-wrap justify-center gap-3">
                <Button variant="primary" size="lg" rightIcon={ArrowRight} onClick={openSignIn}>
                  Start tracking
                </Button>
                <Button as={Link} to="/trending" variant="secondary" size="lg">
                  See what&rsquo;s trending
                </Button>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
