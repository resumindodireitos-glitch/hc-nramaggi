-- =====================================================
-- FASE 1: CRIAR ESTRUTURA PARA PERGUNTAS COM PESOS
-- =====================================================

-- Tabela para armazenar pesos das opções de resposta (ERGOS)
CREATE TABLE IF NOT EXISTS public.question_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  option_text TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(form_id, question_id, option_text)
);

-- Habilitar RLS
ALTER TABLE public.question_weights ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Anyone can view question_weights" ON public.question_weights
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage question_weights" ON public.question_weights
  FOR ALL USING (is_admin(auth.uid()));

-- =====================================================
-- FASE 2: ATUALIZAR FORMULÁRIO ERGOS COM LÓGICA CORRETA
-- =====================================================

-- Primeiro, vamos atualizar o schema do formulário ERGOS existente
UPDATE public.forms 
SET 
  title = 'Pesquisa de Qualidade de Vida no Trabalho',
  description = 'Avaliação de fatores cognitivos e organizacionais no ambiente de trabalho',
  schema = '[
    {
      "id": "bloco_a_header",
      "type": "header",
      "label": "BLOCO A - FATORES COGNITIVOS"
    },
    {
      "id": "pressao_tempo_header",
      "type": "subheader", 
      "label": "1. Pressão de Tempo"
    },
    {
      "id": "pt_1",
      "type": "weighted_radio",
      "label": "Duração do tempo de pausa em relação à jornada de trabalho:",
      "dimension_group": "Pressão de Tempo",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "< 5% da jornada", "weight": 4},
        {"text": "5 a 15% da jornada", "weight": 2},
        {"text": "> 15% da jornada", "weight": 0}
      ]
    },
    {
      "id": "pt_2",
      "type": "weighted_radio",
      "label": "Possibilidade de parar a máquina/equipamento para atender necessidades pessoais:",
      "dimension_group": "Pressão de Tempo",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Não", "weight": 4},
        {"text": "Sim, com restrições", "weight": 2},
        {"text": "Sim, sem restrições", "weight": 0}
      ]
    },
    {
      "id": "pt_3",
      "type": "weighted_radio",
      "label": "Tempo disponível para realizar a tarefa:",
      "dimension_group": "Pressão de Tempo",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Muito apertado/insuficiente", "weight": 4},
        {"text": "Adequado com alguma pressão", "weight": 2},
        {"text": "Adequado/suficiente", "weight": 0}
      ]
    },
    {
      "id": "atencao_header",
      "type": "subheader",
      "label": "2. Atenção"
    },
    {
      "id": "at_1",
      "type": "weighted_radio",
      "label": "Nível de concentração exigido para executar a tarefa:",
      "dimension_group": "Atenção",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Alto (concentração constante)", "weight": 4},
        {"text": "Médio (concentração intermitente)", "weight": 2},
        {"text": "Baixo (pouca concentração)", "weight": 0}
      ]
    },
    {
      "id": "at_2",
      "type": "weighted_radio",
      "label": "Necessidade de observar detalhes minuciosos:",
      "dimension_group": "Atenção",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Sempre", "weight": 4},
        {"text": "Às vezes", "weight": 2},
        {"text": "Raramente/Nunca", "weight": 0}
      ]
    },
    {
      "id": "at_3",
      "type": "weighted_radio",
      "label": "Interrupções frequentes durante a execução da tarefa:",
      "dimension_group": "Atenção",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Sim, frequentemente", "weight": 4},
        {"text": "Sim, ocasionalmente", "weight": 2},
        {"text": "Não/Raramente", "weight": 0}
      ]
    },
    {
      "id": "complexidade_header",
      "type": "subheader",
      "label": "3. Complexidade"
    },
    {
      "id": "cx_1",
      "type": "weighted_radio",
      "label": "Quantidade de informações a serem processadas simultaneamente:",
      "dimension_group": "Complexidade",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Muitas (sobrecarga)", "weight": 4},
        {"text": "Quantidade moderada", "weight": 2},
        {"text": "Poucas", "weight": 0}
      ]
    },
    {
      "id": "cx_2",
      "type": "weighted_radio",
      "label": "Necessidade de tomar decisões complexas:",
      "dimension_group": "Complexidade",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Frequentemente", "weight": 4},
        {"text": "Às vezes", "weight": 2},
        {"text": "Raramente/Nunca", "weight": 0}
      ]
    },
    {
      "id": "cx_3",
      "type": "weighted_radio",
      "label": "Grau de dificuldade das tarefas executadas:",
      "dimension_group": "Complexidade",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Alto", "weight": 4},
        {"text": "Médio", "weight": 2},
        {"text": "Baixo", "weight": 0}
      ]
    },
    {
      "id": "monotonia_header",
      "type": "subheader",
      "label": "4. Monotonia"
    },
    {
      "id": "mn_1",
      "type": "weighted_radio",
      "label": "Repetitividade das tarefas:",
      "dimension_group": "Monotonia",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Alta (tarefas muito repetitivas)", "weight": 4},
        {"text": "Média", "weight": 2},
        {"text": "Baixa (tarefas variadas)", "weight": 0}
      ]
    },
    {
      "id": "mn_2",
      "type": "weighted_radio",
      "label": "Variabilidade do conteúdo do trabalho:",
      "dimension_group": "Monotonia",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Baixa (sempre igual)", "weight": 4},
        {"text": "Média", "weight": 2},
        {"text": "Alta (bastante variado)", "weight": 0}
      ]
    },
    {
      "id": "mn_3",
      "type": "weighted_radio",
      "label": "Estímulo mental proporcionado pelo trabalho:",
      "dimension_group": "Monotonia",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Baixo (trabalho tedioso)", "weight": 4},
        {"text": "Médio", "weight": 2},
        {"text": "Alto (trabalho estimulante)", "weight": 0}
      ]
    },
    {
      "id": "raciocinio_header",
      "type": "subheader",
      "label": "5. Raciocínio"
    },
    {
      "id": "rc_1",
      "type": "weighted_radio",
      "label": "Necessidade de resolução de problemas:",
      "dimension_group": "Raciocínio",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Frequente e complexa", "weight": 4},
        {"text": "Ocasional", "weight": 2},
        {"text": "Rara/Inexistente", "weight": 0}
      ]
    },
    {
      "id": "rc_2",
      "type": "weighted_radio",
      "label": "Exigência de raciocínio lógico-matemático:",
      "dimension_group": "Raciocínio",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Alta", "weight": 4},
        {"text": "Média", "weight": 2},
        {"text": "Baixa", "weight": 0}
      ]
    },
    {
      "id": "rc_3",
      "type": "weighted_radio",
      "label": "Necessidade de memória de trabalho (lembrar várias informações):",
      "dimension_group": "Raciocínio",
      "bloco": "A",
      "required": true,
      "options": [
        {"text": "Alta", "weight": 4},
        {"text": "Média", "weight": 2},
        {"text": "Baixa", "weight": 0}
      ]
    },
    {
      "id": "bloco_b_header",
      "type": "header",
      "label": "BLOCO B - FATORES ORGANIZACIONAIS"
    },
    {
      "id": "iniciativa_header",
      "type": "subheader",
      "label": "6. Iniciativa"
    },
    {
      "id": "in_1",
      "type": "weighted_radio",
      "label": "Autonomia para decidir como executar o trabalho:",
      "dimension_group": "Iniciativa",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Nenhuma/Muito pouca", "weight": 4},
        {"text": "Parcial", "weight": 2},
        {"text": "Total/Ampla", "weight": 0}
      ]
    },
    {
      "id": "in_2",
      "type": "weighted_radio",
      "label": "Liberdade para organizar o próprio ritmo de trabalho:",
      "dimension_group": "Iniciativa",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Nenhuma", "weight": 4},
        {"text": "Parcial", "weight": 2},
        {"text": "Total", "weight": 0}
      ]
    },
    {
      "id": "in_3",
      "type": "weighted_radio",
      "label": "Possibilidade de tomar iniciativas no trabalho:",
      "dimension_group": "Iniciativa",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Nenhuma", "weight": 4},
        {"text": "Limitada", "weight": 2},
        {"text": "Ampla", "weight": 0}
      ]
    },
    {
      "id": "isolamento_header",
      "type": "subheader",
      "label": "7. Isolamento"
    },
    {
      "id": "is_1",
      "type": "weighted_radio",
      "label": "Contato com colegas durante a jornada de trabalho:",
      "dimension_group": "Isolamento",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Nenhum/Muito raro", "weight": 4},
        {"text": "Ocasional", "weight": 2},
        {"text": "Frequente", "weight": 0}
      ]
    },
    {
      "id": "is_2",
      "type": "weighted_radio",
      "label": "Trabalho realizado de forma isolada:",
      "dimension_group": "Isolamento",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Sim, totalmente isolado", "weight": 4},
        {"text": "Parcialmente isolado", "weight": 2},
        {"text": "Não, trabalho em equipe", "weight": 0}
      ]
    },
    {
      "id": "is_3",
      "type": "weighted_radio",
      "label": "Possibilidade de comunicação durante o trabalho:",
      "dimension_group": "Isolamento",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Nenhuma/Muito restrita", "weight": 4},
        {"text": "Limitada", "weight": 2},
        {"text": "Livre", "weight": 0}
      ]
    },
    {
      "id": "horarios_header",
      "type": "subheader",
      "label": "8. Horários e Turnos"
    },
    {
      "id": "ht_1",
      "type": "weighted_radio",
      "label": "Regime de trabalho em turnos:",
      "dimension_group": "Horários e Turnos",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Sim, turno noturno ou rotativo", "weight": 4},
        {"text": "Turno fixo diurno com horas extras frequentes", "weight": 2},
        {"text": "Turno fixo diurno regular", "weight": 0}
      ]
    },
    {
      "id": "ht_2",
      "type": "weighted_radio",
      "label": "Previsibilidade dos horários de trabalho:",
      "dimension_group": "Horários e Turnos",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Imprevisível", "weight": 4},
        {"text": "Parcialmente previsível", "weight": 2},
        {"text": "Totalmente previsível", "weight": 0}
      ]
    },
    {
      "id": "relacionamentos_header",
      "type": "subheader",
      "label": "9. Relacionamentos"
    },
    {
      "id": "rl_1",
      "type": "weighted_radio",
      "label": "Qualidade do relacionamento com a chefia:",
      "dimension_group": "Relacionamentos",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Ruim/Conflituoso", "weight": 4},
        {"text": "Regular", "weight": 2},
        {"text": "Bom/Colaborativo", "weight": 0}
      ]
    },
    {
      "id": "rl_2",
      "type": "weighted_radio",
      "label": "Qualidade do relacionamento com colegas:",
      "dimension_group": "Relacionamentos",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Ruim/Conflituoso", "weight": 4},
        {"text": "Regular", "weight": 2},
        {"text": "Bom/Colaborativo", "weight": 0}
      ]
    },
    {
      "id": "rl_3",
      "type": "weighted_radio",
      "label": "Reconhecimento pelo trabalho realizado:",
      "dimension_group": "Relacionamentos",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Nenhum", "weight": 4},
        {"text": "Ocasional", "weight": 2},
        {"text": "Frequente", "weight": 0}
      ]
    },
    {
      "id": "demandas_header",
      "type": "subheader",
      "label": "10. Demandas Gerais"
    },
    {
      "id": "dg_1",
      "type": "weighted_radio",
      "label": "Carga de trabalho em relação ao número de funcionários:",
      "dimension_group": "Demandas Gerais",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Excessiva", "weight": 4},
        {"text": "Adequada com picos ocasionais", "weight": 2},
        {"text": "Adequada", "weight": 0}
      ]
    },
    {
      "id": "dg_2",
      "type": "weighted_radio",
      "label": "Clareza das metas e objetivos do trabalho:",
      "dimension_group": "Demandas Gerais",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Pouca/Nenhuma clareza", "weight": 4},
        {"text": "Parcialmente claras", "weight": 2},
        {"text": "Totalmente claras", "weight": 0}
      ]
    },
    {
      "id": "dg_3",
      "type": "weighted_radio",
      "label": "Compatibilidade entre as exigências do trabalho e os recursos disponíveis:",
      "dimension_group": "Demandas Gerais",
      "bloco": "B",
      "required": true,
      "options": [
        {"text": "Incompatível (faltam recursos)", "weight": 4},
        {"text": "Parcialmente compatível", "weight": 2},
        {"text": "Compatível", "weight": 0}
      ]
    }
  ]'::jsonb,
  calculation_rules = '{
    "method": "ergos_weighted",
    "coefficient": 0.83,
    "blocks": {
      "A": {
        "name": "Fatores Cognitivos",
        "dimensions": ["Pressão de Tempo", "Atenção", "Complexidade", "Monotonia", "Raciocínio"]
      },
      "B": {
        "name": "Fatores Organizacionais", 
        "dimensions": ["Iniciativa", "Isolamento", "Horários e Turnos", "Relacionamentos", "Demandas Gerais"]
      }
    },
    "max_score_per_question": 4,
    "questions_per_dimension": 3
  }'::jsonb,
  risk_thresholds = '{
    "levels": [
      {"min": 0, "max": 30, "level": "baixo", "label": "Satisfatório", "color": "green", "description": "Carga mental adequada"},
      {"min": 31, "max": 60, "level": "medio", "label": "Aceitável", "color": "yellow", "description": "Carga mental tolerável, requer atenção"},
      {"min": 61, "max": 100, "level": "alto", "label": "Deve Melhorar", "color": "red", "description": "Carga mental inadequada, intervenção necessária"}
    ],
    "dimension_thresholds": {
      "low": {"max": 4, "status": "Adequado", "color": "green"},
      "medium": {"max": 8, "status": "Atenção", "color": "yellow"},
      "high": {"min": 9, "status": "Crítico", "color": "red"}
    }
  }'::jsonb,
  updated_at = now()
