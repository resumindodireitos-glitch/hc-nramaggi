-- Fix SECURITY DEFINER views by recreating as SECURITY INVOKER
DROP VIEW IF EXISTS public.aggregated_reports_by_role;
DROP VIEW IF EXISTS public.participation_control;

-- Recreate aggregated_reports_by_role as SECURITY INVOKER
CREATE VIEW public.aggregated_reports_by_role
WITH (security_invoker = true)
AS
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

-- Recreate participation_control as SECURITY INVOKER  
CREATE VIEW public.participation_control
WITH (security_invoker = true)
AS
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