import axios from 'axios';
import { supabase } from '../lib/supabase';
import { invalidateUserData } from '../lib/queryCache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor: automatically attaches Supabase access token if session exists
apiClient.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn('[API Client] Could not resolve current session for request:', err.message);
  }
  return config;
}, (error) => Promise.reject(error));

/**
 * Fetch health status of the Express API and PostgreSQL
 */
export async function checkApiHealth() {
  try {
    const res = await apiClient.get('/health');
    return { ok: true, data: res.data };
  } catch (err) {
    return {
      ok: false,
      error: err.response?.data?.error?.message || err.message || 'Server connection failed.'
    };
  }
}

/**
 * GET /api/auth/me
 * Retrieves authenticated user and their ShowTracker profile
 */
export async function getMe() {
  const res = await apiClient.get('/auth/me');
  return res.data;
}

/**
 * GET /api/profiles/username-availability?username=...
 */
export async function checkUsernameAvailability(username) {
  const res = await apiClient.get('/profiles/username-availability', {
    params: { username }
  });
  return res.data;
}

/**
 * PATCH /api/profiles/me
 * Updates authenticated user's profile
 */
export async function updateMyProfile(profileData) {
  const res = await apiClient.patch('/profiles/me', profileData);
  invalidateUserData();
  return res.data;
}

/**
 * GET /api/users/:username
 * Public profile lookup. Returns { profile, library, stats, library_is_private, isOwner }.
 * The server decides what the caller may see (private profile = 404, private library = empty).
 */
export async function getPublicProfile(username, params = {}, signal) {
  const res = await apiClient.get(`/users/${encodeURIComponent(username)}`, { params: cleanParams(params), signal });
  return res.data;
}

// ---------------------------------------------------------------- media ----
// The browser only talks to our Express API; AniList and TMDB are never called directly.

/** Turns any axios failure into { code, message, retryAfterSeconds } for the UI. Cancelled requests return null. */
export function toApiError(err) {
  if (axios.isCancel(err) || err?.code === 'ERR_CANCELED') return null;
  const apiError = err.response?.data?.error;
  return {
    code: apiError?.code || (err.response ? 'REQUEST_FAILED' : 'NETWORK_ERROR'),
    message:
      apiError?.message ||
      (err.response ? 'The request failed.' : 'Could not reach the ShowTracker server. Is the backend running?'),
    retryAfterSeconds: apiError?.details?.retryAfterSeconds ?? null,
    fieldErrors: Array.isArray(apiError?.details) ? apiError.details : null, // validation problems: [{ field, message }]
    status: err.response?.status ?? null
  };
}

const cleanParams = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export async function searchMedia(params, signal) {
  // `genre` may be an array of names; the API takes a comma-separated list meaning "any of these".
  const genre = Array.isArray(params.genre) ? params.genre.join(',') : params.genre;
  const res = await apiClient.get('/media/search', { params: cleanParams({ ...params, genre }), signal });
  return res.data.data;
}

export async function getTrendingMedia(params, signal) {
  const res = await apiClient.get('/media/trending', { params: cleanParams(params), signal });
  return res.data.data;
}

export async function getMediaGenres(type, signal) {
  const res = await apiClient.get('/media/genres', { params: { type }, signal });
  return res.data.data;
}

export async function getMediaDetails({ provider, mediaType, externalId }, signal) {
  const res = await apiClient.get(
    `/media/details/${encodeURIComponent(provider)}/${encodeURIComponent(mediaType)}/${encodeURIComponent(externalId)}`,
    { signal }
  );
  return res.data.data;
}

// --------------------------------------------------------------- library ----
// All of these require a signed-in user (the axios interceptor attaches the token).

export async function getMyLibrary(params, signal) {
  const res = await apiClient.get('/library', { params: cleanParams(params), signal });
  return res.data.data;
}

/** -> { entry | null, watchedEpisodeIds: [] } */
export async function checkLibraryEntry(mediaId, signal) {
  const res = await apiClient.get(`/library/check/${encodeURIComponent(mediaId)}`, { signal });
  return res.data.data;
}

