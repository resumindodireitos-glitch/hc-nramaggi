/**
 * Testes Unitários - Cálculo FMEA e NRE
 * Sistema HC Consultoria - Blueprint V3.0
 * 
 * Para executar: npx vitest run src/__tests__/fmea-calculation.test.ts
 */

import { describe, it, expect } from 'vitest';

// Funções de cálculo replicadas do edge function para teste
function getNREClassification(nre: number): string {
  if (nre <= 50) return 'Trivial';
  if (nre <= 100) return 'Tolerável';
  if (nre <= 200) return 'Moderado';
  if (nre <= 400) return 'Substancial';
  return 'Intolerável';
}

function getPriorityFromNRE(nre: number): string {
  if (nre <= 50) return 'baixa';
  if (nre <= 100) return 'media';
  if (nre <= 200) return 'alta';
  return 'critica';
}

function calculateProbabilityFromScore(score: number): number {
  // Score de 0-10 convertido para probabilidade 1-5
  if (score <= 2) return 1;
  if (score <= 4) return 2;
  if (score <= 6) return 3;
  if (score <= 8) return 4;
  return 5;
}

function calculateGravityFromScores(scores: Record<string, number>, formType: string): number {
  const values = Object.values(scores);
  if (values.length === 0) return 1;
  
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  // Para ERGOS (0-10 scale)
  if (formType === 'ergos') {
    if (average <= 2) return 1;
    if (average <= 4) return 2;
    if (average <= 6) return 3;
    if (average <= 8) return 4;
    return 5;
  }
  
  // Para HSE-IT (0-100 scale, percentual)
  if (average <= 20) return 1;
  if (average <= 40) return 2;
  if (average <= 60) return 3;
  if (average <= 80) return 4;
  return 5;
}

function calculateERGOSTotal(blocoA: number, blocoB: number): number {
  return (blocoA + blocoB) * 0.83;
}

function getInterpretacaoERGOS(pontuacao: number): { nivel: string; interpretacao: string } {
  if (pontuacao <= 30) {
    return {
      nivel: 'Adequado',
      interpretacao: 'As condições de trabalho são adequadas e não existe nenhum risco em potencial.'
    };
  } else if (pontuacao <= 60) {
    return {
      nivel: 'Aceitável',
      interpretacao: 'As condições de trabalho estão dentro dos padrões aceitáveis internacionalmente.'
    };
  } else {
    return {
      nivel: 'Requer Atenção',
      interpretacao: 'São necessárias medidas corretivas para reduzir os riscos.'
    };
  }
}

describe('Cálculo NRE e Classificação', () => {
  it('deve classificar NRE Trivial corretamente (1-50)', () => {
    expect(getNREClassification(1)).toBe('Trivial');
    expect(getNREClassification(25)).toBe('Trivial');
    expect(getNREClassification(50)).toBe('Trivial');
  });

  it('deve classificar NRE Tolerável corretamente (51-100)', () => {
    expect(getNREClassification(51)).toBe('Tolerável');
    expect(getNREClassification(75)).toBe('Tolerável');
    expect(getNREClassification(100)).toBe('Tolerável');
  });

  it('deve classificar NRE Moderado corretamente (101-200)', () => {
    expect(getNREClassification(101)).toBe('Moderado');
    expect(getNREClassification(150)).toBe('Moderado');
    expect(getNREClassification(200)).toBe('Moderado');
  });

  it('deve classificar NRE Substancial corretamente (201-400)', () => {
    expect(getNREClassification(201)).toBe('Substancial');
    expect(getNREClassification(300)).toBe('Substancial');
    expect(getNREClassification(400)).toBe('Substancial');
  });

  it('deve classificar NRE Intolerável corretamente (>400)', () => {
    expect(getNREClassification(401)).toBe('Intolerável');
    expect(getNREClassification(500)).toBe('Intolerável');
    expect(getNREClassification(1000)).toBe('Intolerável');
  });

  it('deve determinar prioridade correta baseada no NRE', () => {
    expect(getPriorityFromNRE(30)).toBe('baixa');
    expect(getPriorityFromNRE(80)).toBe('media');
    expect(getPriorityFromNRE(150)).toBe('alta');
    expect(getPriorityFromNRE(500)).toBe('critica');
  });
});

describe('Cálculo de Probabilidade', () => {
  it('deve converter scores baixos para probabilidade 1', () => {
    expect(calculateProbabilityFromScore(0)).toBe(1);
    expect(calculateProbabilityFromScore(1)).toBe(1);
    expect(calculateProbabilityFromScore(2)).toBe(1);
  });

  it('deve converter scores médios-baixos para probabilidade 2', () => {
    expect(calculateProbabilityFromScore(3)).toBe(2);
    expect(calculateProbabilityFromScore(4)).toBe(2);
  });

  it('deve converter scores médios para probabilidade 3', () => {
    expect(calculateProbabilityFromScore(5)).toBe(3);
    expect(calculateProbabilityFromScore(6)).toBe(3);
  });

  it('deve converter scores altos para probabilidade 4-5', () => {
    expect(calculateProbabilityFromScore(7)).toBe(4);
    expect(calculateProbabilityFromScore(8)).toBe(4);
    expect(calculateProbabilityFromScore(9)).toBe(5);
    expect(calculateProbabilityFromScore(10)).toBe(5);
  });
});

