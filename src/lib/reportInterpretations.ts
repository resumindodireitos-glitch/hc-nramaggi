/**
 * Standard interpretation texts for ERGOS and HSE-IT reports
 * Based on client's official document specifications
 */

// NRE Classification - Conforme documento do cliente
// NRE = G × P × C
// Trivial (1), Tolerável (2-3), Moderado (4-9), Substancial (12-18), Intolerável (27)
export function getNREClassificationClient(nre: number): { label: string; color: string } {
  if (nre <= 1) return { label: "TRIVIAL", color: "bg-green-500" };
  if (nre <= 3) return { label: "TOLERÁVEL", color: "bg-yellow-500" };
  if (nre <= 9) return { label: "MODERADO", color: "bg-orange-500" };
  if (nre <= 18) return { label: "SUBSTANCIAL", color: "bg-red-500" };
  return { label: "INTOLERÁVEL", color: "bg-red-700" };
}

// ERGOS Interpretation - Standard text based on score
// Score = (A + B) × 0.83
// Threshold per dimension: 6 out of 12 = risk factor
export function getERGOSInterpretation(
  globalScore: number, 
  cargo: string,
  riskyDimensions: string[]
): string {
  const riskLabel = globalScore <= 30 ? "satisfatório" : 
                    globalScore <= 60 ? "aceitável" : "crítico";
  
  const baseInterpretation = globalScore <= 30
    ? `Na função de ${cargo} após aplicação do ERGOS, o resultado total foi de ${globalScore.toFixed(2)} pontos sendo interpretado como condições de trabalho adequadas sem existência de risco em potencial, configurando fatores cognitivos em nível satisfatório para exercício da atividade laboral.`
    : globalScore <= 60
    ? `Na função de ${cargo} após aplicação do ERGOS, o resultado total foi de ${globalScore.toFixed(2)} pontos sendo interpretado como condições de trabalho aceitáveis com atenção necessária para alguns fatores cognitivos e organizacionais identificados.`
    : `Na função de ${cargo} após aplicação do ERGOS, o resultado total foi de ${globalScore.toFixed(2)} pontos sendo interpretado como condições de trabalho que necessitam melhorias, configurando fatores de risco que requerem ação corretiva.`;

  if (riskyDimensions.length > 0) {
    return `${baseInterpretation} As dimensões que necessitam atenção são: ${riskyDimensions.join(", ")}.`;
  }
  
  return baseInterpretation;
}

// HSE-IT Interpretation - Standard text based on dimensions
// Stressor percentage per dimension
export function getHSEITInterpretation(
  cargo: string,
  dimensions: Array<{ name: string; percentage: number }>
): string {
  const stressDimensions = dimensions.filter(d => d.percentage > 0);
  const allZero = stressDimensions.length === 0;
  
  if (allZero) {
    return `A aplicação do instrumento HSE IT resultou em 0% em todas as dimensões avaliadas (demandas, relacionamentos, controle, apoio de chefia, apoio de colegas, cargo e comunicação e mudanças) indicando ausência de riscos psicossociais identificáveis. Esse resultado demonstra que, no contexto atual, as condições psicossociais associadas à função de ${cargo} apresentam-se adequadas, não havendo evidências de sobrecarga, desequilíbrio no suporte organizacional ou conflitos interpessoais que possam comprometer a atividade laboral em seu ambiente.`;
  }
  
  const stressText = stressDimensions.map(d => 
    `${d.percentage}% na dimensão ${d.name.toLowerCase()}`
  ).join(", ");
  
  const otherDimensions = dimensions.filter(d => d.percentage === 0);
  const otherText = otherDimensions.length > 0 
    ? ` Identifica-se ainda que as demais dimensões (${otherDimensions.map(d => d.name.toLowerCase()).join(", ")}), no contexto atual apresentam condições psicossociais adequadas, sem fatores estressores.`
    : "";
  
  return `Na aplicação do HSE IT, a função de ${cargo} apresentou resultado com nível de ${stressText}. Este resultado aponta possíveis fatores que podem estar diferentes da capacidade adaptativa esperada.${otherText}`;
}

// HSE-IT Dimension descriptions
export const HSEIT_DIMENSION_DESCRIPTIONS: Record<string, string> = {
  "Demandas": "Aspectos relacionados à carga de trabalho, exigências, organização e ambiente de trabalho",
  "Relacionamentos": "Aspectos relacionados a comportamentos interpessoais, inaceitáveis, como assédio",
  "Controle": "Possibilidades de opinar sobre mudanças nos processos e controlar o ritmo de trabalho",
  "Apoio Chefia": "Apoio por parte dos superiores e os recursos fornecidos para resolver os problemas",
  "Apoio Colegas": "Comunicação interpessoal adequada e respeito às diversidades entre os trabalhadores",
  "Cargo": "Transparência nos critérios de promoção na carreira e reconhecimento",
  "Mudanças": "Participação dos trabalhadores em mudanças"
};

