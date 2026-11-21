/**
 * Master Test Suite for Upcoming Episodes (28-day window, eligibility, multi-episode, library sync).
 *
 * Verifies:
 * - calculateUpcomingStatus buckets (TODAY, TOMORROW, THIS_WEEK, NEXT_WEEK, LATER)
 * - 28-day rolling window boundaries (now < episode.airDate <= now + 28 days)
 * - Eligibility rules across show categories (A: Running, B: Upcoming Season, C: Hiatus, D: Cancelled/Ended)
 * - Multi-episode scheduling per show
 * - User library isolation and synchronization
 */
import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';

const { migrationPool, closePool } = await import('../src/config/database.js');
const { createLibraryRouter } = await import('../src/modules/library/library.routes.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const {
  getUpcoming,
  resetRadarState,
  calculateUpcomingStatus,
  UPCOMING_WINDOW_DAYS,
  UPCOMING_WINDOW_MS
} = await import('../src/modules/library/radar.service.js');

const admin = migrationPool;
const userAlpha = crypto.randomUUID();
const userBeta = crypto.randomUUID();
const realFetch = globalThis.fetch;

const fakeAuth = (req, res, next) => {
  req.user = { id: req.headers['x-test-user'] };
  next();
};
const app = express();
app.use(express.json());
app.use('/api/library', createLibraryRouter({ auth: fakeAuth }));
app.use(errorHandler);

const getUpcomingReq = (user) => request(app).get('/api/library/upcoming').set('x-test-user', user);

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Fixed reference timestamp: 2026-11-20 12:00:00 UTC
const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);
const sec = (ms) => Math.floor(ms / 1000);
const HOUR = 3600_000;
const DAY = 24 * HOUR;

let anilistSchedules; // id -> array of { episode, airingAt, timeUntilAiring }
let tmdbDetails; // id -> show object

function installMockFetch() {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('graphql.anilist.co')) {
      const body = JSON.parse(init.body);
      const isScheduleQuery = body.query && body.query.includes('airingSchedules');
      if (isScheduleQuery) {
        const ids = body.variables.ids || [];
        const schedules = [];
        for (const id of ids) {
          const showScheds = anilistSchedules.get(Number(id)) || [];
          for (const s of showScheds) {
            schedules.push({
              id: Number(`${id}${s.episode}`),
              airingAt: s.airingAt,
              timeUntilAiring: Math.max(0, s.airingAt - sec(NOW)),
              episode: s.episode,
              mediaId: Number(id),
              media: {
                id: Number(id),
                status: s.status || 'RELEASING'
              }
            });
          }
        }
        return jsonResponse({ data: { Page: { airingSchedules: schedules } } });
      }
      // Standard single media query
      const media = (body.variables.ids || []).map((id) => ({
        id,
        episodes: null,
        status: 'RELEASING',
        nextAiringEpisode: null
      }));
      return jsonResponse({ data: { Page: { media } } });
    }

    const m = u.match(/\/tv\/(\d+)/);
    if (m) {
      const show = tmdbDetails.get(m[1]) || { status: 'Ended', next_episode_to_air: null };
      return jsonResponse(show);
    }
    throw new Error(`unmocked fetch in upcoming-episodes test: ${u}`);
  };
}

