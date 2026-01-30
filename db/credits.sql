-- Credits system tables

-- User credits table
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id uuid PRIMARY KEY,
  subscription_tier text NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'pro')),
  monthly_limit integer NOT NULL DEFAULT 100,
  used_credits integer NOT NULL DEFAULT 0,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  last_reset_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT positive_credits CHECK (used_credits >= 0),
  CONSTRAINT positive_limit CHECK (monthly_limit > 0)
);

-- Credit usage tracking table
CREATE TABLE IF NOT EXISTS public.credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model_name text NOT NULL,
  model_category text NOT NULL,
  credits_used integer NOT NULL,
  task_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  CONSTRAINT positive_usage CHECK (credits_used > 0),
  FOREIGN KEY (user_id) REFERENCES public.user_credits(user_id) ON DELETE CASCADE
);

-- Credit transactions table for audit trail
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('usage', 'refund', 'bonus', 'reset')),
  credits integer NOT NULL,
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  model_name text,
  task_id text,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES public.user_credits(user_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_usage_user_id ON public.credit_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_created_at ON public.credit_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_usage_model ON public.credit_usage(model_name);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.touch_updated_at_credits()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_credits
DROP TRIGGER IF EXISTS user_credits_touch_updated_at ON public.user_credits;
CREATE TRIGGER user_credits_touch_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_credits();

-- Function to check if credits need reset (monthly)
CREATE OR REPLACE FUNCTION public.check_credit_reset(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_current_period_end timestamptz;
  v_now timestamptz := now();
BEGIN
  SELECT current_period_end INTO v_current_period_end
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  RETURN v_now > v_current_period_end;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly credits
CREATE OR REPLACE FUNCTION public.reset_monthly_credits(p_user_id uuid)
RETURNS void AS $$
DECLARE
  v_monthly_limit integer;
  v_old_used integer;
BEGIN
  SELECT monthly_limit, used_credits INTO v_monthly_limit, v_old_used
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  -- Reset credits and update period
  UPDATE public.user_credits
  SET 
    used_credits = 0,
    current_period_start = now(),
    current_period_end = now() + interval '1 month',
    last_reset_date = now()
  WHERE user_id = p_user_id;
  
  -- Log the reset transaction
  INSERT INTO public.credit_transactions (
    user_id, type, credits, balance_before, balance_after, description
  ) VALUES (
    p_user_id, 'reset', v_monthly_limit, v_old_used, 0, 'Monthly credit reset'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to use credits
CREATE OR REPLACE FUNCTION public.use_credits(
  p_user_id uuid,
  p_model_name text,
  p_model_category text,
  p_credits integer,
  p_task_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS boolean AS $$
DECLARE
  v_current_used integer;
  v_monthly_limit integer;
  v_new_used integer;
  v_needs_reset boolean;
BEGIN
  -- Check if credits need reset
  SELECT public.check_credit_reset(p_user_id) INTO v_needs_reset;
  
  IF v_needs_reset THEN
    PERFORM public.reset_monthly_credits(p_user_id);
  END IF;
  
  -- Get current usage and limit
  SELECT used_credits, monthly_limit INTO v_current_used, v_monthly_limit
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  -- Check if user has enough credits
  IF v_current_used + p_credits > v_monthly_limit THEN
    RETURN FALSE; -- Not enough credits
  END IF;
  
  v_new_used := v_current_used + p_credits;
  
  -- Update user credits
  UPDATE public.user_credits
  SET used_credits = v_new_used
  WHERE user_id = p_user_id;
  
  -- Log usage
  INSERT INTO public.credit_usage (
    user_id, model_name, model_category, credits_used, task_id, metadata
  ) VALUES (
    p_user_id, p_model_name, p_model_category, p_credits, p_task_id, p_metadata
  );
  
  -- Log transaction
  INSERT INTO public.credit_transactions (
    user_id, type, credits, balance_before, balance_after, model_name, task_id, description
  ) VALUES (
    p_user_id, 'usage', p_credits, v_current_used, v_new_used, p_model_name, p_task_id,
    format('Used %s credits for %s', p_credits, p_model_name)
  );
  
  RETURN TRUE; -- Success
END;
$$ LANGUAGE plpgsql;

-- Function to initialize user credits
CREATE OR REPLACE FUNCTION public.init_user_credits(
  p_user_id uuid,
  p_subscription_tier text DEFAULT 'free'
)
RETURNS void AS $$
DECLARE
  v_limit integer;
BEGIN
  -- Set limit based on tier
  v_limit := CASE 
    WHEN p_subscription_tier = 'pro' THEN 1000
    WHEN p_subscription_tier = 'basic' THEN 500
    ELSE 100
  END;
  
  INSERT INTO public.user_credits (
    user_id, subscription_tier, monthly_limit, used_credits
  ) VALUES (
    p_user_id, p_subscription_tier, v_limit, 0
  ) ON CONFLICT (user_id) DO UPDATE SET
    subscription_tier = EXCLUDED.subscription_tier,
    monthly_limit = EXCLUDED.monthly_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to update subscription tier
CREATE OR REPLACE FUNCTION public.update_subscription_tier(
  p_user_id uuid,
  p_new_tier text
)
RETURNS void AS $$
DECLARE
  v_new_limit integer;
BEGIN
  -- Set limit based on tier
  v_new_limit := CASE 
    WHEN p_new_tier = 'pro' THEN 1000
    WHEN p_new_tier = 'basic' THEN 500
    ELSE 100
  END;
  
  UPDATE public.user_credits
  SET 
    subscription_tier = p_new_tier,
    monthly_limit = v_new_limit
  WHERE user_id = p_user_id;
  
  -- Log the tier change
  INSERT INTO public.credit_transactions (
    user_id, type, credits, balance_before, balance_after, description
  ) VALUES (
    p_user_id, 'bonus', 0, 
    (SELECT used_credits FROM public.user_credits WHERE user_id = p_user_id),
    (SELECT used_credits FROM public.user_credits WHERE user_id = p_user_id),
    format('Subscription tier updated to %s (limit: %s)', p_new_tier, v_new_limit)
  );
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for user_credits
DROP POLICY IF EXISTS user_credits_select_own ON public.user_credits;
CREATE POLICY user_credits_select_own ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_credits_update_own ON public.user_credits;
CREATE POLICY user_credits_update_own ON public.user_credits
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for credit_usage
DROP POLICY IF EXISTS credit_usage_select_own ON public.credit_usage;
CREATE POLICY credit_usage_select_own ON public.credit_usage
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS credit_usage_insert_own ON public.credit_usage;
CREATE POLICY credit_usage_insert_own ON public.credit_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for credit_transactions
DROP POLICY IF EXISTS credit_transactions_select_own ON public.credit_transactions;
CREATE POLICY credit_transactions_select_own ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);
