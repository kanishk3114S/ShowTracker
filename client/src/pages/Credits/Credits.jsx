import React from 'react';
import Container from '../../components/layout/Container';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import { TMDB_NOTICE, TmdbLogo } from '../../components/layout/Footer';

export default function Credits() {
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader
        title="Credits & data sources"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Credits' }]}
        description="ShowTracker does not own the titles, posters, backdrops or descriptions it shows. They come from the providers below and belong to their respective owners."
      />

      <div className="space-y-4">
        <Card>
          <div className="mb-2 flex items-center gap-3">
            <h2 className="text-base font-semibold text-fg">TMDB</h2>
            <TmdbLogo className="h-4" />
          </div>
          <p className="text-sm text-fg">{TMDB_NOTICE}</p>
          <p className="mt-2 text-sm text-fg-muted">
            Movie and TV metadata, posters and ratings. TMDB&rsquo;s free API is for non-commercial use with attribution; commercial use
            requires a license from TMDB.
          </p>
          <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-accent transition hover:text-accent-hover">
            themoviedb.org
          </a>
        </Card>

        <Card>
          <h2 className="mb-2 text-base font-semibold text-fg">AniList</h2>
          <p className="text-sm text-fg-muted">Anime metadata, cover images, scores and trending rankings, from the public AniList GraphQL API.</p>
          <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-accent transition hover:text-accent-hover">
            anilist.co
          </a>
        </Card>
      </div>
    </Container>
  );
}