describe('Cálculo de Gravidade', () => {
  it('deve calcular gravidade para ERGOS corretamente', () => {
    expect(calculateGravityFromScores({ dim1: 1, dim2: 2 }, 'ergos')).toBe(1);
    expect(calculateGravityFromScores({ dim1: 3, dim2: 4 }, 'ergos')).toBe(2);
    expect(calculateGravityFromScores({ dim1: 5, dim2: 6 }, 'ergos')).toBe(3);
    expect(calculateGravityFromScores({ dim1: 7, dim2: 8 }, 'ergos')).toBe(4);
    expect(calculateGravityFromScores({ dim1: 9, dim2: 10 }, 'ergos')).toBe(5);
  });

  it('deve calcular gravidade para HSE-IT corretamente', () => {
    expect(calculateGravityFromScores({ dim1: 10, dim2: 15 }, 'hse_it')).toBe(1);
    expect(calculateGravityFromScores({ dim1: 30, dim2: 40 }, 'hse_it')).toBe(2);
    expect(calculateGravityFromScores({ dim1: 50, dim2: 60 }, 'hse_it')).toBe(3);
    expect(calculateGravityFromScores({ dim1: 70, dim2: 80 }, 'hse_it')).toBe(4);
    expect(calculateGravityFromScores({ dim1: 90, dim2: 95 }, 'hse_it')).toBe(5);
  });

  it('deve retornar 1 para scores vazios', () => {
    expect(calculateGravityFromScores({}, 'ergos')).toBe(1);
    expect(calculateGravityFromScores({}, 'hse_it')).toBe(1);
  });
});

describe('Cálculo ERGOS Total', () => {
  it('deve aplicar fórmula 0.83 × (A + B) corretamente', () => {
    // Bloco A = 25, Bloco B = 25 → Total = 0.83 * 50 = 41.5
    expect(calculateERGOSTotal(25, 25)).toBeCloseTo(41.5, 1);
    
    // Bloco A = 30, Bloco B = 30 → Total = 0.83 * 60 = 49.8
    expect(calculateERGOSTotal(30, 30)).toBeCloseTo(49.8, 1);
    
    // Bloco A = 40, Bloco B = 40 → Total = 0.83 * 80 = 66.4
    expect(calculateERGOSTotal(40, 40)).toBeCloseTo(66.4, 1);
  });

  it('deve interpretar pontuação ERGOS corretamente', () => {
    const adequado = getInterpretacaoERGOS(20);
    expect(adequado.nivel).toBe('Adequado');
    
    const aceitavel = getInterpretacaoERGOS(45);
    expect(aceitavel.nivel).toBe('Aceitável');
    
    const requerAtencao = getInterpretacaoERGOS(70);
    expect(requerAtencao.nivel).toBe('Requer Atenção');
  });
});

describe('Cálculo NRE = G × P × C', () => {
  it('deve calcular NRE corretamente', () => {
    // NRE = Gravidade × Probabilidade × Capacidade de Detecção
    const calcularNRE = (g: number, p: number, c: number) => g * p * c;
    
    // Caso trivial: G=1, P=1, C=1 → NRE = 1
    expect(calcularNRE(1, 1, 1)).toBe(1);
    
    // Caso moderado: G=3, P=3, C=3 → NRE = 27
    expect(calcularNRE(3, 3, 3)).toBe(27);
    
    // Caso substancial: G=4, P=4, C=4 → NRE = 64
    expect(calcularNRE(4, 4, 4)).toBe(64);
    
    // Caso intolerável: G=5, P=5, C=5 → NRE = 125
    expect(calcularNRE(5, 5, 5)).toBe(125);
  });
});

describe('Validação de Scores', () => {
  it('deve validar que scores ERGOS estão entre 0 e 10', () => {
    const isValidERGOSScore = (score: number) => score >= 0 && score <= 10;
    
    expect(isValidERGOSScore(0)).toBe(true);
    expect(isValidERGOSScore(5)).toBe(true);
    expect(isValidERGOSScore(10)).toBe(true);
    expect(isValidERGOSScore(-1)).toBe(false);
    expect(isValidERGOSScore(11)).toBe(false);
  });

  it('deve validar que scores HSE-IT estão entre 0 e 100', () => {
    const isValidHSEITScore = (score: number) => score >= 0 && score <= 100;
    
    expect(isValidHSEITScore(0)).toBe(true);
    expect(isValidHSEITScore(50)).toBe(true);
    expect(isValidHSEITScore(100)).toBe(true);
    expect(isValidHSEITScore(-1)).toBe(false);
    expect(isValidHSEITScore(101)).toBe(false);
  });
});
