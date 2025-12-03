# Sistema HC Consultoria - Blueprint V3.0
## Análise Ergonômica e Psicossocial - Amaggi

---

## 1. VISÃO GERAL DO SISTEMA

### 1.1 Propósito
Sistema web para coleta, análise e geração de relatórios de avaliação ergonômica (AET) e riscos psicossociais, em conformidade com a LGPD (Lei 13.709/2018).

### 1.2 Cliente
**Amaggi** - Empresa do agronegócio com múltiplas fazendas/unidades, departamentos e cargos.

### 1.3 Operador
**HC Consultoria - Ergonomia & Fisioterapia** - Empresa especializada em saúde ocupacional.

---

## 2. STACK TECNOLÓGICO

### 2.1 Frontend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| React | 18.x | Framework UI |
| TypeScript | 5.x | Tipagem estática |
| Vite | 5.x | Build tool |
| TailwindCSS | 3.x | Estilização |
| Shadcn/UI | - | Componentes base |
| Framer Motion | 12.x | Animações |
| Recharts | 2.x | Gráficos/Dashboards |
| React Hook Form | 7.x | Formulários |
| Zod | 3.x | Validação |

### 2.2 Backend (Lovable Cloud / Supabase)
| Componente | Tecnologia | Propósito |
|------------|------------|-----------|
| Database | PostgreSQL 15 | Armazenamento |
| Auth | Supabase Auth | Autenticação |
| Storage | Supabase Storage | Arquivos |
| Edge Functions | Deno | Lógica servidor |
| Vector DB | pgvector | RAG/Embeddings |
| Real-time | Supabase Realtime | Atualizações |

### 2.3 IA/ML
| Componente | Propósito |
|------------|-----------|
| Lovable AI | Análise de submissões |
| Google Gemini | Modelos de linguagem |
| OpenAI GPT | Modelos alternativos |
| pgvector | Busca semântica RAG |

---

## 3. ARQUITETURA DO SISTEMA

### 3.1 Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUÁRIOS                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Respondente]     [Admin HC]      [Super Admin]                │
│   Formulário        Dashboard        Configurações              │
│   Público           Relatórios       Sistema                    │
└───────┬─────────────────┬───────────────────┬───────────────────┘
        │                 │                   │
        ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)                         │
├─────────────────────────────────────────────────────────────────┤
│  • PublicFormSubmit    • Dashboard         • AdminSettings      │
│  • ConsentModal (LGPD) • Reports           • AIAgents           │
│  • FormBuilder         • ReviewReport      • LGPDManagement     │
└───────┬─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SUPABASE / LOVABLE CLOUD                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    Auth     │  │   Storage   │  │  Edge Funcs │              │
│  │  • JWT      │  │  • Docs     │  │  • analyze  │              │
│  │  • Roles    │  │  • RAG      │  │  • PDF      │              │
│  └─────────────┘  └─────────────┘  │  • export   │              │
│                                     └─────────────┘              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   PostgreSQL Database                     │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  submissions │ reports │ forms │ consent_logs │ audit_log│   │
│  │  profiles    │ farms   │ departments │ job_roles         │   │
│  │  ai_prompts  │ ai_usage │ knowledge_documents            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Fluxo de Dados

```
[1] SUBMISSÃO
    Respondente → ConsentModal → Formulário → submissions + consent_logs
                      ↓
[2] ANÁLISE IA
    submissions → analyze-submission → AI Provider → reports
                      ↓
[3] REVISÃO
    Admin → ReviewReport → Edição/Aprovação → reports (approved)
                      ↓
[4] RELATÓRIO
    reports → generate-pdf/docx → Documento Final (agregado por cargo)
```

---

## 4. MODELO DE DADOS

### 4.1 Tabelas Principais

#### submissions
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| form_id | UUID | FK → forms |
| respondent_data | JSONB | Dados do respondente (nome, cargo, setor) |
| answers | JSONB | Respostas do formulário |
| respondent_hash | TEXT | Hash SHA256 para deduplicação |
| ip_hash | TEXT | Hash do IP (rate limiting) |
| status | ENUM | pending_ai, processed, approved |
| data_retention_until | TIMESTAMP | Data limite de retenção (5 anos) |

#### reports
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| submission_id | UUID | FK → submissions |
| risk_level | TEXT | trivial → intoleravel |
| dimensions_score | JSONB | Scores por dimensão |
| ai_analysis_text | TEXT | Análise gerada pela IA |
| ai_recommendations | TEXT[] | Recomendações |
| is_approved | BOOLEAN | Aprovado por admin |

#### consent_logs (LGPD)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | PK |
| submission_id | UUID | FK → submissions |
| ip_hash | TEXT | Hash do IP |
| term_version | TEXT | Versão do termo aceito |
| consent_text | TEXT | Texto completo do termo |
| accepted_at | TIMESTAMP | Data/hora do aceite |

### 4.2 Views

#### aggregated_reports_by_role
Relatórios agregados por CARGO (não por pessoa individual).
- cargo, setor, form_type
- total_submissions, approved_reports
- avg_risk_score, most_common_risk_level

#### participation_control
Controle de presença (quem já respondeu) - Apenas para Admin.

---

## 5. SEGURANÇA E LGPD

### 5.1 Controle de Acesso (RBAC)

| Role | Permissões |
|------|------------|
| **super_admin** | Tudo: configurações, API keys, LGPD, ver nomes individuais |
| **admin_hc** | Relatórios, aprovações, dashboard, ver dados agregados |
| **employee_amaggi** | Visualizar próprios dados (futuro) |
| **anon** | Apenas INSERT em submissions/consent_logs |

