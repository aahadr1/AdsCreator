-- Assistant State Optimization Indexes
-- These indexes improve query performance for JSONB plan fields

-- Add GIN index for media pool queries
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_plan_media_pool 
ON public.assistant_conversations USING GIN ((plan->'media_pool'));

-- Add GIN index for workflow state queries  
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_plan_workflow_state
ON public.assistant_conversations USING GIN ((plan->'workflow_state'));

-- Add index for active avatar lookups
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_plan_active_avatar
ON public.assistant_conversations ((plan->'media_pool'->>'activeAvatarId'))
WHERE plan->'media_pool'->>'activeAvatarId' IS NOT NULL;

-- Add index for approved script lookups
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_plan_approved_script  
ON public.assistant_conversations ((plan->'media_pool'->>'approvedScriptId'))
WHERE plan->'media_pool'->>'approvedScriptId' IS NOT NULL;

-- Add comment explaining the state architecture
COMMENT ON COLUMN public.assistant_conversations.plan IS 
'JSONB state container including: media_pool (asset tracking), workflow_state (progress tracking), selected_avatar/product/script (confirmed selections), image_registry (image metadata), pending_storyboard_action (gating)';
