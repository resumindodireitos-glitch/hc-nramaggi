-- ============================================================
-- LGPD COMPLIANCE COMPLETE IMPLEMENTATION
-- Lei 13.709 - Lei Geral de Proteção de Dados
-- ============================================================

-- 1. CONSENT MANAGEMENT (Gestão de Consentimento)
-- ============================================================

-- Create consent_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  ip_hash TEXT NOT NULL,
  term_version TEXT NOT NULL DEFAULT 'v1.0',
  consent_text TEXT NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  device_fingerprint TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on consent_logs
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can insert (public form consent)
CREATE POLICY "Anyone can insert consent" ON public.consent_logs
FOR INSERT WITH CHECK (true);

-- RLS: Only admins can view consent logs
CREATE POLICY "Admins can view consent logs" ON public.consent_logs
FOR SELECT USING (is_admin(auth.uid()));

-- RLS: No updates or deletes (immutable audit log)
-- (no policies = blocked)

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_consent_logs_submission ON public.consent_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_ip_hash ON public.consent_logs(ip_hash);

-- 2. RIGHT TO BE FORGOTTEN (Direito ao Esquecimento)
-- ============================================================

-- Function to anonymize a specific submission
CREATE OR REPLACE FUNCTION public.anonymize_submission(target_submission_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original_hash TEXT;
BEGIN
  -- Only super_admin can run this
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  -- Get original hash before anonymization
  SELECT respondent_hash INTO original_hash
  FROM public.submissions
  WHERE id = target_submission_id;

  -- Anonymize the submission (keep answers for statistics)
  UPDATE public.submissions
  SET 
    respondent_data = jsonb_build_object(
      'anonymized', true,
      'anonymized_at', now()::text,
      'anonymized_by', auth.uid()::text,
      'original_hash', original_hash,
      'reason', 'LGPD_RIGHT_TO_BE_FORGOTTEN'
    ),
    ip_hash = NULL
  WHERE id = target_submission_id;

  -- Log the anonymization
  INSERT INTO public.audit_log (action, table_name, record_id, user_id, new_data)
  VALUES (
    'LGPD_ANONYMIZATION_REQUEST',
    'submissions',
    target_submission_id,
    auth.uid(),
    jsonb_build_object(
      'anonymized_submission', target_submission_id,
      'reason', 'RIGHT_TO_BE_FORGOTTEN',
      'executed_at', now()
    )
  );

  RETURN true;
END;
$$;

-- Function to anonymize by email/identifier
CREATE OR REPLACE FUNCTION public.anonymize_by_identifier(target_identifier TEXT)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer := 0;
  sub_record RECORD;
BEGIN
  -- Only super_admin can run this
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  -- Find and anonymize all submissions matching the identifier
  FOR sub_record IN 
    SELECT id 
    FROM public.submissions 
    WHERE respondent_data->>'nome' ILIKE '%' || target_identifier || '%'
       OR respondent_data->>'email' ILIKE '%' || target_identifier || '%'
       AND NOT (respondent_data ? 'anonymized')
  LOOP
    PERFORM anonymize_submission(sub_record.id);
    affected_count := affected_count + 1;
  END LOOP;

  RETURN affected_count;
END;
$$;

-- 3. DATA RETENTION POLICY (Política de Retenção)
-- ============================================================

-- Enhanced cleanup function for automatic anonymization
CREATE OR REPLACE FUNCTION public.cleanup_old_pii()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  -- Anonymize submissions older than retention period
  UPDATE public.submissions
  SET 
    respondent_data = jsonb_build_object(
      'anonymized', true,
      'anonymized_at', now()::text,
      'reason', 'DATA_RETENTION_POLICY',
      'original_hash', respondent_hash
    ),
    ip_hash = NULL
  WHERE data_retention_until < now()
    AND NOT (respondent_data ? 'anonymized');
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Log the cleanup
  IF affected_count > 0 THEN
    INSERT INTO public.audit_log (action, table_name, new_data)
    VALUES (
      'AUTOMATIC_PII_CLEANUP',
      'submissions',
      jsonb_build_object(
        'anonymized_count', affected_count,
        'executed_at', now(),
        'reason', 'DATA_RETENTION_POLICY_5_YEARS'
      )
    );
  END IF;
  
  RETURN affected_count;
END;
$$;

-- 4. DATA PORTABILITY HELPERS (Portabilidade)
-- ============================================================

-- Function to export user data (returns JSON)
CREATE OR REPLACE FUNCTION public.export_user_data(target_identifier TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only super_admin can export data
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  SELECT jsonb_build_object(
    'export_date', now(),
    'identifier_searched', target_identifier,
    'submissions', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'form_title', f.title,
        'form_type', f.type,
        'respondent_data', s.respondent_data,
        'answers', s.answers,
        'submitted_at', s.created_at,
        'status', s.status
      ))
      FROM public.submissions s
      LEFT JOIN public.forms f ON s.form_id = f.id
      WHERE s.respondent_data->>'nome' ILIKE '%' || target_identifier || '%'
         OR s.respondent_data->>'email' ILIKE '%' || target_identifier || '%'),
      '[]'::jsonb
    ),
    'reports', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'risk_level', r.risk_level,
        'analysis', r.ai_analysis_text,
        'conclusion', r.ai_conclusion,
        'recommendations', r.ai_recommendations,
        'created_at', r.created_at,
        'is_approved', r.is_approved
      ))
      FROM public.reports r
      INNER JOIN public.submissions s ON r.submission_id = s.id
      WHERE s.respondent_data->>'nome' ILIKE '%' || target_identifier || '%'
         OR s.respondent_data->>'email' ILIKE '%' || target_identifier || '%'),
      '[]'::jsonb
    )
  ) INTO result;

  -- Log the export
  INSERT INTO public.audit_log (action, table_name, user_id, new_data)
  VALUES (
    'LGPD_DATA_EXPORT',
    'submissions',
    auth.uid(),
    jsonb_build_object(
      'identifier_searched', target_identifier,
      'exported_at', now()
    )
  );

  RETURN result;
