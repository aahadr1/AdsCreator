-- Influencers Table
-- Stores user-created influencer personas with generated photoshoots

CREATE TABLE IF NOT EXISTS influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  name TEXT NOT NULL,
  username TEXT, -- Generated from name, same as name
  
  -- Legacy fields (kept for backward compatibility with older deployments/UI)
  -- The app now uses user_description/enriched_description primarily.
  short_description TEXT,
  full_description TEXT,
  
  -- User input
  user_description TEXT NOT NULL, -- Original user description
  
  -- LLM enriched description
  enriched_description TEXT, -- Enhanced description by LLM with modern details
  
  -- Generation metadata (not used for now, kept for backward compatibility)
  generation_prompt TEXT, -- Deprecated: use enriched_description instead
  input_images TEXT[], -- Array of URLs if user provided reference images
  
  -- Generated photoshoot images (5 angles)
  photo_face_closeup TEXT, -- Face close-up shot
  photo_full_body TEXT, -- Full body shot
  photo_right_side TEXT, -- Right side view
  photo_left_side TEXT, -- Left side view
  photo_back_top TEXT, -- Back view from bird's eye/top view
  
  -- Additional photos for Instagram-like grid
  additional_photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Generation status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'enriching', 'generating', 'completed', 'failed')
  ),
  generation_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_influencers_user_id ON influencers(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_updated_at ON influencers(updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_influencers_status ON influencers(status) WHERE deleted_at IS NULL;

-- RLS Policies
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;

-- Users can only see their own influencers
CREATE POLICY "Users can view own influencers"
  ON influencers FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can create their own influencers
CREATE POLICY "Users can create own influencers"
  ON influencers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own influencers
CREATE POLICY "Users can update own influencers"
  ON influencers FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can soft delete their own influencers
CREATE POLICY "Users can delete own influencers"
  ON influencers FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_influencers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_influencers_updated_at ON influencers;
CREATE TRIGGER trigger_update_influencers_updated_at
  BEFORE UPDATE ON influencers
  FOR EACH ROW
  EXECUTE FUNCTION update_influencers_updated_at();

-- Comments
COMMENT ON TABLE influencers IS 'Stores user-created influencer personas with AI-generated photoshoots';
COMMENT ON COLUMN influencers.generation_prompt IS 'User-provided description for generating the influencer';
COMMENT ON COLUMN influencers.photo_face_closeup IS 'Face close-up shot from photoshoot';
COMMENT ON COLUMN influencers.photo_full_body IS 'Full body shot from photoshoot';
COMMENT ON COLUMN influencers.photo_right_side IS 'Right side view from photoshoot';
COMMENT ON COLUMN influencers.photo_left_side IS 'Left side view from photoshoot';
COMMENT ON COLUMN influencers.photo_back_top IS 'Back/top view from photoshoot';
COMMENT ON COLUMN influencers.additional_photos IS 'Array of additional photos for Instagram-like grid display';
