export const TYPE_LABELS = { ANIME: 'Anime', MOVIE: 'Movie', TV: 'TV Show' };
export const TYPE_PLURAL = { ANIME: 'Anime', MOVIE: 'Movies', TV: 'TV Shows' };

export const PROVIDER_NAMES = { ANILIST: 'AniList', TMDB: 'TMDB', TVMAZE: 'TVMaze', TVDB: 'TheTVDB' };

export const mediaPath = (m) =>
  `/media/${m.provider.toLowerCase()}/${m.mediaType.toLowerCase()}/${m.externalId}`;

export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** AniList enums: FINISHED -> Finished, NOT_YET_RELEASED -> Not yet released */
export function humanize(value) {
  if (!value) return null;
  if (/^[A-Z]{2,3}$/.test(value)) return value; // acronyms: TV, OVA, ONA
  const text = String(value).replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