END;
$$;

-- 5. AGGREGATED REPORTS BY JOB ROLE (Relatórios Agregados por Cargo)
-- ============================================================

-- View for aggregated statistics by job role (cargo)
CREATE OR REPLACE VIEW public.aggregated_reports_by_role AS
SELECT 
  s.respondent_data->>'cargo' as cargo,
  s.respondent_data->>'setor' as setor,
  f.type as form_type,
  f.title as form_title,
  COUNT(DISTINCT s.id) as total_submissions,
  COUNT(DISTINCT CASE WHEN r.is_approved THEN r.id END) as approved_reports,
  AVG(CASE 
    WHEN r.risk_level = 'trivial' OR r.risk_level = 'adequado' THEN 1
    WHEN r.risk_level = 'baixo' OR r.risk_level = 'toleravel' THEN 2
    WHEN r.risk_level = 'medio' OR r.risk_level = 'moderado' THEN 3
    WHEN r.risk_level = 'alto' OR r.risk_level = 'substancial' THEN 4
    WHEN r.risk_level = 'critico' OR r.risk_level = 'intoleravel' THEN 5
    ELSE NULL
  END) as avg_risk_score,
  MODE() WITHIN GROUP (ORDER BY r.risk_level) as most_common_risk_level,
  MIN(s.created_at) as first_submission,
  MAX(s.created_at) as last_submission
FROM public.submissions s
LEFT JOIN public.reports r ON s.id = r.submission_id
LEFT JOIN public.forms f ON s.form_id = f.id
WHERE NOT (s.respondent_data ? 'anonymized')
GROUP BY 
  s.respondent_data->>'cargo',
  s.respondent_data->>'setor',
  f.type,
  f.title;

-- 6. SUPER ADMIN ONLY: FULL DATA ACCESS
-- ============================================================

-- Function for super_admin to view individual responses (última instância)
CREATE OR REPLACE FUNCTION public.get_individual_responses_by_role(
  target_cargo TEXT,
  target_setor TEXT DEFAULT NULL
)
RETURNS TABLE (
  submission_id UUID,
  nome TEXT,
  cargo TEXT,
  setor TEXT,
  form_title TEXT,
  answers JSONB,
  risk_level TEXT,
  submitted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ONLY super_admin can see individual names
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required for individual data access.';
  END IF;

  -- Log this privileged access
  INSERT INTO public.audit_log (action, table_name, user_id, new_data)
  VALUES (
    'PRIVILEGED_INDIVIDUAL_DATA_ACCESS',
    'submissions',
    auth.uid(),
    jsonb_build_object(
      'accessed_cargo', target_cargo,
      'accessed_setor', target_setor,
      'accessed_at', now(),
      'reason', 'SUPER_ADMIN_ULTIMA_INSTANCIA'
    )
  );

  RETURN QUERY
  SELECT 
    s.id as submission_id,
    s.respondent_data->>'nome' as nome,
    s.respondent_data->>'cargo' as cargo,
    s.respondent_data->>'setor' as setor,
    f.title as form_title,
    s.answers,
    r.risk_level,
    s.created_at as submitted_at
  FROM public.submissions s
  LEFT JOIN public.reports r ON s.id = r.submission_id
  LEFT JOIN public.forms f ON s.form_id = f.id
  WHERE s.respondent_data->>'cargo' = target_cargo
    AND (target_setor IS NULL OR s.respondent_data->>'setor' = target_setor)
    AND NOT (s.respondent_data ? 'anonymized')
  ORDER BY s.created_at DESC;
END;
$$;

-- 7. PARTICIPATION CONTROL (Controle de Presença - Admin Only)
-- ============================================================

-- View for participation tracking (shows who responded, not what they answered)
CREATE OR REPLACE VIEW public.participation_control AS
SELECT 
  s.id as submission_id,
  s.respondent_data->>'nome' as nome,
  s.respondent_data->>'cargo' as cargo,
  s.respondent_data->>'setor' as setor,
  f.title as form_title,
  f.type as form_type,
  s.created_at as submitted_at,
  s.status,
  CASE WHEN r.id IS NOT NULL THEN true ELSE false END as has_report,
  r.is_approved
FROM public.submissions s
LEFT JOIN public.reports r ON s.id = r.submission_id
LEFT JOIN public.forms f ON s.form_id = f.id
WHERE NOT (s.respondent_data ? 'anonymized');

-- Grant access only to admins for participation control
-- (handled via RLS on base tables)