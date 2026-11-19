import * as anilist from '../providers/anilist.provider.js';
import { TTLCache } from '../utils/ttlCache.js';
import { buildAnimeEpisodes, anilistKnownEpisodeCount } from './mediaNormalizer.js';

/**
 * Anime franchise linking.
 *
 * AniList publishes every cour of a story as its own entry (Attack on Titan,
 * Season 2, Season 3 ...). Here they are chained through PREQUEL / SEQUEL
 * relations and presented as Season 1, 2, 3 ... of ONE series, like a TV show.
 *
 * Rules (so unrelated entries are never merged):
 *   - only TV, TV_SHORT and ONA entries count as seasons (movies, OVAs, specials,
 *     music videos and manga are skipped)
 *   - a chain is followed through SEQUEL edges forward and PREQUEL edges backward
 *   - when an entry has several candidates, the earliest sequel / the nearest
 *     earlier prequel wins; every id is visited once, so cycles cannot loop
 *   - at most MAX_FRANCHISE_SEASONS entries per franchise
 *
 * Only the ROOT (the first season) owns the unified seasons. A sequel opened on
 * its own keeps its single season and is shown with a "Part of ..." link to the root.
 *
 * AniList data per entry is cached in memory (short TTL while airing), so walking
 * a franchise costs a handful of requests once, then nothing.
 */
export const FRANCHISE_FORMATS = new Set(['TV', 'TV_SHORT', 'ONA']);
export const MAX_FRANCHISE_SEASONS = 12;
/** Marker stored in seasons.overview so the provider entry behind a season is known. */
export const SEASON_SOURCE_PREFIX = 'anilist:';

const AIRING_TTL_MS = 30 * 60 * 1000;
const FINISHED_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new TTLCache({ maxEntries: 400 });

export const resetFranchiseCache = () => cache.clear();

const titleOf = (t) => [t?.english, t?.romaji, t?.native].map((s) => (typeof s === 'string' ? s.trim() : '')).find(Boolean) ?? null;

const startKey = (d) => (d?.year ? d.year * 10000 + (d.month || 0) * 100 + (d.day || 0) : null);
const isoDate = (d) =>
  d?.year ? `${d.year}-${String(d.month || 1).padStart(2, '0')}-${String(d.day || 1).padStart(2, '0')}` : null;

/** Loads one entry (with relations), cached. `id` is whatever AniList id was requested. */
async function loadNode(id) {
  const key = `node:${id}`;
  const node = await cache.getOrLoad(key, AIRING_TTL_MS, () => anilist.getAnimeFranchiseNode(id));
  if (node?.status === 'FINISHED') cache.set(key, node, FINISHED_TTL_MS);
  return node;
}

/** The sequel/prequel edge to follow from `node`, or null when the chain ends. */
function pickEdge(node, relationType, visited) {
  const candidates = (node?.relations?.edges ?? [])
    .filter(
      (e) =>
        e?.relationType === relationType &&
        e.node?.type === 'ANIME' &&
        FRANCHISE_FORMATS.has(e.node.format) &&
        !visited.has(String(e.node.id))
    )
    .map((e) => ({ id: String(e.node.id), key: startKey(e.node.startDate) }));
  if (candidates.length === 0) return null;

  const own = startKey(node.startDate);
  if (relationType === 'SEQUEL') {
    // earliest sequel (unknown dates last, then lowest id)
    candidates.sort((a, b) => (a.key ?? Infinity) - (b.key ?? Infinity) || Number(a.id) - Number(b.id));
    return candidates[0].id;
  }
  // PREQUEL: the nearest earlier one (latest start date that is not after this entry)
  const earlier = candidates.filter((c) => own === null || c.key === null || c.key <= own);
  const pool = earlier.length ? earlier : candidates;
  pool.sort((a, b) => (b.key ?? -Infinity) - (a.key ?? -Infinity) || Number(a.id) - Number(b.id));
  return pool[0].id;
}

/** True when this entry is the continuation of an earlier TV/ONA entry (it is NOT the first season). */
export function hasPrequel(node) {
  return pickEdge(node, 'PREQUEL', new Set()) !== null;
}

/** Entries after `start`, in order, following SEQUEL edges (start excluded). */
async function walkForward(startId, startNode, limit, visited) {
  const out = [];
  let cur = { id: String(startId), node: startNode };
  while (out.length < limit) {
    const nextId = pickEdge(cur.node, 'SEQUEL', visited);
    if (!nextId) break;
    visited.add(nextId);
    cur = { id: nextId, node: await loadNode(nextId) };
    out.push(cur);
  }
  return out;
}

