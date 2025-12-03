# Sistema HC Consultoria - Blueprint V3.2
## Integração de Conhecimento, FMEA Automático e Motor de Cálculo Universal

---

## NOVIDADES V3.2

### 1. Motor de Cálculo Universal (Metadata-Driven)
- **Edge function `universal-calculator`**: Calcula scores de qualquer formulário usando regras armazenadas no banco
- **Colunas `calculation_rules` e `risk_thresholds`** na tabela `forms`: Armazenam fórmulas e limiares
- **Métodos suportados**:
  - `sum_with_coefficient`: ERGOS (0.83 × (A + B))
  - `average_by_dimension`: HSE-IT (média percentual por dimensão)
  - `weighted_sum`: NASA-TLX (soma ponderada)
- **Output padronizado**: Todos os formulários geram JSON com a mesma estrutura

### 2. Output JSON Padronizado
```json
{
  "global_score": 75,
  "risk_level": "medio",
  "risk_label": "Aceitável",
  "risk_color": "yellow",
  "dimensions": [
    {"name": "Atenção", "score": 7, "normalized_score": 70, "status": "Atenção", "color": "yellow"}
  ]
}
```

### 3. Componente Universal de Gráficos
- `UniversalScoreChart`: Renderiza gráficos para QUALQUER tipo de formulário
- Lê apenas o JSON padronizado, não faz `if (type == 'ergos')`
- Suporta Radar, Barras e visualização por blocos

### 2. Cálculo FMEA Automático
- Edge function `calculate-fmea` 
- NRE = Gravidade × Probabilidade × Detecção
- Classificação: Trivial → Intolerável
- Detecção de inconsistências com flag `requires_manual_review`

### 3. Planos de Ação Sugeridos
- Tabela `suggested_actions` vinculada ao relatório
- Prioridade automática baseada no NRE
- Referências normativas (NR-01, NR-17, ISO 45003)

### 4. Dashboard de Riscos Agregados
- `/admin/risk-matrix` - Visão consolidada por cargo
- Respeita LGPD (sem dados individuais)
- Filtros por tipo de formulário e setor

### 5. LGPD Compliance Completo
- Modal de consentimento bloqueante
- consent_logs imutável
- Direito ao esquecimento e portabilidade
- Anonimização automática após 5 anos

---

## FLUXO DE DADOS

```
Submissão → Análise IA → FMEA Automático → Ações Sugeridas → Relatório
```

## TABELAS NOVAS

| Tabela | Propósito |
|--------|-----------|
| risk_matrix_ergos | Base de conhecimento ERGOS |
| risk_matrix_hseit | Base de conhecimento HSE-IT |
| risk_matrix_biomecanicos | Riscos biomecânicos |
| fmea_calculations | Resultados FMEA |
| suggested_actions | Planos de ação |
| consent_logs | Registros LGPD |

## EDGE FUNCTIONS

| Função | Propósito |
|--------|-----------|
| calculate-fmea | Cálculo FMEA determinístico |
| analyze-submission | Análise IA + RAG |
| generate-pdf | Relatório PDF |

---

*Versão: 3.1 | Dezembro 2024*
