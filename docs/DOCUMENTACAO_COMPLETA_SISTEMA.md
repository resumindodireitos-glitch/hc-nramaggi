# HC Consultoria - Documentação Completa do Sistema

**Versão:** 3.2  
**Data:** Dezembro 2024  
**Projeto:** Sistema de Análise Ergonômica e Psicossocial

---

## ÍNDICE

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estrutura do Banco de Dados](#3-estrutura-do-banco-de-dados)
4. [Políticas RLS (Row Level Security)](#4-políticas-rls)
5. [Funções do Banco de Dados](#5-funções-do-banco-de-dados)
6. [Edge Functions](#6-edge-functions)
7. [Sistema de IA e Prompts](#7-sistema-de-ia-e-prompts)
8. [Páginas e Componentes](#8-páginas-e-componentes)
9. [Fluxos de Dados](#9-fluxos-de-dados)
10. [Sistema de Autenticação](#10-sistema-de-autenticação)
11. [Metodologias Implementadas](#11-metodologias-implementadas)
12. [LGPD e Compliance](#12-lgpd-e-compliance)

---

## 1. VISÃO GERAL

### 1.1 Propósito
Sistema web para análise ergonômica e psicossocial desenvolvido para HC Consultoria e Grupo Amaggi. Automatiza avaliações usando metodologias ERGOS (operacional) e HSE-IT (administrativo), com cálculos FMEA e geração de relatórios AET (Análise Ergonômica do Trabalho).

### 1.2 Funcionalidades Principais
- **Formulários Dinâmicos**: Criação e gestão de questionários ERGOS e HSE-IT
- **Análise por IA**: Processamento automático de respostas com Gemini/GPT
- **Cálculo FMEA**: NRE automático (Gravidade × Probabilidade × Detecção)
- **Relatórios AET**: Geração de documentos PDF/DOCX
- **Dashboard de Riscos**: Visão consolidada por cargo/setor
- **LGPD Compliance**: Anonimização, consentimento, direito ao esquecimento

### 1.3 Tipos de Usuário
| Role | Permissões |
|------|------------|
| `super_admin` | Acesso total, gestão de usuários, configurações do sistema |
| `admin_hc` | Gestão de formulários, relatórios, aprovações |
| `employee_amaggi` | Responder questionários, ver próprios relatórios |

---

## 2. STACK TECNOLÓGICO

### 2.1 Frontend
- **React 18** + **TypeScript**
- **Vite** (bundler)
- **TailwindCSS** + **shadcn/ui** (componentes)
- **TanStack Query** (gerenciamento de estado/cache)
- **Framer Motion** (animações)
- **Recharts** (gráficos)
- **React Router DOM** (rotas)

### 2.2 Backend (Lovable Cloud/Supabase)
- **PostgreSQL** (banco de dados)
- **Supabase Auth** (autenticação)
- **Edge Functions** (Deno runtime)
- **pgvector** (embeddings para RAG)
- **Storage** (bucket knowledge-base)

### 2.3 IA
- **Lovable AI Gateway** (google/gemini-2.5-flash padrão)
- **RAG** (Retrieval Augmented Generation)
- **Embeddings** via Lovable API

---

## 3. ESTRUTURA DO BANCO DE DADOS

### 3.1 Tabelas Principais

#### `profiles`
Perfis de usuários do sistema.
```sql
- id: uuid (PK, referencia auth.users)
- email: text (NOT NULL)
- full_name: text (NOT NULL)
- role: user_role ('admin_hc' | 'employee_amaggi')
- company: text (default 'Amaggi')
- department: text
- job_title: text
- created_at, updated_at: timestamp
```

#### `user_roles`
Roles separados para segurança (evita privilege escalation).
```sql
- id: uuid (PK)
- user_id: uuid (FK auth.users)
- role: app_role ('super_admin' | 'admin_hc' | 'employee_amaggi')
- created_at: timestamp
- UNIQUE(user_id, role)
```

#### `forms`
Definição dos formulários/questionários.
```sql
- id: uuid (PK)
- title: text (NOT NULL)
- description: text
- type: form_type ('ergos' | 'hse_it')
- schema: jsonb (estrutura das perguntas)
- calculation_rules: jsonb (regras de cálculo)
- risk_thresholds: jsonb (limiares de risco)
- is_active: boolean
- created_by: uuid (FK profiles)
- created_at, updated_at: timestamp
```

**Estrutura do schema (exemplo):**
```json
[
  {
    "id": "q1",
    "type": "likert",
    "question": "Texto da pergunta",
    "dimension": "pressao_tempo",
    "required": true,
    "options": [
      {"value": 0, "label": "Nunca"},
      {"value": 1, "label": "Raramente"},
      {"value": 2, "label": "Às vezes"},
      {"value": 3, "label": "Frequentemente"}
    ]
  }
]
```

#### `submissions`
Respostas dos questionários.
```sql
- id: uuid (PK)
- form_id: uuid (FK forms)
- respondent_data: jsonb (nome, cargo, setor, unidade)
- respondent_hash: text (hash LGPD)
- answers: jsonb (respostas)
- status: submission_status ('pending_ai' | 'processed' | 'approved')
- ip_hash: text
- employee_id: uuid (FK employees, opcional)
- data_retention_until: timestamp (default now() + 5 years)
- created_at: timestamp
```

**Estrutura de answers:**
```json
{
  "q1": 2,
  "q2": 3,
  "q3": 1
}
```

#### `reports`
Relatórios gerados pela IA.
```sql
- id: uuid (PK)
- submission_id: uuid (FK submissions, UNIQUE)
- dimensions_score: jsonb (scores por dimensão)
- risk_level: text ('baixo' | 'medio' | 'alto' | 'critico')
- ai_analysis_text: text (análise narrativa)
- ai_conclusion: text (conclusão)
- ai_recommendations: text[] (recomendações)
- final_text_override: text (edições manuais)
- is_approved: boolean
- reviewer_id: uuid (FK profiles)
- created_at, updated_at: timestamp
```

**Estrutura de dimensions_score:**
```json
{
  "global_score": 75,
  "risk_level": "medio",
  "risk_label": "Moderado",
  "dimensions": [
    {
      "name": "Pressão de Tempo",
      "key": "pressao_tempo",
      "score": 7,
      "normalized_score": 58,
      "max_score": 12,
      "status": "Aceitável",
      "color": "green"
    }
  ]
}
```

### 3.2 Tabelas Organizacionais

#### `farms`
Unidades/Fazendas da Amaggi.
```sql
- id: uuid (PK)
- name: text (NOT NULL)
- code: text
- location: text
- cnae: text (default '01.15-6-00')
- risk_degree: integer (default 3)
- manager_name: text
- is_active: boolean
- created_at, updated_at: timestamp
```

#### `departments`
Setores dentro das unidades.
```sql
- id: uuid (PK)
- name: text (NOT NULL)
- code: text
- farm_id: uuid (FK farms)
- manager_name: text
- description: text
- created_at, updated_at: timestamp
```

#### `job_roles`
Cargos/Funções.
```sql
- id: uuid (PK)
- name: text (NOT NULL)
- department_id: uuid (FK departments)
- cbo: text (código CBO)
- cbo_description: text
- description: text
- environment_desc: text
- risk_category: text
- created_at, updated_at: timestamp
```

#### `employees`
Funcionários.
```sql
- id: uuid (PK)
- name: text (NOT NULL)
- email: text
- registration_code: text (matrícula)
- farm_id: uuid (FK farms)
- job_role_id: uuid (FK job_roles)
- admission_date: date
- is_active: boolean
- created_at, updated_at: timestamp
```

### 3.3 Tabelas de IA/RAG

#### `ai_prompts`
Configuração dos agentes de IA.
```sql
- id: uuid (PK)
- name: text (NOT NULL)
- description: text
- form_type: text ('ergos' | 'hse_it' | 'all')
- agent_type: text ('analysis' | 'narrative' | 'recommendations')
- provider: text ('lovable' | 'openai' | 'anthropic' | 'google' | 'deepseek')
- model: text (default 'google/gemini-2.5-flash')
- system_prompt: text (NOT NULL)
- temperature: float (default 0.7)
- max_tokens: integer (default 4000)
- output_schema: jsonb
- use_rag: boolean
- rag_top_k: integer (default 5)
- is_active: boolean
- version: integer
- created_by: uuid
- created_at, updated_at: timestamp
```

#### `knowledge_documents`
Documentos da base de conhecimento.
```sql
- id: uuid (PK)
- name: text (NOT NULL)
- description: text
- file_path: text (NOT NULL)
- file_type: text (NOT NULL)
- file_size: integer
- status: text ('pending' | 'processing' | 'ready' | 'error')
- chunks_count: integer
- metadata: jsonb
- created_by: uuid
- created_at, updated_at: timestamp
```

#### `document_chunks`
Chunks vetorizados dos documentos.
```sql
- id: uuid (PK)
- document_id: uuid (FK knowledge_documents)
- content: text (NOT NULL)
- chunk_index: integer (NOT NULL)
- embedding: vector(1536)
- metadata: jsonb
- created_at: timestamp
```

#### `agent_documents`
Associação entre agentes e documentos (RAG).
```sql
- id: uuid (PK)
- agent_id: uuid (FK ai_prompts)
- document_id: uuid (FK knowledge_documents)
- created_at: timestamp
```

#### `ai_usage`
Registro de uso da IA (custos/tokens).
```sql
- id: uuid (PK)
- agent_id: uuid (FK ai_prompts)
- submission_id: uuid (FK submissions)
- user_id: uuid
- provider: text (NOT NULL)
- model: text (NOT NULL)
- input_tokens: integer
- output_tokens: integer
- total_tokens: integer
- cost_estimate: numeric
- created_at: timestamp
```

#### `ai_usage_limits`
Limites de uso da IA.
```sql
- id: uuid (PK)
- name: text (NOT NULL)
- daily_token_limit: integer
- monthly_token_limit: integer (default 1000000)
- is_active: boolean
- created_at, updated_at: timestamp
```

### 3.4 Tabelas FMEA/Riscos

#### `fmea_calculations`
Cálculos FMEA por relatório.
```sql
- id: uuid (PK)
- report_id: uuid (FK reports, UNIQUE)
- gravidade: integer (NOT NULL)
- probabilidade: integer (NOT NULL)
- capacidade_deteccao: integer (default 1)
- nre_score: integer (G × P × D)
- nre_classification: text ('Trivial' | 'Tolerável' | 'Moderado' | 'Substancial' | 'Intolerável')
- dimension_scores: jsonb
- requires_manual_review: boolean
- review_reason: text
- calculated_at, created_at: timestamp
```

#### `suggested_actions`
Planos de ação sugeridos.
```sql
- id: uuid (PK)
- report_id: uuid (FK reports)
- risk_detected: text (NOT NULL)
- action_title: text (NOT NULL)
- action_description: text
- dimension: text
- priority: text ('baixa' | 'media' | 'alta' | 'critica')
- status: text ('pendente' | 'em_andamento' | 'concluida')
- responsible: text
- due_date: date
- nre_score: integer
- nre_classification: text
- nr_referencia: text[]
- source_matrix: text
- created_at, updated_at: timestamp
```

#### `risk_matrix_ergos`
Matriz de riscos ERGOS.
```sql
- id: uuid (PK)
- dimension: text (NOT NULL)
- perigo: text (NOT NULL)
- fonte_geradora: text
- dano_potencial: text
- medida_controle_sugerida: text
- gravidade_padrao: integer (default 3)
- probabilidade_base: integer (default 3)
- nr_referencia: text[]
- observacoes: text
- is_active: boolean
- created_at, updated_at: timestamp
```

#### `risk_matrix_hseit`
Matriz de riscos HSE-IT.
```sql
- id: uuid (PK)
- dimension: text (NOT NULL)
- perigo: text (NOT NULL)
- fonte_geradora: text
- dano_potencial: text
- medida_controle_sugerida: text
- gravidade_padrao: integer (default 3)
- probabilidade_base: integer (default 3)
- benchmark_hse: numeric
- nr_referencia: text[]
- observacoes: text
- is_active: boolean
- created_at, updated_at: timestamp
```

#### `risk_matrix_biomecanicos`
Matriz de riscos biomecânicos.
```sql
- id: uuid (PK)
- segmento_corporal: text (NOT NULL)
- perigo: text (NOT NULL)
- fonte_geradora: text
- dano_potencial: text
- medida_controle_sugerida: text
- gravidade_padrao: integer (default 3)
- probabilidade_base: integer (default 3)
- cid_relacionado: text
- nr_referencia: text[]
- observacoes: text
- is_active: boolean
- created_at, updated_at: timestamp
```

#### `tanguro_risk_matrix`
Matriz consolidada Tanguro.
```sql
- id: uuid (PK)
- risk_factor: text (NOT NULL)
- dimension: text
- source: text
- severity_g: integer (default 3)
- probability_p: integer (default 3)
- detection_d: integer (default 3)
- suggested_action: text
- nr_referencia: text[]
- is_active: boolean
- created_at, updated_at: timestamp
```

### 3.5 Tabelas LGPD/Compliance

#### `consent_logs`
Registro imutável de consentimentos.
```sql
- id: uuid (PK)
- submission_id: uuid (FK submissions)
- consent_text: text (NOT NULL)
- term_version: text (default 'v1.0')
- accepted_at: timestamp (NOT NULL)
- ip_hash: text (NOT NULL)
- user_agent: text
- device_fingerprint: text
- created_at: timestamp
```

#### `audit_log`
Log de auditoria.
```sql
- id: uuid (PK)
- action: text (NOT NULL)
- table_name: text
- record_id: uuid
- user_id: uuid
- old_data: jsonb
- new_data: jsonb
- ip_address: text
- created_at: timestamp
```

### 3.6 Tabelas de Sistema

#### `system_settings`
Configurações do sistema.
```sql
- id: uuid (PK)
- key: text (NOT NULL, UNIQUE)
- value: text
- description: text
- is_secret: boolean
- created_at, updated_at: timestamp
```

#### `system_updates`
Registro de atualizações do sistema.
```sql
- id: uuid (PK)
- title: text (NOT NULL)
- description: text (NOT NULL)
- version: text
- type: text ('feature' | 'fix' | 'improvement')
- created_by: uuid
- created_at: timestamp
```

#### `notifications`
Notificações para usuários.
```sql
- id: uuid (PK)
- user_id: uuid
- title: text (NOT NULL)
- message: text (NOT NULL)
- type: text ('info' | 'warning' | 'error' | 'success')
- category: text (default 'system')
- link: text
- is_read: boolean
- created_at: timestamp
```

#### `webhook_configurations`
Configurações de webhooks externos.
```sql
- id: uuid (PK)
- name: text (NOT NULL)
- provider: text (NOT NULL)
- external_form_id: text (NOT NULL)
- internal_form_id: uuid (FK forms)
- field_mapping: jsonb
- secret_key: text
- is_active: boolean
- total_submissions: integer
- last_received_at: timestamp
- created_by: uuid
- created_at, updated_at: timestamp
```

#### `submission_tokens`
Tokens de segurança para submissões.
```sql
- id: uuid (PK)
- token: text (NOT NULL)
- form_id: uuid (FK forms)
- ip_hash: text
- used: boolean
- expires_at: timestamp (default now() + 24h)
- created_at: timestamp
```

#### `question_weights`
Pesos das opções de resposta.
```sql
- id: uuid (PK)
- form_id: uuid (FK forms)
- question_id: text (NOT NULL)
- option_text: text (NOT NULL)
- weight: integer (default 0)
- display_order: integer
- created_at: timestamp
```

#### `report_signatures`
Assinaturas digitais de relatórios.
```sql
- id: uuid (PK)
- report_id: uuid (FK reports)
- signer_name: text (NOT NULL)
- signer_role: text (NOT NULL)
- signer_credential: text
- signature_hash: text (NOT NULL)
- verification_code: text
- signed_at: timestamp
- ip_address: text
- user_agent: text
- is_verified: boolean
- created_at: timestamp
```

### 3.7 Views

#### `participation_control`
Controle de participação (visão agregada).
```sql
SELECT 
  s.id as submission_id,
  s.respondent_data->>'nome' as nome,
  s.respondent_data->>'cargo' as cargo,
  s.respondent_data->>'setor' as setor,
  f.title as form_title,
  f.type as form_type,
  s.status,
  s.created_at as submitted_at,
  EXISTS(SELECT 1 FROM reports r WHERE r.submission_id = s.id) as has_report,
  r.is_approved
FROM submissions s
LEFT JOIN forms f ON s.form_id = f.id
LEFT JOIN reports r ON s.id = r.submission_id
```

#### `aggregated_reports_by_role`
Relatórios agregados por cargo (LGPD compliant).
```sql
SELECT 
  s.respondent_data->>'cargo' as cargo,
  s.respondent_data->>'setor' as setor,
  f.title as form_title,
  f.type as form_type,
  COUNT(*) as total_submissions,
  COUNT(r.id) FILTER (WHERE r.is_approved) as approved_reports,
  AVG(CAST(r.dimensions_score->>'global_score' AS numeric)) as avg_risk_score,
  MODE() WITHIN GROUP (ORDER BY r.risk_level) as most_common_risk_level,
  MIN(s.created_at) as first_submission,
  MAX(s.created_at) as last_submission
FROM submissions s
LEFT JOIN forms f ON s.form_id = f.id
LEFT JOIN reports r ON s.id = r.submission_id
GROUP BY cargo, setor, f.title, f.type
```

#### `submissions_anonymized`
View anonimizada de submissões.
```sql
SELECT 
  id,
  form_id,
  NULL as respondent_data,  -- PII removido
  respondent_hash,
  answers,
  status,
  created_at
FROM submissions
```

---

## 4. POLÍTICAS RLS

### 4.1 Funções Auxiliares de Segurança

```sql
-- Verifica se é admin
CREATE FUNCTION is_admin(user_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin_hc'
  ) OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = is_admin.user_id AND role IN ('admin_hc', 'super_admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verifica se é super admin
CREATE FUNCTION is_super_admin(_user_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'super_admin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verifica role específico
CREATE FUNCTION has_role(_user_id uuid, _role app_role) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### 4.2 RLS por Tabela

#### `profiles`
```sql
-- Usuário vê próprio perfil
CREATE POLICY "auth_select_own_profile" ON profiles FOR SELECT 
  USING (auth.uid() = id);

-- Admin vê todos
CREATE POLICY "admin_select_all_profiles" ON profiles FOR SELECT 
  USING (is_admin(auth.uid()));

-- Usuário atualiza próprio (sem mudar role)
CREATE POLICY "auth_update_own_profile" ON profiles FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Admin atualiza (sem mudar role)
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE 
  USING (is_admin(auth.uid()))
  WITH CHECK (role = (SELECT role FROM profiles WHERE id = profiles.id));

-- Inserir próprio perfil
CREATE POLICY "auth_insert_own_profile" ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);
```

#### `submissions`
```sql
-- Qualquer um pode inserir (formulário público)
CREATE POLICY "anon_insert_only_submissions" ON submissions FOR INSERT 
  WITH CHECK (true);

-- Autenticado pode inserir
CREATE POLICY "auth_insert_submissions" ON submissions FOR INSERT 
  WITH CHECK (true);

-- Admin vê todas
CREATE POLICY "admin_select_all_submissions" ON submissions FOR SELECT 
  USING (is_admin(auth.uid()));

-- Usuário vê próprias (por user_id no respondent_data)
CREATE POLICY "user_select_own_submissions" ON submissions FOR SELECT 
  USING ((respondent_data->>'user_id') = auth.uid()::text);

-- Admin atualiza
CREATE POLICY "admin_update_submissions" ON submissions FOR UPDATE 
  USING (is_admin(auth.uid()));

-- NINGUÉM pode deletar (LGPD - apenas anonimizar)
```

#### `reports`
```sql
-- Admin vê todos
CREATE POLICY "Admins can view all reports" ON reports FOR SELECT 
  USING (is_admin(auth.uid()));

-- Usuário vê próprios
CREATE POLICY "Users can view their own reports" ON reports FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM submissions s 
    WHERE s.id = reports.submission_id 
    AND (s.respondent_data->>'user_id') = auth.uid()::text
  ));

-- Admin cria
CREATE POLICY "Admins can create reports" ON reports FOR INSERT 
  WITH CHECK (is_admin(auth.uid()));

-- Admin atualiza
CREATE POLICY "Admins can update reports" ON reports FOR UPDATE 
  USING (is_admin(auth.uid()));

-- NINGUÉM pode deletar
```

#### `forms`
```sql
-- Qualquer um vê formulários ativos
CREATE POLICY "Anyone can view active forms" ON forms FOR SELECT 
  USING (is_active = true);

-- Admin vê todos
CREATE POLICY "Admins can view all forms" ON forms FOR SELECT 
  USING (is_admin(auth.uid()));

-- Admin cria/atualiza/deleta
CREATE POLICY "Admins can create/update/delete forms" ON forms 
  FOR ALL USING (is_admin(auth.uid()));
```

#### `farms`, `departments`, `job_roles`
```sql
-- Qualquer um pode ver (dados organizacionais públicos)
CREATE POLICY "Anyone can view" FOR SELECT USING (true);

-- Admin gerencia
CREATE POLICY "Admins can manage" FOR ALL USING (is_admin(auth.uid()));
```

#### `employees`
```sql
-- Admin vê todos
CREATE POLICY "Admins can view all employees" ON employees FOR SELECT 
  USING (is_admin(auth.uid()));

-- Empregado vê próprios dados (por email)
CREATE POLICY "Employees can view their own data" ON employees FOR SELECT 
  USING (email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- Admin gerencia
CREATE POLICY "Admins can manage employees" FOR ALL USING (is_admin(auth.uid()));
```

#### `ai_prompts`, `ai_usage_limits`, `knowledge_documents`, `document_chunks`, `agent_documents`
```sql
-- Admin pode ver
CREATE POLICY "Admins can view" FOR SELECT USING (is_admin(auth.uid()));

-- Super admin gerencia
CREATE POLICY "Super admins can manage" FOR ALL USING (is_super_admin(auth.uid()));
```

#### `ai_usage`
```sql
-- Admin vê todos
CREATE POLICY "admin_select_all_ai_usage" FOR SELECT USING (is_admin(auth.uid()));

-- Usuário vê próprio uso
CREATE POLICY "user_select_own_ai_usage" FOR SELECT USING (user_id = auth.uid());

-- Autenticado insere
CREATE POLICY "auth_insert_ai_usage" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Service role insere (edge functions)
CREATE POLICY "service_insert_ai_usage" FOR INSERT WITH CHECK (true);
```

#### `consent_logs`
```sql
-- Qualquer um pode inserir (consentimento no formulário)
CREATE POLICY "Anyone can insert consent" FOR INSERT WITH CHECK (true);

-- Admin pode ver
CREATE POLICY "Admins can view consent logs" FOR SELECT USING (is_admin(auth.uid()));

-- NINGUÉM pode atualizar ou deletar (imutável por LGPD)
```

#### `audit_log`
```sql
-- Admin e super_admin podem ver
CREATE POLICY "admin_select_audit_logs" FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "super_admin_select_audit_logs" FOR SELECT USING (is_super_admin(auth.uid()));

-- Qualquer operação pode inserir (triggers/functions)
CREATE POLICY "auth_insert_audit_logs" FOR INSERT WITH CHECK (true);
CREATE POLICY "service_insert_audit_logs" FOR INSERT WITH CHECK (true);

-- NINGUÉM pode atualizar ou deletar
```

#### `system_settings`
```sql
-- Somente super_admin
CREATE POLICY "super_admin_all_settings" FOR ALL 
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
```

#### `fmea_calculations`, `suggested_actions`
```sql
-- Admin gerencia
CREATE POLICY "Admins can manage" FOR ALL USING (is_admin(auth.uid()));

-- Usuário vê próprias ações
CREATE POLICY "Users can view their actions" ON suggested_actions FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM reports r 
    JOIN submissions s ON r.submission_id = s.id 
    WHERE r.id = suggested_actions.report_id 
    AND (s.respondent_data->>'user_id') = auth.uid()::text
  ));
```

#### Matrizes de Risco (`risk_matrix_*`, `tanguro_risk_matrix`)
```sql
-- Qualquer um pode ver
CREATE POLICY "Anyone can view" FOR SELECT USING (true);

-- Super admin gerencia
CREATE POLICY "Super admin can manage" FOR ALL USING (is_super_admin(auth.uid()));
```

---

## 5. FUNÇÕES DO BANCO DE DADOS

### 5.1 Funções de Segurança

#### `get_user_role(user_id uuid)`
Retorna o role do usuário da tabela profiles.
```sql
SELECT role FROM profiles WHERE id = user_id LIMIT 1;
```

#### `has_role(_user_id uuid, _role app_role)`
Verifica se usuário tem determinado role.
```sql
SELECT EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
);
```

#### `is_admin(user_id uuid)`
Verifica se é admin (admin_hc ou super_admin).

#### `is_super_admin(_user_id uuid)`
Verifica se é super_admin.

### 5.2 Funções de Hash/LGPD

#### `generate_respondent_hash(respondent_data jsonb)`
Gera hash do respondente baseado em nome + setor + cargo.
```sql
RETURN encode(
  sha256((nome || setor || cargo)::bytea), 
  'hex'
);
```

#### `generate_respondent_hash_secure(respondent_data jsonb)`
Versão com salt para resistência a rainbow tables.
```sql
DECLARE salt text := 'HC_AMAGGI_SECURE_SALT_2024_LGPD_COMPLIANT';
RETURN encode(sha256((nome || setor || cargo || salt)::bytea), 'hex');
```

#### `mask_sensitive_data(data jsonb)`
Mascara dados sensíveis (nome, email) para acesso não-admin.
```sql
-- Nome: mostra só 3 primeiros chars + '***'
-- Email: substitui por '***@***.com'
```

### 5.3 Funções LGPD

#### `anonymize_submission(target_submission_id uuid)`
Anonimiza uma submissão específica.
- Somente super_admin pode executar
- Substitui respondent_data por objeto {anonymized: true, ...}
- Remove ip_hash
- Mantém answers para estatísticas
- Registra em audit_log

#### `anonymize_by_identifier(target_identifier text)`
Anonimiza todas as submissões que correspondem ao identificador (nome ou email).
- Busca por ILIKE
- Chama anonymize_submission para cada match

#### `anonymize_expired_submissions()`
Anonimiza submissões com data_retention_until expirada.
- Execução automática (scheduled)

#### `cleanup_old_pii()`
Limpeza automática de PII após período de retenção.

#### `export_user_data(target_identifier text)`
Exporta todos os dados de um usuário (portabilidade LGPD).
- Retorna JSON com submissions e reports
- Registra em audit_log

#### `get_individual_responses_by_role(target_cargo, target_setor)`
Acesso privilegiado a respostas individuais (somente super_admin).
- Registra acesso em audit_log

### 5.4 Funções de Assinatura Digital

#### `generate_signature_hash(report_uuid, signer_name, signed_timestamp)`
Gera hash de assinatura baseado no conteúdo do relatório + assinante + timestamp.

#### `sign_report(report_uuid, p_signer_name, p_signer_role, ...)`
Assina digitalmente um relatório.
- Gera verification_code (8 chars alfanumérico)
- Armazena em report_signatures
- Registra em audit_log

#### `verify_signature(verification_code_input)`
Verifica autenticidade de uma assinatura.

### 5.5 Funções de Cálculo

#### `get_nre_classification(nre integer)`
Retorna classificação textual do NRE:
- ≤50: Trivial
- 51-100: Tolerável
- 101-200: Moderado
- 201-400: Substancial
- >400: Intolerável

**Nota:** A classificação foi atualizada para usar escala 1-27:
- 1: Trivial
- 2-3: Tolerável
- 4-9: Moderado
- 12-18: Substancial
- 27: Intolerável

### 5.6 Funções de Busca (RAG)

#### `search_similar_chunks(query_embedding vector, agent_uuid uuid, match_count int)`
Busca chunks similares usando embeddings.
```sql
SELECT dc.id, dc.document_id, dc.content,
       1 - (dc.embedding <=> query_embedding) AS similarity
FROM document_chunks dc
INNER JOIN agent_documents ad ON dc.document_id = ad.document_id
WHERE ad.agent_id = agent_uuid
ORDER BY dc.embedding <=> query_embedding
LIMIT match_count;
```

### 5.7 Funções de Acesso

#### `get_submission_full_data(submission_uuid uuid)`
Retorna dados completos de uma submissão (somente admin).
- Inclui respondent_data completo

### 5.8 Triggers

#### `handle_new_user()`
Trigger para criação automática de perfil e role após signup.
```sql
-- Executado em auth.users AFTER INSERT
-- Cria registro em profiles
-- Cria registro em user_roles
```

#### `handle_submission_hash()`
Trigger para gerar respondent_hash automaticamente.
```sql
-- Executado em submissions BEFORE INSERT
NEW.respondent_hash := generate_respondent_hash_secure(NEW.respondent_data);
```

#### `handle_updated_at()`
Trigger genérico para atualizar updated_at.

#### `check_submission_rate_limit()`
Trigger para rate limiting (5 submissões por 10 minutos por IP).

#### `validate_submission_json()`
Trigger para validação de JSON (previne XSS e JSON bomb).

#### `log_sensitive_data_access()`
Trigger para auditoria de acesso a dados sensíveis.

---

## 6. EDGE FUNCTIONS

### 6.1 `analyze-submission`
**Propósito:** Processa submissão e gera relatório via IA.

**Fluxo:**
1. Recebe `submissionId`
2. Busca submission e form
3. Identifica agente ativo (ai_prompts) para o form_type
4. Se RAG habilitado, busca contexto similar
5. Monta prompt com dados da submissão
6. Chama provider de IA (Lovable/OpenAI/Anthropic/Google/DeepSeek)
7. Parsea resposta JSON
8. Cria/atualiza report
9. Atualiza status da submission
10. Registra uso em ai_usage

**Providers suportados:**
- `lovable`: Lovable AI Gateway (padrão)
- `openai`: OpenAI API
- `anthropic`: Anthropic API
- `google`: Google Gemini
- `deepseek`: DeepSeek API

**Fallback:**
Se IA falhar, usa `calculateUniversalScore()` para gerar análise determinística.

### 6.2 `universal-calculator`
**Propósito:** Calcula scores de forma determinística (sem IA).

**Métodos de cálculo suportados:**
- `sum_with_coefficient`: ERGOS (0.83 × soma por dimensão)
- `average_by_dimension`: HSE-IT (média percentual)
- `weighted_sum`: NASA-TLX (soma ponderada)

**Lógica ERGOS:**
```javascript
// Agrupa respostas por dimensão
// Soma scores por dimensão (max 12 por dimensão)
// Score global = soma de todas dimensões
// Multiplicador: 0.83

// Classificação:
// score < 4: Aceitável (verde)
// score >= 4 && < 7: Atenção (amarelo)
// score >= 7: Risco (vermelho)

// Fator de risco identificado se score >= 6 (metade de 12)
```

**Lógica HSE-IT:**
```javascript
// 7 dimensões: demandas, controle, apoio_gestor, apoio_colegas, 
//              relacionamentos, funcao, mudancas

// Calcula média por dimensão
// Converte para % de estresse: 100 - (média × 20)

// % >= 50: Fator de estresse identificado
// % < 50: Sem estresse identificado

// Gera texto interpretativo automático
```

**Output padronizado:**
```json
{
  "global_score": 75,
  "risk_level": "medio",
  "risk_label": "Moderado",
  "risk_color": "yellow",
  "dimensions": [
    {
      "name": "Pressão de Tempo",
      "key": "pressao_tempo",
      "score": 7,
      "normalized_score": 58,
      "max_score": 12,
      "status": "Atenção",
      "color": "yellow"
    }
  ],
  "interpretation": "Texto interpretativo...",
  "methodology": "ERGOS",
  "calculated_at": "2024-12-04T..."
}
```

### 6.3 `calculate-fmea`
**Propósito:** Calcula FMEA automático baseado nos scores.

**Fórmula:**
```
NRE = Gravidade × Probabilidade × Detecção
```

**Classificação NRE (escala Tanguro):**
| NRE | Classificação |
|-----|---------------|
| 1 | Trivial |
| 2-3 | Tolerável |
| 4-9 | Moderado |
| 12-18 | Substancial |
| 27 | Intolerável |

**Fluxo:**
1. Recebe `submissionId` ou `reportId`
2. Busca scores das dimensões
3. Consulta matrizes de risco (risk_matrix_ergos/hseit)
4. Identifica riscos por dimensão crítica
5. Calcula G, P, D baseado nos thresholds
6. Gera NRE e classificação
7. Cria suggested_actions
8. Armazena em fmea_calculations

**Cross-validation:**
- Verifica se há outras metodologias aplicadas ao mesmo cargo
- Compara resultados entre ERGOS e HSE-IT
- Flag `requires_manual_review` se variância > 30%

### 6.4 `generate-pdf`
**Propósito:** Gera relatório AET em HTML (para conversão PDF).

**Conteúdo:**
- Cabeçalho com logos HC/Amaggi
- Dados do avaliado (cargo, setor, unidade)
- Tabela de scores por dimensão
- Inventário de riscos (formato tabular)
- Cálculo FMEA
- Recomendações
- Conclusão
- Assinatura digital (se houver)

### 6.5 `generate-docx`
**Propósito:** Gera relatório em formato DOCX.

**Estrutura:**
- WordprocessingML XML
- Formatação compatível com Word
- Retorna Base64 encoded

### 6.6 `generate-narrative-report`
**Propósito:** Gera seções narrativas via IA.

**Seções:**
- `narrative`: Análise descritiva
- `conclusion`: Conclusão técnica
- `recommendations`: Recomendações

**Fluxo:**
1. Busca report e FMEA
2. Monta prompt com contexto
3. Chama IA para gerar texto
4. Atualiza campos no report

### 6.7 `generate-zip`
**Propósito:** Gera ZIP com múltiplos PDFs.

**Uso:** Geração em lote de relatórios.

### 6.8 `process-document`
**Propósito:** Processa documento para base de conhecimento (RAG).

**Fluxo:**
1. Recebe `documentId`
2. Baixa arquivo do Storage
3. Extrai texto (PDF, DOCX, etc)
4. Divide em chunks
5. Gera embeddings via Lovable API
6. Armazena em document_chunks
7. Atualiza status do documento

### 6.9 `recalculate-reports`
**Propósito:** Recalcula scores de relatórios existentes.

**Uso:** Após alteração nas regras de cálculo.

### 6.10 `seed-admin`
**Propósito:** Cria usuário admin inicial.

### 6.11 `update-password`
**Propósito:** Atualiza senha de usuário.

### 6.12 `scheduled-tasks`
**Propósito:** Tarefas agendadas (cron).

**Tarefas:**
- Anonimização de dados expirados
- Limpeza de tokens expirados
- Verificação de limites de uso IA

### 6.13 `webhook-google-forms`
**Propósito:** Recebe submissões do Google Forms.

**Fluxo:**
1. Valida secret_key
2. Mapeia campos conforme field_mapping
3. Cria submission
4. Dispara analyze-submission

### 6.14 `webhook-microsoft-forms`
**Propósito:** Recebe submissões do Microsoft Forms.

---

## 7. SISTEMA DE IA E PROMPTS

### 7.1 Arquitetura

```
Submissão → Edge Function → Seleção de Agente → RAG (opcional) → 
→ Provider IA → Parse Response → Report
```

### 7.2 Prompts Padrão

#### Master Prompt (Fallback)
```
Você é um Ergonomista Sênior especializado em análise de fatores 
psicossociais e cognitivos no trabalho. Analise os dados do questionário 
e gere uma análise técnica seguindo as metodologias ERGOS ou HSE-IT.

REGRAS:
1. Responda APENAS em JSON válido
2. Use terminologia técnica da NR-17 e ISO 45003
3. Baseie conclusões nos scores das dimensões
4. Sugira ações práticas e mensuráveis

OUTPUT ESPERADO:
{
  "risk_level": "baixo|medio|alto|critico",
  "dimensions_score": {...},
  "analysis": "texto da análise",
  "conclusion": "conclusão técnica",
  "recommendations": ["rec1", "rec2", ...]
}
```

#### Prompt ERGOS
```
Você está analisando um questionário ERGOS (Escala de Risco de 
Sobrecarga Mental) aplicado a trabalhadores operacionais.

DIMENSÕES ERGOS:
- pressao_tempo: Pressão de tempo e ritmo
- monotonia: Monotonia e repetitividade
- controle: Controle sobre o trabalho
- conflito: Conflito de papéis
- demanda_cognitiva: Demanda cognitiva
- apoio_social: Apoio social

ESCALA: 0-3 por questão, máximo 12 por dimensão
LIMIAR CRÍTICO: Score ≥ 6 indica fator de risco

CLASSIFICAÇÃO FINAL:
- Score global 0-20: Baixo risco
- Score global 21-40: Médio risco
- Score global 41-60: Alto risco
- Score global >60: Risco crítico
```

#### Prompt HSE-IT
```
Você está analisando um questionário HSE-IT (Health and Safety 
Executive Indicator Tool) para trabalhadores administrativos.

DIMENSÕES HSE-IT:
- demandas: Demandas de trabalho
- controle: Controle sobre o trabalho
- apoio_gestor: Apoio do gestor
- apoio_colegas: Apoio dos colegas
- relacionamentos: Relacionamentos interpessoais
- funcao: Clareza de função
- mudancas: Gestão de mudanças

ESCALA: 1-5 Likert reverso (1=sempre, 5=nunca)
BENCHMARK HSE: Média ≥ 3.5 indica baixo risco

CÁLCULO: % de estresse = 100 - (média × 20)
LIMIAR: % ≥ 50 indica fator de estresse
```

### 7.3 RAG (Retrieval Augmented Generation)

**Documentos base:**
- AET_Modelo_Amaggi_Comodoro.docx
- Dissertacao_HSE_IT.pdf
- NASA_TLX_Referencias.pdf
- Matriz_Perigo_Risco_Dano_PGR.xlsx
- etc.

**Fluxo RAG:**
1. Gera embedding da query (texto da submissão)
2. Busca chunks similares via `search_similar_chunks()`
3. Concatena contexto relevante ao prompt
4. Envia para IA com contexto enriquecido

### 7.4 Providers de IA

| Provider | Modelos | Uso |
|----------|---------|-----|
| Lovable | google/gemini-2.5-flash (padrão), gpt-5 | Análise principal |
| OpenAI | gpt-4o, gpt-4-turbo | Fallback |
| Anthropic | claude-3-opus, claude-3-sonnet | Alternativo |
| Google | gemini-pro | Alternativo |
| DeepSeek | deepseek-chat | Alternativo |

### 7.5 Configuração de Agentes

Tabela `ai_prompts`:
```sql
INSERT INTO ai_prompts (
  name, form_type, agent_type, provider, model,
  system_prompt, temperature, max_tokens,
  use_rag, rag_top_k, is_active
) VALUES (
  'ERGOS Analyzer',
  'ergos',
  'analysis',
  'lovable',
  'google/gemini-2.5-flash',
  '..prompt text..',
  0.7,
  4000,
  true,
  5,
  true
);
```

---

## 8. PÁGINAS E COMPONENTES

### 8.1 Páginas Principais

| Rota | Página | Descrição | Acesso |
|------|--------|-----------|--------|
| `/` | Index | Landing page | Público |
| `/login` | Login | Autenticação | Público |
| `/dashboard` | Dashboard | Visão geral | Autenticado |
| `/forms` | Forms | Lista formulários | Autenticado |
| `/forms/:id` | FormSubmit | Responder formulário | Autenticado |
| `/public/form/:id` | PublicFormSubmit | Formulário público | Público |
| `/submissions` | Submissions | Lista submissões | Admin |
| `/submissions/:id` | SubmissionsManagement | Detalhe submissão | Admin |
| `/reports` | Reports | Lista relatórios | Admin |
| `/reports/:id` | ReportDetail | Detalhe relatório | Admin |
| `/reports/:id/review` | ReviewReport | Revisar/aprovar | Admin |
| `/aggregated-reports` | AggregatedReports | Relatórios agregados | Admin |
| `/risk-matrix` | RiskMatrixDashboard | Dashboard de riscos | Admin |
| `/bulk-generation` | BulkGeneration | Geração em lote | Admin |
| `/organization` | OrganizationManagement | Gestão organizacional | Admin |
| `/profile` | Profile | Perfil do usuário | Autenticado |

### 8.2 Páginas Administrativas

| Rota | Página | Descrição |
|------|--------|-----------|
| `/admin/forms` | AdminForms | Gestão de formulários |
| `/admin/form-builder` | FormBuilder | Construtor de formulários |
| `/admin/form-builder/:id` | FormBuilder | Editar formulário |
| `/admin/form-calculation/:id` | FormCalculationConfig | Config. cálculos |
| `/admin/users` | UserManagement | Gestão de usuários |
| `/admin/settings` | AdminSettings | Configurações |
| `/admin/ai-prompts` | AIPromptsManagement | Gestão de prompts |
| `/admin/ai-agents` | AIAgents | Gestão de agentes IA |
| `/admin/ai-usage` | AIUsagePanel | Uso de IA |
| `/admin/webhooks` | WebhookConfiguration | Webhooks |
| `/admin/lgpd` | LGPDManagement | Gestão LGPD |
| `/admin/logs` | SystemLogs | Logs do sistema |
| `/admin/cron-jobs` | CronJobsDashboard | Tarefas agendadas |
| `/admin/updates` | SystemUpdates | Atualizações |

### 8.3 Componentes Principais

#### Layout
- `AppLayout`: Layout principal com sidebar
- `AppHeader`: Cabeçalho com navegação
- `AnimatedSidebar`: Sidebar animada

#### Formulários
- `FormPreview`: Preview de formulário
- `QuestionEditor`: Editor de perguntas
- `RespondentDataForm`: Dados do respondente

#### Relatórios
- `TanguroReportTemplate`: Template AET completo
- `AETReportPreview`: Preview do relatório
- `DimensionScoreChart`: Gráfico de dimensões
- `UniversalScoreChart`: Gráfico universal
- `BiopsychosocialProfile`: Perfil biopsicossocial
- `DigitalSignature`: Assinatura digital

#### LGPD
- `ConsentModal`: Modal de consentimento

#### Organização
- `HierarchyView`: Visualização hierárquica

#### Admin
- `CSVImporter`: Importador CSV

### 8.4 Hooks Principais

- `useAuth`: Autenticação e sessão
- `useToast`: Notificações toast
- `useMobile`: Detecção mobile

### 8.5 Contextos

- `AuthContext`: Estado de autenticação global

---

## 9. FLUXOS DE DADOS

### 9.1 Fluxo de Submissão

```
[Usuário] → [Formulário] → [Validação] → [Consentimento LGPD]
    ↓
[submission criada] → [Trigger: hash + rate limit]
    ↓
[status: pending_ai] → [Edge: analyze-submission]
    ↓
[IA processa] → [Report criado] → [status: processed]
    ↓
[Admin revisa] → [Aprova] → [status: approved]
    ↓
[Gera PDF/DOCX] → [Assinatura digital]
```

### 9.2 Fluxo de Análise IA

```
[analyze-submission recebe submissionId]
    ↓
[Busca submission + form]
    ↓
[Identifica agente ativo para form_type]
    ↓
[use_rag = true?] → [Sim] → [Gera embedding] → [Busca chunks similares]
    ↓                           ↓
[Monta prompt] ←----------------┘
    ↓
[Chama provider (Lovable/OpenAI/etc)]
    ↓
[Parsea JSON response]
    ↓
[Fallback se erro] → [universal-calculator]
    ↓
[Cria/atualiza report]
    ↓
[Registra ai_usage]
```

### 9.3 Fluxo FMEA

```
[Report criado/atualizado]
    ↓
[calculate-fmea chamado]
    ↓
[Extrai dimension_scores]
    ↓
[Para cada dimensão crítica (score >= limiar)]:
    - Busca risk_matrix correspondente
    - Extrai G, P, D base
    - Ajusta baseado no score
    ↓
[Calcula NRE = G × P × D]
    ↓
[Classifica: Trivial → Intolerável]
    ↓
[Cria suggested_actions]
    ↓
[Verifica cross-validation]
    ↓
[Armazena fmea_calculations]
```

### 9.4 Fluxo de Geração de Relatório

```
[Admin clica "Gerar PDF"]
    ↓
[generate-pdf chamado]
    ↓
[Busca report + submission + form + fmea]
    ↓
[Monta HTML com template Tanguro]
    ↓
[Retorna Base64]
    ↓
[Frontend converte/baixa]
```

---

## 10. SISTEMA DE AUTENTICAÇÃO

### 10.1 Fluxo de Signup

```
[Usuário preenche formulário]
    ↓
[supabase.auth.signUp()]
    ↓
[Trigger: handle_new_user()]
    ↓
[Cria profile + user_role]
    ↓
[Auto-confirm email (desenvolvimento)]
    ↓
[Sessão ativa]
```

### 10.2 Fluxo de Login

```
[Usuário entra credenciais]
    ↓
[supabase.auth.signInWithPassword()]
    ↓
[JWT gerado]
    ↓
[Session armazenada]
    ↓
[Busca profile + roles]
    ↓
[Redireciona para dashboard]
```

### 10.3 Verificação de Permissões

```typescript
// useAuth hook
const { user, profile, isAdmin, isSuperAdmin } = useAuth();

// Verificação em componente
if (!isAdmin) {
  return <Navigate to="/dashboard" />;
}

// RLS no banco
USING (is_admin(auth.uid()))
```

### 10.4 Protected Routes

```typescript
// ProtectedRoute component
<Route element={<ProtectedRoute requireAdmin />}>
  <Route path="/admin/*" element={<AdminLayout />} />
</Route>
```

---

## 11. METODOLOGIAS IMPLEMENTADAS

### 11.1 ERGOS (Escala de Risco de Sobrecarga Mental)

**Público:** Trabalhadores operacionais

**Dimensões (6):**
| Dimensão | Código | Questões | Max Score |
|----------|--------|----------|-----------|
| Pressão de Tempo | pressao_tempo | 4 | 12 |
| Monotonia | monotonia | 4 | 12 |
| Controle | controle | 4 | 12 |
| Conflito de Papéis | conflito | 4 | 12 |
| Demanda Cognitiva | demanda_cognitiva | 4 | 12 |
| Apoio Social | apoio_social | 4 | 12 |

**Escala de resposta:** 0-3 (Nunca, Raramente, Às vezes, Frequentemente)

**Cálculo:**
```javascript
// Por dimensão
dimensionScore = sum(questoes_da_dimensao)
normalizedScore = (dimensionScore / 12) * 100

// Global
globalScore = sum(todas_dimensoes) * 0.83

// Classificação por dimensão
< 4: Aceitável (verde)
4-6: Atenção (amarelo)
>= 7: Risco (vermelho)

// Fator de risco identificado se score >= 6
```

### 11.2 HSE-IT (Health and Safety Executive Indicator Tool)

**Público:** Trabalhadores administrativos

**Dimensões (7):**
| Dimensão | Código | Questões |
|----------|--------|----------|
| Demandas | demandas | 8 |
| Controle | controle | 6 |
| Apoio do Gestor | apoio_gestor | 5 |
| Apoio dos Colegas | apoio_colegas | 4 |
| Relacionamentos | relacionamentos | 4 |
| Função | funcao | 5 |
| Mudanças | mudancas | 3 |

**Escala Likert:** 1-5 (Sempre, Frequentemente, Às vezes, Raramente, Nunca)

**Cálculo:**
```javascript
// Por dimensão (escala reversa)
media = sum(respostas) / num_questoes
percentualEstresse = 100 - (media * 20)

// Interpretação
percentualEstresse >= 50: Fator de estresse identificado
percentualEstresse < 50: Sem estresse significativo

// Benchmark HSE
media >= 3.5: Condição favorável
```

### 11.3 NASA-TLX (Task Load Index)

**Uso:** Complementar para carga de trabalho

**Dimensões (6):**
- Demanda Mental
- Demanda Física
- Demanda Temporal
- Performance
- Esforço
- Frustração

**Escala:** 0-100 com pesos

### 11.4 FMEA Psicossocial

**Fórmula:**
```
NRE = G × P × D

G = Gravidade (1-3)
P = Probabilidade (1-3)
D = Detecção (1-3)
```

**Classificação NRE (Tanguro):**
| NRE | Classificação | Cor | Ação |
|-----|---------------|-----|------|
| 1 | Trivial | Verde | Manter controles |
| 2-3 | Tolerável | Verde claro | Monitorar |
| 4-9 | Moderado | Amarelo | Plano de ação |
| 12-18 | Substancial | Laranja | Ação prioritária |
| 27 | Intolerável | Vermelho | Ação imediata |

---

## 12. LGPD E COMPLIANCE

### 12.1 Medidas Implementadas

#### Consentimento
- Modal bloqueante antes de submissão
- Registro imutável em `consent_logs`
- Versionamento de termos
- Hash de IP (não armazena IP real)

#### Minimização de Dados
- Coleta apenas dados necessários
- Hash de identificação (não nome real em relatórios agregados)
- Views anonimizadas

#### Direito ao Esquecimento
- Função `anonymize_submission()`
- Função `anonymize_by_identifier()`
- Mantém dados estatísticos sem PII

#### Portabilidade
- Função `export_user_data()`
- Exporta JSON com todos os dados do titular

#### Retenção de Dados
- `data_retention_until` = 5 anos por padrão
- Anonimização automática após expiração
- Job agendado `cleanup_old_pii()`

#### Auditoria
- Tabela `audit_log` registra:
  - Acessos a dados sensíveis
  - Anonimizações
  - Exportações
  - Assinaturas

#### Segurança
- RLS em todas as tabelas
- Hash com salt para identificadores
- Rate limiting por IP
- Validação de JSON (anti-XSS)
- Mascaramento de dados sensíveis

### 12.2 Funções LGPD

| Função | Artigo LGPD | Descrição |
|--------|-------------|-----------|
| `anonymize_submission` | Art. 18 | Direito ao esquecimento |
| `export_user_data` | Art. 18 | Portabilidade |
| `mask_sensitive_data` | Art. 6 | Minimização |
| `cleanup_old_pii` | Art. 16 | Retenção |
| `consent_logs` | Art. 8 | Consentimento |
| `audit_log` | Art. 37 | Registro de operações |

---

## APÊNDICE A: VARIÁVEIS DE AMBIENTE

```env
# Supabase (auto-configurado)
VITE_SUPABASE_URL=https://svbqnwchxrvydtxmnnsd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_SUPABASE_PROJECT_ID=svbqnwchxrvydtxmnnsd

# Edge Functions (secrets)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
LOVABLE_API_KEY=... (auto-provisionado)
```

---

## APÊNDICE B: ESTRUTURA DE PASTAS

```
src/
├── components/
│   ├── admin/          # Componentes administrativos
│   ├── forms/          # Componentes de formulário
│   ├── layout/         # Layout (header, sidebar)
│   ├── lgpd/           # Componentes LGPD
│   ├── organization/   # Componentes organizacionais
│   ├── reports/        # Componentes de relatório
│   └── ui/             # Componentes base (shadcn)
├── contexts/           # Context providers
├── hooks/              # Custom hooks
├── integrations/       # Integrações (Supabase)
├── lib/                # Utilitários
├── pages/              # Páginas da aplicação
└── __tests__/          # Testes

supabase/
├── functions/          # Edge functions
│   ├── analyze-submission/
│   ├── calculate-fmea/
│   ├── generate-pdf/
│   ├── generate-docx/
│   ├── generate-narrative-report/
│   ├── generate-zip/
│   ├── process-document/
│   ├── recalculate-reports/
│   ├── scheduled-tasks/
│   ├── seed-admin/
│   ├── universal-calculator/
│   ├── update-password/
│   ├── webhook-google-forms/
│   └── webhook-microsoft-forms/
├── migrations/         # Migrações SQL
└── config.toml         # Configuração

docs/
├── DOCUMENTACAO_COMPLETA_SISTEMA.md  # Este arquivo
├── BLUEPRINT.md
├── SYSTEM_ARCHITECTURE_REPORT.md
├── AI_PROMPTS.md
└── AET_TANGURO_TEMPLATE.md

public/
└── knowledge-docs/     # Documentos base de conhecimento
```

---

## APÊNDICE C: COMANDOS ÚTEIS

```bash
# Desenvolvimento local
npm run dev

# Build
npm run build

# Testes
npm run test

# Deploy edge functions (automático no Lovable)
# As funções são deployadas automaticamente
```

---

**Documento gerado em:** Dezembro 2024  
**Versão do Sistema:** 3.2  
**Mantido por:** HC Consultoria / Lovable AI
