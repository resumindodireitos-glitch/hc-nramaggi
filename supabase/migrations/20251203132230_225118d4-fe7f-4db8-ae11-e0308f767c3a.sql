-- ============================================================
-- KNOWLEDGE BASE V3.1 - Risk Matrix & Action Plans
-- ============================================================

-- 1. RISK MATRIX TABLES (Knowledge Base)
-- ============================================================

-- ERGOS Risk Matrix
CREATE TABLE IF NOT EXISTS public.risk_matrix_ergos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension TEXT NOT NULL,
  perigo TEXT NOT NULL,
  fonte_geradora TEXT,
  dano_potencial TEXT,
  medida_controle_sugerida TEXT,
  gravidade_padrao INTEGER DEFAULT 3 CHECK (gravidade_padrao BETWEEN 1 AND 5),
  probabilidade_base INTEGER DEFAULT 3 CHECK (probabilidade_base BETWEEN 1 AND 5),
  nr_referencia TEXT[],
  observacoes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- HSE-IT Risk Matrix
CREATE TABLE IF NOT EXISTS public.risk_matrix_hseit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension TEXT NOT NULL,
  perigo TEXT NOT NULL,
  fonte_geradora TEXT,
  dano_potencial TEXT,
  medida_controle_sugerida TEXT,
  gravidade_padrao INTEGER DEFAULT 3 CHECK (gravidade_padrao BETWEEN 1 AND 5),
  probabilidade_base INTEGER DEFAULT 3 CHECK (probabilidade_base BETWEEN 1 AND 5),
  nr_referencia TEXT[],
  benchmark_hse NUMERIC(5,2),
  observacoes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Biomechanical Risk Matrix
CREATE TABLE IF NOT EXISTS public.risk_matrix_biomecanicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento_corporal TEXT NOT NULL,
  perigo TEXT NOT NULL,
  fonte_geradora TEXT,
  dano_potencial TEXT,
  medida_controle_sugerida TEXT,
  gravidade_padrao INTEGER DEFAULT 3 CHECK (gravidade_padrao BETWEEN 1 AND 5),
  probabilidade_base INTEGER DEFAULT 3 CHECK (probabilidade_base BETWEEN 1 AND 5),
  nr_referencia TEXT[],
  cid_relacionado TEXT,
  observacoes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on risk matrices
ALTER TABLE public.risk_matrix_ergos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_matrix_hseit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_matrix_biomecanicos ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read risk matrices
CREATE POLICY "Anyone can view risk_matrix_ergos" ON public.risk_matrix_ergos
FOR SELECT USING (true);

CREATE POLICY "Anyone can view risk_matrix_hseit" ON public.risk_matrix_hseit
FOR SELECT USING (true);

CREATE POLICY "Anyone can view risk_matrix_biomecanicos" ON public.risk_matrix_biomecanicos
FOR SELECT USING (true);

-- RLS: Only super_admin can manage
CREATE POLICY "Super admin can manage risk_matrix_ergos" ON public.risk_matrix_ergos
FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can manage risk_matrix_hseit" ON public.risk_matrix_hseit
FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can manage risk_matrix_biomecanicos" ON public.risk_matrix_biomecanicos
FOR ALL USING (is_super_admin(auth.uid()));

-- 2. ACTION PLANS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.suggested_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  risk_detected TEXT NOT NULL,
  dimension TEXT,
  action_title TEXT NOT NULL,
  action_description TEXT,
  priority TEXT DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'critica')),
  nre_score INTEGER,
  nre_classification TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  responsible TEXT,
  due_date DATE,
  nr_referencia TEXT[],
  source_matrix TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.suggested_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage suggested_actions" ON public.suggested_actions
FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their actions" ON public.suggested_actions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    JOIN public.submissions s ON r.submission_id = s.id
    WHERE r.id = suggested_actions.report_id
    AND (s.respondent_data->>'user_id')::text = auth.uid()::text
  )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_suggested_actions_report ON public.suggested_actions(report_id);
