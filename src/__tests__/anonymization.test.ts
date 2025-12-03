/**
 * Testes de Anonimização - LGPD Compliance
 * Sistema HC Consultoria - Blueprint V3.0
 * 
 * Para executar: npx vitest run src/__tests__/anonymization.test.ts
 */

import { describe, it, expect } from 'vitest';

// Função de hash simulada (igual à do banco de dados)
function generateRespondentHash(respondentData: { nome?: string; setor?: string; cargo?: string }): string {
  const salt = 'HC_AMAGGI_SECURE_SALT_2024_LGPD_COMPLIANT';
  const dataString = 
    (respondentData.nome || '') + 
    (respondentData.setor || '') + 
    (respondentData.cargo || '') + 
    salt;
  
  // Simulação de SHA256 (em produção usa crypto)
  // Para testes, usamos uma função hash simples
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

// Função para verificar se dados foram anonimizados
function isAnonymized(respondentData: Record<string, unknown>): boolean {
  return respondentData.anonymized === true;
}

// Função para mascarar dados sensíveis
function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...data };
  
  // Mascarar nome (mostrar apenas 3 primeiros caracteres)
  if (typeof masked.nome === 'string' && masked.nome.length > 3) {
    masked.nome = masked.nome.substring(0, 3) + '***';
  }
  
  // Mascarar email
  if (typeof masked.email === 'string') {
    masked.email = '***@***.com';
  }
  
  return masked;
}

// Validação de dados PII
function containsPII(data: Record<string, unknown>): boolean {
  const piiFields = ['nome', 'email', 'cpf', 'telefone', 'endereco'];
  return piiFields.some(field => {
    const value = data[field];
    return typeof value === 'string' && value.length > 0 && !value.includes('***');
  });
}

describe('Hash de Respondente', () => {
  it('deve gerar hash idêntico para o mesmo respondente', () => {
    const respondent1 = { nome: 'João Silva', setor: 'TI', cargo: 'Analista' };
    const respondent2 = { nome: 'João Silva', setor: 'TI', cargo: 'Analista' };
    
    const hash1 = generateRespondentHash(respondent1);
    const hash2 = generateRespondentHash(respondent2);
    
    expect(hash1).toBe(hash2);
  });

  it('deve gerar hashes diferentes para respondentes diferentes', () => {
    const respondent1 = { nome: 'João Silva', setor: 'TI', cargo: 'Analista' };
    const respondent2 = { nome: 'Maria Santos', setor: 'RH', cargo: 'Coordenador' };
    
    const hash1 = generateRespondentHash(respondent1);
    const hash2 = generateRespondentHash(respondent2);
    
    expect(hash1).not.toBe(hash2);
  });

  it('deve ser sensível a mudanças mínimas nos dados', () => {
    const respondent1 = { nome: 'João Silva', setor: 'TI', cargo: 'Analista' };
    const respondent2 = { nome: 'João Silva ', setor: 'TI', cargo: 'Analista' }; // espaço extra
    
    const hash1 = generateRespondentHash(respondent1);
    const hash2 = generateRespondentHash(respondent2);
    
    expect(hash1).not.toBe(hash2);
  });

  it('não deve ser reversível (não deve conter dados em texto plano)', () => {
    const respondent = { nome: 'João Silva', setor: 'TI', cargo: 'Analista' };
    const hash = generateRespondentHash(respondent);
    
    expect(hash).not.toContain('João');
    expect(hash).not.toContain('Silva');
    expect(hash).not.toContain('TI');
    expect(hash).not.toContain('Analista');
  });
});

describe('Verificação de Anonimização', () => {
  it('deve identificar dados anonimizados corretamente', () => {
    const anonymizedData = {
      anonymized: true,
      anonymized_at: '2024-01-15T10:00:00Z',
      original_hash: 'abc123'
    };
    
    expect(isAnonymized(anonymizedData)).toBe(true);
  });

  it('deve identificar dados não anonimizados', () => {
    const normalData = {
      nome: 'João Silva',
      setor: 'TI',
      cargo: 'Analista'
    };
    
    expect(isAnonymized(normalData)).toBe(false);
  });
});

describe('Mascaramento de Dados Sensíveis', () => {
  it('deve mascarar nome mantendo 3 primeiros caracteres', () => {
    const data = { nome: 'João Silva', email: 'joao@email.com' };
    const masked = maskSensitiveData(data);
    
    expect(masked.nome).toBe('Joã***');
  });

  it('deve mascarar email completamente', () => {
    const data = { nome: 'João', email: 'joao@empresa.com.br' };
    const masked = maskSensitiveData(data);
    
    expect(masked.email).toBe('***@***.com');
  });

  it('não deve alterar nomes curtos (<=3 caracteres)', () => {
    const data = { nome: 'Ana' };
    const masked = maskSensitiveData(data);
    
    expect(masked.nome).toBe('Ana');
  });
});

describe('Detecção de PII', () => {
  it('deve detectar dados PII não mascarados', () => {
    const dataWithPII = {
      nome: 'João Silva',
      email: 'joao@email.com',
      setor: 'TI'
    };
    
    expect(containsPII(dataWithPII)).toBe(true);
  });

  it('deve não detectar PII em dados mascarados', () => {
    const maskedData = {
      nome: 'Joã***',
      email: '***@***.com',
      setor: 'TI'
    };
    
    expect(containsPII(maskedData)).toBe(false);
  });

  it('deve não detectar PII em dados anonimizados', () => {
    const anonymizedData = {
      anonymized: true,
      original_hash: 'abc123'
    };
    
    expect(containsPII(anonymizedData)).toBe(false);
  });
});

describe('Retenção de Dados (5 anos)', () => {
  it('deve calcular data de retenção corretamente', () => {
    const submissionDate = new Date('2024-01-15');
    const retentionYears = 5;
    
    const retentionDate = new Date(submissionDate);
    retentionDate.setFullYear(retentionDate.getFullYear() + retentionYears);
    
    expect(retentionDate.getFullYear()).toBe(2029);
    expect(retentionDate.getMonth()).toBe(0); // Janeiro
    expect(retentionDate.getDate()).toBe(15);
  });

  it('deve identificar dados expirados', () => {
    const isExpired = (retentionUntil: Date) => {
      return new Date() > retentionUntil;
    };
    
    const futureDate = new Date('2030-01-01');
    const pastDate = new Date('2020-01-01');
    
    expect(isExpired(futureDate)).toBe(false);
    expect(isExpired(pastDate)).toBe(true);
  });
});

describe('Deduplicação por Hash', () => {
  it('deve permitir identificar submissões duplicadas pelo hash', () => {
    const submissions = [
      { id: '1', respondent_hash: 'hash123', form_id: 'form1' },
      { id: '2', respondent_hash: 'hash456', form_id: 'form1' },
      { id: '3', respondent_hash: 'hash123', form_id: 'form1' }, // duplicado
    ];
    
    const findDuplicates = (subs: typeof submissions) => {
      const seen = new Map<string, string[]>();
      
      subs.forEach(sub => {
        const key = `${sub.respondent_hash}-${sub.form_id}`;
        if (!seen.has(key)) {
          seen.set(key, []);
        }
        seen.get(key)!.push(sub.id);
      });
      
      return Array.from(seen.entries())
        .filter(([_, ids]) => ids.length > 1)
        .map(([_, ids]) => ids);
    };
    
    const duplicates = findDuplicates(submissions);
    
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toContain('1');
    expect(duplicates[0]).toContain('3');
  });
});