/** Entries before `start`, nearest first, following PREQUEL edges (start excluded). */
async function walkBackward(startId, startNode, limit, visited) {
  const out = [];
  let cur = { id: String(startId), node: startNode };
  while (out.length < limit) {
    const prevId = pickEdge(cur.node, 'PREQUEL', visited);
    if (!prevId) break;
    visited.add(prevId);
    cur = { id: prevId, node: await loadNode(prevId) };
    out.push(cur);
  }
  return out;
}

const toMember = ({ id, node }) => ({
  externalId: String(id),
  title: titleOf(node.title),
  format: node.format ?? null,
  episodes: anilistKnownEpisodeCount(node),
  durationMinutes: Number.isInteger(node.duration) && node.duration > 0 ? node.duration : null,
  posterUrl: node.coverImage?.extraLarge || node.coverImage?.large || null,
  startDate: isoDate(node.startDate),
  year: node.startDate?.year ?? null
});

/**
 * The seasons of the franchise this entry belongs to, in order.
 * Members without a known episode count yet (unreleased) are left out.
 * @returns {Promise<{ members: object[], position: number|null, root: object|null }>}
 */
export async function resolveFranchise(externalId) {
  const startId = String(externalId);
  const startNode = await loadNode(startId);
  const visited = new Set([startId]);

  const back = await walkBackward(startId, startNode, MAX_FRANCHISE_SEASONS - 1, visited);
  const forward = await walkForward(startId, startNode, MAX_FRANCHISE_SEASONS - 1 - back.length, visited);

  const chain = [...back.reverse(), { id: startId, node: startNode }, ...forward].slice(0, MAX_FRANCHISE_SEASONS);
  const members = chain.map(toMember).filter((m) => m.episodes);
  const index = members.findIndex((m) => m.externalId === startId);
  return { members, position: index === -1 ? null : index + 1, root: members[0] ?? null };
}

/** A season plan (the shape episodeCatalog persists) for a list of franchise members. */
export function buildSeasonPlan(members) {
  return members.map((m, i) => {
    const episodes = buildAnimeEpisodes(m.episodes, m.durationMinutes);
    return {
      seasonNumber: i + 1,
      name: m.title ?? `Season ${i + 1}`,
      overview: `${SEASON_SOURCE_PREFIX}${m.externalId}`,
      posterUrl: m.posterUrl,
      airDate: m.startDate,
      episodeCount: episodes.length,
      episodes
    };
  });
}

/**
 * Seasons to store for the anime with this AniList id:
 *   - the first season of a franchise -> Season 1..N (every linked entry)
 *   - a sequel opened on its own      -> just its own season (it is tracked on its own)
 *   - a standalone anime              -> its single season
 */
export async function planAnimeSeasons(externalId) {
  const startId = String(externalId);
  const startNode = await loadNode(startId);

  if (hasPrequel(startNode)) {
    return buildSeasonPlan([toMember({ id: startId, node: startNode })].filter((m) => m.episodes));
  }
  const visited = new Set([startId]);
  const forward = await walkForward(startId, startNode, MAX_FRANCHISE_SEASONS - 1, visited);
  const members = [{ id: startId, node: startNode }, ...forward].map(toMember).filter((m) => m.episodes);
  return buildSeasonPlan(members);
}

/** What the title page needs: is this entry part of a longer series, and where does it sit in it? */
export async function getFranchiseSummary(externalId) {
  const { members, position, root } = await resolveFranchise(externalId);
  const isFranchise = members.length > 1 && position !== null;
  return {
    externalId: String(externalId),
    isFranchise,
    isRoot: isFranchise ? position === 1 : false,
    seasonNumber: isFranchise ? position : null,
    totalSeasons: isFranchise ? members.length : null,
    totalEpisodes: isFranchise ? members.reduce((sum, m) => sum + m.episodes, 0) : null,
    root: isFranchise && root ? { externalId: root.externalId, title: root.title } : null,
    members: isFranchise
      ? members.map((m, i) => ({
          seasonNumber: i + 1,
          externalId: m.externalId,
          title: m.title,
          episodes: m.episodes,
          year: m.year,
          posterUrl: m.posterUrl
        }))
      : []
  };
}

export default { resolveFranchise, planAnimeSeasons, getFranchiseSummary, resetFranchiseCache };
