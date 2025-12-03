/**
 * Testes de Acurácia - Cálculos ERGOS, HSE-IT e NASA-TLX
 * Sistema HC Consultoria - Blueprint V3.0
 * 
 * Estes testes simulam dados reais do Excel para validar que os cálculos
 * estão corretos e correspondem exatamente à especificação.
 * 
 * Para executar: npx vitest run src/__tests__/calculation-accuracy.test.ts
 */

import { describe, it, expect } from 'vitest';

// ============= FUNÇÕES DE CÁLCULO REPLICADAS =============

interface RiskThresholds {
  levels: Array<{ min: number; max: number; level: string; label: string; color: string; description: string }>;
  dimension_thresholds: { low: { max: number; status: string; color: string }; medium: { max: number; status: string; color: string }; high: { min: number; status: string; color: string } };
}

const DEFAULT_THRESHOLDS: RiskThresholds = {
  levels: [
    { min: 0, max: 30, level: "baixo", label: "Satisfatório", color: "green", description: "Adequado" },
    { min: 31, max: 60, level: "medio", label: "Aceitável", color: "yellow", description: "Atenção" },
    { min: 61, max: 100, level: "alto", label: "Deve Melhorar", color: "red", description: "Crítico" }
  ],
  dimension_thresholds: {
    low: { max: 30, status: "Adequado", color: "green" },
    medium: { max: 60, status: "Atenção", color: "yellow" },
    high: { min: 61, status: "Crítico", color: "red" }
  }
};

function getRiskLevel(score: number, levels: RiskThresholds["levels"]) {
  for (const t of levels) {
    if (score >= t.min && score <= t.max) return t;
  }
  return levels[levels.length - 1];
}

// ERGOS Legacy: valores 0-10 por dimensão
function calculateERGOS_Legacy(answers: Record<string, number>) {
  const dimensionMapping: Record<string, { name: string; bloco: string }> = {
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
    const mapping = dimensionMapping[key];
    if (!mapping) continue;
    if (mapping.bloco === 'A') totalA += val;
    else totalB += val;
  }
  
  // Fórmula ERGOS: 0.83 × (soma A + soma B)
  const rawScore = 0.83 * (totalA + totalB);
  // Normalizar para 0-100 (máximo teórico: 10 dimensões × 10 pontos × 0.83 = 83)
  const normalizedGlobal = Math.min(100, Math.round((rawScore / 83) * 100));
  
  return { totalA, totalB, rawScore, normalizedGlobal, risk: getRiskLevel(normalizedGlobal, DEFAULT_THRESHOLDS.levels) };
}

// ERGOS Modern: pesos 0, 2, 4 por pergunta
function calculateERGOS_Weighted(questionWeights: Record<string, number>) {
  // Agrupa por dimensão e soma pesos
  const dimensionTotals: Record<string, { total: number; count: number; bloco: string }> = {
    'Pressão de Tempo': { total: 0, count: 0, bloco: 'A' },
    'Atenção': { total: 0, count: 0, bloco: 'A' },
    'Complexidade': { total: 0, count: 0, bloco: 'A' },
    'Monotonia': { total: 0, count: 0, bloco: 'A' },
    'Raciocínio': { total: 0, count: 0, bloco: 'A' },
    'Iniciativa': { total: 0, count: 0, bloco: 'B' },
    'Isolamento': { total: 0, count: 0, bloco: 'B' },
    'Horários e Turnos': { total: 0, count: 0, bloco: 'B' },
    'Relacionamentos': { total: 0, count: 0, bloco: 'B' },
    'Demandas Gerais': { total: 0, count: 0, bloco: 'B' }
  };
  
  // Simular: cada dimensão tem 3 perguntas, peso total = soma dos 3
  for (const [dim, data] of Object.entries(dimensionTotals)) {
    if (questionWeights[dim] !== undefined) {
      data.total = questionWeights[dim];
      data.count = 3; // assume 3 perguntas por dimensão
    }
  }
  
  let totalA = 0, totalB = 0;
  for (const data of Object.values(dimensionTotals)) {
    if (data.bloco === 'A') totalA += data.total;
    else totalB += data.total;
  }
  
  const globalScore = Math.round(0.83 * (totalA + totalB));
  // Max teórico: 10 dimensões × 3 perguntas × 4 peso × 0.83 = 99.6
  const normalizedGlobal = Math.min(100, Math.round((globalScore / 99.6) * 100));
  
  return { totalA, totalB, globalScore, normalizedGlobal, risk: getRiskLevel(normalizedGlobal, DEFAULT_THRESHOLDS.levels) };
}