WHERE type = 'ergos';

-- =====================================================
-- FASE 3: ATUALIZAR FORMULÁRIO HSE-IT COM LÓGICA CORRETA
-- =====================================================

UPDATE public.forms 
SET 
  title = 'Pesquisa de Bem-Estar Ocupacional',
  description = 'Avaliação de indicadores de estresse ocupacional baseado no HSE Management Standards',
  schema = '[
    {
      "id": "intro_header",
      "type": "header",
      "label": "INDICADOR DE ESTRESSE OCUPACIONAL"
    },
    {
      "id": "intro_text",
      "type": "info",
      "label": "Por favor, responda às questões a seguir indicando com que frequência cada situação ocorre no seu trabalho. Escala: 1 = Nunca, 2 = Raramente, 3 = Às vezes, 4 = Frequentemente, 5 = Sempre"
    },
    {
      "id": "demandas_header",
      "type": "subheader",
      "label": "DEMANDAS"
    },
    {
      "id": "d1",
      "type": "likert",
      "label": "Tenho que trabalhar muito intensamente",
      "dimension_group": "Demandas",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "d2",
      "type": "likert",
      "label": "Tenho prazos impossíveis de cumprir",
      "dimension_group": "Demandas",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "d3",
      "type": "likert",
      "label": "Tenho que negligenciar algumas tarefas porque tenho muito trabalho",
      "dimension_group": "Demandas",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "d4",
      "type": "likert",
      "label": "Não consigo ter pausas suficientes",
      "dimension_group": "Demandas",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "d5",
      "type": "likert",
      "label": "Sinto-me pressionado a trabalhar longas horas",
      "dimension_group": "Demandas",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "d6",
      "type": "likert",
      "label": "Tenho exigências de trabalho conflitantes",
      "dimension_group": "Demandas",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "d7",
      "type": "likert",
      "label": "Tenho que trabalhar muito rapidamente",
      "dimension_group": "Demandas",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "d8",
      "type": "likert",
      "label": "Minha carga de trabalho é excessiva",
      "dimension_group": "Demandas",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "relacionamentos_header",
      "type": "subheader",
      "label": "RELACIONAMENTOS"
    },
    {
      "id": "r1",
      "type": "likert",
      "label": "Sou alvo de comportamento desrespeitoso ou intimidador no trabalho",
      "dimension_group": "Relacionamentos",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "r2",
      "type": "likert",
      "label": "Existem atritos ou raiva entre os colegas",
      "dimension_group": "Relacionamentos",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "r3",
      "type": "likert",
      "label": "Sou alvo de assédio, sob a forma de palavras ou comportamento ofensivo",
      "dimension_group": "Relacionamentos",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "r4",
      "type": "likert",
      "label": "As relações no trabalho são tensas",
      "dimension_group": "Relacionamentos",
      "is_reverse_scored": false,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "controle_header",
      "type": "subheader",
      "label": "CONTROLE"
    },
    {
      "id": "c1",
      "type": "likert",
      "label": "Posso decidir quando fazer uma pausa",
      "dimension_group": "Controle",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "c2",
      "type": "likert",
      "label": "Tenho voz ativa sobre meu ritmo de trabalho",
      "dimension_group": "Controle",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "c3",
      "type": "likert",
      "label": "Tenho liberdade para decidir como fazer meu trabalho",
      "dimension_group": "Controle",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "c4",
      "type": "likert",
      "label": "Tenho oportunidade de usar minhas habilidades",
      "dimension_group": "Controle",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "c5",
      "type": "likert",
      "label": "Minha opinião sobre o que acontece no trabalho é levada em conta",
      "dimension_group": "Controle",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "c6",
      "type": "likert",
      "label": "Sou consultado sobre mudanças no trabalho",
      "dimension_group": "Controle",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "apoio_chefia_header",
      "type": "subheader",
      "label": "APOIO DA CHEFIA"
    },
    {
      "id": "ac1",
      "type": "likert",
      "label": "Posso contar com o apoio do meu chefe se as coisas ficarem difíceis",
      "dimension_group": "Apoio Chefia",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "ac2",
      "type": "likert",
      "label": "Recebo feedback útil sobre o trabalho que faço",
      "dimension_group": "Apoio Chefia",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "ac3",
      "type": "likert",
      "label": "Posso falar com meu chefe sobre algo que me aborreceu no trabalho",
      "dimension_group": "Apoio Chefia",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "ac4",
      "type": "likert",
      "label": "Meu chefe me encoraja no trabalho",
      "dimension_group": "Apoio Chefia",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "ac5",
      "type": "likert",
      "label": "Sou apoiado em trabalho emocionalmente exigente",
      "dimension_group": "Apoio Chefia",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "apoio_colegas_header",
      "type": "subheader",
      "label": "APOIO DOS COLEGAS"
    },
    {
      "id": "acol1",
      "type": "likert",
      "label": "Posso contar com a ajuda dos meus colegas quando preciso",
      "dimension_group": "Apoio Colegas",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "acol2",
      "type": "likert",
      "label": "Meus colegas demonstram respeito pelo meu trabalho",
      "dimension_group": "Apoio Colegas",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "acol3",
      "type": "likert",
      "label": "Meus colegas estão dispostos a me ouvir sobre problemas no trabalho",
      "dimension_group": "Apoio Colegas",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "acol4",
      "type": "likert",
      "label": "Quando o trabalho fica difícil, meus colegas me ajudam",
      "dimension_group": "Apoio Colegas",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "cargo_header",
      "type": "subheader",
      "label": "CARGO"
    },
    {
      "id": "cg1",
      "type": "likert",
      "label": "Tenho clareza sobre o que se espera de mim no trabalho",
      "dimension_group": "Cargo",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "cg2",
      "type": "likert",
      "label": "Sei como fazer meu trabalho",
      "dimension_group": "Cargo",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "cg3",
      "type": "likert",
      "label": "Tenho clareza sobre meus deveres e responsabilidades",
      "dimension_group": "Cargo",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "cg4",
      "type": "likert",
      "label": "Tenho clareza sobre os objetivos e metas do meu departamento",
      "dimension_group": "Cargo",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "cg5",
      "type": "likert",
      "label": "Entendo como meu trabalho se encaixa nos objetivos gerais da empresa",
      "dimension_group": "Cargo",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "mudancas_header",
      "type": "subheader",
      "label": "MUDANÇAS"
    },
    {
      "id": "m1",
      "type": "likert",
      "label": "A equipe é consultada sobre mudanças no trabalho",
      "dimension_group": "Mudanças",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "m2",
      "type": "likert",
      "label": "Quando há mudanças no trabalho, tenho clareza sobre como funcionarão na prática",
      "dimension_group": "Mudanças",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    },
    {
      "id": "m3",
      "type": "likert",
      "label": "Tenho tempo suficiente para me adaptar às mudanças no trabalho",
      "dimension_group": "Mudanças",
      "is_reverse_scored": true,
      "required": true,
      "options": [
        {"value": 1, "label": "Nunca"},
        {"value": 2, "label": "Raramente"},
        {"value": 3, "label": "Às vezes"},
        {"value": 4, "label": "Frequentemente"},
        {"value": 5, "label": "Sempre"}
      ]
    }
  ]'::jsonb,
  calculation_rules = '{
    "method": "hseit_percentage",
    "dimensions": {
      "Demandas": {"questions": ["d1","d2","d3","d4","d5","d6","d7","d8"], "is_reverse_scored": false},
      "Relacionamentos": {"questions": ["r1","r2","r3","r4"], "is_reverse_scored": false},
      "Controle": {"questions": ["c1","c2","c3","c4","c5","c6"], "is_reverse_scored": true},
      "Apoio Chefia": {"questions": ["ac1","ac2","ac3","ac4","ac5"], "is_reverse_scored": true},
      "Apoio Colegas": {"questions": ["acol1","acol2","acol3","acol4"], "is_reverse_scored": true},
      "Cargo": {"questions": ["cg1","cg2","cg3","cg4","cg5"], "is_reverse_scored": true},
      "Mudanças": {"questions": ["m1","m2","m3"], "is_reverse_scored": true}
    },
    "stressor_threshold": {
      "direct": [4, 5],
      "reverse": [1, 2]
    }
  }'::jsonb,
  risk_thresholds = '{
    "levels": [
      {"min": 0, "max": 25, "level": "baixo", "label": "Satisfatório", "color": "green", "description": "Baixo nível de estresse"},
      {"min": 26, "max": 50, "level": "medio", "label": "Aceitável", "color": "yellow", "description": "Nível moderado de estresse"},
      {"min": 51, "max": 100, "level": "alto", "label": "Deve Melhorar", "color": "red", "description": "Alto nível de estresse"}
    ],
    "dimension_thresholds": {
      "low": {"max": 25, "status": "Adequado", "color": "green"},
      "medium": {"max": 50, "status": "Atenção", "color": "yellow"},
      "high": {"min": 51, "status": "Crítico", "color": "red"}
    }
  }'::jsonb,
  updated_at = now()
WHERE type = 'hse_it';