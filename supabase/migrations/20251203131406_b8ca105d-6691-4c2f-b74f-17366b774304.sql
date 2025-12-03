-- Fix: Change view to use SECURITY INVOKER (safe pattern)
-- The RLS policies on submissions table will handle access control

DROP VIEW IF EXISTS public.submissions_anonymized;

-- Recreate as regular view (inherits caller's permissions via RLS)
CREATE VIEW public.submissions_anonymized 
WITH (security_invoker = true)
AS
SELECT 
  id,
  form_id,
  status,
  created_at,
  mask_sensitive_data(respondent_data) as respondent_data,
  answers,
  respondent_hash
FROM public.submissions;

-- Grant access
GRANT SELECT ON public.submissions_anonymized TO authenticated;