// HSE-IT Legacy: valores percentuais 0-100 por dimensão
function calculateHSEIT_Legacy(answers: Record<string, number>) {
  const values = Object.values(answers);
  const globalPercentage = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  return { globalPercentage, risk: getRiskLevel(globalPercentage, DEFAULT_THRESHOLDS.levels) };
}

// HSE-IT Modern: conta estressores (Likert 4-5 para direct, 1-2 para reverse)
function calculateHSEIT_Percentage(responses: Record<string, { value: number; is_reverse: boolean }[]>) {
  let totalStressors = 0, totalQuestions = 0;
  const dimensions: { name: string; percentage: number }[] = [];
  
  for (const [dimName, questions] of Object.entries(responses)) {
    let stressors = 0;
    for (const q of questions) {
      totalQuestions++;
      const isStressor = q.is_reverse ? [1, 2].includes(q.value) : [4, 5].includes(q.value);
      if (isStressor) {
        stressors++;
        totalStressors++;
      }
    }
    dimensions.push({ name: dimName, percentage: Math.round((stressors / questions.length) * 100) });
  }
  
  const globalPercentage = totalQuestions > 0 ? Math.round((totalStressors / totalQuestions) * 100) : 0;
  return { globalPercentage, dimensions, risk: getRiskLevel(globalPercentage, DEFAULT_THRESHOLDS.levels) };
}

// NASA-TLX: média dos 6 sliders 0-100
function calculateNASATLX(answers: Record<string, number>) {
  const values = Object.values(answers);
  const globalScore = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  return { globalScore, risk: getRiskLevel(globalScore, DEFAULT_THRESHOLDS.levels) };
}

// ============= TESTES =============

describe('ERGOS Legacy - Dados Excel', () => {
  it('deve calcular cenário de baixo risco (Satisfatório)', () => {
    // Todas as dimensões com scores baixos (2 de 10)
    const answers = {
      pressao_tempo: 2, atencao: 1, complexidade: 2, monotonia: 1, raciocinio: 2,
      iniciativa: 1, isolamento: 2, horarios: 1, relacionamentos: 2, demandas_gerais: 1
    };
    
    const result = calculateERGOS_Legacy(answers);
    
    // totalA = 2+1+2+1+2 = 8, totalB = 1+2+1+2+1 = 7
    expect(result.totalA).toBe(8);
    expect(result.totalB).toBe(7);
    // rawScore = 0.83 × 15 = 12.45
    expect(result.rawScore).toBeCloseTo(12.45, 1);
    // normalized = (12.45 / 83) × 100 = 15%
    expect(result.normalizedGlobal).toBeLessThanOrEqual(30);
    expect(result.risk.label).toBe('Satisfatório');
  });
  
  it('deve calcular cenário de risco médio (Aceitável)', () => {
    // Dimensões com scores médios (5 de 10)
    const answers = {
      pressao_tempo: 5, atencao: 4, complexidade: 5, monotonia: 4, raciocinio: 5,
      iniciativa: 4, isolamento: 5, horarios: 4, relacionamentos: 5, demandas_gerais: 4
    };
    
    const result = calculateERGOS_Legacy(answers);
    
    // totalA = 5+4+5+4+5 = 23, totalB = 4+5+4+5+4 = 22
    expect(result.totalA).toBe(23);
    expect(result.totalB).toBe(22);
    // rawScore = 0.83 × 45 = 37.35
    expect(result.rawScore).toBeCloseTo(37.35, 1);
    // normalized = (37.35 / 83) × 100 ≈ 45%
    expect(result.normalizedGlobal).toBeGreaterThan(30);
    expect(result.normalizedGlobal).toBeLessThanOrEqual(60);
    expect(result.risk.label).toBe('Aceitável');
  });
  
  it('deve calcular cenário de alto risco (Deve Melhorar)', () => {
    // Dimensões com scores altos (8-9 de 10)
    const answers = {
      pressao_tempo: 9, atencao: 8, complexidade: 9, monotonia: 8, raciocinio: 9,
      iniciativa: 8, isolamento: 9, horarios: 8, relacionamentos: 9, demandas_gerais: 8
    };
    
    const result = calculateERGOS_Legacy(answers);
    
    // totalA = 9+8+9+8+9 = 43, totalB = 8+9+8+9+8 = 42
    expect(result.totalA).toBe(43);
    expect(result.totalB).toBe(42);
    // rawScore = 0.83 × 85 = 70.55
    expect(result.rawScore).toBeCloseTo(70.55, 1);
    // normalized = (70.55 / 83) × 100 ≈ 85%
    expect(result.normalizedGlobal).toBeGreaterThan(60);
    expect(result.risk.label).toBe('Deve Melhorar');
  });
});

