import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, BarChart3, Check, Compass, Eye, Lock, Sparkles } from 'lucide-react';
import Container from '../../components/layout/Container';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import PosterImage from '../../components/media/PosterImage';
import ProgressBar from '../../components/ui/ProgressBar';
import { Reveal } from '../../components/ui/motion';
import { useSignIn } from '../../components/auth/SignInContext';
import { useTrendingArtwork } from '../../hooks/useTrendingArtwork';
import { TYPE_LABELS } from '../../components/media/mediaUtils';

/** Real trending posters in three offset columns. Renders nothing if the artwork API is unavailable. */
function HeroCollage({ posters }) {
  const picks = posters.slice(0, 9);
  if (picks.length < 6) return null;
  const columns = [picks.filter((_, i) => i % 3 === 0), picks.filter((_, i) => i % 3 === 1), picks.filter((_, i) => i % 3 === 2)];
  const offsets = ['mt-0', 'mt-12', 'mt-4'];
  const drift = [-10, 12, -6];

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
      <div className="absolute -inset-10 rounded-full bg-copper/10 blur-3xl" />
      <div className="relative grid grid-cols-3 gap-3 sm:gap-4">
        {columns.map((col, c) => (
          <motion.div
            key={c}
            className={`space-y-3 sm:space-y-4 ${offsets[c]}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 * c, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div animate={{ y: [0, drift[c], 0] }} transition={{ duration: 9 + c * 2, repeat: Infinity, ease: 'easeInOut' }} className="space-y-3 sm:space-y-4">
              {col.map((m) => (
                <PosterImage
                  key={`${m.provider}:${m.externalId}`}
                  src={m.posterUrl}
                  alt=""
                  className="aspect-[2/3] rounded-xl border border-ink-edge shadow-lift"
                />
              ))}
            </motion.div>
          </motion.div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink-base to-transparent" />
    </div>
  );
}

function FeatureHeading({ eyebrow, title, children }) {
  return (
    <div className="max-w-xl">
      <p className="text-sm font-semibold text-copper">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-fg sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-relaxed text-fg-muted">{children}</p>
    </div>
  );
}

export default function Landing() {
  const { openSignIn } = useSignIn();
  const { posters, groups } = useTrendingArtwork();
  const one = (type) => (groups[type] ?? []).find((m) => m.posterUrl);
  const trio = ['ANIME', 'TV', 'MOVIE'].map(one).filter(Boolean);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_30%,rgba(224,122,95,0.10),transparent)]" aria-hidden="true" />
        <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <Reveal>
              <Badge tone="copper" className="mb-5">
                <Sparkles className="h-3 w-3" aria-hidden="true" /> Anime · Movies · TV in one library
              </Badge>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-fg sm:text-5xl lg:text-6xl">
                Your watchlist.
                <br />
                Your stories.
                <br />
                <span className="text-copper">Your universe.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
                Track every anime, movie and series you love, all in one personal library.
              </p>
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

      {/* 1. Unified library */}
      <section className="border-t border-ink-line py-20">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal inView>
            <FeatureHeading eyebrow="Unified entertainment library" title="Anime, shows and films, side by side.">
              Stop juggling three apps. Anime from AniList and movies and series from TMDB live in one library, with one
              status system, one rating scale and one place to pick up where you left off.
            </FeatureHeading>
          </Reveal>
          <Reveal inView delay={0.1}>
            {trio.length === 3 ? (
              <div className="grid grid-cols-3 gap-4">
                {trio.map((m, i) => (
                  <div key={m.mediaType} className={i === 1 ? 'mt-6' : ''}>
                    <PosterImage src={m.posterUrl} alt="" className="aspect-[2/3] rounded-xl border border-ink-edge shadow-lift" />
                    <p className="mt-2.5 text-center text-xs font-medium text-fg-muted">{TYPE_LABELS[m.mediaType]}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center text-sm text-fg-muted">
                {['Anime', 'TV Shows', 'Movies'].map((t) => (
                  <div key={t} className="flex aspect-[2/3] items-center justify-center rounded-xl border border-ink-edge bg-ink-surface">
                    {t}
                  </div>
                ))}
              </div>
            )}
          </Reveal>
        </Container>
      </section>

      {/* 2. Episode precision */}
      <section className="border-t border-ink-line bg-ink-surface/40 py-20">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal inView delay={0.1} className="order-2 lg:order-1">
            <div className="rounded-2xl border border-ink-edge bg-ink-surface p-5 shadow-card" aria-label="Illustration of the episode tracker">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-fg">Episode tracker</p>
                <Badge tone="neutral">Illustration</Badge>
              </div>
              <ProgressBar value={3} max={5} label="Example progress" />
              <div className="mt-4 flex gap-1.5">
                {['Season 1', 'Season 2'].map((s, i) => (
                  <span
                    key={s}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium ${i === 0 ? 'border-copper/50 bg-copper/10 text-copper' : 'border-ink-edge text-fg-muted'}`}
                  >
                    {s}
                  </span>
                ))}
              </div>
              <ul className="mt-4 space-y-1.5">
                {[true, true, true, false, false].map((done, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-ink-edge bg-ink-raised/50'}`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${done ? 'border-emerald-500 bg-emerald-500 text-ink-base' : 'border-[#3b455e]'}`}>
                      {done && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
                    </span>
                    <span className="text-sm text-fg-muted">Episode {i + 1}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal inView className="order-1 lg:order-2">
            <FeatureHeading eyebrow="Episode-by-episode precision" title="Know exactly where you stopped.">
              Tick off episodes one at a time or a whole season at once. Progress bars, automatic status changes and
              season tabs keep every series up to date without any busywork.
            </FeatureHeading>
          </Reveal>
        </Container>
      </section>

      {/* 3. Stats & privacy */}
      <section className="border-t border-ink-line py-20">
        <Container>
          <Reveal inView>
            <FeatureHeading eyebrow="Personal stats & privacy" title="Your numbers. Your rules.">
              See what you have watched, how much, and how you rate it. Then decide who else gets to see any of it.
            </FeatureHeading>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: BarChart3, title: 'Live statistics', text: 'Titles, episodes watched, completions and your average rating, always calculated from your real library.' },
              { icon: Eye, title: 'Public or private profile', text: 'Share a profile page, or keep it entirely to yourself. It is one switch in settings.' },
              { icon: Lock, title: 'Library privacy, separately', text: 'Show your profile but hide your library. Personal notes are never public, whatever you choose.' }
            ].map((f, i) => (
              <Reveal inView delay={0.07 * i} key={f.title}>
                <div className="h-full rounded-2xl border border-ink-edge bg-ink-surface p-6 shadow-card">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-edge bg-ink-raised">
                    <f.icon className="h-5 w-5 text-copper" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-fg">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-ink-line pb-4 pt-20">
        <Container>
          <Reveal inView>
            <div className="relative overflow-hidden rounded-3xl border border-ink-edge bg-ink-surface px-6 py-14 text-center sm:px-12">
              <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-copper/10 blur-3xl" aria-hidden="true" />
              <h2 className="relative text-3xl font-bold tracking-tight text-fg sm:text-4xl">Ready to build your library?</h2>
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
