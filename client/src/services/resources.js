import {
  searchMedia,
  getTrendingMedia,
  getMediaGenres,
  getMediaDetails,
  getMediaSeasons,
  getMyLibrary,
  getLibraryStats,
  getContinueWatching,
  getRecentlyUpdated,
  getPublicProfile,
  checkLibraryEntry
} from './api';
import { prefetch } from '../lib/queryCache';

/**
 * One definition per kind of data: its cache key, how to fetch it, and how long
 * it counts as fresh. Pages and prefetchers both use these, so a prefetch always
 * lands in exactly the cache slot the page will read.
 *
 * Key prefixes matter: 'me:' and 'profile:' are marked stale after the user changes
 * their library or profile (see lib/queryCache.js).
 */
const k = (...parts) => parts.map((p) => (p === undefined || p === null ? '' : p)).join('|');

const MEDIA_STALE = 120_000;
const ME_STALE = 20_000;

export const R = {
  // ----- private (signed-in user)
  stats: () => ({ key: 'me:stats', staleMs: ME_STALE, fetch: (s) => getLibraryStats(s) }),
  continueWatching: () => ({ key: 'me:continue', staleMs: ME_STALE, fetch: (s) => getContinueWatching(s) }),
  recentlyUpdated: () => ({ key: 'me:recent', staleMs: ME_STALE, fetch: (s) => getRecentlyUpdated(s) }),
  library: ({ status = '', mediaType = '', sort = 'updated_at', order = 'desc' } = {}) => ({
    key: `me:library:${k(status, mediaType, sort, order)}`,
    staleMs: ME_STALE,
    fetch: (s) => getMyLibrary({ status, mediaType, sort, order }, s)
  }),
  checkEntry: (mediaId) => ({ key: `me:check:${mediaId}`, staleMs: ME_STALE, fetch: (s) => checkLibraryEntry(mediaId, s) }),
  seasons: (mediaId) => ({ key: `me:seasons:${mediaId}`, staleMs: 10 * 60_000, fetch: (s) => getMediaSeasons(mediaId, s) }),

  // ----- public profile page
  profile: (username, { status = '', mediaType = '', sort = 'updated_at', order = 'desc' } = {}) => ({
    key: `profile:${username}:${k(status, mediaType, sort, order)}`,
    staleMs: ME_STALE,
    fetch: (s) => getPublicProfile(username, { status, mediaType, sort, order }, s)
  }),

  // ----- public catalog
  search: ({ q = '', type = 'ALL', page = 1, genre = [], year = '' } = {}) => ({
    key: `media:search:${k(q, type, page, genre.join(','), year)}`,
    staleMs: MEDIA_STALE,
    fetch: (s) => searchMedia({ q, type, page, genre, year }, s)
  }),
  genres: (type = 'ALL') => ({ key: `media:genres:${type}`, staleMs: 60 * 60_000, fetch: (s) => getMediaGenres(type, s) }),
  trending: ({ type = 'ALL', window = 'week', page = 1 } = {}) => ({
    key: `media:trending:${k(type, window, page)}`,
    staleMs: MEDIA_STALE,
    fetch: (s) => getTrendingMedia({ type, window, page }, s)
  }),
  details: ({ provider, mediaType, externalId }) => ({
    key: `media:details:${k(String(provider).toLowerCase(), String(mediaType).toLowerCase(), externalId)}`,
    staleMs: 5 * 60_000,
    fetch: (s) => getMediaDetails({ provider, mediaType, externalId }, s)
  })
};

/** Fetch ahead of time into the cache. Never throws, never shows UI. */
export const prefetchResource = (resource) => prefetch(resource.key, () => resource.fetch(undefined), resource.staleMs);

export const prefetchMediaDetails = (media) =>
  prefetchResource(R.details({ provider: media.provider, mediaType: media.mediaType, externalId: media.externalId }));