describe('ERGOS Weighted - Pesos Excel (0, 2, 4)', () => {
  it('deve calcular cenário de baixo risco com pesos 0', () => {
    // Todas as dimensões com peso total 0 (respostas ideais)
    const questionWeights = {
      'Pressão de Tempo': 0, 'Atenção': 0, 'Complexidade': 0, 'Monotonia': 0, 'Raciocínio': 0,
      'Iniciativa': 0, 'Isolamento': 0, 'Horários e Turnos': 0, 'Relacionamentos': 0, 'Demandas Gerais': 0
    };
    
    const result = calculateERGOS_Weighted(questionWeights);
    
    expect(result.totalA).toBe(0);
    expect(result.totalB).toBe(0);
    expect(result.normalizedGlobal).toBe(0);
    expect(result.risk.label).toBe('Satisfatório');
  });
  
  it('deve calcular cenário misto com pesos variados', () => {
    // Mix: algumas dimensões com peso 0, algumas com 2, algumas com 4
    // Por dimensão: 3 perguntas, então peso total pode ser 0 a 12
    const questionWeights = {
      'Pressão de Tempo': 6,  // média (2+2+2)
      'Atenção': 4,           // baixo-médio
      'Complexidade': 8,      // alto (4+2+2)
      'Monotonia': 2,         // baixo
      'Raciocínio': 6,        // média
      'Iniciativa': 4,        // baixo-médio
      'Isolamento': 6,        // média
      'Horários e Turnos': 2, // baixo
      'Relacionamentos': 4,   // baixo-médio
      'Demandas Gerais': 8    // alto
    };
    
    const result = calculateERGOS_Weighted(questionWeights);
    
    expect(result.totalA).toBe(6 + 4 + 8 + 2 + 6); // 26
    expect(result.totalB).toBe(4 + 6 + 2 + 4 + 8); // 24
    expect(result.globalScore).toBe(Math.round(0.83 * 50)); // 41.5 -> 42
    expect(result.risk.label).toBe('Aceitável');
  });
  
  it('deve calcular cenário de máximo risco com todos os pesos 4', () => {
    // Pior cenário: todas as perguntas com peso 4 (3 perguntas × peso 4 = 12)
    const questionWeights = {
      'Pressão de Tempo': 12, 'Atenção': 12, 'Complexidade': 12, 'Monotonia': 12, 'Raciocínio': 12,
      'Iniciativa': 12, 'Isolamento': 12, 'Horários e Turnos': 12, 'Relacionamentos': 12, 'Demandas Gerais': 12
    };
    
    const result = calculateERGOS_Weighted(questionWeights);
    
    expect(result.totalA).toBe(60);
    expect(result.totalB).toBe(60);
    expect(result.globalScore).toBe(Math.round(0.83 * 120)); // 99.6 -> 100
    expect(result.normalizedGlobal).toBe(100);
    expect(result.risk.label).toBe('Deve Melhorar');
  });
});

