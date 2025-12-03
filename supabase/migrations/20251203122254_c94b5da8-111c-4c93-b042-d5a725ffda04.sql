
-- Criar tabela de fazendas (farms)
CREATE TABLE public.farms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text UNIQUE,
    location text,
    manager_name text,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Adicionar farm_id às tabelas existentes
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES public.farms(id);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES public.farms(id);

-- Criar tabela de consumo de IA
CREATE TABLE public.ai_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.ai_prompts(id) ON DELETE SET NULL,
    submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
    provider text NOT NULL,
    model text NOT NULL,
    input_tokens integer DEFAULT 0,
    output_tokens integer DEFAULT 0,
    total_tokens integer DEFAULT 0,
    cost_estimate numeric(10,6) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de limites de uso
CREATE TABLE public.ai_usage_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    monthly_token_limit integer DEFAULT 1000000,
    daily_token_limit integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de notificações
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info', -- info, success, warning, error
    category text DEFAULT 'system', -- system, report, submission, ai
    link text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de atualizações do sistema
CREATE TABLE public.system_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text NOT NULL,
    version text,
    type text DEFAULT 'feature', -- feature, fix, improvement, security
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;

-- Policies for farms
CREATE POLICY "Anyone can view farms" ON public.farms FOR SELECT USING (true);
CREATE POLICY "Admins can manage farms" ON public.farms FOR ALL USING (is_admin(auth.uid()));

-- Policies for ai_usage
CREATE POLICY "Admins can view all ai usage" ON public.ai_usage FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Users can view their own usage" ON public.ai_usage FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert usage" ON public.ai_usage FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policies for ai_usage_limits
CREATE POLICY "Super admins can manage limits" ON public.ai_usage_limits FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Admins can view limits" ON public.ai_usage_limits FOR SELECT USING (is_admin(auth.uid()));

-- Policies for notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Policies for system_updates
CREATE POLICY "Anyone authenticated can view updates" ON public.system_updates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Super admins can manage updates" ON public.system_updates FOR ALL USING (is_super_admin(auth.uid()));

-- Insert default farm (Sede)
INSERT INTO public.farms (name, code, description) VALUES
('Sede Administrativa', 'SEDE', 'Unidade administrativa central'),
('Fazenda Tanguro', 'TANGURO', 'Fazenda Tanguro - MT'),
('Fazenda Tucunaré', 'TUCUNARE', 'Fazenda Tucunaré - MT');

-- Insert default usage limit
INSERT INTO public.ai_usage_limits (name, monthly_token_limit, daily_token_limit) VALUES
('Plano Padrão', 1000000, 50000);

-- Insert initial system update
INSERT INTO public.system_updates (title, description, version, type) VALUES
('Sistema Lançado', 'Versão inicial do HC Consultoria com análise ergonômica por IA', '1.0.0', 'feature');

-- Add GOOGLE_API_KEY to system_settings if not exists
INSERT INTO public.system_settings (key, value, description, is_secret)
VALUES ('GOOGLE_API_KEY', NULL, 'Chave de API do Google Gemini', true)
ON CONFLICT (key) DO NOTHING;
