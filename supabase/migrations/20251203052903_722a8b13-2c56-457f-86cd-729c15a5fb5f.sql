-- Insert default API key settings if they don't exist
INSERT INTO public.system_settings (key, value, description, is_secret)
VALUES 
  ('OPENAI_API_KEY', NULL, 'Chave de API da OpenAI para modelos GPT', true),
  ('ANTHROPIC_API_KEY', NULL, 'Chave de API da Anthropic para modelos Claude', true),
  ('DEEPSEEK_API_KEY', NULL, 'Chave de API do DeepSeek', true)
ON CONFLICT (key) DO NOTHING;

-- Add unique constraint on key if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_key_unique') THEN
    ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_key_unique UNIQUE (key);
  END IF;
END $$;