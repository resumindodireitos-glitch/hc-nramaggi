# 📋 ERGOS AI Platform - Blueprint Completo

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Banco de Dados](#banco-de-dados)
4. [Autenticação e Autorização](#autenticação-e-autorização)
5. [Módulos do Sistema](#módulos-do-sistema)
6. [Inteligência Artificial](#inteligência-artificial)
7. [Edge Functions](#edge-functions)
8. [Fluxos de Dados](#fluxos-de-dados)
9. [Segurança](#segurança)
10. [API Reference](#api-reference)

---

## 1. Visão Geral

### 1.1 Descrição
Plataforma de avaliação ergonômica e psicossocial desenvolvida para a HC Consultoria em Ergonomia, atendendo empresas do Grupo Amaggi. O sistema automatiza a coleta e análise de questionários ERGOS e HSE-IT, gerando laudos técnicos em conformidade com NR-01 e NR-17.

### 1.2 Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI** | Tailwind CSS + shadcn/ui |
| **Estado** | TanStack Query |
| **Backend** | Supabase (Lovable Cloud) |
| **Banco** | PostgreSQL |
| **IA** | Lovable AI Gateway (Gemini 2.5 Flash) |
| **Auth** | Supabase Auth |

### 1.3 Público-Alvo

| Role | Descrição | Permissões |
|------|-----------|------------|
| `super_admin` | Administrador master | Tudo |
| `admin_hc` | Administrador HC Consultoria | Gerenciar formulários, relatórios, usuários |
| `employee_amaggi` | Colaborador Amaggi | Responder questionários, ver próprios relatórios |

---

## 2. Arquitetura

### 2.1 Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  Pages: Login, Register, Dashboard, Forms, Submissions, Reports │
│  Components: AppLayout, FormBuilder, QuestionEditor, etc.       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Lovable Cloud)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    Auth     │  │  Database   │  │    Edge Functions       │  │
│  │  (JWT/RLS)  │  │ (PostgreSQL)│  │  - analyze-submission   │  │
│  │             │  │             │  │  - generate-pdf         │  │
│  └─────────────┘  └─────────────┘  │  - generate-zip         │  │
│                                    └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LOVABLE AI GATEWAY                           │
├─────────────────────────────────────────────────────────────────┤
│  Model: google/gemini-2.5-flash                                 │
│  Endpoint: https://ai.gateway.lovable.dev/v1/chat/completions   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Estrutura de Pastas

```
src/
├── assets/                 # Logos e imagens
├── components/
│   ├── forms/              # FormPreview, QuestionEditor
│   ├── layout/             # AppLayout
│   └── ui/                 # shadcn components
├── contexts/               # AuthContext
├── hooks/                  # useAuth, use-mobile, use-toast
├── integrations/
│   └── supabase/           # client.ts, types.ts (auto-gerados)
├── lib/                    # utils.ts
└── pages/
    ├── AdminForms.tsx      # CRUD formulários
    ├── AdminSettings.tsx   # Configurações sistema
    ├── BulkGeneration.tsx  # Geração em lote
    ├── Dashboard.tsx       # Painel principal
    ├── FormBuilder.tsx     # Construtor de formulários
    ├── FormSubmit.tsx      # Preenchimento questionário
    ├── Forms.tsx           # Lista formulários
    ├── Login.tsx           # Autenticação
    ├── OrganizationManagement.tsx  # Departamentos, cargos, funcionários
    ├── Register.tsx        # Cadastro
    ├── ReportDetail.tsx    # Detalhes do relatório
    ├── Reports.tsx         # Lista relatórios
    ├── ReviewReport.tsx    # Revisão/aprovação
    ├── Submissions.tsx     # Submissões
    └── UserManagement.tsx  # Gestão usuários

supabase/
├── config.toml             # Configuração Supabase
├── functions/
│   ├── analyze-submission/ # Análise IA
│   ├── generate-pdf/       # Geração PDF
│   └── generate-zip/       # Exportação em lote
└── migrations/             # Migrações SQL
```

---

## 3. Banco de Dados

### 3.1 Diagrama ER

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    profiles     │     │   user_roles    │     │   ai_prompts    │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK, FK auth)│◄────│ user_id (FK)    │     │ id (PK)         │
│ full_name       │     │ role (enum)     │     │ name            │
│ email           │     │ created_at      │     │ form_type       │
│ role (enum)     │     └─────────────────┘     │ system_prompt   │
│ company         │                             │ model           │
│ department      │                             │ temperature     │
│ job_title       │                             │ is_active       │
└─────────────────┘                             └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     forms       │     │  submissions    │     │    reports      │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────│ form_id (FK)    │◄────│ submission_id   │
│ title           │     │ id (PK)         │     │ id (PK)         │
│ description     │     │ employee_id     │     │ risk_level      │
│ type (enum)     │     │ answers (JSONB) │     │ dimensions_score│
│ schema (JSONB)  │     │ respondent_data │     │ ai_analysis_text│
│ is_active       │     │ status (enum)   │     │ ai_conclusion   │
│ created_by      │     │ created_at      │     │ ai_recommendations
└─────────────────┘     └─────────────────┘     │ is_approved     │
                                                │ reviewer_id     │
                                                └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  departments    │     │   job_roles     │     │   employees     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────│ department_id   │     │ id (PK)         │
│ name            │     │ id (PK)         │◄────│ job_role_id (FK)│
│ code            │     │ name            │     │ name            │
│ description     │     │ cbo             │     │ email           │
│ manager_name    │     │ risk_category   │     │ registration_code
└─────────────────┘     │ description     │     │ admission_date  │
                        └─────────────────┘     │ is_active       │
                                                └─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│ system_settings │     │   audit_log     │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ key             │     │ user_id         │
│ value           │     │ action          │
│ description     │     │ table_name      │
│ is_secret       │     │ record_id       │
└─────────────────┘     │ old_data        │
                        │ new_data        │
                        └─────────────────┘
```

### 3.2 Enums

```sql
-- Tipos de formulário
CREATE TYPE form_type AS ENUM ('ergos', 'hse_it');

-- Roles de usuário (tabela profiles)
CREATE TYPE user_role AS ENUM ('admin_hc', 'employee_amaggi');

-- Roles de aplicação (tabela user_roles)
CREATE TYPE app_role AS ENUM ('super_admin', 'admin_hc', 'employee_amaggi');

-- Status de submissão
CREATE TYPE submission_status AS ENUM ('pending_ai', 'processed', 'reviewed', 'approved');
```

### 3.3 Funções de Segurança

```sql
-- Verifica se usuário é admin
CREATE FUNCTION is_admin(user_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = user_id AND role = 'admin_hc'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Verifica se usuário é super_admin
CREATE FUNCTION is_super_admin(_user_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'super_admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Verifica role específica
CREATE FUNCTION has_role(_user_id uuid, _role app_role) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
```

---

## 4. Autenticação e Autorização

### 4.1 Fluxo de Autenticação

```
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  User   │───▶│  Register   │───▶│ Supabase    │───▶│ handle_new  │
│         │    │  /Login     │    │ Auth        │    │ _user()     │
└─────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                         │                  │
                                         ▼                  ▼
                                  ┌─────────────┐    ┌─────────────┐
                                  │   JWT       │    │  profiles   │
                                  │   Token     │    │ user_roles  │
                                  └─────────────┘    └─────────────┘
```

### 4.2 Trigger de Novo Usuário

```sql
CREATE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  -- Cria profile com role padrão
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee_amaggi')
  );
  
  -- Cria entrada em user_roles
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'employee_amaggi');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.3 Hook useAuth

```typescript
// src/hooks/useAuth.ts
const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const isAdmin = profile?.role === "admin_hc";
  
  return { user, profile, isAdmin, isLoading, signIn, signUp, signOut };
};
```

### 4.4 RLS Policies Resumo

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| profiles | próprio + admin | próprio | próprio | ❌ |
| forms | auth + admin | admin | admin | admin |
| submissions | próprio + admin | auth | admin | ❌ |
| reports | próprio + admin | admin | admin | ❌ |
| departments | auth | admin | admin | admin |
| employees | admin | admin | admin | admin |
| ai_prompts | admin | super_admin | super_admin | super_admin |
| user_roles | próprio + super_admin | super_admin | super_admin | super_admin |

---

## 5. Módulos do Sistema

### 5.1 Dashboard (`/dashboard`)
- Estatísticas de submissões
- Gráficos de risco por período
- Atalhos rápidos

### 5.2 Formulários (`/forms`, `/form-builder`)
- Lista de questionários disponíveis
- Construtor drag-and-drop
- Tipos de pergunta: text, textarea, radio, checkbox, select, slider
- Preview em tempo real

### 5.3 Submissões (`/form/:id`, `/submissions`)
- Preenchimento de questionário
- Histórico de respostas
- Status: pending_ai → processed → reviewed → approved

### 5.4 Relatórios (`/reports`, `/report/:id`, `/review/:id`)
- Visualização de análise IA
- Edição de texto final
- Aprovação por revisor
- Exportação PDF

### 5.5 Organização (`/organization`)
- CRUD Departamentos
- CRUD Cargos (job_roles)
- CRUD Funcionários
- Importação em massa

### 5.6 Administração (`/admin-settings`)
- Gestão de prompts IA
- Configurações do sistema
- Gestão de roles
- Auditoria

---

## 6. Inteligência Artificial

### 6.1 Arquitetura IA

```
┌─────────────────┐
│   Submissão     │
│   (answers)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Edge Function   │────▶│  ai_prompts     │
│ analyze-        │     │  (form_type)    │
│ submission      │     └─────────────────┘
└────────┬────────┘
         │ Se não há prompt customizado
         ▼
┌─────────────────┐
│ MASTER_PROMPT   │
│ (hardcoded)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│        LOVABLE AI GATEWAY               │
│  POST https://ai.gateway.lovable.dev/   │
│       v1/chat/completions               │
│  Model: google/gemini-2.5-flash         │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  JSON Response  │
│  - risk_level   │
│  - dimensions   │
│  - analysis     │
│  - conclusion   │
│  - recommendations
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    reports      │
│    (table)      │
└─────────────────┘
```

### 6.2 Prompts Ativos

#### ERGOS (Operacional)
- **Objetivo:** Avaliar carga mental e fatores psicossociais
- **10 Dimensões:** Pressão de tempo, Atenção, Complexidade, Monotonia, Raciocínio, Iniciativa, Isolamento, Horários/Turnos, Relacionamentos, Demandas Gerais
- **Escala:** 0-10 por dimensão
- **Classificação:** 0-30 (baixo), 31-50 (médio), 51-70 (alto), 70+ (crítico)

#### HSE-IT (Administrativo)
- **Objetivo:** Avaliar estresse relacionado ao trabalho
- **7 Dimensões:** Demandas, Controle, Apoio da Chefia, Apoio dos Colegas, Relacionamentos, Cargo, Mudanças
- **Escala:** 0-100% por dimensão
- **Classificação:** 0-25% (baixo), 26-50% (moderado), 51-75% (alto), 76-100% (crítico)

### 6.3 Formato de Saída JSON

```json
{
  "risk_level": "baixo|medio|alto|critico",
  "form_type": "ergos|hse_it",
  "total_score": 45.5,
  "dimensions_score": {
    "pressao_tempo": { "score": 6, "risk_color": "amarelo" },
    "atencao": { "score": 4, "risk_color": "verde" }
  },
  "analysis_text": "Texto técnico da análise...",
  "risk_inventory": [
    {
      "risk_factor": "Pressão de tempo",
      "harm": "Transtornos de ansiedade",
      "source_cause": "Prazos apertados",
      "exposure": "Habitual",
      "severity_G": 2,
      "probability_P": 2,
      "control_C": 2,
      "nre_value": 8,
      "nre_label": "Moderado",
      "action_plan": "Manter ações do portfólio CULTURA DE CUIDADO"
    }
  ],
  "conclusion": "Texto conclusivo...",
  "recommendations": ["Recomendação 1", "Recomendação 2"]
}
```

### 6.4 Matriz FMEA (G × P × C)

| G (Gravidade) | P (Probabilidade) | C (Controle) | NRE = G×P×C |
|---------------|-------------------|--------------|-------------|
| 1 = Baixa | 1 = Improvável | 1 = Bom | 1 = Trivial |
| 2 = Média | 2 = Possível | 2 = Parcial | 2-3 = Tolerável |
| 3 = Alta | 3 = Frequente | 3 = Inexistente | 4-9 = Moderado |
| | | | 12-18 = Substancial |
| | | | 27 = Intolerável |

---

## 7. Edge Functions

### 7.1 analyze-submission

**Endpoint:** `POST /functions/v1/analyze-submission`

**Input:**
```json
{ "submissionId": "uuid" }
```

**Processo:**
1. Busca submission + form
2. Carrega prompt customizado ou MASTER_PROMPT
3. Chama Lovable AI Gateway
4. Parse JSON da resposta
5. Insere em `reports`
6. Atualiza `submissions.status` → "processed"

**Output:**
```json
{ "success": true, "reportId": "uuid" }
```

### 7.2 generate-pdf

**Endpoint:** `POST /functions/v1/generate-pdf`

**Input:**
```json
{ "reportId": "uuid" }
```

**Output:** PDF binário

### 7.3 generate-zip

**Endpoint:** `POST /functions/v1/generate-zip`

**Input:**
```json
{ "reportIds": ["uuid1", "uuid2"] }
```

**Output:** ZIP com múltiplos PDFs

---

## 8. Fluxos de Dados

### 8.1 Fluxo de Preenchimento de Questionário

```
1. Colaborador acessa /form/:formId
2. Sistema carrega perguntas (forms.schema)
3. Colaborador preenche respostas
4. Submit → INSERT submissions (status: pending_ai)
5. Chama edge function analyze-submission
6. IA processa → INSERT reports
7. UPDATE submissions.status → "processed"
8. Notifica admin para revisão
```

### 8.2 Fluxo de Revisão e Aprovação

```
1. Admin acessa /review/:reportId
2. Visualiza análise IA
3. Edita texto final (opcional)
4. Clica "Aprovar"
5. UPDATE reports.is_approved = true
6. UPDATE reports.reviewer_id = auth.uid()
7. UPDATE submissions.status → "approved"
```

### 8.3 Fluxo de Geração em Lote

```
1. Admin seleciona múltiplos colaboradores
2. Sistema busca submissions pendentes
3. Para cada submission:
   a. Chama analyze-submission
   b. Aguarda processamento
4. Exibe progresso em tempo real
5. Permite download ZIP com todos os PDFs
```

---

## 9. Segurança

### 9.1 Checklist de Segurança

| Item | Status | Observação |
|------|--------|------------|
| RLS habilitado em todas as tabelas | ✅ | |
| Funções SECURITY DEFINER com search_path | ✅ | |
| JWT verificado em edge functions | ✅ | |
| CORS configurado | ✅ | |
| Senhas hasheadas (Supabase Auth) | ✅ | |
| Rate limiting (Lovable AI) | ✅ | 429/402 tratados |
| Input validation | ⚠️ | Recomendado adicionar Zod |
| Role storage separado | ✅ | user_roles table |

### 9.2 Vulnerabilidades Conhecidas

1. **[CRÍTICO]** Seleção de role no registro - usuários podem escolher admin_hc
2. **[MÉDIO]** Admin check usa profiles.role ao invés de user_roles
3. **[BAIXO]** Falta validação de input com Zod

### 9.3 Recomendações

1. Remover dropdown de role do formulário de registro
2. Migrar verificação de admin para usar `has_role()` function
3. Implementar validação com Zod em todos os formulários
4. Adicionar coluna `user_id` dedicada em submissions

---

## 10. API Reference

### 10.1 Supabase Client

```typescript
import { supabase } from "@/integrations/supabase/client";

// Autenticação
await supabase.auth.signUp({ email, password, options: { data: { full_name } } });
await supabase.auth.signInWithPassword({ email, password });
await supabase.auth.signOut();

// Queries
const { data } = await supabase.from('forms').select('*').eq('is_active', true);
const { data } = await supabase.from('submissions').insert({ form_id, answers, respondent_data });
const { data } = await supabase.from('reports').update({ is_approved: true }).eq('id', reportId);

// Edge Functions
const { data } = await supabase.functions.invoke('analyze-submission', {
  body: { submissionId }
});
```

### 10.2 Lovable AI Gateway

```typescript
// Apenas via Edge Function
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  }),
});
```

---

## 📝 Changelog

| Data | Versão | Descrição |
|------|--------|-----------|
| 2025-12-03 | 1.0.0 | Documentação inicial |

---

## 👥 Contatos

- **Desenvolvimento:** Lovable AI
- **Cliente:** HC Consultoria em Ergonomia
- **Empresa:** Grupo Amaggi