CREATE INDEX IF NOT EXISTS idx_suggested_actions_status ON public.suggested_actions(status);

-- 3. FMEA CALCULATION RESULTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fmea_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE UNIQUE,
  gravidade INTEGER NOT NULL CHECK (gravidade BETWEEN 1 AND 5),
  probabilidade INTEGER NOT NULL CHECK (probabilidade BETWEEN 1 AND 5),
  capacidade_deteccao INTEGER NOT NULL DEFAULT 1 CHECK (capacidade_deteccao BETWEEN 1 AND 5),
  nre_score INTEGER GENERATED ALWAYS AS (gravidade * probabilidade * capacidade_deteccao) STORED,
  nre_classification TEXT,
  dimension_scores JSONB,
  requires_manual_review BOOLEAN DEFAULT false,
  review_reason TEXT,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fmea_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fmea_calculations" ON public.fmea_calculations
FOR ALL USING (is_admin(auth.uid()));

-- 4. HELPER FUNCTION: Calculate NRE Classification
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_nre_classification(nre INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE
    WHEN nre <= 50 THEN 'Trivial'
    WHEN nre <= 100 THEN 'Tolerável'
    WHEN nre <= 200 THEN 'Moderado'
    WHEN nre <= 400 THEN 'Substancial'
    ELSE 'Intolerável'
  END;
END;
$$;

-- 5. SEED DATA: Initial Risk Matrix (ERGOS)
-- ============================================================

INSERT INTO public.risk_matrix_ergos (dimension, perigo, fonte_geradora, dano_potencial, medida_controle_sugerida, gravidade_padrao, nr_referencia) VALUES
-- Dimensão: Carga Cognitiva
('Carga Cognitiva', 'Sobrecarga mental', 'Múltiplas tarefas simultâneas', 'Fadiga mental, erros, estresse', 'Redesenho de tarefas, pausas programadas', 4, ARRAY['NR-17', 'ISO 10075-1']),
('Carga Cognitiva', 'Pressão temporal', 'Prazos curtos, metas agressivas', 'Ansiedade, burnout', 'Revisão de metas, gestão de tempo', 4, ARRAY['NR-17', 'ISO 45003']),
('Carga Cognitiva', 'Monotonia', 'Tarefas repetitivas sem variação', 'Desatenção, acidentes', 'Rodízio de tarefas, enriquecimento de cargo', 3, ARRAY['NR-17']),
-- Dimensão: Organização do Trabalho
('Organização do Trabalho', 'Falta de autonomia', 'Controle excessivo, microgerenciamento', 'Desmotivação, estresse', 'Empoderamento, delegação', 3, ARRAY['ISO 45003']),
('Organização do Trabalho', 'Comunicação deficiente', 'Falta de feedback, ruídos', 'Conflitos, retrabalho', 'Canais claros, reuniões periódicas', 3, ARRAY['NR-01']),
('Organização do Trabalho', 'Jornadas excessivas', 'Horas extras frequentes', 'Fadiga crônica, acidentes', 'Controle de jornada, banco de horas', 5, ARRAY['NR-17', 'CLT']),
-- Dimensão: Ambiente Físico
('Ambiente Físico', 'Ruído excessivo', 'Máquinas, equipamentos', 'Perda auditiva, estresse', 'EPI, isolamento acústico', 4, ARRAY['NR-15', 'NR-17']),
('Ambiente Físico', 'Iluminação inadequada', 'Lâmpadas insuficientes/excesso', 'Fadiga visual, cefaleia', 'Adequação lumínica conforme NBR', 3, ARRAY['NR-17', 'NBR 5413']),
('Ambiente Físico', 'Temperatura extrema', 'Falta de climatização', 'Desconforto, queda produtividade', 'Climatização, pausas térmicas', 3, ARRAY['NR-17'])
ON CONFLICT DO NOTHING;

-- 6. SEED DATA: Initial Risk Matrix (HSE-IT)
-- ============================================================

INSERT INTO public.risk_matrix_hseit (dimension, perigo, fonte_geradora, dano_potencial, medida_controle_sugerida, gravidade_padrao, benchmark_hse, nr_referencia) VALUES
('Demandas', 'Alta demanda de trabalho', 'Volume excessivo, prazos', 'Estresse, burnout', 'Redistribuição de carga, priorização', 4, 65.0, ARRAY['ISO 45003']),
('Demandas', 'Demandas emocionais', 'Atendimento ao público, conflitos', 'Exaustão emocional', 'Suporte psicológico, treinamento', 4, 60.0, ARRAY['ISO 45003']),
('Controle', 'Baixa autonomia', 'Decisões centralizadas', 'Desmotivação, frustração', 'Participação em decisões', 3, 70.0, ARRAY['ISO 45003']),
('Controle', 'Falta de flexibilidade', 'Horários rígidos', 'Conflito trabalho-vida', 'Flexibilização de horários', 3, 65.0, ARRAY['ISO 45003']),
('Apoio Chefia', 'Suporte inadequado', 'Liderança ausente', 'Isolamento, baixo desempenho', 'Treinamento de líderes', 4, 75.0, ARRAY['ISO 45003']),
('Apoio Colegas', 'Clima organizacional ruim', 'Competição excessiva', 'Conflitos, rotatividade', 'Team building, mediação', 3, 72.0, ARRAY['ISO 45003']),
('Relacionamentos', 'Assédio moral', 'Comportamentos abusivos', 'Trauma, afastamento', 'Canal de denúncias, política zero tolerância', 5, 85.0, ARRAY['ISO 45003', 'CLT']),
('Cargo', 'Ambiguidade de papel', 'Responsabilidades indefinidas', 'Conflito de papéis, estresse', 'Descrição clara de cargos', 3, 78.0, ARRAY['ISO 45003']),
('Mudanças', 'Gestão de mudanças ruim', 'Mudanças sem comunicação', 'Resistência, ansiedade', 'Comunicação prévia, participação', 3, 65.0, ARRAY['ISO 45003'])
ON CONFLICT DO NOTHING;

-- 7. SEED DATA: Biomechanical Risk Matrix
-- ============================================================

INSERT INTO public.risk_matrix_biomecanicos (segmento_corporal, perigo, fonte_geradora, dano_potencial, medida_controle_sugerida, gravidade_padrao, cid_relacionado, nr_referencia) VALUES
('Coluna Lombar', 'Levantamento de peso', 'Cargas acima de 23kg', 'Lombalgia, hérnia de disco', 'Mecanização, treinamento postural', 5, 'M54.5', ARRAY['NR-17']),
('Coluna Lombar', 'Postura sentada prolongada', 'Cadeira inadequada, monitor baixo', 'Dor lombar crônica', 'Mobiliário ergonômico, pausas', 4, 'M54.5', ARRAY['NR-17']),
('Membros Superiores', 'Movimentos repetitivos', 'Digitação, operação de máquinas', 'LER/DORT, tendinite', 'Pausas, rodízio, fisioterapia', 4, 'M65', ARRAY['NR-17']),
('Membros Superiores', 'Esforço excessivo', 'Ferramentas pesadas', 'Epicondilite, bursite', 'Ferramentas ergonômicas, EPI', 4, 'M77.1', ARRAY['NR-17']),
('Pescoço', 'Flexão cervical prolongada', 'Tela baixa, leitura de documentos', 'Cervicalgia, cefaleia tensional', 'Suporte de monitor, porta-documentos', 3, 'M54.2', ARRAY['NR-17']),
('Membros Inferiores', 'Postura em pé prolongada', 'Trabalho em linha de produção', 'Varizes, fadiga', 'Tapete anti-fadiga, pausas sentado', 3, 'I83', ARRAY['NR-17'])
ON CONFLICT DO NOTHING;