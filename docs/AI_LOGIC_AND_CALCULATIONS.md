# 🤖 Documentação Completa da Lógica de IA e Cálculos
## Sistema HC Consultoria - Ergos AI Platform

---

## 📋 ÍNDICE

1. [Visão Geral do Sistema de IA](#1-visão-geral-do-sistema-de-ia)
2. [API Keys e Configuração](#2-api-keys-e-configuração)
3. [Provedores de IA Suportados](#3-provedores-de-ia-suportados)
4. [Edge Functions de IA](#4-edge-functions-de-ia)
5. [Motor de Cálculo Universal](#5-motor-de-cálculo-universal)
6. [Cálculos ERGOS](#6-cálculos-ergos)
7. [Cálculos HSE-IT](#7-cálculos-hse-it)
8. [Cálculo NASA-TLX](#8-cálculo-nasa-tlx)
9. [FMEA e Matriz de Riscos](#9-fmea-e-matriz-de-riscos)
10. [Sistema RAG (Retrieval Augmented Generation)](#10-sistema-rag)
11. [Prompts de IA](#11-prompts-de-ia)
12. [Fluxo Completo de Processamento](#12-fluxo-completo-de-processamento)
13. [Interpretações Padrão](#13-interpretações-padrão)

---

## 1. VISÃO GERAL DO SISTEMA DE IA

O sistema utiliza **múltiplos provedores de IA** para análise de questionários ergonômicos e geração de relatórios técnicos. O provedor padrão é o **Lovable AI Gateway**.

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                                │
│  PublicFormSubmit → ReviewReport → ReportDetail → PDF Generation        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     SUPABASE EDGE FUNCTIONS                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │analyze-submission│  │universal-calculator│  │generate-narrative-report│
│  └─────────────────┘  └──────────────────┘  └────────────────────────┘  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │  calculate-fmea │  │ process-document │  │     generate-pdf       │  │
│  └─────────────────┘  └──────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       PROVEDORES DE IA                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ Lovable AI │  │  OpenAI    │  │  Anthropic │  │  Google Gemini     │ │
│  │  (default) │  │   (GPT)    │  │  (Claude)  │  │   (direto)         │ │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. API KEYS E CONFIGURAÇÃO

### Keys Configuradas no Sistema

| Key | Local | Uso |
|-----|-------|-----|
| `LOVABLE_API_KEY` | Supabase Secrets (automático) | Lovable AI Gateway - **PADRÃO** |
| `GOOGLE_API_KEY` | system_settings table | Google Gemini direto |
| `OPENAI_API_KEY` | system_settings table | OpenAI GPT |
| `ANTHROPIC_API_KEY` | system_settings table | Claude |
| `DEEPSEEK_API_KEY` | system_settings table | DeepSeek |

### Tabela system_settings

```sql
SELECT key, description, is_secret FROM system_settings 
WHERE key IN ('GOOGLE_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY');
```

### Configuração de Agentes (ai_prompts table)

```sql
-- Estrutura da tabela ai_prompts
CREATE TABLE ai_prompts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  form_type TEXT NOT NULL,           -- 'ergos' ou 'hse_it'
  provider TEXT DEFAULT 'lovable',   -- 'lovable', 'google', 'openai', 'anthropic', 'deepseek'
  model TEXT DEFAULT 'google/gemini-2.5-flash',
  system_prompt TEXT NOT NULL,
  temperature FLOAT DEFAULT 0.7,
  max_tokens INT DEFAULT 4000,
  is_active BOOLEAN DEFAULT false,
  use_rag BOOLEAN DEFAULT false,
  rag_top_k INT DEFAULT 5,
  output_schema JSONB
);
```

---

## 3. PROVEDORES DE IA SUPORTADOS

### 3.1 Lovable AI Gateway (PADRÃO)

```typescript
const AI_ENDPOINTS = {
  lovable: "https://ai.gateway.lovable.dev/v1/chat/completions",
};

async function callLovableAI(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
  const response = await fetch(AI_ENDPOINTS.lovable, {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      model,  // "google/gemini-2.5-flash"
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}
```

**Modelos Disponíveis via Lovable:**
- `google/gemini-2.5-flash` (padrão, rápido)
- `google/gemini-2.5-pro` (mais preciso)
- `openai/gpt-5` (alta precisão)
- `openai/gpt-5-mini` (custo-benefício)
- `openai/gpt-5-nano` (mais rápido)

### 3.2 Google Gemini (Direto)

```typescript
async function callGoogleGemini(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
  const modelName = model.includes("/") ? model.split("/")[1] : model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      }
    }),
  });
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}
```

### 3.3 OpenAI

```typescript
async function callOpenAI(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4000,
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}
```

### 3.4 Anthropic (Claude)

```typescript
async function callAnthropic(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text;
}
```

### 3.5 DeepSeek

```typescript
async function callDeepSeek(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4000,
    }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}
```

---

## 4. EDGE FUNCTIONS DE IA

### 4.1 analyze-submission

**Arquivo:** `supabase/functions/analyze-submission/index.ts`

**Propósito:** Processa submissão de formulário e gera análise inicial com IA.

**Fluxo:**
1. Recebe `submissionId`
2. Verifica autorização (admin_hc ou super_admin)
3. Busca submissão e formulário associado
4. Seleciona agente ativo para o `form_type`
5. Se RAG habilitado, busca contexto na base de conhecimento
6. Chama provedor de IA configurado
7. Parseia resposta JSON
8. Cria registro na tabela `reports`

```typescript
// Fallback quando IA falha
function generateFallbackAnalysis(formType: string, answers: Record<string, any>, form?: any) {
  const calculated = calculateUniversalScore(formType, answers, form);
  return {
    risk_level: calculated.risk_level,
    form_type: formType,
    total_score: calculated.global_score,
    dimensions_score: calculated,
    analysis_text: "Análise básica gerada. Configure um agente de IA para análises detalhadas.",
    risk_inventory: [],
    conclusion: "Relatório gerado sem análise de IA completa.",
    recommendations: ["Configure um agente de IA ativo para recomendações personalizadas."]
  };
}
```

### 4.2 generate-narrative-report

**Arquivo:** `supabase/functions/generate-narrative-report/index.ts`

**Propósito:** Gera/regenera texto narrativo de seções específicas do relatório.

**Parâmetros:**
- `reportId`: ID do relatório
- `section`: "analysis" | "conclusion" | "recommendations"

**Prompt de Sistema (NARRATIVE_SYSTEM_PROMPT):**

```
# ROLE
Você é um Fisioterapeuta Ergonomista Sênior especializado em análise de riscos 
psicossociais e ergonômicos ocupacionais.

# ESTILO
- Tom técnico, formal, impessoal em Português Brasil
- Linguagem encontrada em documentos AET profissionais
- Cite explicitamente NRs quando detectar risco alto (NR-01, NR-17)
- Referencie ISO 10075-1 para carga mental, ISO 45003 para riscos psicossociais

# ESTRUTURA DA ANÁLISE
1. **Caracterização do Posto**: Breve descrição do cargo/função avaliado
2. **Principais Achados**: Pontos críticos identificados nos scores
3. **Riscos Identificados**: Lista objetiva com gravidade
4. **Correlações**: Relação entre dimensões (ex: alta demanda + baixo controle = estresse)
5. **Recomendações Prioritárias**: Ações baseadas no NRE calculado

# REGRAS
- NÃO invente dados - use apenas os scores fornecidos
- NÃO cite nomes de funcionários individuais
- Foque na FUNÇÃO, não na pessoa
- Priorize recomendações baseadas no NRE (Intolerável > Substancial > Moderado)
- Mantenha o texto entre 300-600 palavras
```

### 4.3 universal-calculator

**Arquivo:** `supabase/functions/universal-calculator/index.ts`

**Propósito:** Motor de cálculo metadata-driven para qualquer tipo de formulário.

**Detalhes na seção 5.**

### 4.4 calculate-fmea

**Arquivo:** `supabase/functions/calculate-fmea/index.ts`

**Propósito:** Cálculo automático de FMEA e população da matriz de riscos.

**Detalhes na seção 9.**

### 4.5 process-document

**Arquivo:** `supabase/functions/process-document/index.ts`

**Propósito:** Pipeline RAG - extração, chunking e vetorização de documentos.

**Detalhes na seção 10.**

---

## 5. MOTOR DE CÁLCULO UNIVERSAL

### Estrutura do Output Padronizado

```json
{
  "global_score": 75,
  "risk_level": "medio",
  "risk_label": "Aceitável",
  "risk_color": "yellow",
  "risk_description": "Texto interpretativo...",
  "dimensions": [
    {
      "name": "Atenção",
      "score": 7,
      "normalized_score": 70,
      "status": "Atenção",
      "color": "yellow",
      "bloco": "A"
    }
  ],
  "blocos": {
    "A": { "total": 35, "name": "Fatores Cognitivos" },
    "B": { "total": 28, "name": "Fatores Organizacionais" }
  },
  "calculation_method": "ergos_weighted",
  "calculated_at": "2024-12-08T10:00:00Z"
}
```

### Detecção Automática de Formato

```typescript
function detectSubmissionFormat(answers: Record<string, any>): 'legacy' | 'modern' {
  const keys = Object.keys(answers);
  
  // Keys do formato legacy (dimensões diretas como "pressao_tempo", "atencao", etc.)
  const legacyDimensionKeys = [
    'pressao_tempo', 'atencao', 'complexidade', 'monotonia', 'raciocinio',
    'iniciativa', 'isolamento', 'horarios', 'relacionamentos', 'demandas_gerais'
  ];
  
  // Se tem keys legacy com valores numéricos diretos = legacy
  for (const key of keys) {
    if (legacyDimensionKeys.includes(key.toLowerCase())) {
      const val = answers[key];
      if (typeof val === 'number' || (typeof val === 'string' && val.length < 5)) {
        return 'legacy';
      }
    }
  }
  
  // Se tem keys no formato "pt_1", "at_1", etc. com valores de texto = modern
  const modernPatterns = [/^pt_\d+$/, /^at_\d+$/, /^cp_\d+$/];
  for (const key of keys) {
    if (modernPatterns.some(p => p.test(key))) {
      return 'modern';
    }
  }
  
  return 'modern'; // default
}
```

### Thresholds de Risco (Padronizado)

```typescript
const DEFAULT_THRESHOLDS = {
  levels: [
    { min: 0, max: 30, level: "baixo", label: "Satisfatório", color: "green", description: "Condições adequadas" },
    { min: 31, max: 60, level: "medio", label: "Aceitável", color: "yellow", description: "Atenção necessária" },
    { min: 61, max: 100, level: "alto", label: "Deve Melhorar", color: "red", description: "Intervenção necessária" }
  ],
  dimension_thresholds: {
    low: { max: 30, status: "Adequado", color: "green" },
    medium: { max: 60, status: "Atenção", color: "yellow" },
    high: { min: 61, status: "Crítico", color: "red" }
  }
};
```

---

## 6. CÁLCULOS ERGOS

### 6.1 Fórmula Principal

```
Pontuação Total = 0.83 × (Soma Bloco A + Soma Bloco B)
```

### 6.2 Estrutura dos Blocos

**Bloco A - Fatores Cognitivos:**
1. Pressão de Tempo
2. Atenção
3. Complexidade
4. Monotonia
5. Raciocínio

**Bloco B - Fatores Organizacionais:**
6. Iniciativa
7. Isolamento
8. Horários e Turnos
9. Relacionamentos
10. Demandas Gerais

### 6.3 Cálculo Legacy (valores numéricos 0-10)

```typescript
function calculateERGOS_Legacy(answers: Record<string, any>, thresholds: RiskThresholds) {
  const dimensionMapping = {
    'pressao_tempo': { name: 'Pressão de Tempo', bloco: 'A' },
    'atencao': { name: 'Atenção', bloco: 'A' },
    'complexidade': { name: 'Complexidade', bloco: 'A' },
    'monotonia': { name: 'Monotonia', bloco: 'A' },
    'raciocinio': { name: 'Raciocínio', bloco: 'A' },
    'iniciativa': { name: 'Iniciativa', bloco: 'B' },
    'isolamento': { name: 'Isolamento', bloco: 'B' },
    'horarios': { name: 'Horários e Turnos', bloco: 'B' },
    'relacionamentos': { name: 'Relacionamentos', bloco: 'B' },
    'demandas_gerais': { name: 'Demandas Gerais', bloco: 'B' }
  };
  
  let totalA = 0, totalB = 0;
  
  for (const [key, val] of Object.entries(answers)) {
    const mapping = dimensionMapping[key.toLowerCase()];
    if (!mapping) continue;
    
    const numVal = parseFloat(val);
    if (mapping.bloco === 'A') totalA += numVal;
    else totalB += numVal;
  }
  
  // Fórmula ERGOS: 0.83 × (soma A + soma B)
  const rawScore = 0.83 * (totalA + totalB);
  const maxTheoretical = 83; // 10 dimensões × 10 pontos × 0.83
  const normalizedGlobal = Math.min(100, Math.round((rawScore / maxTheoretical) * 100));
  
  return {
    global_score: normalizedGlobal,
    blocos: { A: { total: totalA }, B: { total: totalB } },
    calculation_method: "ergos_legacy"
  };
}
```

### 6.4 Cálculo Modern (weighted_radio com pesos)

```typescript
function calculateERGOS_Weighted(answers: Record<string, any>, schema: any[], rules: CalculationRules, thresholds: RiskThresholds) {
  const coefficient = rules.coefficient || 0.83;
  
  // Mapa de questões do schema
  const questionMap = {};
  schema.forEach((item) => { 
    if (item.type === "weighted_radio" && item.id) 
      questionMap[item.id] = item; 
  });

  const dimensionScores = {
    "Pressão de Tempo": { total: 0, count: 0, bloco: "A" },
    "Atenção": { total: 0, count: 0, bloco: "A" },
    // ... outras dimensões
  };

  for (const [qId, answer] of Object.entries(answers)) {
    const q = questionMap[qId];
    if (!q || q.type !== "weighted_radio") continue;
    
    const dimGroup = q.dimension_group;
    if (!dimensionScores[dimGroup]) continue;
    
    // Encontra o peso da opção selecionada
    let weight = 0;
    if (q.options && Array.isArray(q.options)) {
      const opt = q.options.find((o) => o.text === answer);
      if (opt) weight = opt.weight || 0;
    }
    
    dimensionScores[dimGroup].total += weight;
    dimensionScores[dimGroup].count += 1;
  }

  let totalA = 0, totalB = 0;
  for (const [name, data] of Object.entries(dimensionScores)) {
    if (data.bloco === "A") totalA += data.total;
    else totalB += data.total;
  }

  const globalScore = Math.round(coefficient * (totalA + totalB));
  const maxTheoretical = 10 * 3 * 4 * coefficient; // 10 dim × 3 perguntas × peso 4 × 0.83
  const normalizedGlobal = Math.min(100, Math.round((globalScore / maxTheoretical) * 100));
  
  return {
    global_score: normalizedGlobal,
    calculation_method: "ergos_weighted"
  };
}
```

### 6.5 Pesos das Opções (weighted_radio)

| Cor | Peso | Significado |
|-----|------|-------------|
| Verde | 0 | Situação ótima, menor risco |
| Âmbar | 2 | Situação intermediária |
| Rosa/Vermelho | 4 | Pior situação, maior risco |

---

## 7. CÁLCULOS HSE-IT

### 7.1 Fórmula Principal

```
Porcentagem de Estressores por Dimensão = (respostas_estressoras / total_respostas) × 100
```

### 7.2 Dimensões

1. **Demandas** - carga de trabalho, exigências
2. **Relacionamentos** - comportamentos interpessoais
3. **Controle** - autonomia e participação
4. **Apoio Chefia** - suporte dos gestores
5. **Apoio Colegas** - suporte entre pares
6. **Cargo** - clareza de função
7. **Mudanças** - comunicação sobre alterações

### 7.3 Lógica de Inversão

| Dimensão | Lógica | Estressor |
|----------|--------|-----------|
| Demandas | Direta | Respostas 4-5 |
| Relacionamentos | Direta | Respostas 4-5 |
| Controle | Invertida | Respostas 1-2 |
| Apoio Chefia | Invertida | Respostas 1-2 |
| Apoio Colegas | Invertida | Respostas 1-2 |
| Cargo | Invertida | Respostas 1-2 |
| Mudanças | Invertida | Respostas 1-2 |

### 7.4 Cálculo HSE-IT Porcentagem

```typescript
function calculateHSEIT_Percentage(answers: Record<string, any>, schema: any[], rules: CalculationRules, thresholds: RiskThresholds, cargo?: string) {
  const dimConfig = {
    "Demandas": { questions: ["d1","d2","d3","d4","d5","d6","d7","d8"], is_reverse_scored: false },
    "Relacionamentos": { questions: ["r1","r2","r3","r4"], is_reverse_scored: false },
    "Controle": { questions: ["c1","c2","c3","c4","c5","c6"], is_reverse_scored: true },
    "Apoio Chefia": { questions: ["ac1","ac2","ac3","ac4","ac5"], is_reverse_scored: true },
    "Apoio Colegas": { questions: ["acol1","acol2","acol3","acol4"], is_reverse_scored: true },
    "Cargo": { questions: ["cg1","cg2","cg3","cg4","cg5"], is_reverse_scored: true },
    "Mudanças": { questions: ["m1","m2","m3"], is_reverse_scored: true }
  };
  
  const stressorThreshold = { direct: [4, 5], reverse: [1, 2] };

  let totalStressors = 0, totalQuestions = 0;

  for (const [dimName, config] of Object.entries(dimConfig)) {
    let stressorCount = 0, answeredCount = 0;
    
    for (const qId of config.questions) {
      const val = answers[qId];
      if (val === undefined) continue;
      
      const numVal = typeof val === "number" ? val : parseInt(val, 10);
      answeredCount++;
      
      // Verifica se é estressor baseado na lógica de inversão
      const isStressor = config.is_reverse_scored 
        ? stressorThreshold.reverse.includes(numVal)  // 1-2 = estressor
        : stressorThreshold.direct.includes(numVal);   // 4-5 = estressor
      
      if (isStressor) stressorCount++;
    }
    
    const percentage = answeredCount > 0 ? Math.round((stressorCount / answeredCount) * 100) : 0;
    totalStressors += stressorCount;
    totalQuestions += answeredCount;
  }

  const globalPercentage = totalQuestions > 0 ? Math.round((totalStressors / totalQuestions) * 100) : 0;
  
  return {
    global_score: globalPercentage,
    calculation_method: "hseit_percentage"
  };
}
```

---

## 8. CÁLCULO NASA-TLX

### 8.1 Dimensões

1. Demanda Mental
2. Demanda Física
3. Demanda Temporal
4. Performance
5. Esforço
6. Frustração

### 8.2 Fórmula

```typescript
function calculateNASATLX(answers: Record<string, any>, schema: any[], thresholds: RiskThresholds) {
  const dimensionMapping = {
    'mental_demand': 'Demanda Mental',
    'physical_demand': 'Demanda Física',
    'temporal_demand': 'Demanda Temporal',
    'performance': 'Performance',
    'effort': 'Esforço',
    'frustration': 'Frustração'
  };
  
  let total = 0, count = 0;
  
  for (const [key, val] of Object.entries(answers)) {
    const dimName = dimensionMapping[key];
    if (!dimName) continue;
    
    const numVal = typeof val === 'number' ? val : parseFloat(val);
    total += numVal;
    count++;
  }
  
  // Média simples dos 6 sliders (0-100)
  const globalScore = count > 0 ? Math.round(total / count) : 0;
  
  return {
    global_score: globalScore,
    calculation_method: "nasa_tlx"
  };
}
```

---

## 9. FMEA E MATRIZ DE RISCOS

### 9.1 Fórmula NRE

```
NRE = Gravidade (G) × Probabilidade (P) × Capacidade de Detecção (C)
```

### 9.2 Classificação NRE

| Faixa NRE | Classificação |
|-----------|---------------|
| 1-50 | Trivial |
| 51-100 | Tolerável |
| 101-200 | Moderado |
| 201-400 | Substancial |
| 401+ | Intolerável |

### 9.3 Thresholds HSE-IT para Auto-FMEA

```typescript
const HSE_FMEA_THRESHOLDS = {
  demandas: {
    critical: 80,  // >80% estressores = inserir risco
    moderate: 60,
    risk: "Sobrecarga Quantitativa de Trabalho",
    source: "Processo de Trabalho",
    gravity: 4,
    action: "Redistribuição de tarefas e revisão de metas de produção",
    nr: ["NR-17", "ISO 10075-1"]
  },
  relacionamentos: {
    critical: 70,
    moderate: 50,
    risk: "Conflitos Interpessoais no Ambiente de Trabalho",
    source: "Clima Organizacional",
    gravity: 3,
    action: "Programa de mediação de conflitos e comunicação não-violenta",
    nr: ["NR-01", "ISO 45003"]
  },
  controle: {
    critical: 60,  // <60% = baixo controle (invertido)
    moderate: 40,
    risk: "Baixa Autonomia e Controle sobre o Trabalho",
    source: "Organização do Trabalho",
    gravity: 3,
    action: "Implementar participação dos trabalhadores nas decisões operacionais",
    nr: ["NR-17", "ISO 45003"]
  },
  // ... outras dimensões
};
```

### 9.4 Thresholds ERGOS para Auto-FMEA

```typescript
const ERGOS_FMEA_THRESHOLDS = {
  pressao_tempo: {
    critical: 70,  // >70% = risco
    risk: "Pressão Temporal Excessiva",
    source: "Ritmo de Trabalho",
    gravity: 4,
    action: "Revisão de prazos e implementação de pausas psicossociais",
    nr: ["NR-17", "ISO 10075-1"]
  },
  monotonia: {
    critical: 70,
    risk: "Monotonia e Repetitividade",
    source: "Organização do Trabalho",
    gravity: 3,
    action: "Enriquecimento de cargo e variação de tarefas",
    nr: ["NR-17", "ISO 10075-1"]
  },
  isolamento: {
    critical: 70,
    risk: "Isolamento Social no Trabalho",
    source: "Ambiente de Trabalho",
    gravity: 3,
    action: "Promover interações sociais e trabalho colaborativo",
    nr: ["NR-01", "ISO 45003"]
  },
  // ... outras dimensões
};
```

### 9.5 Cross-Validation (ERGOS + NASA-TLX)

```typescript
// Verifica se há convergência entre metodologias
if (submission.respondent_hash) {
  const { data: relatedSubmissions } = await supabase
    .from("submissions")
    .select("*, forms(*), reports(*)")
    .eq("respondent_hash", submission.respondent_hash)
    .neq("id", submission.id);

  for (const related of relatedSubmissions) {
    const relatedScore = related.reports?.dimensions_score?.global_score ?? 0;
    const currentScore = dimensionsScore.global_score ?? avgScore;
    
    // Ambos altos = convergência de risco
    const bothHigh = currentScore > 60 && relatedScore > 60;
    // Ambos baixos = convergência de adequação
    const bothLow = currentScore <= 40 && relatedScore <= 40;
    
    if (bothHigh) {
      convergenceText = `A sobrecarga foi corroborada por dupla verificação metodológica 
        (${formType.toUpperCase()} Score: ${currentScore} e ${relatedType.toUpperCase()} Score: ${relatedScore}), 
        aumentando o grau de certeza do risco identificado.`;
    } else {
      divergenceText = `Observou-se discrepância entre as metodologias. 
        Esta divergência pode indicar necessidade de investigação complementar in loco.`;
    }
  }
}
```

---

## 10. SISTEMA RAG

### 10.1 Pipeline de Processamento

```
Upload → Extração de Texto → Chunking → Embedding → Armazenamento
```

### 10.2 Geração de Embeddings

```typescript
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}
```

### 10.3 Chunking

```typescript
function splitIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);
    
    // Tenta quebrar em limites de sentença
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
      }
    }
    
    chunks.push(chunk.trim());
    start = start + chunk.length - overlap;
  }
  
  return chunks.filter(c => c.length > 50);
}
```

### 10.4 Busca por Similaridade

```typescript
async function searchRAG(supabase: any, agentId: string, query: string, topK: number, apiKey: string): Promise<string> {
  // Gera embedding da query
  const embedding = await generateEmbedding(query, apiKey);
  
  // Busca chunks similares usando pgvector
  const { data: chunks } = await supabase.rpc("search_similar_chunks", {
    query_embedding: `[${embedding.join(",")}]`,
    agent_uuid: agentId,
    match_count: topK
  });

  // Monta contexto
  const context = chunks
    .map((c, i) => `[Documento ${i + 1}]\n${c.content}`)
    .join("\n\n---\n\n");

  return context;
}
```

### 10.5 Função SQL de Busca

```sql
CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector,
  agent_uuid uuid,
  match_count integer DEFAULT 5
) RETURNS TABLE(id uuid, document_id uuid, content text, similarity float)
LANGUAGE plpgsql
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

---

## 11. PROMPTS DE IA

### 11.1 MASTER_PROMPT (Fallback)

```
# SYSTEM ROLE
Você é um Fisioterapeuta Ergonomista Sênior da "HC Consultoria em Ergonomia", 
responsável pela elaboração de laudos AET e avaliação de Riscos Psicossociais 
para empresas do Grupo Amaggi.

# REGRAS DE OURO
1. Use tom técnico, formal, impessoal em Português (BR).
2. Baseie-se estritamente nos dados fornecidos. Não invente riscos.
3. Siga rigorosamente a estrutura JSON solicitada.
4. Cite as normas: NR-01, NR-17, ISO 10075-1, ISO 45003.

# FORMATO DE SAÍDA (JSON)
{
  "risk_level": "baixo" | "medio" | "alto",
  "form_type": "ergos" | "hse_it",
  "total_score": 00.00,
  "dimensions_score": {},
  "analysis_text": "Texto da interpretação...",
  "risk_inventory": [],
  "conclusion": "Texto conclusivo...",
  "recommendations": []
}
```

### 11.2 User Prompt (Construído Dinamicamente)

```typescript
const userPrompt = `# DADOS DO COLABORADOR
- Nome: ${respondentData.nome || "Não informado"}
- Função: ${respondentData.cargo || "Não informado"}
- Setor: ${respondentData.setor || "Não informado"}
- Empresa: Amaggi

# FORMULÁRIO
- Título: ${formTitle}
- Tipo: ${formType}

# RESPOSTAS
${JSON.stringify(answers, null, 2)}

Analise e gere o relatório técnico em JSON.`;
```

---

## 12. FLUXO COMPLETO DE PROCESSAMENTO

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         1. SUBMISSÃO DO FORMULÁRIO                         │
│  PublicFormSubmit → Valida CPF → Aceita LGPD → Insere em submissions      │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         2. ANÁLISE COM IA                                  │
│  Admin clica "Analisar" → analyze-submission edge function                 │
│  ├─ Busca agente ativo para form_type                                     │
│  ├─ Se RAG habilitado, busca contexto na base de conhecimento             │
│  ├─ Chama provedor de IA (Lovable/OpenAI/Anthropic/Google/DeepSeek)       │
│  ├─ Parseia resposta JSON                                                  │
│  └─ Cria registro em reports                                               │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         3. CÁLCULO UNIVERSAL                               │
│  universal-calculator edge function                                        │
│  ├─ Detecta formato (legacy vs modern)                                     │
│  ├─ Aplica fórmula correta (ERGOS/HSE-IT/NASA-TLX)                        │
│  └─ Gera output JSON padronizado                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         4. CÁLCULO FMEA                                    │
│  calculate-fmea edge function                                              │
│  ├─ Extrai scores das dimensões                                            │
│  ├─ Auto-popula matriz de riscos baseado nos thresholds                   │
│  ├─ Calcula G × P × C = NRE                                               │
│  ├─ Verifica cross-validation (ERGOS + NASA-TLX)                          │
│  ├─ Insere em fmea_calculations                                            │
│  └─ Cria suggested_actions                                                 │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         5. REVISÃO HUMANA                                  │
│  ReviewReport interface                                                    │
│  ├─ Edição de dados do respondente                                        │
│  ├─ Edição de análise/conclusão/recomendações                             │
│  ├─ Edição da matriz FMEA                                                  │
│  ├─ Regeneração via IA (por seção)                                        │
│  └─ Recálculo de scores                                                    │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         6. APROVAÇÃO E PDF                                 │
│  ├─ Validação de campos obrigatórios                                      │
│  ├─ Aprovação do relatório                                                 │
│  └─ Geração de PDF (TanguroReportTemplate)                                │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 13. INTERPRETAÇÕES PADRÃO

### 13.1 Classificação NRE (Cliente)

```typescript
export function getNREClassificationClient(nre: number): { label: string; color: string } {
  if (nre <= 1) return { label: "TRIVIAL", color: "bg-green-500" };
  if (nre <= 3) return { label: "TOLERÁVEL", color: "bg-yellow-500" };
  if (nre <= 9) return { label: "MODERADO", color: "bg-orange-500" };
  if (nre <= 18) return { label: "SUBSTANCIAL", color: "bg-red-500" };
  return { label: "INTOLERÁVEL", color: "bg-red-700" };
}
```

### 13.2 Interpretação ERGOS

```typescript
export function getERGOSInterpretation(globalScore: number, cargo: string, riskyDimensions: string[]): string {
  const baseText = globalScore <= 30
    ? `Na função de ${cargo} após aplicação do ERGOS, o resultado total foi de ${globalScore.toFixed(2)} pontos 
       sendo interpretado como condições de trabalho adequadas sem existência de risco em potencial.`
    : globalScore <= 60
    ? `Na função de ${cargo} após aplicação do ERGOS, o resultado total foi de ${globalScore.toFixed(2)} pontos 
       sendo interpretado como condições de trabalho aceitáveis com atenção necessária.`
    : `Na função de ${cargo} após aplicação do ERGOS, o resultado total foi de ${globalScore.toFixed(2)} pontos 
       sendo interpretado como condições de trabalho que necessitam melhorias.`;

  if (riskyDimensions.length > 0) {
    return `${baseText} As dimensões que necessitam atenção são: ${riskyDimensions.join(", ")}.`;
  }
  return baseText;
}
```

### 13.3 Interpretação HSE-IT

```typescript
export function getHSEITInterpretation(cargo: string, dimensions: Array<{ name: string; percentage: number }>): string {
  const stressDimensions = dimensions.filter(d => d.percentage > 0);
  
  if (stressDimensions.length === 0) {
    return `A aplicação do instrumento HSE IT resultou em 0% em todas as dimensões avaliadas 
            indicando ausência de riscos psicossociais identificáveis. As condições psicossociais 
            associadas à função de ${cargo} apresentam-se adequadas.`;
  }
  
  const stressText = stressDimensions.map(d => 
    `${d.percentage}% na dimensão ${d.name.toLowerCase()}`
  ).join(", ");
  
  return `Na aplicação do HSE IT, a função de ${cargo} apresentou resultado com nível de ${stressText}. 
          Este resultado aponta possíveis fatores que podem estar diferentes da capacidade adaptativa esperada.`;
}
```

---

## 📎 ARQUIVOS RELEVANTES

| Arquivo | Propósito |
|---------|-----------|
| `supabase/functions/analyze-submission/index.ts` | Análise inicial com IA |
| `supabase/functions/generate-narrative-report/index.ts` | Regeneração de narrativas |
| `supabase/functions/universal-calculator/index.ts` | Motor de cálculo |
| `supabase/functions/calculate-fmea/index.ts` | Cálculo FMEA automático |
| `supabase/functions/process-document/index.ts` | Pipeline RAG |
| `src/lib/reportInterpretations.ts` | Textos padrão de interpretação |
| `docs/AI_PROMPTS.md` | Documentação detalhada de prompts |

---

*Versão: 1.0 | Dezembro 2024*
*Sistema: HC Consultoria - Ergos AI Platform*
