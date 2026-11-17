-- ShowTracker initial relational schema reference
-- PostgreSQL 13+ recommended. Run against the `showtracker_dev` database.
-- This is a readable baseline. In the project, split changes into versioned
-- migration files and apply them through the selected migration runner.
-- The `user_sessions` table is created/managed by connect-pg-simple and is
-- intentionally not defined here.

BEGIN;

-- 001: USERS AND AUTHENTICATION IDENTITY
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(30) NOT NULL,
    email VARCHAR(254) NOT NULL,
    display_name VARCHAR(80),
    avatar_url TEXT,
    bio VARCHAR(300),
    profile_visibility VARCHAR(10) NOT NULL DEFAULT 'PUBLIC'
        CHECK (profile_visibility IN ('PUBLIC', 'PRIVATE')),
    library_visibility VARCHAR(10) NOT NULL DEFAULT 'PUBLIC'
        CHECK (library_visibility IN ('PUBLIC', 'PRIVATE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness. Application code should also normalize these
-- values to lowercase before inserting/updating them.
CREATE UNIQUE INDEX users_username_lower_unique
    ON users (LOWER(username));
CREATE UNIQUE INDEX users_email_lower_unique
    ON users (LOWER(email));

CREATE TABLE auth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('GOOGLE')),
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(254),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)
);
CREATE INDEX auth_accounts_user_id_idx ON auth_accounts(user_id);

-- 002: UNIFIED MEDIA CATALOG AND PROVIDER IDENTIFIERS
CREATE TABLE media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_type VARCHAR(10) NOT NULL
        CHECK (media_type IN ('ANIME', 'MOVIE', 'TV')),
    title VARCHAR(500) NOT NULL,
    original_title VARCHAR(500),
    overview TEXT,
    poster_url TEXT,
    backdrop_url TEXT,
    release_date DATE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX media_items_type_idx ON media_items(media_type);
CREATE INDEX media_items_title_lower_idx ON media_items(LOWER(title));

CREATE TABLE media_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('ANILIST', 'TMDB')),
    provider_media_type VARCHAR(20) NOT NULL,
    external_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_media_type, external_id)
);
CREATE INDEX media_sources_media_id_idx ON media_sources(media_id);

CREATE TABLE genres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE media_genres (
    media_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (media_id, genre_id)
);
CREATE INDEX media_genres_genre_id_idx ON media_genres(genre_id);

-- 003: SEASONS AND EPISODES
CREATE TABLE seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL CHECK (season_number >= 0),
    name VARCHAR(255),
    overview TEXT,
    poster_url TEXT,
    air_date DATE,
    episode_count INTEGER CHECK (episode_count IS NULL OR episode_count >= 0),
    UNIQUE (media_id, season_number)
);
CREATE INDEX seasons_media_id_idx ON seasons(media_id);

CREATE TABLE episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL CHECK (episode_number > 0),
    title VARCHAR(255),
    overview TEXT,
    air_date DATE,
    runtime_minutes INTEGER CHECK (runtime_minutes IS NULL OR runtime_minutes > 0),
    UNIQUE (season_id, episode_number)
);
CREATE INDEX episodes_season_id_idx ON episodes(season_id);

-- 004: USER LIBRARY AND EPISODE PROGRESS
CREATE TABLE user_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media_items(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN (
            'WATCHING',
            'COMPLETED',
            'PLAN_TO_WATCH',
            'ON_HOLD',
            'DROPPED',
            'REWATCHING'
        )),
    rating NUMERIC(3,1)
        CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    notes VARCHAR(1000),
    started_at DATE,
    completed_at DATE,
    rewatch_count INTEGER NOT NULL DEFAULT 0 CHECK (rewatch_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, media_id)
);
CREATE INDEX user_library_user_status_idx
    ON user_library(user_id, status);
CREATE INDEX user_library_user_updated_idx
    ON user_library(user_id, updated_at DESC);
CREATE INDEX user_library_media_id_idx
    ON user_library(media_id);

-- A row means that this user marked this episode as watched.
-- Deleting the row marks it unwatched; the catalog episode remains.
CREATE TABLE user_episode_progress (
    user_library_id UUID NOT NULL
        REFERENCES user_library(id) ON DELETE CASCADE,
    episode_id UUID NOT NULL
        REFERENCES episodes(id) ON DELETE CASCADE,
    watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_library_id, episode_id)
);
CREATE INDEX user_episode_progress_episode_id_idx
    ON user_episode_progress(episode_id);
CREATE INDEX user_episode_progress_watched_at_idx
    ON user_episode_progress(user_library_id, watched_at DESC);

COMMIT;

-- NOTE FOR THE BACKEND:
-- Before inserting user_episode_progress, verify that:
-- 1. the user owns the user_library row;
-- 2. the episode belongs to the same media item as that library row;
-- 3. the media item is ANIME or TV, never MOVIE.
-- These cross-table rules are checked in the service layer and covered by tests.
