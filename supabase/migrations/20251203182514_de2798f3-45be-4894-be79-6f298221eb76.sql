-- NASA-TLX Form for Cross-Validation with ERGOS
-- This form measures subjective workload across 6 dimensions

INSERT INTO public.forms (
  id,
  title,
  description,
  type,
  is_active,
  schema,
  calculation_rules,
  risk_thresholds
) VALUES (
  gen_random_uuid(),
  'NASA-TLX - Avaliação de Carga de Trabalho',
  'O NASA Task Load Index (NASA-TLX) é uma ferramenta de avaliação subjetiva da carga de trabalho desenvolvida pela NASA. Avalia 6 dimensões: Demanda Mental, Demanda Física, Demanda Temporal, Performance, Esforço e Frustração.',
  'ergos',
  true,
  '[
    {
      "id": "nasa_info",
      "type": "info",
      "label": "Instruções NASA-TLX",
      "description": "Para cada dimensão abaixo, indique o nível que melhor representa sua experiência de trabalho. Use a escala de 0 (muito baixo) a 100 (muito alto)."
    },
    {
      "id": "nasa_mental_demand",
      "type": "slider",
      "label": "Demanda Mental",
      "description": "Quanto de atividade mental e perceptiva foi requerido (pensar, decidir, calcular, lembrar, observar, procurar)? A tarefa foi fácil ou exigente, simples ou complexa?",
      "required": true,
      "min": 0,
      "max": 100,
      "dimension_group": "Demanda Mental"
    },
    {
      "id": "nasa_physical_demand",
      "type": "slider",
      "label": "Demanda Física",
      "description": "Quanto de atividade física foi requerida (empurrar, puxar, controlar, ativar)? A tarefa foi fácil ou exigente, lenta ou rápida, descansada ou árdua?",
      "required": true,
      "min": 0,
      "max": 100,
      "dimension_group": "Demanda Física"
    },
    {
      "id": "nasa_temporal_demand",
      "type": "slider",
      "label": "Demanda Temporal",
      "description": "Quanta pressão de tempo você sentiu devido ao ritmo em que as tarefas ou elementos da tarefa ocorreram? O ritmo foi lento e tranquilo ou rápido e frenético?",
      "required": true,
      "min": 0,
      "max": 100,
      "dimension_group": "Demanda Temporal"
    },
    {
      "id": "nasa_performance",
      "type": "slider",
      "label": "Performance (Auto-avaliação)",
      "description": "Quão bem sucedido você foi em realizar o que foi solicitado? Quão satisfeito você está com seu desempenho ao realizar essas tarefas?",
      "required": true,
      "min": 0,
      "max": 100,
      "dimension_group": "Performance"
    },
    {
      "id": "nasa_effort",
      "type": "slider",
      "label": "Esforço",
      "description": "Quanto você teve que trabalhar (mentalmente e fisicamente) para atingir seu nível de desempenho?",
      "required": true,
      "min": 0,
      "max": 100,
      "dimension_group": "Esforço"
    },
    {
      "id": "nasa_frustration",
      "type": "slider",
      "label": "Frustração",
      "description": "Quão inseguro, desencorajado, irritado, estressado e incomodado versus seguro, gratificado, satisfeito, relaxado e complacente você se sentiu durante a tarefa?",
      "required": true,
      "min": 0,
      "max": 100,
      "dimension_group": "Frustração"
    }
  ]'::jsonb,
  '{
    "method": "average_by_dimension",
    "dimensions": [
      {"name": "Demanda Mental", "question_ids": ["nasa_mental_demand"], "weight": 1},
      {"name": "Demanda Física", "question_ids": ["nasa_physical_demand"], "weight": 1},
      {"name": "Demanda Temporal", "question_ids": ["nasa_temporal_demand"], "weight": 1},
      {"name": "Performance", "question_ids": ["nasa_performance"], "weight": 1, "inverted": true},
      {"name": "Esforço", "question_ids": ["nasa_effort"], "weight": 1},
      {"name": "Frustração", "question_ids": ["nasa_frustration"], "weight": 1}
    ],
    "global_calculation": "average"
  }'::jsonb,
  '{
    "levels": [
      {"min": 0, "max": 30, "level": "low", "label": "Satisfatório", "color": "green", "description": "Carga de trabalho adequada"},
      {"min": 31, "max": 60, "level": "medium", "label": "Aceitável", "color": "yellow", "description": "Carga de trabalho moderada, requer atenção"},
      {"min": 61, "max": 100, "level": "high", "label": "Deve Melhorar", "color": "red", "description": "Carga de trabalho elevada, requer intervenção"}
    ],
    "dimension_thresholds": {
      "low": {"min": 0, "max": 30},
      "medium": {"min": 31, "max": 60},
      "high": {"min": 61, "max": 100}
    }
  }'::jsonb
);