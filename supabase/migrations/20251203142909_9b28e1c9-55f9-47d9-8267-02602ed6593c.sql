-- Adicionar campos específicos do padrão Tanguro
ALTER TABLE farms 
ADD COLUMN IF NOT EXISTS cnae TEXT DEFAULT '01.15-6-00',
ADD COLUMN IF NOT EXISTS risk_degree INT DEFAULT 3;

ALTER TABLE job_roles
ADD COLUMN IF NOT EXISTS cbo_description TEXT,
ADD COLUMN IF NOT EXISTS environment_desc TEXT;

-- Tabela de Matriz de Risco Tanguro (FMEA específico)
CREATE TABLE IF NOT EXISTS tanguro_risk_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_factor TEXT NOT NULL,
    source TEXT,
    severity_g INT DEFAULT 3 CHECK (severity_g BETWEEN 1 AND 5),
    probability_p INT DEFAULT 3 CHECK (probability_p BETWEEN 1 AND 5),
    detection_d INT DEFAULT 3 CHECK (detection_d BETWEEN 1 AND 5),
    suggested_action TEXT,
    dimension TEXT,
    nr_referencia TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE tanguro_risk_matrix ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view tanguro_risk_matrix" ON tanguro_risk_matrix FOR SELECT USING (true);
CREATE POLICY "Super admin can manage tanguro_risk_matrix" ON tanguro_risk_matrix FOR ALL USING (is_super_admin(auth.uid()));

-- Seed initial Tanguro risk factors
INSERT INTO tanguro_risk_matrix (risk_factor, source, severity_g, probability_p, detection_d, suggested_action, dimension, nr_referencia) VALUES
('Sobrecarga Mental', 'Ritmo de trabalho imposto, múltiplas tarefas simultâneas', 4, 3, 3, 'Pausas psicossociais programadas, redistribuição de tarefas', 'pressao_tempo', ARRAY['NR-17', 'ISO 10075-1']),
('Monotonia', 'Tarefas repetitivas sem variação', 3, 3, 2, 'Rodízio de tarefas, enriquecimento do cargo', 'monotonia', ARRAY['NR-17']),
('Alta Demanda Cognitiva', 'Necessidade constante de atenção e concentração', 4, 3, 3, 'Pausas regulares, ambiente adequado', 'atencao', ARRAY['NR-17', 'ISO 10075-1']),
('Complexidade Excessiva', 'Tarefas que exigem raciocínio complexo contínuo', 3, 3, 3, 'Treinamento adequado, suporte técnico', 'complexidade', ARRAY['NR-17']),
('Isolamento Social', 'Trabalho solitário, falta de interação', 3, 3, 2, 'Atividades em grupo, comunicação regular', 'isolamento', ARRAY['NR-17', 'ISO 45003']),
('Conflitos Interpessoais', 'Relacionamentos difíceis no ambiente de trabalho', 4, 3, 2, 'Mediação, treinamento em comunicação', 'relacionamentos', ARRAY['NR-17', 'ISO 45003']),
('Jornada Inadequada', 'Horários irregulares, turnos noturnos', 4, 3, 3, 'Adequação de escalas, respeito aos intervalos', 'horarios_turnos', ARRAY['NR-17', 'CLT']),
('Falta de Autonomia', 'Baixo controle sobre métodos de trabalho', 3, 3, 2, 'Empoderamento, participação nas decisões', 'iniciativa', ARRAY['NR-17', 'ISO 45003']),
('Demandas Excessivas', 'Carga de trabalho acima da capacidade', 4, 4, 3, 'Dimensionamento adequado da equipe', 'demandas_gerais', ARRAY['NR-17', 'ISO 10075-1'])
ON CONFLICT DO NOTHING;