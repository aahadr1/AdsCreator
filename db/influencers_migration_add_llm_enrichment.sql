-- Influencers Migration: add LLM enrichment columns + PostgREST reload
-- This file is needed because CREATE TABLE IF NOT EXISTS does NOT update an existing table.
--
-- Apply this in Supabase SQL editor if you already created the influencers table earlier.

-- 1) Add new columns (safe / idempotent)
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS user_description TEXT,
  ADD COLUMN IF NOT EXISTS enriched_description TEXT;

-- 2) Ensure legacy columns exist (some older deployments may have them)
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS full_description TEXT;

-- 3) Backfill user_description from existing data
UPDATE influencers
SET user_description = COALESCE(
  user_description,
  short_description,
  generation_prompt,
  name,
  ''
)
WHERE user_description IS NULL;

-- 4) Make user_description NOT NULL (after backfill)
ALTER TABLE influencers
  ALTER COLUMN user_description SET NOT NULL;

-- 5) Expand status constraint to include 'enriching'
ALTER TABLE influencers
  DROP CONSTRAINT IF EXISTS influencers_status_check;

ALTER TABLE influencers
  ADD CONSTRAINT influencers_status_check
  CHECK (status IN ('draft', 'enriching', 'generating', 'completed', 'failed'));

-- 6) Force PostgREST schema cache reload (Supabase)
-- This fixes errors like: "Could not find the 'enriched_description' column ... in the schema cache"
NOTIFY pgrst, 'reload schema';

