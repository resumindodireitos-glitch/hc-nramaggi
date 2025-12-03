-- ============================================
-- LGPD COMPLIANCE: Data Encryption Layer
-- ============================================

-- Note: Full encryption with pgcrypto requires a secure key management strategy.
-- This creates the foundation for encrypted sensitive data fields.

-- 1. Create encryption helper functions (SECURITY DEFINER for controlled access)
CREATE OR REPLACE FUNCTION public.mask_sensitive_data(data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  masked jsonb;
BEGIN
  -- Mask sensitive fields for non-admin access
  masked := data;
  
  -- Mask name (show only first 3 chars)
  IF masked ? 'nome' AND length(masked->>'nome') > 3 THEN
    masked := jsonb_set(masked, '{nome}', to_jsonb(substring(masked->>'nome' from 1 for 3) || '***'));
  END IF;
  
  IF masked ? 'name' AND length(masked->>'name') > 3 THEN
    masked := jsonb_set(masked, '{name}', to_jsonb(substring(masked->>'name' from 1 for 3) || '***'));
  END IF;
  
  IF masked ? 'full_name' AND length(masked->>'full_name') > 3 THEN
    masked := jsonb_set(masked, '{full_name}', to_jsonb(substring(masked->>'full_name' from 1 for 3) || '***'));
  END IF;
  
  -- Mask email
  IF masked ? 'email' THEN
    masked := jsonb_set(masked, '{email}', '"***@***.com"'::jsonb);
  END IF;
  
  RETURN masked;
END;
$$;

-- 2. Create view for anonymized submissions access (LGPD compliant for reports)
CREATE OR REPLACE VIEW public.submissions_anonymized AS
SELECT 
  id,
  form_id,
  status,
  created_at,
  mask_sensitive_data(respondent_data) as respondent_data,
  answers,
  respondent_hash
FROM public.submissions;

-- 3. Grant access to the view
GRANT SELECT ON public.submissions_anonymized TO authenticated;

-- 4. Create function to get full data (admin only)
CREATE OR REPLACE FUNCTION public.get_submission_full_data(submission_uuid uuid)
RETURNS TABLE (
  id uuid,
  form_id uuid,
  respondent_data jsonb,
  answers jsonb,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can access full data
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;
  
  RETURN QUERY
  SELECT 
    s.id,
    s.form_id,
    s.respondent_data,
    s.answers,
    s.status::text,
    s.created_at
  FROM public.submissions s
  WHERE s.id = submission_uuid;
END;
$$;

-- 5. Create audit function for LGPD data access tracking
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    action,
    table_name,
    record_id,
    user_id,
    new_data
  ) VALUES (
    'DATA_ACCESS',
    TG_TABLE_NAME,
    NEW.id,
    auth.uid(),
    jsonb_build_object(
      'accessed_at', now(),
      'fields_accessed', ARRAY['respondent_data']
    )
  );
  RETURN NEW;
END;
$$;

-- 6. Add data retention policy metadata column
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS data_retention_until timestamptz DEFAULT (now() + interval '5 years');

-- 7. Create function to anonymize expired data (LGPD right to be forgotten)
CREATE OR REPLACE FUNCTION public.anonymize_expired_submissions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  -- Only super_admin can run this
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;
  
  UPDATE public.submissions
  SET 
    respondent_data = jsonb_build_object(
      'anonymized', true,
      'anonymized_at', now()::text,
      'original_hash', respondent_hash
    ),
    ip_hash = NULL
  WHERE data_retention_until < now()
    AND NOT (respondent_data ? 'anonymized');
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Log the anonymization
  INSERT INTO public.audit_log (action, table_name, new_data)
  VALUES (
    'LGPD_ANONYMIZATION',
    'submissions',
    jsonb_build_object('anonymized_count', affected_count, 'executed_at', now())
  );
  
  RETURN affected_count;
END;
$$;

-- 8. Create index for retention queries
CREATE INDEX IF NOT EXISTS idx_submissions_retention 
ON public.submissions (data_retention_until) 
WHERE data_retention_until IS NOT NULL;