# RELATÓRIO DE ARQUITETURA DO SISTEMA
## HC Consultoria - Sistema de Análise Ergonômica e Psicossocial
**Data:** 03/12/2025 | **Versão:** 2.0

---

## 1. VISÃO GERAL DO SISTEMA

### 1.1 Propósito
Sistema web para aplicação de metodologias de análise ergonômica e psicossocial (HSE-IT e ERGOS) para monitoramento de saúde mental e riscos ocupacionais dos colaboradores da Amaggi.

### 1.2 Stack Tecnológico
| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS |
| UI Components | Shadcn/ui, Framer Motion |
| Gráficos | Recharts |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| IA | Lovable AI (Gemini, GPT-5) |
| Vector DB | pgvector (embeddings) |

---

## 2. ARQUITETURA DE BANCO DE DADOS

### 2.1 Schema Padronizado

#### Tabelas Principais

```sql
-- TABELA: submissions (Respostas dos Formulários)
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) NOT NULL,
  employee_id UUID REFERENCES employees(id),
  answers JSONB NOT NULL DEFAULT '{}',
  respondent_data JSONB NOT NULL DEFAULT '{}',
  status submission_status DEFAULT 'pending_ai',
  respondent_hash TEXT,  -- Hash SHA256 para auditoria anônima
  ip_hash TEXT,          -- Hash do IP para rate limiting
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CAMPOS PADRONIZADOS DE respondent_data:
{
  "nome": "Nome Completo",
  "empresa": "Amaggi",
  "setor": "Nome do Departamento",
  "cargo": "Nome do Cargo",
  "genero": "Masculino|Feminino|Outro|Prefiro não dizer",
  "tempo_empresa": "0-6 meses|6m-1a|1-2a|2-5a|5-7a|7-10a|10-15a|15+a",
  "data_avaliacao": "YYYY-MM-DD",
  "submitted_at": "ISO8601 timestamp"
}
```

```sql
-- TABELA: reports (Relatórios de Análise)
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) UNIQUE NOT NULL,
  ai_analysis_text TEXT,
  ai_conclusion TEXT,
  ai_recommendations TEXT[],
  dimensions_score JSONB DEFAULT '{}',
  risk_level TEXT,
  is_approved BOOLEAN DEFAULT false,
  reviewer_id UUID REFERENCES profiles(id),
  final_text_override TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ESTRUTURA DE dimensions_score:
{
  "Demanda Mental": {"score": 75, "risk_color": "yellow"},
  "Demanda Física": {"score": 45, "risk_color": "green"},
  ...
}
```

```sql
-- TABELA: forms (Formulários)
CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type form_type NOT NULL DEFAULT 'ergos',  -- 'hse_it' | 'ergos'
  schema JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ESTRUTURA DO SCHEMA DE QUESTÕES:
[
  {
    "id": "q1",
    "label": "Texto da pergunta",
    "description": "Descrição opcional",
    "type": "radio|checkbox|slider|scale|text|textarea|select|info",
    "options": ["Opção 1", "Opção 2"],
    "required": true,
    "min": 0,
    "max": 100
  }
]
```

#### Tabelas Organizacionais

```sql
-- Hierarquia: Farms → Departments → Job Roles → Employees

CREATE TABLE farms (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  location TEXT,
  manager_name TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE departments (
  id UUID PRIMARY KEY,
  farm_id UUID REFERENCES farms(id),
  name TEXT NOT NULL,
  code TEXT,
  manager_name TEXT
);

CREATE TABLE job_roles (
  id UUID PRIMARY KEY,
  department_id UUID REFERENCES departments(id),
  name TEXT NOT NULL,
  cbo TEXT,           -- Código Brasileiro de Ocupações
  risk_category TEXT  -- Categoria de risco NR
);

CREATE TABLE employees (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  registration_code TEXT,
  farm_id UUID REFERENCES farms(id),
  job_role_id UUID REFERENCES job_roles(id),
  admission_date DATE,
  is_active BOOLEAN DEFAULT true
);
```

#### Tabelas de IA e RAG