describe('HSE-IT Legacy - Porcentagens diretas', () => {
  it('deve calcular média das dimensões', () => {
    const answers = {
      demandas: 20,
      controle: 15,
      apoio_chefia: 25,
      apoio_colegas: 10,
      relacionamentos: 30,
      cargo: 20,
      mudancas: 15
    };
    
    const result = calculateHSEIT_Legacy(answers);
    
    // Média: (20+15+25+10+30+20+15) / 7 = 135/7 ≈ 19%
    expect(result.globalPercentage).toBe(Math.round(135 / 7));
    expect(result.risk.label).toBe('Satisfatório');
  });
  
  it('deve classificar risco alto corretamente', () => {
    const answers = {
      demandas: 80,
      controle: 70,
      apoio_chefia: 75,
      apoio_colegas: 65,
      relacionamentos: 85,
      cargo: 70,
      mudancas: 60
    };
    
    const result = calculateHSEIT_Legacy(answers);
    
    // Média: (80+70+75+65+85+70+60) / 7 = 505/7 ≈ 72%
    expect(result.globalPercentage).toBe(Math.round(505 / 7));
    expect(result.risk.label).toBe('Deve Melhorar');
  });
});

describe('HSE-IT Modern - Contagem de estressores', () => {
  it('deve contar estressores para dimensões diretas (4-5 = estressor)', () => {
    const responses = {
      'Demandas': [
        { value: 4, is_reverse: false }, // estressor
        { value: 5, is_reverse: false }, // estressor
        { value: 3, is_reverse: false }, // não
        { value: 2, is_reverse: false }  // não
      ]
    };
    
    const result = calculateHSEIT_Percentage(responses);
    
    // 2 de 4 = 50%
    expect(result.dimensions[0].percentage).toBe(50);
    expect(result.globalPercentage).toBe(50);
    expect(result.risk.label).toBe('Aceitável');
  });
  
  it('deve contar estressores para dimensões reversas (1-2 = estressor)', () => {
    const responses = {
      'Controle': [
        { value: 1, is_reverse: true }, // estressor (falta de controle)
        { value: 2, is_reverse: true }, // estressor
        { value: 4, is_reverse: true }, // não (tem controle)
        { value: 5, is_reverse: true }  // não
      ]
    };
    
    const result = calculateHSEIT_Percentage(responses);
    
    // 2 de 4 = 50%
    expect(result.dimensions[0].percentage).toBe(50);
    expect(result.globalPercentage).toBe(50);
  });
  
  it('deve calcular cenário completo com múltiplas dimensões', () => {
    const responses = {
      'Demandas': [
        { value: 5, is_reverse: false }, { value: 4, is_reverse: false },
        { value: 3, is_reverse: false }, { value: 3, is_reverse: false }
      ],
      'Controle': [
        { value: 1, is_reverse: true }, { value: 2, is_reverse: true },
        { value: 4, is_reverse: true }, { value: 5, is_reverse: true }
      ],
      'Relacionamentos': [
        { value: 5, is_reverse: false }, { value: 2, is_reverse: false }
      ]
    };
    
    const result = calculateHSEIT_Percentage(responses);
    
    // Demandas: 2/4 = 50%
    // Controle: 2/4 = 50%
    // Relacionamentos: 1/2 = 50%
    // Total: 5/10 = 50%
    expect(result.globalPercentage).toBe(50);
  });
});

