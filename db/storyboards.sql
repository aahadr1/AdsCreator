-- Storyboards Table
-- Stores complete storyboard drafts with all scenes and metadata

CREATE TABLE IF NOT EXISTS storyboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES assistant_conversations(id) ON DELETE SET NULL,
  
  -- Metadata
  title TEXT NOT NULL,
  brand_name TEXT,
  product TEXT,
  product_description TEXT,
  target_audience TEXT,
  platform TEXT CHECK (platform IN ('tiktok', 'instagram', 'facebook', 'youtube_shorts')),
  total_duration_seconds INTEGER,
  style TEXT,
  aspect_ratio TEXT DEFAULT '9:16',
  
  -- Avatar reference
  avatar_image_url TEXT,
  avatar_description TEXT,
  
  -- Product image reference
  product_image_url TEXT,
  product_image_description TEXT,
  
  -- Video scenario (creative foundation)
  scenario JSONB,
  
  -- Scenes data
  scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'planning', 'refining_scenes', 'awaiting_product_image', 'generating', 'ready', 'failed')
  ),
  
  -- Scenes needing product image
  scenes_needing_product INTEGER[],
  
  -- Version control
  version INTEGER NOT NULL DEFAULT 1,
  parent_version_id UUID REFERENCES storyboards(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_storyboards_user_id ON storyboards(user_id) WHERE deleted_at IS NULL;

-- Index for conversation lookups
CREATE INDEX IF NOT EXISTS idx_storyboards_conversation_id ON storyboards(conversation_id) WHERE deleted_at IS NULL;

-- Index for recent storyboards
CREATE INDEX IF NOT EXISTS idx_storyboards_updated_at ON storyboards(updated_at DESC) WHERE deleted_at IS NULL;

-- Index for version history
CREATE INDEX IF NOT EXISTS idx_storyboards_parent_version ON storyboards(parent_version_id) WHERE deleted_at IS NULL;

-- RLS Policies
ALTER TABLE storyboards ENABLE ROW LEVEL SECURITY;

-- Users can only see their own storyboards
CREATE POLICY "Users can view own storyboards"
  ON storyboards FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can create their own storyboards
CREATE POLICY "Users can create own storyboards"
  ON storyboards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own storyboards
CREATE POLICY "Users can update own storyboards"
  ON storyboards FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can soft delete their own storyboards
CREATE POLICY "Users can delete own storyboards"
  ON storyboards FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_storyboards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_storyboards_updated_at ON storyboards;
CREATE TRIGGER trigger_update_storyboards_updated_at
  BEFORE UPDATE ON storyboards
  FOR EACH ROW
  EXECUTE FUNCTION update_storyboards_updated_at();

-- Storyboard Edit History Table (for version tracking and undo/redo)
CREATE TABLE IF NOT EXISTS storyboard_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyboard_id UUID NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What changed
  change_type TEXT NOT NULL CHECK (
    change_type IN ('scene_created', 'scene_updated', 'scene_deleted', 'scene_reordered', 'metadata_updated', 'full_update')
  ),
  
  -- Snapshot of storyboard state before this change
  before_state JSONB,
  
  -- Snapshot of storyboard state after this change
  after_state JSONB,
  
  -- Optional description
  description TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_storyboard_edit_history_storyboard ON storyboard_edit_history(storyboard_id, created_at DESC);

-- RLS for edit history
ALTER TABLE storyboard_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own storyboard history"
  ON storyboard_edit_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own storyboard history"
  ON storyboard_edit_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to auto-create version snapshots on significant changes
CREATE OR REPLACE FUNCTION create_storyboard_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create version if scenes were modified
  IF OLD.scenes IS DISTINCT FROM NEW.scenes THEN
    INSERT INTO storyboard_edit_history (
      storyboard_id,
      user_id,
      change_type,
      before_state,
      after_state
    ) VALUES (
      NEW.id,
      NEW.user_id,
      'full_update',
      row_to_json(OLD),
      row_to_json(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-versioning
DROP TRIGGER IF EXISTS trigger_create_storyboard_version ON storyboards;
CREATE TRIGGER trigger_create_storyboard_version
  AFTER UPDATE ON storyboards
  FOR EACH ROW
  EXECUTE FUNCTION create_storyboard_version();

-- Comments
COMMENT ON TABLE storyboards IS 'Stores complete storyboard drafts with all scenes, metadata, and version control';
COMMENT ON COLUMN storyboards.scenario IS 'High-level video scenario including concept, narrative arc, and scene breakdown';
COMMENT ON COLUMN storyboards.scenes IS 'Array of detailed scene objects with prompts, frame URLs, and metadata';
COMMENT ON COLUMN storyboards.version IS 'Version number for this storyboard instance';
COMMENT ON COLUMN storyboards.parent_version_id IS 'Reference to parent version for tracking lineage';
COMMENT ON TABLE storyboard_edit_history IS 'Version history for storyboards to enable undo/redo and audit trail';
