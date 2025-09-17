-- Ad Creatives Database Schema
-- This creates the necessary tables for the ad creative workflow

-- Main ad creatives table
CREATE TABLE IF NOT EXISTS ad_creatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic info
    name TEXT NOT NULL,
    hook TEXT,
    message TEXT,
    cta TEXT,
    angles TEXT[] DEFAULT '{}',
    
    -- Status and progress
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in-progress', 'ready', 'error')),
    current_step TEXT DEFAULT 'concept' CHECK (current_step IN ('concept', 'avatar-voice', 'base-video', 'broll', 'summary')),
    
    -- Avatar & Voice data
    avatar_url TEXT,
    script TEXT,
    audio_url TEXT,
    voice_provider TEXT CHECK (voice_provider IN ('elevenlabs', 'minimax', 'dia')),
    voice_id TEXT,
    
    -- Base video data
    base_video_url TEXT,
    base_video_job_id TEXT,
    background_removed BOOLEAN DEFAULT FALSE,
    
    -- B-roll data (stored as JSONB for flexibility)
    script_segments JSONB,
    broll_items JSONB,
    
    -- Final output
    final_video_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on user_id for performance
CREATE INDEX IF NOT EXISTS idx_ad_creatives_user_id ON ad_creatives(user_id);

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_ad_creatives_status ON ad_creatives(status);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_ad_creatives_created_at ON ad_creatives(created_at DESC);

-- Angles library table (predefined marketing angles)
CREATE TABLE IF NOT EXISTS ad_angles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default angles
INSERT INTO ad_angles (name, description, category) VALUES
    ('Problem/Solution', 'Identify a pain point and present your product as the solution', 'Core'),
    ('Before/After Transformation', 'Show the transformation your product enables', 'Social Proof'),
    ('Social Proof/Testimonial', 'Use customer testimonials and reviews', 'Social Proof'),
    ('Limited Time Offer', 'Create urgency with time-sensitive deals', 'Urgency'),
    ('Comparison/Competitive', 'Compare against competitors or alternatives', 'Positioning'),
    ('Behind the Scenes', 'Show how your product is made or your company culture', 'Transparency'),
    ('User Generated Content', 'Feature real customers using your product', 'Social Proof'),
    ('How-To/Educational', 'Teach something valuable related to your product', 'Educational'),
    ('Seasonal/Trending', 'Tie into current events, seasons, or trends', 'Timely'),
    ('Fear of Missing Out (FOMO)', 'Highlight what they might miss without your product', 'Urgency'),
    ('Authority/Expert', 'Position yourself or endorsers as experts', 'Credibility'),
    ('Story/Narrative', 'Tell a compelling brand or customer story', 'Emotional')
ON CONFLICT (name) DO NOTHING;

-- Messages library table (predefined core messages)
CREATE TABLE IF NOT EXISTS ad_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert some default message templates
INSERT INTO ad_messages (title, content, category, tags) VALUES
    ('Quality Sleep Solution', 'Get the best sleep of your life with our advanced technology that regulates temperature and eliminates common sleep disruptions.', 'Sleep', ARRAY['comfort', 'health', 'technology']),
    ('Revolutionary Cooling Technology', 'Experience innovative cooling fabric that pulls heat and moisture away from your body, keeping you comfortable all night long.', 'Technology', ARRAY['innovation', 'comfort', 'cooling']),
    ('Health and Wellness', 'Stop suffering from night sweats and overheating. Our solution promotes better sleep health and overall wellness.', 'Health', ARRAY['wellness', 'health', 'sleep']),
    ('Convenience and Ease', 'Simple to use, machine washable, and designed to fit seamlessly into your daily routine.', 'Convenience', ARRAY['easy', 'practical', 'maintenance'])
ON CONFLICT DO NOTHING;

-- CTAs library table (predefined call-to-actions)
CREATE TABLE IF NOT EXISTS ad_ctas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text TEXT NOT NULL UNIQUE,
    urgency_level INTEGER DEFAULT 1 CHECK (urgency_level BETWEEN 1 AND 5),
    category TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default CTAs
INSERT INTO ad_ctas (text, urgency_level, category) VALUES
    ('Shop now - Buy one, get one FREE!', 4, 'BOGO'),
    ('Limited time offer - Order today!', 4, 'Urgency'),
    ('Try risk-free with 30-day guarantee', 2, 'Risk Reduction'),
    ('Get yours before they sell out', 5, 'Scarcity'),
    ('Save 50% - This weekend only!', 5, 'Discount'),
    ('Free shipping on all orders', 2, 'Incentive'),
    ('Join thousands of happy customers', 3, 'Social Proof'),
    ('Transform your sleep tonight', 3, 'Transformation'),
    ('Click to claim your discount', 3, 'Action'),
    ('Don''t wait - Supplies are limited!', 5, 'Scarcity')
ON CONFLICT (text) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_ad_creatives_updated_at 
    BEFORE UPDATE ON ad_creatives 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;

-- Users can only see their own creatives
CREATE POLICY "Users can view own ad creatives" ON ad_creatives
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own creatives
CREATE POLICY "Users can insert own ad creatives" ON ad_creatives
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own creatives
CREATE POLICY "Users can update own ad creatives" ON ad_creatives
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own creatives
CREATE POLICY "Users can delete own ad creatives" ON ad_creatives
    FOR DELETE USING (auth.uid() = user_id);

-- Public read access for library tables
ALTER TABLE ad_angles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_ctas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view angles" ON ad_angles FOR SELECT USING (is_active = true);
CREATE POLICY "Everyone can view messages" ON ad_messages FOR SELECT USING (is_active = true);
CREATE POLICY "Everyone can view ctas" ON ad_ctas FOR SELECT USING (is_active = true);

-- Views for easier querying
CREATE OR REPLACE VIEW ad_creatives_with_stats AS
SELECT 
    ac.*,
    CASE 
        WHEN ac.final_video_url IS NOT NULL THEN 'completed'
        WHEN ac.base_video_url IS NOT NULL THEN 'video_ready'
        WHEN ac.script IS NOT NULL AND ac.audio_url IS NOT NULL THEN 'content_ready'
        WHEN ac.script IS NOT NULL THEN 'script_ready'
        ELSE 'concept_only'
    END as completion_status,
    CASE
        WHEN ac.script_segments IS NOT NULL THEN jsonb_array_length(ac.script_segments)
        ELSE 0
    END as segment_count,
    CASE
        WHEN ac.broll_items IS NOT NULL THEN jsonb_array_length(ac.broll_items)
        ELSE 0
    END as broll_count
FROM ad_creatives ac;