### 5.2 Compliance LGPD

| Requisito | Implementação |
|-----------|---------------|
| **Consentimento** | Modal bloqueante + consent_logs |
| **Minimização** | IP salvo como hash (SHA256) |
| **Retenção** | 5 anos, depois anonimização automática |
| **Esquecimento** | Função anonymize_submission() |
| **Portabilidade** | Função export_user_data() |
| **Auditoria** | audit_log com todas operações sensíveis |

### 5.3 Relatórios e Privacidade

**REGRA FUNDAMENTAL:** Relatórios finais são AGREGADOS por CARGO.
- ✅ "Cargo: Assistente Administrativo - 10 participantes - Risco Médio"
- ❌ "Maria da Silva respondeu que está estressada"

**Exceção (última instância):** Super Admin pode acessar dados individuais via função `get_individual_responses_by_role()`, com registro em audit_log.

### 5.4 RLS Policies

```sql
-- submissions: write-only para anon
CREATE POLICY "anon_insert_only" ON submissions FOR INSERT WITH CHECK (true);
-- (sem SELECT para anon)

-- reports: apenas admin pode ver/editar
CREATE POLICY "admin_only" ON reports FOR ALL USING (is_admin(auth.uid()));

-- consent_logs: imutável (append-only)
-- (sem UPDATE/DELETE policies)
```

---

## 6. METODOLOGIAS IMPLEMENTADAS

### 6.1 ERGOS (Escala de Avaliação Ergonômica)
- **10 Dimensões**: 5 cognitivas + 5 organizacionais
- **Escala**: 0-10
- **Fórmula**: Score = 0.83 × (A + B)
- **Classificação**: Adequado (≥80%) → Inadequado (<40%)

### 6.2 HSE-IT (Health & Safety Executive - Indicator Tool)
- **7 Dimensões**: Demandas, Controle, Apoio Chefia, Apoio Colegas, Relacionamentos, Cargo, Mudanças
- **Escala**: 0-100%
- **Benchmark**: Comparação com padrões HSE UK

### 6.3 FMEA Psicossocial (Risk Matrix)
- **Cálculo**: NRE = Gravidade × Probabilidade × Capacidade de Detecção
- **Classificação**:
  - Trivial (NRE ≤ 50)
  - Tolerável (51-100)
  - Moderado (101-200)
  - Substancial (201-400)
  - Intolerável (>400)

### 6.4 Referências Normativas
- NR-01 (Gerenciamento de Riscos)
- NR-17 (Ergonomia)
- ISO 10075-1 (Carga Mental)
- ISO 45003 (Riscos Psicossociais)
- ISO 31000 (Gestão de Riscos)

---

## 7. EDGE FUNCTIONS

| Função | Propósito |
|--------|-----------|
| `analyze-submission` | Análise IA com RAG opcional |
| `generate-pdf` | Geração de relatório PDF |
| `generate-docx` | Geração de relatório Word |
| `process-document` | Processamento de documentos para RAG |
| `export-user-data` | Exportação LGPD |
| `seed-admin` | Criação de usuário admin inicial |

---

## 8. ESTRUTURA DE DIRETÓRIOS

```
src/
├── assets/                 # Logos, imagens
├── components/
│   ├── layout/             # AppLayout, AppHeader
│   ├── lgpd/               # ConsentModal
│   ├── forms/              # FormBuilder components
│   └── ui/                 # Shadcn components
├── contexts/               # AuthContext
├── hooks/                  # useAuth, useMobile
├── integrations/
│   └── supabase/           # Client, types
├── lib/                    # Utils, validations
├── pages/
│   ├── Dashboard.tsx
│   ├── Reports.tsx
│   ├── ReviewReport.tsx
│   ├── PublicFormSubmit.tsx
│   ├── AIAgents.tsx
│   ├── LGPDManagement.tsx
│   └── ...
└── App.tsx                 # Router

supabase/
├── config.toml
├── functions/
│   ├── analyze-submission/
│   ├── generate-pdf/
│   ├── generate-docx/
│   ├── process-document/
│   └── ...
└── migrations/
```

---

## 9. VARIÁVEIS DE AMBIENTE

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (edge functions) |
| `LOVABLE_API_KEY` | API Lovable AI |

---

## 10. ROADMAP

### ✅ Implementado (MVP)
- [x] Autenticação e roles
- [x] Formulários nativos (builder)
- [x] Submissão pública com consentimento LGPD
- [x] Análise IA com RAG
- [x] Revisão de relatórios (split-view)
- [x] Geração PDF/DOCX
- [x] Dashboard com gráficos
- [x] Gestão LGPD (esquecimento, portabilidade, retenção)
- [x] Agregação por cargo (privacidade)
- [x] Auditoria completa

### 🔄 Em Desenvolvimento
- [ ] Assinatura digital
- [ ] Cron para limpeza automática de PII
- [ ] Webhooks Google/Microsoft Forms

### 📋 Futuro
- [ ] Multi-tenancy (outros clientes além Amaggi)
- [ ] App mobile
- [ ] Integração com sistemas de RH

---

## 11. CONTATO E SUPORTE

**HC Consultoria - Ergonomia & Fisioterapia**
- Sistema desenvolvido com Lovable AI
- Conformidade LGPD: Lei 13.709/2018
- Última atualização: Dezembro 2024

---

*Este documento é confidencial e destinado apenas à equipe técnica do projeto.*
