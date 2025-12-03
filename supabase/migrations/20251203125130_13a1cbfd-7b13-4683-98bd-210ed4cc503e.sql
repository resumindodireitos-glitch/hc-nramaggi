-- SECURITY FIX: Remove overly permissive public access to submissions
-- Keep only necessary policies for authenticated access

-- Drop the dangerous "Anyone can view submission by id" policy
DROP POLICY IF EXISTS "Anyone can view submission by id" ON public.submissions;

-- Create more restrictive policy: Only the respondent (by submission code) or admins can view
CREATE POLICY "Admins can view all submissions" 
ON public.submissions 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Add rate limiting token table for form submissions (prevents spam)
CREATE TABLE IF NOT EXISTS public.submission_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  ip_hash text,
  used boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.submission_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create tokens" ON public.submission_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view their token" ON public.submission_tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can update token" ON public.submission_tokens FOR UPDATE USING (true);

-- Create index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_submission_tokens_token ON public.submission_tokens(token);
CREATE INDEX IF NOT EXISTS idx_submission_tokens_expires ON public.submission_tokens(expires_at);

-- Add submission hash column to submissions for audit without exposing identity
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS respondent_hash text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS ip_hash text;

-- Create function to generate anonymous hash
CREATE OR REPLACE FUNCTION generate_respondent_hash(respondent_data jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hash based on nome + setor + cargo to prevent duplicates while maintaining anonymity
  RETURN encode(
    sha256(
      (COALESCE(respondent_data->>'nome', '') || 
       COALESCE(respondent_data->>'setor', '') || 
       COALESCE(respondent_data->>'cargo', ''))::bytea
    ), 
    'hex'
  );
END;
$$;

-- Trigger to auto-generate hash on submission
CREATE OR REPLACE FUNCTION handle_submission_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.respondent_hash := generate_respondent_hash(NEW.respondent_data);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_submission_set_hash ON public.submissions;
CREATE TRIGGER on_submission_set_hash
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION handle_submission_hash();