// ERGOS Dimension descriptions
export const ERGOS_DIMENSION_DESCRIPTIONS: Record<string, string> = {
  "Pressão de Tempo": "Avalia a urgência e velocidade exigida para execução das tarefas",
  "Atenção": "Nível de concentração e vigilância necessários",
  "Complexidade": "Grau de dificuldade e variedade das tarefas",
  "Monotonia": "Repetitividade e falta de variação nas atividades",
  "Raciocínio": "Demandas cognitivas e processos mentais centrais",
  "Iniciativa": "Autonomia para tomar decisões e agir",
  "Isolamento": "Grau de interação social no trabalho",
  "Horários e Turnos": "Aspectos relacionados à organização temporal do trabalho",
  "Relacionamentos": "Qualidade das relações interpessoais",
  "Demandas Gerais": "Outras exigências organizacionais"
};

// Generate risk inventory row for ERGOS dimension
export function generateERGOSRiskRow(
  dimensionName: string,
  score: number,
  cargo: string,
  threshold: number = 6
): {
  nominacao: string;
  perigo: string;
  lesoes: string;
  fontes: string;
  exposicao: string;
  medidas: string;
  g: number;
  p: number;
  c: number;
  nre: number;
  acoes: string;
} | null {
  // Only create risk if score >= threshold (6 out of 12)
  if (score < threshold) return null;
  
  const description = ERGOS_DIMENSION_DESCRIPTIONS[dimensionName] || dimensionName;
  
  return {
    nominacao: `Atividade laboral na função de ${cargo}`,
    perigo: dimensionName,
    lesoes: "Transtornos relacionados à saúde mental",
    fontes: description,
    exposicao: "Habitual",
    medidas: "Manter e monitorar ações aplicáveis constantes no portfólio CULTURA DE CUIDADO - Saúde Mental e Qualidade de Vida na AMAGGI.",
    g: score > 10 ? 4 : score > 8 ? 3 : 2,
    p: 1,
    c: 1,
    nre: (score > 10 ? 4 : score > 8 ? 3 : 2) * 1 * 1,
    acoes: "Conforme anexo 1 deste documento"
  };
}

// Generate risk inventory row for HSE-IT dimension
export function generateHSEITRiskRow(
  dimensionName: string,
  percentage: number,
  cargo: string,
  threshold: number = 13
): {
  nominacao: string;
  perigo: string;
  lesoes: string;
  fontes: string;
  exposicao: string;
  medidas: string;
  g: number;
  p: number;
  c: number;
  nre: number;
  acoes: string;
} | null {
  // Only create risk if percentage >= threshold (default 13%)
  if (percentage < threshold) return null;
  
  const description = HSEIT_DIMENSION_DESCRIPTIONS[dimensionName] || dimensionName;
  
  // Map dimension to perigo
  const perigoMap: Record<string, string> = {
    "Demandas": "Demanda/sobrecarga mental",
    "Relacionamentos": "Conflitos interpessoais",
    "Controle": "Falta de autonomia",
    "Apoio Chefia": "Isolamento vertical",
    "Apoio Colegas": "Isolamento horizontal",
    "Cargo": "Falta de reconhecimento",
    "Mudanças": "Resistência a mudanças"
  };
  
  return {
    nominacao: `Realização das atividades laborais na função de ${cargo}`,
    perigo: perigoMap[dimensionName] || dimensionName,
    lesoes: "Transtornos relacionados à saúde mental",
    fontes: description,
    exposicao: "Habitual",
    medidas: "Manter e monitorar ações aplicáveis constantes no portfólio CULTURA DE CUIDADO - Saúde Mental e Qualidade de Vida na AMAGGI.",
    g: percentage > 50 ? 4 : percentage > 30 ? 3 : 2,
    p: 1,
    c: 1,
    nre: (percentage > 50 ? 4 : percentage > 30 ? 3 : 2) * 1 * 1,
    acoes: "Conforme anexo 1 deste documento"
  };
}

// Empty risk inventory row for when no risks are identified
export function generateEmptyRiskRow(cargo: string): {
  nominacao: string;
  perigo: string;
  lesoes: string;
  fontes: string;
  exposicao: string;
  medidas: string;
  g: string;
  p: string;
  c: string;
  nre: string;
  acoes: string;
} {
  return {
    nominacao: `Atividades laborais na função de ${cargo}`,
    perigo: "Não identificado",
    lesoes: "Não identificado exposição com significância",
    fontes: "Não identificado",
    exposicao: "Não aplicável",
    medidas: "",
    g: "",
    p: "",
    c: "",
    nre: "",
    acoes: ""
  };
}
