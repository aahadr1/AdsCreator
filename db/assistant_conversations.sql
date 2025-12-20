-- Assistant conversations and plans tables

-- Conversations table: stores chat conversations
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  messages jsonb NOT NULL DEFAULT '[]',
  plan jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Assistant tasks table: links individual task executions to conversations
CREATE TABLE IF NOT EXISTS public.assistant_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  task_id text NOT NULL,
  step_id text NOT NULL,
  step_title text,
  step_tool text,
  step_model text,
  step_inputs jsonb,
  step_output_url text,
  step_output_text text,
  step_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id) REFERENCES public.assistant_conversations(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_id ON public.assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_created_at ON public.assistant_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_conversation_id ON public.assistant_tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_task_id ON public.assistant_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_assistant_tasks_step_id ON public.assistant_tasks(step_id);

-- Add assistant_plan_id column to tasks table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'assistant_conversation_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN assistant_conversation_id uuid;
    CREATE INDEX IF NOT EXISTS idx_tasks_assistant_conversation_id ON public.tasks(assistant_conversation_id);
  END IF;
END $$;

