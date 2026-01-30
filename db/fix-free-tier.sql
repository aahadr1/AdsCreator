-- Fix: Add 'free' tier to subscription_tier check constraint
-- Run this in your Supabase SQL Editor

-- Drop the old constraint
ALTER TABLE public.user_credits 
DROP CONSTRAINT IF EXISTS user_credits_subscription_tier_check;

-- Add new constraint that includes 'free'
ALTER TABLE public.user_credits 
ADD CONSTRAINT user_credits_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'basic', 'pro'));

-- Update the init_user_credits function to handle 'free' tier
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
    ELSE 100  -- free tier gets 100 credits
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

-- Update the subscription tier function too
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
    ELSE 100  -- free tier
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
