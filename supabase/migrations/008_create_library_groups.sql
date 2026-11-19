-- ============================================================================
-- SHOWTRACKER — MIGRATION 008: CUSTOM LIBRARY GROUPS (many-to-many collections)
-- ============================================================================
-- A user can create their own shelves ("Watched in 2026", "Peak Shonen") and put
-- any library title on as many shelves as they like.
--
--   library_groups       one row per shelf, owned by one user
--   library_group_items  the many-to-many link: shelf <-> library entry
--
-- Deleting a shelf only deletes its links, never the titles in the library.
-- Deleting a library entry removes it from every shelf (ON DELETE CASCADE).
-- Everything is private: Row Level Security is FORCED and keyed on auth.uid().
-- ============================================================================

-- 1. library_groups ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.library_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT NOT NULL DEFAULT 'amber',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT library_groups_name_check
        CHECK (char_length(btrim(name)) > 0 AND char_length(name) <= 60),
    CONSTRAINT library_groups_description_check
        CHECK (description IS NULL OR char_length(description) <= 200),
    CONSTRAINT library_groups_color_check
        CHECK (color ~ '^[a-z]{3,20}$')
);

-- One shelf name per user, ignoring case ("Peak Shonen" == "peak shonen").
CREATE UNIQUE INDEX IF NOT EXISTS library_groups_user_name_lower_idx
    ON public.library_groups (user_id, LOWER(name));
CREATE INDEX IF NOT EXISTS library_groups_user_created_idx
    ON public.library_groups (user_id, created_at);

DROP TRIGGER IF EXISTS set_library_groups_updated_at ON public.library_groups;
CREATE TRIGGER set_library_groups_updated_at
    BEFORE UPDATE ON public.library_groups
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. library_group_items -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.library_group_items (
    group_id         UUID NOT NULL REFERENCES public.library_groups(id) ON DELETE CASCADE,
    library_entry_id UUID NOT NULL REFERENCES public.user_library(id) ON DELETE CASCADE,
    added_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, library_entry_id)
);

-- "which shelves is this title on?" and cascade deletes from user_library
CREATE INDEX IF NOT EXISTS library_group_items_entry_idx
    ON public.library_group_items (library_entry_id);

-- 3. Permissions -------------------------------------------------------------
REVOKE ALL ON public.library_groups, public.library_group_items FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.library_groups, public.library_group_items FROM showtracker_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_groups      TO showtracker_app;
GRANT SELECT, INSERT, DELETE         ON public.library_group_items TO showtracker_app;

-- 4. Row Level Security ------------------------------------------------------
ALTER TABLE public.library_groups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_groups      FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.library_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_group_items FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_groups_select ON public.library_groups;
DROP POLICY IF EXISTS library_groups_insert ON public.library_groups;
DROP POLICY IF EXISTS library_groups_update ON public.library_groups;
DROP POLICY IF EXISTS library_groups_delete ON public.library_groups;

CREATE POLICY library_groups_select ON public.library_groups
    FOR SELECT TO showtracker_app USING (auth.uid() = user_id);
CREATE POLICY library_groups_insert ON public.library_groups
    FOR INSERT TO showtracker_app WITH CHECK (auth.uid() = user_id);
CREATE POLICY library_groups_update ON public.library_groups
    FOR UPDATE TO showtracker_app USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY library_groups_delete ON public.library_groups
    FOR DELETE TO showtracker_app USING (auth.uid() = user_id);

-- A link is owned through its shelf. Inserting also requires that the library
-- entry is the caller's own, so a user can never attach someone else's entry.
DROP POLICY IF EXISTS library_group_items_select ON public.library_group_items;
DROP POLICY IF EXISTS library_group_items_insert ON public.library_group_items;
DROP POLICY IF EXISTS library_group_items_delete ON public.library_group_items;

CREATE POLICY library_group_items_select ON public.library_group_items
    FOR SELECT TO showtracker_app
    USING (EXISTS (SELECT 1 FROM public.library_groups g
                    WHERE g.id = group_id AND g.user_id = auth.uid()));
CREATE POLICY library_group_items_insert ON public.library_group_items
    FOR INSERT TO showtracker_app
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.library_groups g
                 WHERE g.id = group_id AND g.user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.user_library ul
                     WHERE ul.id = library_entry_id AND ul.user_id = auth.uid())
    );
CREATE POLICY library_group_items_delete ON public.library_group_items
    FOR DELETE TO showtracker_app
    USING (EXISTS (SELECT 1 FROM public.library_groups g
                    WHERE g.id = group_id AND g.user_id = auth.uid()));
