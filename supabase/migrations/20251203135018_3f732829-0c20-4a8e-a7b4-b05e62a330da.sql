-- =====================================================
-- MIGRATION: OTIMIZAÇÃO, ÍNDICES E SEGURANÇA
-- Sistema HC Consultoria - Blueprint V3.0 QA
-- =====================================================

-- 1. ÍNDICES PARA PERFORMANCE (colunas mais consultadas)
CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON public.submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_ip_hash ON public.submissions(ip_hash) WHERE ip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_respondent_hash ON public.submissions(respondent_hash) WHERE respondent_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_employee_id ON public.submissions(employee_id) WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_submission_id ON public.reports(submission_id);
CREATE INDEX IF NOT EXISTS idx_reports_risk_level ON public.reports(risk_level);
CREATE INDEX IF NOT EXISTS idx_reports_is_approved ON public.reports(is_approved);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fmea_calculations_report_id ON public.fmea_calculations(report_id);
CREATE INDEX IF NOT EXISTS idx_fmea_calculations_nre_classification ON public.fmea_calculations(nre_classification);

CREATE INDEX IF NOT EXISTS idx_suggested_actions_report_id ON public.suggested_actions(report_id);
CREATE INDEX IF NOT EXISTS idx_suggested_actions_priority ON public.suggested_actions(priority);
CREATE INDEX IF NOT EXISTS idx_suggested_actions_status ON public.suggested_actions(status);

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consent_logs_submission_id ON public.consent_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_accepted_at ON public.consent_logs(accepted_at DESC);

CREATE INDEX IF NOT EXISTS idx_employees_job_role_id ON public.employees(job_role_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON public.employees(is_active);

CREATE INDEX IF NOT EXISTS idx_job_roles_department_id ON public.job_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_departments_farm_id ON public.departments(farm_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_agent_id ON public.ai_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_form_type ON public.ai_prompts(form_type);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_is_active ON public.ai_prompts(is_active);

-- 2. TABELA DE ASSINATURA DIGITAL
CREATE TABLE IF NOT EXISTS public.report_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_role TEXT NOT NULL,
  signer_credential TEXT,
  signature_hash TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  verification_code TEXT UNIQUE,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para assinaturas
CREATE INDEX IF NOT EXISTS idx_report_signatures_report_id ON public.report_signatures(report_id);
CREATE INDEX IF NOT EXISTS idx_report_signatures_verification_code ON public.report_signatures(verification_code);

-- RLS para assinaturas
ALTER TABLE public.report_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage signatures" ON public.report_signatures
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Users can view signatures of their reports" ON public.report_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reports r
      JOIN submissions s ON r.submission_id = s.id
      WHERE r.id = report_signatures.report_id
      AND (s.respondent_data->>'user_id')::text = auth.uid()::text
    )
  );

-- 3. TABELA DE CONFIGURAÇÃO DE WEBHOOKS
CREATE TABLE IF NOT EXISTS public.webhook_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google_forms', 'microsoft_forms', 'custom')),
  external_form_id TEXT NOT NULL,
  internal_form_id UUID REFERENCES public.forms(id) ON DELETE SET NULL,
  field_mapping JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  secret_key TEXT,
  last_received_at TIMESTAMP WITH TIME ZONE,
  total_submissions INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(provider, external_form_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_configurations_provider ON public.webhook_configurations(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_is_active ON public.webhook_configurations(is_active);

ALTER TABLE public.webhook_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage webhooks" ON public.webhook_configurations
  FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view webhooks" ON public.webhook_configurations
  FOR SELECT USING (is_admin(auth.uid()));

-- 4. FUNÇÃO PARA GERAR HASH DE ASSINATURA SHA256
CREATE OR REPLACE FUNCTION public.generate_signature_hash(
  report_uuid UUID,
  signer_name TEXT,
  signed_timestamp TIMESTAMP WITH TIME ZONE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_content TEXT;
  hash_input TEXT;
BEGIN
  -- Get report content for hashing
  SELECT CONCAT(
    r.id::text,
    r.ai_analysis_text,
    r.ai_conclusion,
    r.risk_level,
    s.respondent_data::text
  ) INTO report_content
  FROM reports r
  JOIN submissions s ON r.submission_id = s.id
  WHERE r.id = report_uuid;
  
  -- Combine with signer info and timestamp
  hash_input := CONCAT(
    report_content,
    signer_name,
    signed_timestamp::text,
    'HC_CONSULTORIA_DIGITAL_SIGNATURE_2024'
  );
  
  RETURN encode(sha256(hash_input::bytea), 'hex');
END;
$$;

-- 5. FUNÇÃO PARA VERIFICAR ASSINATURA
CREATE OR REPLACE FUNCTION public.verify_signature(verification_code_input TEXT)
RETURNS TABLE(
  is_valid BOOLEAN,
  report_id UUID,
  signer_name TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  signer_credential TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as is_valid,
    rs.report_id,
    rs.signer_name,
    rs.signed_at,
    rs.signer_credential
  FROM report_signatures rs
  WHERE rs.verification_code = verification_code_input;
END;
$$;

-- 6. FUNÇÃO PARA CRIAR ASSINATURA
CREATE OR REPLACE FUNCTION public.sign_report(
  report_uuid UUID,
  p_signer_name TEXT,
  p_signer_role TEXT,
  p_signer_credential TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(
  signature_id UUID,
  verification_code TEXT,
  signature_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signature_hash TEXT;
  v_verification_code TEXT;
  v_signature_id UUID;
  v_signed_at TIMESTAMP WITH TIME ZONE := now();
BEGIN
  -- Only admins can sign
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Generate hash
  v_signature_hash := generate_signature_hash(report_uuid, p_signer_name, v_signed_at);
  
  -- Generate verification code (8 chars alphanumeric)
  v_verification_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
  
  -- Insert signature
  INSERT INTO report_signatures (
    report_id,
    signer_name,
    signer_role,
    signer_credential,
    signature_hash,
    signed_at,
    ip_address,
    user_agent,
    verification_code,
    is_verified
  ) VALUES (
    report_uuid,
    p_signer_name,
    p_signer_role,
    p_signer_credential,
    v_signature_hash,
    v_signed_at,
    p_ip_address,
    p_user_agent,
    v_verification_code,
    true
  )
  RETURNING id INTO v_signature_id;
  
  -- Log the signing
  INSERT INTO audit_log (action, table_name, record_id, user_id, new_data)
  VALUES (
    'REPORT_SIGNED',
    'report_signatures',
    v_signature_id,
    auth.uid(),
    jsonb_build_object(
      'report_id', report_uuid,
      'signer_name', p_signer_name,
      'verification_code', v_verification_code
    )
  );
  
  RETURN QUERY SELECT v_signature_id, v_verification_code, v_signature_hash;
END;
$$;

-- 7. TRIGGER PARA ATUALIZAR updated_at em webhook_configurations
CREATE TRIGGER update_webhook_configurations_updated_at
  BEFORE UPDATE ON public.webhook_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();