async function insertTestMedia(title, mediaType, provider, externalId, metadata) {
  const { rows } = await admin.query(
    `INSERT INTO public.media_items (media_type, title, metadata) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [mediaType, title, JSON.stringify(metadata)]
  );
  await admin.query(
    `INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id) VALUES ($1, $2, $3, $4)`,
    [rows[0].id, provider, mediaType, externalId]
  );
  return rows[0].id;
}

async function addEntry(user, mediaId, status = 'WATCHING') {
  const { rows } = await admin.query(
    `INSERT INTO public.user_library (user_id, media_id, status) VALUES ($1, $2, $3) RETURNING id`,
    [user, mediaId, status]
  );
  return rows[0].id;
}

async function cleanup() {
  await admin.query(`DELETE FROM auth.users WHERE id IN ('${userAlpha}', '${userBeta}') OR email LIKE 'test-upcoming-%@example.invalid'`);
  await admin.query(`DELETE FROM public.profiles WHERE id IN ('${userAlpha}', '${userBeta}') OR username LIKE 'upcoming_user_%'`);
  const { rows } = await admin.query(`SELECT id FROM public.media_items WHERE title LIKE 'TEST_UPCOMING_%'`);
  const mediaIds = rows.map((r) => r.id);
  if (mediaIds.length > 0) {
    await admin.query(`DELETE FROM public.user_library WHERE media_id = ANY($1::uuid[])`, [mediaIds]);
    await admin.query(`DELETE FROM public.media_sources WHERE media_id = ANY($1::uuid[])`, [mediaIds]);
    await admin.query(`DELETE FROM public.media_items WHERE id = ANY($1::uuid[])`, [mediaIds]);
  }
}

async function setupTestUsers() {
  await admin.query(`
    INSERT INTO auth.users (id, email)
    VALUES
      ('${userAlpha}', 'test-upcoming-a@example.invalid'),
      ('${userBeta}', 'test-upcoming-b@example.invalid')
    ON CONFLICT (id) DO NOTHING
  `);
  await admin.query(`
    INSERT INTO public.profiles (id, username)
    VALUES
      ('${userAlpha}', 'upcoming_user_a'),
      ('${userBeta}', 'upcoming_user_b')
    ON CONFLICT (id) DO NOTHING
  `);
}

before(async () => {
  await cleanup();
  await setupTestUsers();
  installMockFetch();
});

after(async () => {
  globalThis.fetch = realFetch;
  await cleanup();
  await closePool();
});

beforeEach(() => {
  resetRadarState();
  anilistSchedules = new Map();
  tmdbDetails = new Map();
});

test('calculateUpcomingStatus properly categorizes timeline into buckets', () => {
  const baseNow = Date.UTC(2026, 10, 20, 12, 0, 0); // Friday 12:00 UTC
  const dayMs = 24 * 60 * 60 * 1000;

  // Today
  assert.equal(calculateUpcomingStatus(baseNow + 2 * 3600_000, baseNow, false), 'TODAY');
  // Tomorrow
  assert.equal(calculateUpcomingStatus(baseNow + 1 * dayMs, baseNow, false), 'TOMORROW');
  // This week (3 days)
  assert.equal(calculateUpcomingStatus(baseNow + 3 * dayMs, baseNow, false), 'THIS_WEEK');
  // Next week (10 days)
  assert.equal(calculateUpcomingStatus(baseNow + 10 * dayMs, baseNow, false), 'NEXT_WEEK');
  // Later in 28 days (20 days)
  assert.equal(calculateUpcomingStatus(baseNow + 20 * dayMs, baseNow, false), 'LATER');
});

test('Upcoming Window is exactly 28 days', () => {
  assert.equal(UPCOMING_WINDOW_DAYS, 28);
  assert.equal(UPCOMING_WINDOW_MS, 28 * 24 * 60 * 60 * 1000);
});

test('Category A: Currently airing show with multiple episodes in next 28 days', async () => {
  const nowMs = Date.now();
  const animeId = await insertTestMedia('TEST_UPCOMING_Chainsaw', 'ANIME', 'ANILIST', '99901', {
    status: 'RELEASING',
    posterUrl: 'https://example.com/csm.jpg',
    nextAiring: sec(nowMs + 3 * DAY),
    nextAiringEpisode: 7
  });
  await addEntry(userAlpha, animeId, 'WATCHING');

  const res = await getUpcomingReq(userAlpha);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.windowDays, 28);

  const items = res.body.data.items.filter((it) => it.externalId === '99901');
  assert.ok(items.length >= 3, 'Multiple episodes in 28-day window scheduled');
  assert.equal(items[0].episodeNumber, 7);
  assert.equal(items[1].episodeNumber, 8);
  assert.equal(items[2].episodeNumber, 9);
  assert.ok(items[0].airingAt < items[1].airingAt);
});

test('Category B: Announced upcoming season with confirmed premiere date in window', async () => {
  const nowMs = Date.now();
  const animeId = await insertTestMedia('TEST_UPCOMING_SoloLeveling_S2', 'ANIME', 'ANILIST', '99902', {
    status: 'NOT_YET_RELEASED',
    posterUrl: 'https://example.com/sl2.jpg',
    nextAiring: sec(nowMs + 14 * DAY),
    nextAiringEpisode: 1
  });
  await addEntry(userAlpha, animeId, 'PLAN_TO_WATCH');

  const res = await getUpcomingReq(userAlpha);
  assert.equal(res.status, 200);
  const items = res.body.data.items.filter((it) => it.externalId === '99902');
  assert.equal(items.length, 1);
  assert.equal(items[0].episodeNumber, 1);
});

test('Category C: Hiatus show with confirmed return date', async () => {
  const nowMs = Date.now();
  const animeId = await insertTestMedia('TEST_UPCOMING_Nier', 'ANIME', 'ANILIST', '99903', {
    status: 'HIATUS',
    posterUrl: 'https://example.com/nier.jpg',
    nextAiring: sec(nowMs + 5 * DAY),
    nextAiringEpisode: 9
  });
  await addEntry(userAlpha, animeId, 'WATCHING');

  const res = await getUpcomingReq(userAlpha);
  assert.equal(res.status, 200);
  const items = res.body.data.items.filter((it) => it.externalId === '99903');
  assert.equal(items.length, 1);
  assert.equal(items[0].episodeNumber, 9);
});

test('Category D: Completed or Cancelled show with NO confirmed future episodes is excluded', async () => {
  const animeId = await insertTestMedia('TEST_UPCOMING_AttackOnTitan_Final', 'ANIME', 'ANILIST', '99904', {
    status: 'FINISHED',
    posterUrl: 'https://example.com/aot.jpg'
  });
  await addEntry(userAlpha, animeId, 'COMPLETED');

  const res = await getUpcomingReq(userAlpha);
  assert.equal(res.status, 200);
  const items = res.body.data.items.filter((it) => it.externalId === '99904');
  assert.equal(items.length, 0, 'Completed show without future episodes must not appear');
});

test('Window boundary: Episodes beyond 28 days are excluded', async () => {
  const nowMs = Date.now();
  const animeId = await insertTestMedia('TEST_UPCOMING_FarAway', 'ANIME', 'ANILIST', '99905', {
    status: 'RELEASING',
    posterUrl: 'https://example.com/far.jpg',
    nextAiring: sec(nowMs + 20 * DAY),
    nextAiringEpisode: 1
  });
  await addEntry(userAlpha, animeId, 'WATCHING');

  const res = await getUpcomingReq(userAlpha);
  assert.equal(res.status, 200);
  const items = res.body.data.items.filter((it) => it.externalId === '99905');
  // At +20 days, ep 1 is in window. Ep 2 is at +27 days (in window). Ep 3 is at +34 days (> 28 days, excluded).
  assert.ok(items.length >= 1);
  assert.ok(items.every((it) => Date.parse(it.airingAt) <= nowMs + 28 * DAY));
});

test('Library Isolation: User only receives upcoming episodes of shows in their own library', async () => {
  const nowMs = Date.now();
  const mediaForA = await insertTestMedia('TEST_UPCOMING_OnlyForUserA', 'ANIME', 'ANILIST', '99906', {
    status: 'RELEASING',
    nextAiring: sec(nowMs + 2 * DAY),
    nextAiringEpisode: 5
  });
  const mediaForB = await insertTestMedia('TEST_UPCOMING_OnlyForUserB', 'ANIME', 'ANILIST', '99907', {
    status: 'RELEASING',
    nextAiring: sec(nowMs + 2 * DAY),
    nextAiringEpisode: 12
  });

  await addEntry(userAlpha, mediaForA, 'WATCHING');
  await addEntry(userBeta, mediaForB, 'WATCHING');

  const resA = await getUpcomingReq(userAlpha);
  const resB = await getUpcomingReq(userBeta);

  const itemsA = resA.body.data.items;
  const itemsB = resB.body.data.items;

  assert.ok(itemsA.some((it) => it.externalId === '99906'), 'User A should see their own show');
  assert.ok(!itemsA.some((it) => it.externalId === '99907'), 'User A must not see User B show');

  assert.ok(itemsB.some((it) => it.externalId === '99907'), 'User B should see their own show');
  assert.ok(!itemsB.some((it) => it.externalId === '99906'), 'User B must not see User A show');
});
