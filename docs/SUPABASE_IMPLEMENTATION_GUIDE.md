# Guia Completo de Implementação Supabase
## Sistema HC Consultoria - Ergonomia & Fisioterapia

---

## ÍNDICE

1. [Estrutura do Banco de Dados](#1-estrutura-do-banco-de-dados)
2. [Enums e Tipos](#2-enums-e-tipos)
3. [Tabelas Principais](#3-tabelas-principais)
4. [Row Level Security (RLS)](#4-row-level-security-rls)
5. [Funções PostgreSQL](#5-funções-postgresql)
6. [Triggers](#6-triggers)
7. [Edge Functions](#7-edge-functions)
8. [Integração com IA](#8-integração-com-ia)
9. [Sistema de Cálculos](#9-sistema-de-cálculos)
10. [RAG e Knowledge Base](#10-rag-e-knowledge-base)
11. [Configuração de Storage](#11-configuração-de-storage)
12. [Secrets e Variáveis](#12-secrets-e-variáveis)

---

## 1. ESTRUTURA DO BANCO DE DADOS

### 1.1 Extensões Necessárias

```sql
-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- Para RAG/embeddings
```

---

## 2. ENUMS E TIPOS

```sql
-- Tipos de formulário suportados
CREATE TYPE public.form_type AS ENUM ('hse_it', 'ergos');

-- Status de submissão
CREATE TYPE public.submission_status AS ENUM ('pending_ai', 'processed', 'approved');

-- Roles de usuário (tabela profiles)
CREATE TYPE public.user_role AS ENUM ('admin_hc', 'employee_amaggi');

-- Roles de aplicação (tabela user_roles)
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin_hc', 'employee_amaggi');
```

---

## 3. TABELAS PRINCIPAIS

### 3.1 Tabela de Perfis (profiles)

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee_amaggi',
  company TEXT DEFAULT 'Amaggi',
  department TEXT,
  job_title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
```

### 3.2 Tabela de Roles (user_roles) - SEGURANÇA

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Índice para performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
```

### 3.3 Tabela de Formulários (forms)

```sql
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type form_type NOT NULL DEFAULT 'ergos',
  schema JSONB NOT NULL DEFAULT '[]',
  calculation_rules JSONB DEFAULT '{}',
  risk_thresholds JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Exemplo de calculation_rules para ERGOS:
/*
{
  "method": "sum_with_coefficient",
  "coefficient": 0.83,
  "blocks": {
    "A": ["pt_1", "pt_2", "at_1", "at_2", "cx_1", "mn_1", "rc_1"],
    "B": ["in_1", "is_1", "ht_1", "rl_1", "dg_1"]
  }
}
*/

-- Exemplo de risk_thresholds:
/*
{
  "low": { "min": 0, "max": 30, "label": "Satisfatório", "color": "green" },
  "medium": { "min": 31, "max": 60, "label": "Aceitável", "color": "yellow" },
  "high": { "min": 61, "max": 100, "label": "Deve Melhorar", "color": "red" }
}
*/
```

### 3.4 Tabela de Submissões (submissions)

```sql
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.forms(id) NOT NULL,
  employee_id UUID REFERENCES public.employees(id),
  respondent_data JSONB NOT NULL DEFAULT '{}',
  respondent_hash TEXT,
  answers JSONB NOT NULL DEFAULT '{}',
  status submission_status DEFAULT 'pending_ai',
  ip_hash TEXT,
  data_retention_until TIMESTAMPTZ DEFAULT (now() + INTERVAL '5 years'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_submissions_form_id ON public.submissions(form_id);
CREATE INDEX idx_submissions_status ON public.submissions(status);
CREATE INDEX idx_submissions_respondent_hash ON public.submissions(respondent_hash);
CREATE INDEX idx_submissions_created_at ON public.submissions(created_at DESC);
```

### 3.5 Tabela de Relatórios (reports)

```sql
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id) UNIQUE NOT NULL,
  dimensions_score JSONB DEFAULT '{}',
  risk_level TEXT,
  ai_analysis_text TEXT,
  ai_conclusion TEXT,
  ai_recommendations TEXT[] DEFAULT '{}',
  final_text_override TEXT,
  is_approved BOOLEAN DEFAULT false,
  reviewer_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Exemplo de dimensions_score:
/*
{
  "global_score": 45,
  "risk_level": "medio",
  "risk_label": "Aceitável",
  "risk_color": "yellow",
  "dimensions": [
    { "name": "Pressão de Tempo", "score": 50, "status": "Atenção", "color": "yellow" },
    { "name": "Atenção", "score": 30, "status": "Adequado", "color": "green" }
  ]
}
*/
```

### 3.6 Tabela de Cálculos FMEA (fmea_calculations)

```sql
CREATE TABLE public.fmea_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) UNIQUE,
  gravidade INTEGER NOT NULL,
  probabilidade INTEGER NOT NULL,
  capacidade_deteccao INTEGER NOT NULL DEFAULT 1,
  nre_score INTEGER,
  nre_classification TEXT,
  dimension_scores JSONB,
  requires_manual_review BOOLEAN DEFAULT false,
  review_reason TEXT,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- NRE = Gravidade × Probabilidade × Capacidade de Detecção
```

### 3.7 Tabela de Ações Sugeridas (suggested_actions)

```sql
CREATE TABLE public.suggested_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id),
  dimension TEXT,
  risk_detected TEXT NOT NULL,
  action_title TEXT NOT NULL,
  action_description TEXT,
  priority TEXT DEFAULT 'media',
  status TEXT DEFAULT 'pendente',
  responsible TEXT,
  due_date DATE,
  nre_score INTEGER,
  nre_classification TEXT,
  nr_referencia TEXT[],
  source_matrix TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.8 Tabela de Prompts IA (ai_prompts)

```sql
CREATE TABLE public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  form_type TEXT NOT NULL,
  agent_type TEXT DEFAULT 'analysis',
  provider TEXT NOT NULL DEFAULT 'lovable',
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  system_prompt TEXT NOT NULL,
  temperature DOUBLE PRECISION DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4000,
  output_schema JSONB,
  use_rag BOOLEAN DEFAULT false,
  rag_top_k INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Apenas um agente ativo por form_type
CREATE UNIQUE INDEX idx_ai_prompts_active 
ON public.ai_prompts(form_type) 
WHERE is_active = true;
```

### 3.9 Tabela de Uso de IA (ai_usage)

```sql
CREATE TABLE public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  agent_id UUID REFERENCES public.ai_prompts(id),
  submission_id UUID REFERENCES public.submissions(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_estimate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.10 Tabela de Documentos de Conhecimento (knowledge_documents)

```sql
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  status TEXT DEFAULT 'pending',
  chunks_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.11 Tabela de Chunks de Documentos (document_chunks)

```sql
CREATE TABLE public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca vetorial
CREATE INDEX idx_document_chunks_embedding 
ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 3.12 Tabela de Vínculo Agente-Documento (agent_documents)

```sql
CREATE TABLE public.agent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.ai_prompts(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (agent_id, document_id)
);
```

### 3.13 Tabela de Logs de Consentimento (consent_logs)

```sql
CREATE TABLE public.consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id),
  consent_text TEXT NOT NULL,
  term_version TEXT NOT NULL DEFAULT 'v1.0',
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  device_fingerprint TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela é APPEND-ONLY (sem UPDATE/DELETE)
```

### 3.14 Tabela de Logs de Auditoria (audit_log)

```sql
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  user_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela é APPEND-ONLY (sem UPDATE/DELETE)
```

### 3.15 Tabela de Configurações do Sistema (system_settings)

```sql
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  is_secret BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir chaves de API
INSERT INTO public.system_settings (key, description, is_secret) VALUES
  ('GOOGLE_API_KEY', 'Google Gemini API Key', true),
  ('OPENAI_API_KEY', 'OpenAI API Key', true),
  ('ANTHROPIC_API_KEY', 'Anthropic Claude API Key', true),
  ('DEEPSEEK_API_KEY', 'DeepSeek API Key', true);
```

### 3.16 Tabelas de Hierarquia Organizacional

```sql
-- Fazendas/Unidades
CREATE TABLE public.farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  location TEXT,
  cnae TEXT DEFAULT '01.15-6-00',
  risk_degree INTEGER DEFAULT 3,
  manager_name TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Departamentos/Setores
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES public.farms(id),
  name TEXT NOT NULL,
  code TEXT,
  manager_name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cargos/Funções
CREATE TABLE public.job_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id),
  name TEXT NOT NULL,
  description TEXT,
  cbo TEXT,
  cbo_description TEXT,
  risk_category TEXT,
  environment_desc TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Funcionários
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  registration_code TEXT,
  farm_id UUID REFERENCES public.farms(id),
  job_role_id UUID REFERENCES public.job_roles(id),
  admission_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.17 Tabelas de Pesos de Questões (question_weights)

```sql
CREATE TABLE public.question_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES public.forms(id),
  question_id TEXT NOT NULL,
  option_text TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Exemplo de dados para ERGOS:
/*
INSERT INTO question_weights (form_id, question_id, option_text, weight, display_order) VALUES
  ('uuid-form-ergos', 'pt_1', 'Menos de 5% da jornada', 0, 1),
  ('uuid-form-ergos', 'pt_1', '5 a 15% da jornada', 2, 2),
  ('uuid-form-ergos', 'pt_1', 'Mais de 15% da jornada', 4, 3);
*/
```

### 3.18 Matrizes de Risco

```sql
-- Matriz ERGOS
CREATE TABLE public.risk_matrix_ergos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension TEXT NOT NULL,
  perigo TEXT NOT NULL,
  fonte_geradora TEXT,
  dano_potencial TEXT,
  medida_controle_sugerida TEXT,
  gravidade_padrao INTEGER DEFAULT 3,
  probabilidade_base INTEGER DEFAULT 3,
  nr_referencia TEXT[],
  observacoes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Matriz HSE-IT
CREATE TABLE public.risk_matrix_hseit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension TEXT NOT NULL,
  perigo TEXT NOT NULL,
  fonte_geradora TEXT,
  dano_potencial TEXT,
  medida_controle_sugerida TEXT,
  gravidade_padrao INTEGER DEFAULT 3,
  probabilidade_base INTEGER DEFAULT 3,
  benchmark_hse NUMERIC,
  nr_referencia TEXT[],
  observacoes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. ROW LEVEL SECURITY (RLS)

### 4.1 Funções de Segurança (SECURITY DEFINER)

```sql
-- Verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
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

-- Verificar se usuário é super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Verificar se usuário tem role específica
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Obter role do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id LIMIT 1;
$$;
```

### 4.2 Habilitar RLS em Todas as Tabelas

```sql
-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fmea_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggested_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_weights ENABLE ROW LEVEL SECURITY;
```

### 4.3 Políticas RLS - Profiles

```sql
-- Usuário pode ver próprio perfil
CREATE POLICY "auth_select_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Usuário pode atualizar próprio perfil (sem mudar role)
CREATE POLICY "auth_update_own_profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- Usuário pode inserir próprio perfil
CREATE POLICY "auth_insert_own_profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin pode ver todos os perfis
CREATE POLICY "admin_select_all_profiles" ON public.profiles
  FOR SELECT USING (is_admin(auth.uid()));

-- Admin pode atualizar perfis (sem escalar própria role)
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE USING (is_admin(auth.uid()))
  WITH CHECK (
    is_admin(auth.uid()) AND
    role = (SELECT role FROM profiles WHERE id = profiles.id)
  );
```

### 4.4 Políticas RLS - User Roles

```sql
-- Usuário pode ver próprias roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Super admin pode gerenciar todas as roles
CREATE POLICY "Super admins can manage all roles" ON public.user_roles
  FOR ALL USING (is_super_admin(auth.uid()));
```

### 4.5 Políticas RLS - Submissions

```sql
-- Qualquer um pode inserir (formulário público)
CREATE POLICY "anon_insert_only_submissions" ON public.submissions
  FOR INSERT WITH CHECK (true);

-- Usuário autenticado pode inserir
CREATE POLICY "auth_insert_submissions" ON public.submissions
  FOR INSERT WITH CHECK (true);

-- Usuário pode ver próprias submissões
CREATE POLICY "user_select_own_submissions" ON public.submissions
  FOR SELECT USING (
    (respondent_data->>'user_id')::text = auth.uid()::text
  );

-- Admin pode ver todas
CREATE POLICY "admin_select_all_submissions" ON public.submissions
  FOR SELECT USING (is_admin(auth.uid()));

-- Admin pode atualizar
CREATE POLICY "admin_update_submissions" ON public.submissions
  FOR UPDATE USING (is_admin(auth.uid()));
```

### 4.6 Políticas RLS - Reports

```sql
-- Admin pode ver todos
CREATE POLICY "Admins can view all reports" ON public.reports
  FOR SELECT USING (is_admin(auth.uid()));

-- Admin pode criar
CREATE POLICY "Admins can create reports" ON public.reports
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- Admin pode atualizar
CREATE POLICY "Admins can update reports" ON public.reports
  FOR UPDATE USING (is_admin(auth.uid()));

-- Usuário pode ver próprios relatórios
CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = reports.submission_id
      AND (s.respondent_data->>'user_id')::text = auth.uid()::text
    )
  );
```

### 4.7 Políticas RLS - Forms

```sql
-- Qualquer um pode ver formulários ativos
CREATE POLICY "Anyone can view active forms" ON public.forms
  FOR SELECT USING (is_active = true);

-- Usuário autenticado pode ver formulários ativos
CREATE POLICY "Anyone authenticated can view active forms" ON public.forms
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admin pode ver todos
CREATE POLICY "Admins can view all forms" ON public.forms
  FOR SELECT USING (is_admin(auth.uid()));

-- Admin pode criar
CREATE POLICY "Admins can create forms" ON public.forms
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- Admin pode atualizar
CREATE POLICY "Admins can update forms" ON public.forms
  FOR UPDATE USING (is_admin(auth.uid()));

-- Admin pode deletar
CREATE POLICY "Admins can delete forms" ON public.forms
  FOR DELETE USING (is_admin(auth.uid()));
```

### 4.8 Políticas RLS - AI Prompts

```sql
-- Admin pode ver prompts
CREATE POLICY "Admins can view prompts" ON public.ai_prompts
  FOR SELECT USING (is_admin(auth.uid()));

-- Super admin pode gerenciar
CREATE POLICY "Super admins can manage prompts" ON public.ai_prompts
  FOR ALL USING (is_super_admin(auth.uid()));
```

### 4.9 Políticas RLS - Consent Logs (APPEND-ONLY)

```sql
-- Qualquer um pode inserir consentimento
CREATE POLICY "Anyone can insert consent" ON public.consent_logs
  FOR INSERT WITH CHECK (true);

-- Admin pode ver
CREATE POLICY "Admins can view consent logs" ON public.consent_logs
  FOR SELECT USING (is_admin(auth.uid()));

-- NÃO criar políticas de UPDATE ou DELETE!
```

### 4.10 Políticas RLS - Audit Log (APPEND-ONLY)

```sql
-- Qualquer um pode inserir log
CREATE POLICY "auth_insert_audit_logs" ON public.audit_log
  FOR INSERT WITH CHECK (true);

-- Service role pode inserir
CREATE POLICY "service_insert_audit_logs" ON public.audit_log
  FOR INSERT WITH CHECK (true);

-- Admin pode ver
CREATE POLICY "admin_select_audit_logs" ON public.audit_log
  FOR SELECT USING (is_admin(auth.uid()));

-- Super admin pode ver
CREATE POLICY "super_admin_select_audit_logs" ON public.audit_log
  FOR SELECT USING (is_super_admin(auth.uid()));

-- NÃO criar políticas de UPDATE ou DELETE!
```

### 4.11 Políticas RLS - System Settings

```sql
-- Apenas super admin pode acessar
CREATE POLICY "super_admin_all_settings" ON public.system_settings
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
```

### 4.12 Políticas RLS - Hierarquia Organizacional

```sql
-- Farms - qualquer um pode ver
CREATE POLICY "Anyone can view farms" ON public.farms
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage farms" ON public.farms
  FOR ALL USING (is_admin(auth.uid()));

-- Departments - qualquer um pode ver
CREATE POLICY "Anyone can view departments" ON public.departments
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage departments" ON public.departments
  FOR ALL USING (is_admin(auth.uid()));

-- Job Roles - qualquer um pode ver
CREATE POLICY "Anyone can view job_roles" ON public.job_roles
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage job_roles" ON public.job_roles
  FOR ALL USING (is_admin(auth.uid()));

-- Employees - admin pode gerenciar
CREATE POLICY "Admins can view all employees" ON public.employees
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage employees" ON public.employees
  FOR ALL USING (is_admin(auth.uid()));
```

---

## 5. FUNÇÕES POSTGRESQL

### 5.1 Gerar Hash do Respondente

```sql
CREATE OR REPLACE FUNCTION public.generate_respondent_hash_secure(respondent_data JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  salt TEXT := 'HC_AMAGGI_SECURE_SALT_2024_LGPD_COMPLIANT';
  data_string TEXT;
BEGIN
  data_string := COALESCE(respondent_data->>'nome', '') || 
                 COALESCE(respondent_data->>'cpf', '') ||
                 COALESCE(respondent_data->>'setor', '') || 
                 COALESCE(respondent_data->>'cargo', '') ||
                 salt;
  
  RETURN encode(sha256(data_string::bytea), 'hex');
END;
$$;
```

### 5.2 Trigger para Hash Automático

```sql
CREATE OR REPLACE FUNCTION public.handle_submission_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.respondent_hash := generate_respondent_hash_secure(NEW.respondent_data);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_submission_hash
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION handle_submission_hash();
```

### 5.3 Rate Limiting

```sql
CREATE OR REPLACE FUNCTION public.check_submission_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
  max_submissions_per_window INTEGER := 5;
  window_minutes INTEGER := 10;
BEGIN
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

CREATE TRIGGER trigger_rate_limit
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION check_submission_rate_limit();
```

### 5.4 Classificação NRE

```sql
CREATE OR REPLACE FUNCTION public.get_nre_classification(nre INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE
    WHEN nre <= 50 THEN 'Trivial'
    WHEN nre <= 100 THEN 'Tolerável'
    WHEN nre <= 200 THEN 'Moderado'
    WHEN nre <= 400 THEN 'Substancial'
    ELSE 'Intolerável'
  END;
END;
$$;
```

### 5.5 Anonimização LGPD

```sql
CREATE OR REPLACE FUNCTION public.anonymize_submission(target_submission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original_hash TEXT;
BEGIN
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  SELECT respondent_hash INTO original_hash
  FROM public.submissions
  WHERE id = target_submission_id;

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
```

### 5.6 Exportação de Dados LGPD

```sql
CREATE OR REPLACE FUNCTION public.export_user_data(target_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
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
      WHERE s.respondent_data->>'cpf' ILIKE '%' || target_identifier || '%'
         OR s.respondent_data->>'nome' ILIKE '%' || target_identifier || '%'),
      '[]'::jsonb
    )
  ) INTO result;

  INSERT INTO public.audit_log (action, table_name, user_id, new_data)
  VALUES (
    'LGPD_DATA_EXPORT',
    'submissions',
    auth.uid(),
    jsonb_build_object('identifier_searched', target_identifier, 'exported_at', now())
  );

  RETURN result;
END;
$$;
```

### 5.7 Busca de Similaridade RAG

```sql
CREATE OR REPLACE FUNCTION public.search_similar_chunks(
  query_embedding vector,
  agent_uuid UUID,
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE(id UUID, document_id UUID, content TEXT, similarity DOUBLE PRECISION)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  INNER JOIN agent_documents ad ON dc.document_id = ad.document_id
  WHERE ad.agent_id = agent_uuid
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 5.8 Assinatura Digital

```sql
CREATE OR REPLACE FUNCTION public.generate_signature_hash(
  report_uuid UUID,
  signer_name TEXT,
  signed_timestamp TIMESTAMPTZ
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
  
  hash_input := CONCAT(
    report_content,
    signer_name,
    signed_timestamp::text,
    'HC_CONSULTORIA_DIGITAL_SIGNATURE_2024'
  );
  
  RETURN encode(sha256(hash_input::bytea), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_report(
  report_uuid UUID,
  p_signer_name TEXT,
  p_signer_role TEXT,
  p_signer_credential TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(signature_id UUID, verification_code TEXT, signature_hash TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signature_hash TEXT;
  v_verification_code TEXT;
  v_signature_id UUID;
  v_signed_at TIMESTAMPTZ := now();
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  v_signature_hash := generate_signature_hash(report_uuid, p_signer_name, v_signed_at);
  v_verification_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
  
  INSERT INTO report_signatures (
    report_id, signer_name, signer_role, signer_credential,
    signature_hash, signed_at, ip_address, user_agent,
    verification_code, is_verified
  ) VALUES (
    report_uuid, p_signer_name, p_signer_role, p_signer_credential,
    v_signature_hash, v_signed_at, p_ip_address, p_user_agent,
    v_verification_code, true
  )
  RETURNING id INTO v_signature_id;
  
  INSERT INTO audit_log (action, table_name, record_id, user_id, new_data)
  VALUES (
    'REPORT_SIGNED', 'report_signatures', v_signature_id, auth.uid(),
    jsonb_build_object('report_id', report_uuid, 'verification_code', v_verification_code)
  );
  
  RETURN QUERY SELECT v_signature_id, v_verification_code, v_signature_hash;
END;
$$;
```

### 5.9 Handle New User Trigger

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value user_role;
  app_role_value app_role;
  user_full_name TEXT;
  user_email TEXT;
BEGIN
  user_email := COALESCE(NEW.email, 'unknown@email.com');
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'name',
    split_part(user_email, '@', 1)
  );
  
  BEGIN
    user_role_value := COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role, 
      'employee_amaggi'
    );
  EXCEPTION WHEN OTHERS THEN
    user_role_value := 'admin_hc';
  END;
  
  INSERT INTO public.profiles (id, full_name, email, role, company)
  VALUES (
    NEW.id,
    user_full_name,
    user_email,
    user_role_value,
    'Amaggi'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = now();
  
  IF user_role_value = 'admin_hc' THEN
    app_role_value := 'admin_hc';
  ELSE
    app_role_value := 'employee_amaggi';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, app_role_value)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger em auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

## 6. TRIGGERS

### 6.1 Updated_at Automático

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Aplicar em todas as tabelas com updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.suggested_actions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

---

## 7. EDGE FUNCTIONS

### 7.1 Estrutura Padrão de Edge Function

```typescript
// supabase/functions/nome-funcao/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Lógica da função
    const { param } = await req.json();

    // ... processamento ...

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### 7.2 Edge Function: analyze-submission

```typescript
// supabase/functions/analyze-submission/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MASTER_PROMPT = `Você é um especialista em ergonomia e análise psicossocial.
Analise os dados fornecidos e gere um relatório técnico em JSON.

Estrutura de saída OBRIGATÓRIA:
{
  "resumo_executivo": "...",
  "fatores_criticos": ["..."],
  "recomendacoes": ["..."],
  "conclusao": "..."
}`;

// Função para chamar Lovable AI Gateway
async function callLovableAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    }),
  });

  if (!response.ok) {
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Função para chamar Google Gemini
async function callGoogleGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4000 }
      }),
    }
  );

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Função para gerar embeddings (RAG)
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    }),
  });

  const data = await response.json();
  return data.data[0].embedding;
}

// Buscar contexto RAG
async function searchRAG(supabase: any, agentId: string, query: string, topK: number, apiKey: string): Promise<string> {
  const embedding = await generateEmbedding(query, apiKey);
  
  const { data: chunks, error } = await supabase.rpc('search_similar_chunks', {
    query_embedding: `[${embedding.join(',')}]`,
    agent_uuid: agentId,
    match_count: topK
  });

  if (error || !chunks?.length) return '';
  
  return chunks.map((c: any) => c.content).join('\n\n---\n\n');
}

// Cálculo de fallback
function calculateUniversalScore(formType: string, answers: Record<string, any>, form: any) {
  if (formType === 'ergos') {
    // Fórmula ERGOS: 0.83 × (Soma Bloco A + Soma Bloco B)
    let totalWeight = 0;
    // Lógica de cálculo baseada em pesos
    const globalScore = Math.min(100, Math.round(0.83 * totalWeight));
    return {
      global_score: globalScore,
      risk_level: globalScore <= 30 ? 'baixo' : globalScore <= 60 ? 'medio' : 'alto',
      risk_label: globalScore <= 30 ? 'Satisfatório' : globalScore <= 60 ? 'Aceitável' : 'Deve Melhorar',
      risk_color: globalScore <= 30 ? 'green' : globalScore <= 60 ? 'yellow' : 'red',
      dimensions: []
    };
  }
  // HSE-IT e outros...
  return { global_score: 50, risk_level: 'medio' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { submissionId } = await req.json();
    if (!submissionId) throw new Error('submissionId required');

    // Buscar submissão
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select('*, forms(*)')
      .eq('id', submissionId)
      .single();

    if (subError) throw subError;

    const form = submission.forms;
    const formType = form.type;

    // Buscar agente ativo
    const { data: agent } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('form_type', formType)
      .eq('is_active', true)
      .single();

    // Preparar prompt
    let systemPrompt = agent?.system_prompt || MASTER_PROMPT;
    let ragContext = '';

    // Buscar RAG se habilitado
    if (agent?.use_rag) {
      const query = `${submission.respondent_data?.cargo || ''} ${submission.respondent_data?.setor || ''}`;
      ragContext = await searchRAG(supabase, agent.id, query, agent.rag_top_k || 5, lovableApiKey);
      if (ragContext) {
        systemPrompt += `\n\nCONTEXTO DA BASE DE CONHECIMENTO:\n${ragContext}`;
      }
    }

    // Preparar user prompt
    const userPrompt = `DADOS DO RESPONDENTE:
${JSON.stringify(submission.respondent_data, null, 2)}

RESPOSTAS DO QUESTIONÁRIO (${formType.toUpperCase()}):
${JSON.stringify(submission.answers, null, 2)}`;

    // Chamar IA
    let aiResponse: string;
    const provider = agent?.provider || 'lovable';

    if (provider === 'google') {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'GOOGLE_API_KEY')
        .single();
      aiResponse = await callGoogleGemini(settings.value, systemPrompt, userPrompt);
    } else {
      aiResponse = await callLovableAI(systemPrompt, userPrompt);
    }

    // Parsear resposta JSON
    let analysis;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { resumo_executivo: aiResponse };
    } catch {
      analysis = { resumo_executivo: aiResponse };
    }

    // Calcular scores
    const calculatedScores = calculateUniversalScore(formType, submission.answers, form);

    // Criar relatório
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        submission_id: submissionId,
        ai_analysis_text: analysis.resumo_executivo || aiResponse,
        ai_conclusion: analysis.conclusao || '',
        ai_recommendations: analysis.recomendacoes || [],
        dimensions_score: calculatedScores,
        risk_level: calculatedScores.risk_label
      })
      .select()
      .single();

    if (reportError) throw reportError;

    // Atualizar status da submissão
    if (submission.status !== 'approved') {
      await supabase
        .from('submissions')
        .update({ status: 'processed' })
        .eq('id', submissionId);
    }

    // Registrar uso de IA
    await supabase.from('ai_usage').insert({
      agent_id: agent?.id,
      submission_id: submissionId,
      provider: provider,
      model: agent?.model || 'google/gemini-2.5-flash',
      total_tokens: 0
    });

    return new Response(JSON.stringify({ success: true, reportId: report.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### 7.3 Edge Function: universal-calculator

```typescript
// supabase/functions/universal-calculator/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Thresholds padrão
const DEFAULT_THRESHOLDS = {
  low: { min: 0, max: 30, label: 'Satisfatório', color: 'green' },
  medium: { min: 31, max: 60, label: 'Aceitável', color: 'yellow' },
  high: { min: 61, max: 100, label: 'Deve Melhorar', color: 'red' }
};

// Detectar formato (legacy vs modern)
function detectAnswerFormat(answers: Record<string, any>): 'legacy' | 'modern' {
  const keys = Object.keys(answers);
  const hasNumericValues = keys.some(k => typeof answers[k] === 'number');
  const hasQuestionIds = keys.some(k => k.match(/^[a-z]{2}_\d+$/));
  return hasQuestionIds && !hasNumericValues ? 'modern' : 'legacy';
}

// Calcular ERGOS
function calculateErgos(answers: Record<string, any>, form: any, questionWeights: any[]): any {
  const format = detectAnswerFormat(answers);
  let totalWeight = 0;
  const dimensionScores: any[] = [];

  if (format === 'modern') {
    // Formato moderno: buscar pesos das opções
    for (const [questionId, answer] of Object.entries(answers)) {
      const weight = questionWeights.find(
        w => w.question_id === questionId && w.option_text === answer
      );
      if (weight) {
        totalWeight += weight.weight;
      }
    }
  } else {
    // Formato legacy: valores numéricos diretos
    totalWeight = Object.values(answers).reduce((sum: number, v) => sum + (Number(v) || 0), 0);
  }

  const globalScore = Math.min(100, Math.round(0.83 * totalWeight));
  const threshold = globalScore <= 30 ? DEFAULT_THRESHOLDS.low :
                    globalScore <= 60 ? DEFAULT_THRESHOLDS.medium :
                    DEFAULT_THRESHOLDS.high;

  return {
    global_score: globalScore,
    risk_level: globalScore <= 30 ? 'baixo' : globalScore <= 60 ? 'medio' : 'alto',
    risk_label: threshold.label,
    risk_color: threshold.color,
    dimensions: dimensionScores
  };
}

// Calcular HSE-IT (percentual de estressores)
function calculateHseIt(answers: Record<string, any>, form: any): any {
  const dimensions: Record<string, { total: number; stressor: number }> = {
    'Demandas': { total: 0, stressor: 0 },
    'Controle': { total: 0, stressor: 0 },
    'Apoio Chefia': { total: 0, stressor: 0 },
    'Apoio Colegas': { total: 0, stressor: 0 },
    'Relacionamentos': { total: 0, stressor: 0 },
    'Cargo': { total: 0, stressor: 0 },
    'Mudanças': { total: 0, stressor: 0 }
  };

  // Dimensões que precisam de inversão
  const invertedDimensions = ['Controle', 'Apoio Chefia', 'Apoio Colegas', 'Cargo', 'Mudanças'];

  for (const [questionId, value] of Object.entries(answers)) {
    const numValue = Number(value);
    const dimensionName = getDimensionFromQuestionId(questionId); // Função auxiliar
    
    if (dimensions[dimensionName]) {
      dimensions[dimensionName].total++;
      
      const isInverted = invertedDimensions.includes(dimensionName);
      const isStressor = isInverted ? (numValue <= 2) : (numValue >= 4);
      
      if (isStressor) {
        dimensions[dimensionName].stressor++;
      }
    }
  }

  const dimensionScores = Object.entries(dimensions).map(([name, data]) => {
    const percentage = data.total > 0 ? Math.round((data.stressor / data.total) * 100) : 0;
    return {
      name,
      score: percentage,
      normalized_score: percentage,
      status: percentage <= 30 ? 'Adequado' : percentage <= 60 ? 'Atenção' : 'Crítico',
      color: percentage <= 30 ? 'green' : percentage <= 60 ? 'yellow' : 'red'
    };
  });

  const globalScore = Math.round(
    dimensionScores.reduce((sum, d) => sum + d.score, 0) / dimensionScores.length
  );

  return {
    global_score: globalScore,
    risk_level: globalScore <= 30 ? 'baixo' : globalScore <= 60 ? 'medio' : 'alto',
    risk_label: globalScore <= 30 ? 'Satisfatório' : globalScore <= 60 ? 'Aceitável' : 'Deve Melhorar',
    risk_color: globalScore <= 30 ? 'green' : globalScore <= 60 ? 'yellow' : 'red',
    dimensions: dimensionScores
  };
}

function getDimensionFromQuestionId(questionId: string): string {
  // Mapeamento de prefixos para dimensões
  const prefixMap: Record<string, string> = {
    'dm': 'Demandas',
    'ct': 'Controle',
    'ac': 'Apoio Chefia',
    'ap': 'Apoio Colegas',
    'rl': 'Relacionamentos',
    'cg': 'Cargo',
    'md': 'Mudanças'
  };
  const prefix = questionId.substring(0, 2);
  return prefixMap[prefix] || 'Outros';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { submissionId, formId } = await req.json();

    // Buscar submissão e formulário
    const { data: submission } = await supabase
      .from('submissions')
      .select('*, forms(*)')
      .eq('id', submissionId)
      .single();

    const form = submission.forms;
    const formType = form.type;

    // Buscar pesos das questões (para ERGOS)
    const { data: questionWeights } = await supabase
      .from('question_weights')
      .select('*')
      .eq('form_id', form.id);

    // Calcular baseado no tipo
    let result;
    if (formType === 'ergos') {
      result = calculateErgos(submission.answers, form, questionWeights || []);
    } else if (formType === 'hse_it') {
      result = calculateHseIt(submission.answers, form);
    } else {
      throw new Error(`Unsupported form type: ${formType}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### 7.4 Edge Function: calculate-fmea

```typescript
// supabase/functions/calculate-fmea/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Thresholds para auto-FMEA baseado em scores
const HSE_FMEA_THRESHOLDS = {
  'Demandas': { threshold: 70, risk: 'Sobrecarga Quantitativa', gravity: 4 },
  'Controle': { threshold: 50, inverted: true, risk: 'Falta de Autonomia', gravity: 3 },
  'Apoio Chefia': { threshold: 50, inverted: true, risk: 'Isolamento Vertical', gravity: 3 },
  'Apoio Colegas': { threshold: 50, inverted: true, risk: 'Isolamento Horizontal', gravity: 3 },
  'Relacionamentos': { threshold: 70, risk: 'Conflitos Interpessoais', gravity: 4 },
  'Cargo': { threshold: 50, inverted: true, risk: 'Ambiguidade de Papel', gravity: 3 },
  'Mudanças': { threshold: 50, inverted: true, risk: 'Resistência a Mudanças', gravity: 3 }
};

const ERGOS_FMEA_THRESHOLDS = {
  'Pressão de Tempo': { threshold: 70, risk: 'Sobrecarga Temporal', gravity: 4 },
  'Atenção': { threshold: 70, risk: 'Fadiga Atencional', gravity: 3 },
  'Complexidade': { threshold: 70, risk: 'Sobrecarga Cognitiva', gravity: 4 },
  'Monotonia': { threshold: 70, risk: 'Subcarregamento Mental', gravity: 3 },
  'Raciocínio': { threshold: 70, risk: 'Demanda de Decisão', gravity: 3 }
};

// Classificação NRE
function getNREClassification(nre: number): string {
  if (nre <= 50) return 'Trivial';
  if (nre <= 100) return 'Tolerável';
  if (nre <= 200) return 'Moderado';
  if (nre <= 400) return 'Substancial';
  return 'Intolerável';
}

// Prioridade baseada em NRE
function getPriorityFromNRE(nre: number): string {
  if (nre > 400) return 'urgente';
  if (nre > 200) return 'alta';
  if (nre > 100) return 'media';
  return 'baixa';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { reportId } = await req.json();

    // Buscar relatório com scores
    const { data: report } = await supabase
      .from('reports')
      .select('*, submissions(*, forms(*))')
      .eq('id', reportId)
      .single();

    const formType = report.submissions.forms.type;
    const dimensions = report.dimensions_score?.dimensions || [];
    const thresholds = formType === 'hse_it' ? HSE_FMEA_THRESHOLDS : ERGOS_FMEA_THRESHOLDS;

    let totalGravidade = 0;
    let totalProbabilidade = 0;
    let dimensionCount = 0;
    const suggestedActions: any[] = [];

    // Analisar cada dimensão
    for (const dim of dimensions) {
      const config = thresholds[dim.name];
      if (!config) continue;

      const score = dim.score || dim.normalized_score;
      const shouldTrigger = config.inverted 
        ? score < config.threshold 
        : score > config.threshold;

      if (shouldTrigger) {
        const gravity = config.gravity;
        const probability = Math.min(5, Math.ceil(score / 20));
        const detection = 3; // Padrão médio
        const nre = gravity * probability * detection;

        totalGravidade += gravity;
        totalProbabilidade += probability;
        dimensionCount++;

        // Criar ação sugerida
        suggestedActions.push({
          report_id: reportId,
          dimension: dim.name,
          risk_detected: config.risk,
          action_title: `Avaliar ${config.risk}`,
          action_description: `Score de ${score}% em ${dim.name} indica necessidade de intervenção`,
          priority: getPriorityFromNRE(nre),
          nre_score: nre,
          nre_classification: getNREClassification(nre),
          nr_referencia: ['NR-01', 'NR-17'],
          source_matrix: formType
        });
      }
    }

    // Calcular FMEA geral
    const avgGravidade = dimensionCount > 0 ? Math.round(totalGravidade / dimensionCount) : 1;
    const avgProbabilidade = dimensionCount > 0 ? Math.round(totalProbabilidade / dimensionCount) : 1;
    const capacidadeDeteccao = 3;
    const nreScore = avgGravidade * avgProbabilidade * capacidadeDeteccao;

    // Inserir/Atualizar FMEA
    const { data: fmea } = await supabase
      .from('fmea_calculations')
      .upsert({
        report_id: reportId,
        gravidade: avgGravidade,
        probabilidade: avgProbabilidade,
        capacidade_deteccao: capacidadeDeteccao,
        nre_score: nreScore,
        nre_classification: getNREClassification(nreScore),
        dimension_scores: { dimensions, thresholds_used: formType },
        requires_manual_review: nreScore > 200,
        review_reason: nreScore > 200 ? 'NRE elevado requer revisão técnica' : null,
        calculated_at: new Date().toISOString()
      }, { onConflict: 'report_id' })
      .select()
      .single();

    // Inserir ações sugeridas
    if (suggestedActions.length > 0) {
      await supabase.from('suggested_actions').insert(suggestedActions);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      fmea,
      actionsCreated: suggestedActions.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### 7.5 Edge Function: generate-narrative-report

```typescript
// supabase/functions/generate-narrative-report/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NARRATIVE_SYSTEM_PROMPT = `Você é um ergonomista sênior especializado em análise ergonômica do trabalho (AET).
Sua tarefa é redigir uma narrativa técnica profissional em português brasileiro.

DIRETRIZES:
- Use linguagem técnica apropriada
- Referencie normas: NR-01, NR-17, ISO 10075-1, ISO 45003
- Seja objetivo e fundamentado nos dados
- Estruture em parágrafos claros

SEÇÕES DISPONÍVEIS:
- analysis: Análise técnica detalhada
- conclusion: Conclusão do parecer
- recommendations: Lista de recomendações`;

async function callLovableAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { reportId, section } = await req.json();
    // section: 'analysis' | 'conclusion' | 'recommendations'

    // Buscar relatório completo
    const { data: report } = await supabase
      .from('reports')
      .select('*, submissions(*, forms(*)), fmea_calculations(*), suggested_actions(*)')
      .eq('id', reportId)
      .single();

    const submission = report.submissions;
    const form = submission.forms;
    const fmea = report.fmea_calculations;
    const actions = report.suggested_actions || [];

    // Preparar prompt específico da seção
    let sectionPrompt = '';
    if (section === 'analysis') {
      sectionPrompt = `Redija uma ANÁLISE TÉCNICA detalhada considerando:
- Tipo de avaliação: ${form.type.toUpperCase()}
- Score global: ${report.dimensions_score?.global_score || 'N/A'}
- Nível de risco: ${report.risk_level}
- Dimensões críticas: ${JSON.stringify(report.dimensions_score?.dimensions?.filter((d: any) => d.status === 'Crítico'))}`;
    } else if (section === 'conclusion') {
      sectionPrompt = `Redija uma CONCLUSÃO TÉCNICA considerando:
- Parecer geral sobre o ${form.type.toUpperCase()}
- NRE FMEA: ${fmea?.nre_score || 'N/A'} (${fmea?.nre_classification || 'N/A'})
- Requer revisão manual: ${fmea?.requires_manual_review ? 'Sim' : 'Não'}`;
    } else if (section === 'recommendations') {
      sectionPrompt = `Liste RECOMENDAÇÕES TÉCNICAS em formato de lista:
- Base nas ${actions.length} ações sugeridas
- Priorize por NRE
- Inclua referências normativas (NR-01, NR-17)`;
    }

    const userPrompt = `DADOS DO RESPONDENTE:
Cargo: ${submission.respondent_data?.cargo || 'N/A'}
Setor: ${submission.respondent_data?.setor || 'N/A'}

SCORES:
${JSON.stringify(report.dimensions_score, null, 2)}

AÇÕES SUGERIDAS:
${JSON.stringify(actions, null, 2)}

${sectionPrompt}`;

    const narrative = await callLovableAI(NARRATIVE_SYSTEM_PROMPT, userPrompt);

    // Atualizar o campo correspondente
    const updateField = section === 'analysis' ? 'ai_analysis_text' :
                        section === 'conclusion' ? 'ai_conclusion' :
                        'ai_recommendations';

    const updateValue = section === 'recommendations' 
      ? narrative.split('\n').filter((l: string) => l.trim().startsWith('-')).map((l: string) => l.replace(/^-\s*/, ''))
      : narrative;

    await supabase
      .from('reports')
      .update({ [updateField]: updateValue })
      .eq('id', reportId);

    // Registrar uso
    await supabase.from('ai_usage').insert({
      submission_id: submission.id,
      provider: 'lovable',
      model: 'google/gemini-2.5-flash',
      total_tokens: 0
    });

    return new Response(JSON.stringify({ 
      success: true, 
      section,
      narrative 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### 7.6 Edge Function: process-document (RAG)

```typescript
// supabase/functions/process-document/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Chunk de texto com overlap
function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }
  
  return chunks;
}

// Gerar embedding
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000) // Limite de tokens
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const { documentId } = await req.json();

    // Buscar documento
    const { data: doc, error: docError } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError) throw docError;

    // Atualizar status para processing
    await supabase
      .from('knowledge_documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    // Baixar arquivo do storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('knowledge-base')
      .download(doc.file_path);

    if (downloadError) throw downloadError;

    // Extrair texto (simplificado - em produção usar bibliotecas específicas)
    let textContent = '';
    if (doc.file_type.includes('text') || doc.file_type.includes('csv')) {
      textContent = await fileData.text();
    } else {
      // Para PDFs/Word, usar serviços externos ou bibliotecas
      textContent = `Conteúdo do documento: ${doc.name}`;
    }

    // Chunkar texto
    const chunks = chunkText(textContent, 500, 50);

    // Processar cada chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      
      // Gerar embedding
      const embedding = await generateEmbedding(chunkContent, lovableApiKey);
      
      // Inserir chunk com embedding
      await supabase.from('document_chunks').insert({
        document_id: documentId,
        content: chunkContent,
        chunk_index: i,
        embedding: `[${embedding.join(',')}]`,
        metadata: {
          source: doc.name,
          chunk_number: i + 1,
          total_chunks: chunks.length
        }
      });
    }

    // Atualizar documento como processado
    await supabase
      .from('knowledge_documents')
      .update({ 
        status: 'processed',
        chunks_count: chunks.length
      })
      .eq('id', documentId);

    return new Response(JSON.stringify({ 
      success: true, 
      chunksCreated: chunks.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    
    // Marcar documento como erro
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { documentId } = await req.json().catch(() => ({}));
    if (documentId) {
      await supabase
        .from('knowledge_documents')
        .update({ status: 'error' })
        .eq('id', documentId);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### 7.7 Edge Function: generate-pdf

```typescript
// supabase/functions/generate-pdf/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { reportId } = await req.json();

    // Buscar relatório completo
    const { data: report } = await supabase
      .from('reports')
      .select(`
        *,
        submissions(*, forms(*)),
        fmea_calculations(*),
        suggested_actions(*),
        report_signatures(*)
      `)
      .eq('id', reportId)
      .single();

    const submission = report.submissions;
    const form = submission.forms;
    const respondent = submission.respondent_data;
    const fmea = report.fmea_calculations;
    const actions = report.suggested_actions || [];

    // Gerar HTML do PDF
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>Relatório AET - ${respondent?.cargo || 'Análise'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
    h2 { color: #2c5282; margin-top: 30px; }
    .header { text-align: center; margin-bottom: 30px; }
    .section { margin: 20px 0; padding: 15px; background: #f7fafc; border-radius: 8px; }
    .score-box { display: inline-block; padding: 10px 20px; border-radius: 5px; font-weight: bold; }
    .score-green { background: #c6f6d5; color: #22543d; }
    .score-yellow { background: #fefcbf; color: #744210; }
    .score-red { background: #fed7d7; color: #742a2a; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
    th { background: #edf2f7; }
    .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #718096; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ANÁLISE ERGONÔMICA DO TRABALHO</h1>
    <p>Formulário: ${form.title} (${form.type.toUpperCase()})</p>
    <p>Data: ${new Date(report.created_at).toLocaleDateString('pt-BR')}</p>
  </div>

  <div class="section">
    <h2>BLOCO A - Identificação</h2>
    <table>
      <tr><td><strong>Empresa:</strong></td><td>Amaggi</td></tr>
      <tr><td><strong>Cargo/Função:</strong></td><td>${respondent?.cargo || 'N/A'}</td></tr>
      <tr><td><strong>Setor:</strong></td><td>${respondent?.setor || 'N/A'}</td></tr>
      <tr><td><strong>CBO:</strong></td><td>${respondent?.cbo || 'N/A'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>BLOCO B - Avaliação Quantitativa</h2>
    <p><strong>Score Global:</strong> 
      <span class="score-box score-${report.dimensions_score?.risk_color || 'yellow'}">
        ${report.dimensions_score?.global_score || 0}% - ${report.dimensions_score?.risk_label || 'N/A'}
      </span>
    </p>
    
    <h3>Dimensões Avaliadas:</h3>
    <table>
      <thead>
        <tr><th>Dimensão</th><th>Score</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${(report.dimensions_score?.dimensions || []).map((d: any) => `
          <tr>
            <td>${d.name}</td>
            <td>${d.score}%</td>
            <td style="background: ${d.color === 'green' ? '#c6f6d5' : d.color === 'yellow' ? '#fefcbf' : '#fed7d7'}">${d.status}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>BLOCO C - Parecer Técnico</h2>
    <div>${report.ai_analysis_text || 'Análise não disponível'}</div>
    
    <h3>Conclusão:</h3>
    <div>${report.ai_conclusion || 'Conclusão não disponível'}</div>
  </div>

  ${fmea ? `
  <div class="section">
    <h2>BLOCO D - Matriz FMEA</h2>
    <table>
      <tr><td><strong>Gravidade (G):</strong></td><td>${fmea.gravidade}</td></tr>
      <tr><td><strong>Probabilidade (P):</strong></td><td>${fmea.probabilidade}</td></tr>
      <tr><td><strong>Detecção (C):</strong></td><td>${fmea.capacidade_deteccao}</td></tr>
      <tr><td><strong>NRE:</strong></td><td>${fmea.nre_score} (${fmea.nre_classification})</td></tr>
    </table>
  </div>
  ` : ''}

  ${actions.length > 0 ? `
  <div class="section">
    <h2>BLOCO E - Plano de Ação</h2>
    <table>
      <thead>
        <tr><th>Ação</th><th>Prioridade</th><th>NRE</th><th>Referências</th></tr>
      </thead>
      <tbody>
        ${actions.map((a: any) => `
          <tr>
            <td>${a.action_title}</td>
            <td>${a.priority}</td>
            <td>${a.nre_score || '-'}</td>
            <td>${(a.nr_referencia || []).join(', ')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>HC Consultoria - Ergonomia & Fisioterapia</p>
    <p>Documento gerado em ${new Date().toLocaleString('pt-BR')}</p>
    <p>Referências: NR-01, NR-17, ISO 10075-1, ISO 45003</p>
  </div>
</body>
</html>`;

    return new Response(htmlContent, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html; charset=utf-8' 
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### 7.8 Edge Function: scheduled-tasks

```typescript
// supabase/functions/scheduled-tasks/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { task } = await req.json();
    let result: any = {};

    switch (task) {
      case 'cleanup_pii':
        // Anonimizar submissões expiradas (>5 anos)
        const { data: expiredCount } = await supabase.rpc('cleanup_old_pii');
        result = { task: 'cleanup_pii', anonymized: expiredCount };
        break;

      case 'recalculate_fmea':
        // Recalcular FMEA de todos os relatórios pendentes
        const { data: reports } = await supabase
          .from('reports')
          .select('id')
          .is('is_approved', false);

        for (const report of reports || []) {
          await supabase.functions.invoke('calculate-fmea', {
            body: { reportId: report.id }
          });
        }
        result = { task: 'recalculate_fmea', processed: reports?.length || 0 };
        break;

      case 'cleanup_tokens':
        // Limpar tokens expirados
        const { error: tokenError } = await supabase
          .from('submission_tokens')
          .delete()
          .lt('expires_at', new Date().toISOString());
        
        result = { task: 'cleanup_tokens', success: !tokenError };
        break;

      default:
        throw new Error(`Unknown task: ${task}`);
    }

    // Log da tarefa
    await supabase.from('audit_log').insert({
      action: 'SCHEDULED_TASK',
      table_name: 'system',
      new_data: result
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

---

## 8. INTEGRAÇÃO COM IA

### 8.1 Provedores Suportados

| Provedor | Modelo Padrão | Endpoint |
|----------|---------------|----------|
| Lovable | google/gemini-2.5-flash | https://ai.gateway.lovable.dev/v1/chat/completions |
| Google | gemini-1.5-flash | https://generativelanguage.googleapis.com/v1beta/ |
| OpenAI | gpt-4o-mini | https://api.openai.com/v1/chat/completions |
| Anthropic | claude-3-haiku | https://api.anthropic.com/v1/messages |
| DeepSeek | deepseek-chat | https://api.deepseek.com/v1/chat/completions |

### 8.2 Fluxo de Chamada IA

```
1. Frontend dispara analyze-submission
2. Edge function busca agente ativo para form_type
3. Se use_rag=true, busca contexto vetorial
4. Monta prompt com dados + contexto RAG
5. Chama provedor configurado no agente
6. Parseia resposta JSON
7. Cria/atualiza relatório
8. Registra uso em ai_usage
```

### 8.3 Estrutura do Prompt

```
SYSTEM PROMPT (do ai_prompts.system_prompt):
- Instruções para a IA
- Formato de saída esperado
- Normas a referenciar

[Se RAG habilitado]
CONTEXTO DA BASE DE CONHECIMENTO:
- Chunks relevantes recuperados por similaridade

USER PROMPT:
- Dados do respondente (JSON)
- Respostas do questionário (JSON)
- Scores calculados (se disponíveis)
```

---

## 9. SISTEMA DE CÁLCULOS

### 9.1 ERGOS

```
Fórmula: Score = 0.83 × (Soma Bloco A + Soma Bloco B)

Bloco A (Cognitivo):
- Pressão de Tempo (pt_1, pt_2, ...)
- Atenção (at_1, at_2, ...)
- Complexidade (cx_1, ...)
- Monotonia (mn_1, ...)
- Raciocínio (rc_1, ...)

Bloco B (Organizacional):
- Iniciativa (in_1, ...)
- Isolamento (is_1, ...)
- Horários/Turnos (ht_1, ...)
- Relacionamentos (rl_1, ...)
- Demandas Gerais (dg_1, ...)

Pesos das Opções (question_weights):
- Opção favorável: 0 pontos
- Opção intermediária: 2 pontos
- Opção desfavorável: 4 pontos

Classificação:
- 0-30: Satisfatório (verde)
- 31-60: Aceitável (amarelo)
- 61-100: Deve Melhorar (vermelho)
```

### 9.2 HSE-IT

```
Fórmula: (Respostas Estressoras / Total Respostas) × 100

7 Dimensões:
- Demandas: 4-5 = estressor (direto)
- Controle: 1-2 = estressor (invertido)
- Apoio Chefia: 1-2 = estressor (invertido)
- Apoio Colegas: 1-2 = estressor (invertido)
- Relacionamentos: 4-5 = estressor (direto)
- Cargo: 1-2 = estressor (invertido)
- Mudanças: 1-2 = estressor (invertido)

Classificação por dimensão:
- 0-30%: Adequado (verde)
- 31-60%: Atenção (amarelo)
- 61-100%: Crítico (vermelho)
```

### 9.3 FMEA

```
NRE = G × P × C

G (Gravidade): 1-5
P (Probabilidade): 1-5
C (Capacidade de Detecção): 1-5

Classificação NRE:
- 1-50: Trivial
- 51-100: Tolerável
- 101-200: Moderado
- 201-400: Substancial
- 401+: Intolerável
```

---

## 10. RAG E KNOWLEDGE BASE

### 10.1 Pipeline de Processamento

```
1. Upload do documento → Storage bucket 'knowledge-base'
2. Registro em knowledge_documents (status: pending)
3. Edge function process-document:
   a. Download do arquivo
   b. Extração de texto
   c. Chunking (500 tokens, 50 overlap)
   d. Geração de embeddings (1536 dimensões)
   e. Armazenamento em document_chunks
4. Atualização do status para 'processed'
```

### 10.2 Busca por Similaridade

```sql
-- Função de busca vetorial
SELECT 
  dc.content,
  1 - (dc.embedding <=> query_embedding) AS similarity
FROM document_chunks dc
INNER JOIN agent_documents ad ON dc.document_id = ad.document_id
WHERE ad.agent_id = 'uuid-do-agente'
ORDER BY dc.embedding <=> query_embedding
LIMIT 5;
```

---

## 11. CONFIGURAÇÃO DE STORAGE

### 11.1 Criar Bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', false);
```

### 11.2 Políticas de Storage

```sql
-- Apenas admins podem gerenciar
CREATE POLICY "Admins can manage knowledge-base"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'knowledge-base' AND
  is_admin(auth.uid())
);

-- Service role tem acesso total
CREATE POLICY "Service role full access"
ON storage.objects
FOR ALL
USING (bucket_id = 'knowledge-base');
```

---

## 12. SECRETS E VARIÁVEIS

### 12.1 Variáveis de Ambiente (Supabase)

```bash
# Automáticas
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DB_URL=postgresql://...

# Configurar manualmente
LOVABLE_API_KEY=xxx  # Automático se usando Lovable Cloud
```

### 12.2 Configurações em system_settings

```sql
INSERT INTO system_settings (key, value, is_secret, description) VALUES
  ('GOOGLE_API_KEY', 'AIza...', true, 'Google Gemini API'),
  ('OPENAI_API_KEY', 'sk-...', true, 'OpenAI API'),
  ('ANTHROPIC_API_KEY', 'sk-ant-...', true, 'Anthropic Claude API'),
  ('DEEPSEEK_API_KEY', 'sk-...', true, 'DeepSeek API');
```

---

## 13. CONFIG.TOML

```toml
# supabase/config.toml
project_id = "seu-project-id"

[api]
enabled = true
port = 54321
schemas = ["public", "storage"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
major_version = 15

[studio]
enabled = true
port = 54323

[auth]
enabled = true
site_url = "http://localhost:5173"
additional_redirect_urls = ["https://seu-dominio.com"]

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false

[functions.analyze-submission]
verify_jwt = true

[functions.universal-calculator]
verify_jwt = true

[functions.calculate-fmea]
verify_jwt = true

[functions.generate-narrative-report]
verify_jwt = true

[functions.generate-pdf]
verify_jwt = true

[functions.process-document]
verify_jwt = true

[functions.scheduled-tasks]
verify_jwt = false
```

---

## 14. VIEWS ÚTEIS

### 14.1 View de Controle de Participação

```sql
CREATE OR REPLACE VIEW public.participation_control AS
SELECT 
  s.id as submission_id,
  s.respondent_data->>'nome' as nome,
  s.respondent_data->>'cargo' as cargo,
  s.respondent_data->>'setor' as setor,
  f.title as form_title,
  f.type as form_type,
  s.status,
  s.created_at as submitted_at,
  r.id IS NOT NULL as has_report,
  r.is_approved
FROM submissions s
LEFT JOIN forms f ON s.form_id = f.id
LEFT JOIN reports r ON s.id = r.submission_id
WHERE NOT (s.respondent_data ? 'anonymized');
```

### 14.2 View de Relatórios Agregados

```sql
CREATE OR REPLACE VIEW public.aggregated_reports_by_role AS
SELECT 
  s.respondent_data->>'cargo' as cargo,
  s.respondent_data->>'setor' as setor,
  f.title as form_title,
  f.type as form_type,
  COUNT(*) as total_submissions,
  COUNT(r.id) FILTER (WHERE r.is_approved) as approved_reports,
  AVG((r.dimensions_score->>'global_score')::numeric) as avg_risk_score,
  MODE() WITHIN GROUP (ORDER BY r.risk_level) as most_common_risk_level,
  MIN(s.created_at) as first_submission,
  MAX(s.created_at) as last_submission
FROM submissions s
LEFT JOIN forms f ON s.form_id = f.id
LEFT JOIN reports r ON s.id = r.submission_id
WHERE NOT (s.respondent_data ? 'anonymized')
GROUP BY cargo, setor, f.title, f.type;
```

---

## RESUMO DE IMPLEMENTAÇÃO

| Componente | Quantidade |
|------------|------------|
| Tabelas | 20+ |
| Políticas RLS | 50+ |
| Funções PostgreSQL | 15+ |
| Triggers | 5+ |
| Edge Functions | 8 |
| Views | 3 |
| Enums | 4 |

---

*Documento gerado em: Dezembro 2024*
*Versão: 1.0*
*Sistema: HC Consultoria - Ergonomia & Fisioterapia*
