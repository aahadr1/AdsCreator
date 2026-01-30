-- Influencers Migration: add MAIN image + globally-unique username (case-insensitive)
-- This file is needed because CREATE TABLE IF NOT EXISTS does NOT update an existing table.
--
-- Apply this in Supabase SQL editor if you already created the influencers table earlier.

-- 1) Add new columns (safe / idempotent)
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS photo_main TEXT;

COMMENT ON COLUMN influencers.photo_main IS 'Primary influencer image (6th): montage/collage generated from the 5 photoshoot angles';

-- 2) Enforce username format for NEW rows without breaking old rows
-- NOT VALID means existing rows are not checked, but new writes are enforced.
ALTER TABLE influencers
  ADD CONSTRAINT IF NOT EXISTS influencers_username_format_check
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{2,32}$')
  NOT VALID;

-- 3) Enforce global uniqueness (case-insensitive) while respecting soft delete
-- This will fail if you already have duplicate usernames among non-deleted rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_influencers_username_unique_ci
  ON influencers (lower(username))
  WHERE deleted_at IS NULL AND username IS NOT NULL;

-- 4) Force PostgREST schema cache reload (Supabase)
-- This fixes errors like: "Could not find the 'photo_main' column ... in the schema cache"
NOTIFY pgrst, 'reload schema';

