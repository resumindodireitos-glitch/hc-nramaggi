# Sistema HC Consultoria - Blueprint V3.1
## Integração de Conhecimento e FMEA Automático

---

## NOVIDADES V3.1

### 1. Knowledge Base (Matrizes de Risco)
- **risk_matrix_ergos**: Riscos cognitivos/organizacionais com medidas de controle
- **risk_matrix_hseit**: Riscos psicossociais (7 dimensões HSE UK)
- **risk_matrix_biomecanicos**: Riscos por segmento corporal (CID-10)

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