```sql
-- Agentes de IA
CREATE TABLE ai_prompts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  form_type TEXT NOT NULL,
  provider TEXT DEFAULT 'lovable',  -- 'lovable' | 'openai' | 'anthropic'
  model TEXT DEFAULT 'google/gemini-2.5-flash',
  system_prompt TEXT NOT NULL,
  temperature FLOAT DEFAULT 0.7,
  max_tokens INT DEFAULT 4000,
  use_rag BOOLEAN DEFAULT false,
  rag_top_k INT DEFAULT 5,
  is_active BOOLEAN DEFAULT false,
  output_schema JSONB
);

-- Documentos da Base de Conhecimento
CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INT,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'processing' | 'ready' | 'error'
  chunks_count INT DEFAULT 0
);

-- Chunks com Embeddings (Vector)
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES knowledge_documents(id),
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- pgvector
  metadata JSONB
);

-- Uso de IA (Custos)
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES ai_prompts(id),
  submission_id UUID REFERENCES submissions(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  total_tokens INT,
  cost_estimate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. SEGURANÇA E RLS

### 3.1 Políticas de Row Level Security

```sql
-- SUBMISSIONS: Anônimo pode criar, só admin vê
CREATE POLICY "Anyone can create submissions" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view all submissions" ON submissions FOR SELECT USING (is_admin(auth.uid()));

-- REPORTS: Só admin gerencia
CREATE POLICY "Admins can view all reports" ON reports FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can create reports" ON reports FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update reports" ON reports FOR UPDATE USING (is_admin(auth.uid()));

