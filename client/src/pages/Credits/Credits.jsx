import React from 'react';
import AppHeader from '../../components/layout/AppHeader';
import AppFooter, { TMDB_NOTICE, TmdbLogo } from '../../components/layout/AppFooter';

export default function Credits() {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6]">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Credits &amp; data sources</h1>
        <p className="mt-2 text-sm text-[#9CA3AF]">
          ShowTracker does not own the titles, posters, backdrops or descriptions it displays. They come from the
          providers below and belong to their respective owners.
        </p>

        <section className="mt-8 rounded-2xl border border-[#2A3245] bg-[#151922] p-5">
          <div className="mb-2 flex items-center gap-3">
            <h2 className="text-base font-semibold text-white">TMDB</h2>
            <TmdbLogo className="h-4" />
          </div>
          <p className="text-sm text-[#E5E7EB]">{TMDB_NOTICE}</p>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            Movie and TV metadata, posters and ratings. TMDB&rsquo;s free API is for non-commercial use with
            attribution; commercial use requires a license from TMDB.
          </p>
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-red-400 hover:text-red-300"
          >
            themoviedb.org
          </a>
        </section>

        <section className="mt-4 rounded-2xl border border-[#2A3245] bg-[#151922] p-5">
          <h2 className="mb-2 text-base font-semibold text-white">AniList</h2>
          <p className="text-sm text-[#9CA3AF]">
            Anime metadata, cover images, scores and trending rankings, from the public AniList GraphQL API.
          </p>
          <a
            href="https://anilist.co"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-red-400 hover:text-red-300"
          >
            anilist.co
          </a>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