/** Live statistics for the signed-in user (derived from the database on every call). */
export async function getLibraryStats(signal) {
  const res = await apiClient.get('/library/stats', { signal });
  return res.data.data;
}

export async function getContinueWatching(signal) {
  const res = await apiClient.get('/library/continue-watching', { signal });
  return res.data.data;
}

export async function getRecentlyUpdated(signal) {
  const res = await apiClient.get('/library/recently-updated', { signal });
  return res.data.data;
}

export async function addToLibrary(payload) {
  const res = await apiClient.post('/library', payload);
  invalidateUserData();
  return res.data.data;
}

export async function updateLibraryEntry(id, payload) {
  const res = await apiClient.patch(`/library/${encodeURIComponent(id)}`, payload);
  invalidateUserData();
  return res.data.data;
}

export async function removeFromLibrary(id) {
  const res = await apiClient.delete(`/library/${encodeURIComponent(id)}`);
  invalidateUserData();
  return res.data.data;
}

export async function getMediaSeasons(mediaId, signal) {
  const res = await apiClient.get(`/media/${encodeURIComponent(mediaId)}/seasons`, { signal });
  return res.data.data;
}

export async function markEpisodeWatched(entryId, episodeId) {
  const res = await apiClient.post(`/library/${entryId}/episodes/${episodeId}/watched`);
  invalidateUserData();
  return res.data.data;
}

export async function markEpisodeUnwatched(entryId, episodeId) {
  const res = await apiClient.delete(`/library/${entryId}/episodes/${episodeId}/watched`);
  invalidateUserData();
  return res.data.data;
}

export async function markSeasonWatched(entryId, seasonId) {
  const res = await apiClient.post(`/library/${entryId}/seasons/${seasonId}/watched`);
  invalidateUserData();
  return res.data.data;
}

// ------------------------------------------------- custom groups (shelves) ----

export async function getLibraryGroups(signal) {
  const res = await apiClient.get('/library/groups', { signal });
  return res.data.data;
}

export async function createLibraryGroup(payload) {
  const res = await apiClient.post('/library/groups', payload);
  invalidateUserData();
  return res.data.data;
}

export async function updateLibraryGroup(id, payload) {
  const res = await apiClient.patch(`/library/groups/${encodeURIComponent(id)}`, payload);
  invalidateUserData();
  return res.data.data;
}

export async function deleteLibraryGroup(id) {
  const res = await apiClient.delete(`/library/groups/${encodeURIComponent(id)}`);
  invalidateUserData();
  return res.data.data;
}

export async function addToLibraryGroup(groupId, libraryEntryId) {
  const res = await apiClient.post(`/library/groups/${encodeURIComponent(groupId)}/items`, { libraryEntryId });
  invalidateUserData();
  return res.data.data;
}

export async function removeFromLibraryGroup(groupId, libraryEntryId) {
  const res = await apiClient.delete(
    `/library/groups/${encodeURIComponent(groupId)}/items/${encodeURIComponent(libraryEntryId)}`
  );
  invalidateUserData();
  return res.data.data;
}

/** -> { libraryEntryId, groupIds: [] } */
export async function getEntryGroups(libraryEntryId, signal) {
  const res = await apiClient.get(`/library/items/${encodeURIComponent(libraryEntryId)}/groups`, { signal });
  return res.data.data;
}

// ------------------------------------------------- release radar / franchise ----

/** -> { serverTime, items: [...] } upcoming episodes of the user's WATCHING / PLAN_TO_WATCH titles */
export async function getUpcomingReleases(signal) {
  const res = await apiClient.get('/library/upcoming', { signal });
  return res.data.data;
}

/** -> { isFranchise, seasonNumber, totalSeasons, root, members } for an AniList anime id */
export async function getAnimeFranchise(externalId, signal) {
  const res = await apiClient.get(`/media/franchise/${encodeURIComponent(externalId)}`, { signal });
  return res.data.data;
}

export default {
  apiClient,
  checkApiHealth,
  getMe,
  getLibraryStats,
  getContinueWatching,
  getRecentlyUpdated,
  checkUsernameAvailability,
  updateMyProfile,
  getPublicProfile
};
