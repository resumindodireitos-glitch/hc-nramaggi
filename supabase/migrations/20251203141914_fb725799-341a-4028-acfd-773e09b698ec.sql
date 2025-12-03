-- Add calculation rules and risk thresholds columns to forms table
ALTER TABLE public.forms
ADD COLUMN IF NOT EXISTS calculation_rules JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS risk_thresholds JSONB DEFAULT '{}';

-- Add comment explaining the structure
COMMENT ON COLUMN public.forms.calculation_rules IS 'JSON structure defining how to calculate scores from answers. Supports methods: average_by_dimension, sum_with_coefficient, weighted_sum';
COMMENT ON COLUMN public.forms.risk_thresholds IS 'JSON structure defining risk level classifications based on score ranges';

-- Update existing ERGOS forms with the correct calculation rules
UPDATE public.forms
SET 
  calculation_rules = '{
    "method": "sum_with_coefficient",
    "coefficient": 0.83,
    "output_scale": 100,
    "blocks": {
      "bloco_a": {
        "name": "Bloco A - Psicofisiológico",
        "dimensions": [
          {"id": "pressao_tempo", "name": "Pressão de Tempo", "max_score": 10},
          {"id": "atencao", "name": "Atenção", "max_score": 10},
          {"id": "complexidade", "name": "Complexidade", "max_score": 10},
          {"id": "monotonia", "name": "Monotonia", "max_score": 10},
          {"id": "raciocinio", "name": "Raciocínio", "max_score": 10}
        ]
      },
      "bloco_b": {
        "name": "Bloco B - Organizacional",
        "dimensions": [
          {"id": "iniciativa", "name": "Iniciativa", "max_score": 10},
          {"id": "isolamento", "name": "Isolamento", "max_score": 10},
          {"id": "horarios_turnos", "name": "Horários e Turnos", "max_score": 10},
          {"id": "relacionamentos", "name": "Relacionamentos", "max_score": 10},
          {"id": "demandas_gerais", "name": "Demandas Gerais", "max_score": 10}
        ]
      }
    }
  }'::jsonb,
  risk_thresholds = '{
    "levels": [
      {"max": 30, "label": "Satisfatório", "risk_level": "baixo", "color": "green", "description": "As condições de trabalho são adequadas e não existe nenhum risco em potencial."},
      {"max": 60, "label": "Aceitável", "risk_level": "medio", "color": "yellow", "description": "As condições de trabalho estão dentro dos padrões e segurança aceitáveis internacionalmente. É improvável que afetem a saúde. Reforça-se manter o controle sistemático dessas condições."},
      {"max": 100, "label": "Deve Melhorar", "risk_level": "alto", "color": "red", "description": "São necessárias medidas corretivas para reduzir os riscos e proteger a saúde e qualidade de vida dos trabalhadores."}
    ],
    "dimension_thresholds": [
      {"max": 3, "status": "Adequado", "color": "green"},
      {"max": 6, "status": "Atenção", "color": "yellow"},
      {"max": 10, "status": "Crítico", "color": "red"}
    ]
  }'::jsonb
WHERE type = 'ergos';

-- Update existing HSE-IT forms with the correct calculation rules
UPDATE public.forms
SET 
  calculation_rules = '{
    "method": "average_by_dimension",
    "output_scale": 100,
    "inverted_dimensions": ["demandas", "relacionamentos"],
    "dimensions": [
      {"id": "demandas", "name": "Demandas", "question_ids": ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"], "weight": 1.0, "description": "Carga de trabalho e condições"},
      {"id": "controle", "name": "Controle", "question_ids": ["q9", "q10", "q11", "q12", "q13", "q14"], "weight": 1.0, "description": "Autonomia sobre métodos de trabalho"},
      {"id": "suporte_chefia", "name": "Apoio Gerencial", "question_ids": ["q15", "q16", "q17", "q18", "q19"], "weight": 1.0, "description": "Suporte da liderança"},
      {"id": "suporte_colegas", "name": "Apoio dos Colegas", "question_ids": ["q20", "q21", "q22", "q23"], "weight": 1.0, "description": "Solidariedade entre colegas"},
      {"id": "relacionamentos", "name": "Relacionamentos", "question_ids": ["q24", "q25", "q26", "q27"], "weight": 1.0, "description": "Qualidade das relações interpessoais"},
      {"id": "cargo", "name": "Papel/Cargo", "question_ids": ["q28", "q29", "q30", "q31", "q32"], "weight": 1.0, "description": "Clareza de funções"},
      {"id": "comunicacao_mudancas", "name": "Mudanças Organizacionais", "question_ids": ["q33", "q34", "q35"], "weight": 1.0, "description": "Gestão de mudanças"}
    ]
  }'::jsonb,
  risk_thresholds = '{
    "levels": [
      {"max": 33, "label": "Baixa Probabilidade", "risk_level": "baixo", "color": "green", "description": "Situação sob controle, demandas equilibradas."},
      {"max": 66, "label": "Média Probabilidade", "risk_level": "medio", "color": "yellow", "description": "Indícios de vulnerabilidade. Monitoramento necessário."},
      {"max": 100, "label": "Alta Probabilidade", "risk_level": "alto", "color": "red", "description": "Condições críticas com alto potencial de adoecimento."}
    ],
    "dimension_thresholds": [
      {"max": 33, "status": "Adequado", "color": "green"},
      {"max": 66, "status": "Atenção", "color": "yellow"},
      {"max": 100, "status": "Crítico", "color": "red"}
    ]
  }'::jsonb
WHERE type = 'hse_it';

-- Create FMEA thresholds table reference (NRP = S × P × C)
-- This is stored as a reference for the universal calculator
INSERT INTO public.system_settings (key, value, description, is_secret)
VALUES (
  'FMEA_CLASSIFICATION',
  '{
    "levels": [
      {"max": 1, "label": "Trivial", "color": "green", "action": "Nenhuma ação imediata requerida. Manter práticas preventivas."},
      {"max": 3, "label": "Tolerável", "color": "lightgreen", "action": "Garantir manutenção dos controles existentes e monitorar."},
      {"max": 9, "label": "Moderado", "color": "yellow", "action": "Implantar medidas de controle, pausas, suporte emocional."},
      {"max": 18, "label": "Substancial", "color": "orange", "action": "Intervenção imediata com plano de ação prioritário."},
      {"max": 27, "label": "Intolerável", "color": "red", "action": "Ação corretiva urgente antes de continuar atividades."}
    ]
  }',
  'FMEA risk classification thresholds (NRP = Severidade × Probabilidade × Controle)',
  false
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();