-- Drop existing check constraint and recreate with google provider
ALTER TABLE ai_prompts DROP CONSTRAINT IF EXISTS ai_prompts_provider_check;

ALTER TABLE ai_prompts ADD CONSTRAINT ai_prompts_provider_check 
CHECK (provider IN ('lovable', 'openai', 'anthropic', 'deepseek', 'google'));