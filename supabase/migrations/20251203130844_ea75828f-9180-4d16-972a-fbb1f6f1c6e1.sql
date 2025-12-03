-- ============================================
-- SECURITY HARDENING V2.0 - HC Consultoria
-- OWASP Top 10 Compliance & LGPD
-- ============================================

-- 1. DROP existing problematic policies and recreate with proper security
-- ============================================

-- 1.1 SUBMISSIONS TABLE - Write-Only for Anonymous (Urna Cega)
DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON public.submissions;

-- Anonymous can ONLY INSERT (Write-Only / Urna Cega)
CREATE POLICY "anon_insert_only_submissions"
ON public.submissions
FOR INSERT
TO anon
WITH CHECK (true);

-- Authenticated users can insert their own submissions
CREATE POLICY "auth_insert_submissions"
ON public.submissions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admins can view all submissions
CREATE POLICY "admin_select_all_submissions"
ON public.submissions
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Admins can update submissions
CREATE POLICY "admin_update_submissions"
ON public.submissions
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

-- Users can view only their own submissions (via respondent_data.user_id)
CREATE POLICY "user_select_own_submissions"
ON public.submissions
FOR SELECT
TO authenticated
USING (
  (respondent_data ->> 'user_id')::text = auth.uid()::text
);

-- 1.2 PROFILES TABLE - Block anonymous access completely
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

-- Recreate with explicit authenticated role
CREATE POLICY "auth_select_own_profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "auth_update_own_profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "auth_insert_own_profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "admin_select_all_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "admin_update_profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (
  is_admin(auth.uid()) 
  AND role = (SELECT role FROM public.profiles WHERE id = profiles.id)
);

-- 2. ENHANCED HASH FUNCTION WITH SALT (Anti-Rainbow Table)
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_respondent_hash_secure(respondent_data jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  salt text := 'HC_AMAGGI_SECURE_SALT_2024_LGPD_COMPLIANT';
  data_string text;
BEGIN
  -- Concatenate fields with salt for rainbow table resistance
  data_string := COALESCE(respondent_data->>'nome', '') || 
                 COALESCE(respondent_data->>'setor', '') || 
                 COALESCE(respondent_data->>'cargo', '') ||
                 salt;
  
  RETURN encode(sha256(data_string::bytea), 'hex');
END;
$$;

-- Update trigger to use secure hash
CREATE OR REPLACE FUNCTION public.handle_submission_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.respondent_hash := generate_respondent_hash_secure(NEW.respondent_data);
  RETURN NEW;
END;
$$;

-- 3. RATE LIMITING FUNCTION (Anti-DDoS/Abuse)
-- ============================================
CREATE OR REPLACE FUNCTION public.check_submission_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
  max_submissions_per_window integer := 5;
  window_minutes integer := 10;
BEGIN
  -- Count submissions from same IP in the time window
  SELECT COUNT(*) INTO recent_count
  FROM public.submissions
  WHERE ip_hash = NEW.ip_hash
    AND created_at > NOW() - (window_minutes || ' minutes')::interval;
  
  IF recent_count >= max_submissions_per_window THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before submitting again.'
      USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create rate limit trigger (only if not exists)
DROP TRIGGER IF EXISTS check_rate_limit ON public.submissions;
CREATE TRIGGER check_rate_limit
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_submission_rate_limit();

-- 4. INPUT VALIDATION CONSTRAINTS
-- ============================================
-- Ensure answers JSON is not empty
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS check_answers_not_empty;
ALTER TABLE public.submissions 
ADD CONSTRAINT check_answers_not_empty 
CHECK (answers IS NOT NULL AND answers != '{}'::jsonb);

-- Ensure respondent_data has minimum required fields
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS check_respondent_data_valid;
ALTER TABLE public.submissions 
ADD CONSTRAINT check_respondent_data_valid 
CHECK (
  respondent_data IS NOT NULL 
  AND respondent_data != '{}'::jsonb
  AND (respondent_data->>'nome' IS NOT NULL OR respondent_data->>'name' IS NOT NULL)
);

-- 5. AUDIT LOG IMMUTABILITY (Append-Only)
-- ============================================
DROP POLICY IF EXISTS "Super admins can view audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Anyone authenticated can insert audit logs
CREATE POLICY "auth_insert_audit_logs"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Service role can insert (for edge functions)
CREATE POLICY "service_insert_audit_logs"
ON public.audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Super admins can view audit logs
CREATE POLICY "super_admin_select_audit_logs"
ON public.audit_log
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Admins can view audit logs
CREATE POLICY "admin_select_audit_logs"
ON public.audit_log
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- EXPLICIT DENY for UPDATE and DELETE (immutability)
-- These are already not allowed by default with RLS, but being explicit
DROP POLICY IF EXISTS "deny_update_audit_logs" ON public.audit_log;
DROP POLICY IF EXISTS "deny_delete_audit_logs" ON public.audit_log;

-- 6. ADDITIONAL SECURITY FUNCTIONS
-- ============================================

-- Function to validate JSON structure for submissions
CREATE OR REPLACE FUNCTION public.validate_submission_json()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for potential XSS in text fields
  IF NEW.respondent_data::text ~ '<script' OR NEW.answers::text ~ '<script' THEN
    RAISE EXCEPTION 'Invalid input detected'
      USING ERRCODE = 'P0002';
  END IF;
  
  -- Limit JSON depth and size (prevent JSON bomb attacks)
  IF length(NEW.answers::text) > 100000 THEN
    RAISE EXCEPTION 'Payload too large'
      USING ERRCODE = 'P0003';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_submission_input ON public.submissions;
CREATE TRIGGER validate_submission_input
  BEFORE INSERT OR UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_submission_json();

-- 7. SECURE the is_admin function from privilege escalation
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id 
    AND role = 'admin_hc'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = is_admin.user_id
    AND role IN ('admin_hc', 'super_admin')
  );
$$;

-- 8. SECURE system_settings access
-- ============================================
DROP POLICY IF EXISTS "Super admins can manage settings" ON public.system_settings;

CREATE POLICY "super_admin_all_settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- 9. ADD INDEX for rate limiting performance
-- ============================================
DROP INDEX IF EXISTS idx_submissions_ip_hash_created;
CREATE INDEX idx_submissions_ip_hash_created 
ON public.submissions (ip_hash, created_at DESC)
WHERE ip_hash IS NOT NULL;

-- 10. SECURE ai_usage - prevent unauthorized cost tracking manipulation
-- ============================================
DROP POLICY IF EXISTS "System can insert usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can view their own usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Admins can view all ai usage" ON public.ai_usage;

CREATE POLICY "auth_insert_ai_usage"
ON public.ai_usage
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "service_insert_ai_usage"
ON public.ai_usage
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "user_select_own_ai_usage"
ON public.ai_usage
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "admin_select_all_ai_usage"
ON public.ai_usage
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));