-- FORMS: Público pode ver ativos, admin gerencia
CREATE POLICY "Anyone can view active forms" ON forms FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage forms" ON forms FOR ALL USING (is_admin(auth.uid()));
```

### 3.2 Funções de Segurança

```sql
-- Verifica se usuário é admin
CREATE FUNCTION is_admin(user_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin_hc');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verifica role específica
CREATE FUNCTION has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Gera hash anônimo do respondente
CREATE FUNCTION generate_respondent_hash(respondent_data JSONB) RETURNS TEXT AS $$
BEGIN
  RETURN encode(sha256((
    COALESCE(respondent_data->>'nome', '') || 
    COALESCE(respondent_data->>'setor', '') || 
    COALESCE(respondent_data->>'cargo', '')
  )::bytea), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.3 Roles do Sistema

| Role | Permissões |
|------|------------|
| `super_admin` | Acesso total, gerencia usuários, chaves de API, agentes |
| `admin_hc` | Revisa submissões, aprova relatórios, gerencia forms |
| `employee_amaggi` | Visualiza dashboards, responde formulários |

---

## 4. FLUXO DE DADOS

### 4.1 Fluxo de Submissão

```
1. Usuário acessa /f/{formId} (público)
2. Preenche dados do respondente
3. Responde questionário (NASA-TLX + HSE-IT ou ERGOS)
4. Sistema gera hash do respondente (anonimização)
5. Cria submission com status 'pending_ai'
6. Trigger dispara análise de IA (se configurado)
```

### 4.2 Fluxo de Análise IA

```
1. Edge Function 'analyze-submission' recebe submissionId
2. Busca agente ativo para o form_type
3. Se RAG habilitado:
   - Gera embedding da submissão
   - Busca chunks similares (top_k)
   - Injeta contexto no prompt
4. Chama provider de IA (Lovable/OpenAI/Anthropic)
5. Parseia resposta estruturada
6. Cria registro em 'reports'
7. Registra uso em 'ai_usage'
8. Atualiza status da submissão para 'processed'
```

### 4.3 Fluxo de Aprovação

```
1. Admin acessa /reports/{id}/review
2. Visualiza dados do respondente e respostas
3. Revisa análise da IA (editável)
4. Aprova relatório
5. Gera PDF/DOCX final
6. Status muda para 'approved'
```

---

## 5. EDGE FUNCTIONS

### 5.1 Funções Disponíveis

| Função | Descrição |
|--------|-----------|
| `analyze-submission` | Processa submissão com IA |
| `generate-pdf` | Gera relatório em HTML/PDF |
| `generate-docx` | Gera relatório em XML/DOCX |
| `generate-zip` | Geração em massa de relatórios |
| `process-document` | Processa documentos para RAG |
| `seed-admin` | Cria usuário admin inicial |
| `update-password` | Atualiza senha de usuário |

---

## 6. METODOLOGIAS IMPLEMENTADAS

### 6.1 ERGOS (Operacional)
- 10 dimensões cognitivas/organizacionais
- Escala 0-10 por pergunta
- Fórmula: 0.83 × (Tabela_A + Tabela_B)
- Classificação: Adequado | Tolerável | Moderado | Substancial | Intolerável

### 6.2 HSE-IT (Administrativo)
- 7 dimensões: Demandas, Controle, Apoio Chefia, Apoio Colegas, Relacionamentos, Cargo, Mudanças
- Escala de frequência 1-5
- Cálculo percentual por dimensão

### 6.3 NASA-TLX
- 6 dimensões: Mental, Física, Temporal, Performance, Esforço, Frustração
- Comparações pareadas (peso)
- Escala 0-100 (percepção)

### 6.4 FMEA Psicossocial
- Gravidade (G) × Probabilidade (P) × Controle (C) = NRE
- Classificação: Trivial (1) | Tolerável (2-3) | Moderado (4-9) | Substancial (12-18) | Intolerável (27)

---

## 7. ESTRUTURA DE PASTAS

```
src/
├── assets/              # Logos e imagens
├── components/
│   ├── forms/           # QuestionEditor, FormPreview
│   ├── layout/          # AppLayout, AppHeader
│   └── ui/              # Shadcn components
├── contexts/            # AuthContext
├── hooks/               # useAuth, useMobile
├── integrations/supabase/
│   ├── client.ts        # Cliente Supabase
│   └── types.ts         # Tipos gerados (read-only)
├── lib/
│   ├── formTemplates.ts # Templates ADM/OP
│   ├── utils.ts         # Funções utilitárias
│   └── validations.ts   # Schemas Zod
├── pages/
│   ├── Dashboard.tsx
│   ├── Forms.tsx
│   ├── FormBuilder.tsx
│   ├── PublicFormSubmit.tsx  # Formulário público (Typeform-style)
│   ├── Reports.tsx
│   ├── ReviewReport.tsx      # Revisão de análise IA
│   └── ...
└── main.tsx

supabase/
├── config.toml          # Configuração do projeto
└── functions/
    ├── analyze-submission/
    ├── generate-pdf/
    ├── generate-docx/
    └── ...
```

---

## 8. VARIÁVEIS DE AMBIENTE

```env
# Geradas automaticamente (não editar)
VITE_SUPABASE_URL=https://svbqnwchxrvydtxmnnsd.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1...
VITE_SUPABASE_PROJECT_ID=svbqnwchxrvydtxmnnsd

# Secrets (Edge Functions)
SUPABASE_SERVICE_ROLE_KEY  # Acesso admin
LOVABLE_API_KEY            # Lovable AI
```

---

## 9. COMPLIANCE E LGPD

### 9.1 Medidas Implementadas
- ✅ Hash SHA256 para anonimização de respondentes
- ✅ RLS restritiva em todas as tabelas sensíveis
- ✅ Submissões públicas sem vínculo direto com auth.users
- ✅ Audit log para rastreabilidade
- ✅ Criptografia em trânsito (HTTPS) e repouso (Supabase)

### 9.2 Pendências
- ⚠️ Criptografia a nível de aplicação (pgcrypto) para campos sensíveis
- ⚠️ Termo de consentimento digital
- ⚠️ Período de retenção de dados

---

## 10. PRÓXIMOS PASSOS

1. **Relatório de Custos IA** - Dashboard com tokens/custos mensais
2. **Auditoria Visual** - Interface para logs de sistema
3. **Assinatura Digital** - Integração com certificado digital
4. **Multi-tenancy** - Suporte a múltiplas empresas

---

*Documento gerado automaticamente pelo sistema HC Consultoria*