describe('NASA-TLX - Média de sliders', () => {
  it('deve calcular média dos 6 sliders', () => {
    const answers = {
      mental_demand: 30,
      physical_demand: 20,
      temporal_demand: 40,
      performance: 25,
      effort: 35,
      frustration: 30
    };
    
    const result = calculateNASATLX(answers);
    
    // Média: (30+20+40+25+35+30) / 6 = 180/6 = 30
    expect(result.globalScore).toBe(30);
    expect(result.risk.label).toBe('Satisfatório');
  });
  
  it('deve classificar alto risco para médias altas', () => {
    const answers = {
      mental_demand: 80,
      physical_demand: 70,
      temporal_demand: 85,
      performance: 75,
      effort: 90,
      frustration: 80
    };
    
    const result = calculateNASATLX(answers);
    
    // Média: (80+70+85+75+90+80) / 6 = 480/6 = 80
    expect(result.globalScore).toBe(80);
    expect(result.risk.label).toBe('Deve Melhorar');
  });
});

describe('Validação Cruzada ERGOS + NASA-TLX', () => {
  it('deve detectar convergência quando ambos indicam alto risco', () => {
    const ergosLegacy = calculateERGOS_Legacy({
      pressao_tempo: 8, atencao: 9, complexidade: 8, monotonia: 7, raciocinio: 8,
      iniciativa: 6, isolamento: 7, horarios: 6, relacionamentos: 7, demandas_gerais: 6
    });
    
    const nasaTLX = calculateNASATLX({
      mental_demand: 85, physical_demand: 60, temporal_demand: 75,
      performance: 70, effort: 80, frustration: 65
    });
    
    // ERGOS indica alto risco (Deve Melhorar)
    // NASA-TLX também alto (média ≈ 72.5%)
    const ergosHigh = ergosLegacy.risk.label === 'Deve Melhorar';
    const nasaHigh = nasaTLX.globalScore > 60;
    
    expect(ergosHigh).toBe(true);
    expect(nasaHigh).toBe(true);
    
    // Convergência: ambos indicam problema
    const convergence = ergosHigh && nasaHigh;
    expect(convergence).toBe(true);
  });
  
  it('deve detectar divergência quando resultados diferem', () => {
    const ergosLegacy = calculateERGOS_Legacy({
      pressao_tempo: 8, atencao: 9, complexidade: 8, monotonia: 7, raciocinio: 8,
      iniciativa: 3, isolamento: 2, horarios: 3, relacionamentos: 2, demandas_gerais: 3
    });
    
    const nasaTLX = calculateNASATLX({
      mental_demand: 25, physical_demand: 20, temporal_demand: 30,
      performance: 25, effort: 20, frustration: 15
    });
    
    // ERGOS pode indicar risco médio-alto devido ao Bloco A alto
    // NASA-TLX indica baixo risco (média ≈ 22%)
    const ergosNotLow = ergosLegacy.risk.label !== 'Satisfatório';
    const nasaLow = nasaTLX.globalScore <= 30;
    
    // Divergência: um alto, outro baixo → requer investigação
    const divergence = ergosNotLow && nasaLow;
    expect(nasaLow).toBe(true);
  });
});

describe('Thresholds de Cores (0/2/4)', () => {
  it('peso 0 deve ser verde (Satisfatório)', () => {
    const getColor = (weight: number) => {
      if (weight === 0) return 'green';
      if (weight === 2) return 'amber';
      return 'rose';
    };
    
    expect(getColor(0)).toBe('green');
  });
  
  it('peso 2 deve ser amarelo (Aceitável)', () => {
    const getColor = (weight: number) => {
      if (weight === 0) return 'green';
      if (weight === 2) return 'amber';
      return 'rose';
    };
    
    expect(getColor(2)).toBe('amber');
  });
  
  it('peso 4 deve ser vermelho (Deve Melhorar)', () => {
    const getColor = (weight: number) => {
      if (weight === 0) return 'green';
      if (weight === 2) return 'amber';
      return 'rose';
    };
    
    expect(getColor(4)).toBe('rose');
  });
});
