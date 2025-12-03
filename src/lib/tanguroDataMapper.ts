// Converts report data from database format to TanguroReportTemplate format

interface DimensionScore {
  name: string;
  score: number;
  normalized_score?: number;
  status: string;
  color: string;
}

interface BlockData {
  name: string;
  total: number;
  dimensions: DimensionScore[];
}

interface RiskMatrixItem {
  risk_factor: string;
  source?: string;
  severity_g: number;
  probability_p: number;
  detection_d: number;
  nre: number;
  classification: string;
  suggested_action?: string;
  dimension?: string;
  nr_referencia?: string[];
}

export interface TanguroReportData {
  company: {
    razaoSocial: string;
    endereco: string;
    municipio: string;
    estado: string;
    cep: string;
    cnpj: string;
    cnae: string;
    atividadeEmpresa: string;
    grauRisco: number;
    horarioTrabalho: string;
  };
  respondent: {
    nome: string;
    setor: string;
    cargo: string;
    cbo?: string;
    genero?: string;
    tempoEmpresa?: string;
    turno?: string;
    pausas?: string;
    qtdFuncionarios?: number;
  };
  trabalhoReal?: string;
  trabalhoPrescrito?: string;
  descricaoAmbiente?: string;
  globalScore: number;
  riskLevel: string;
  riskLabel: string;
  riskColor: string;
  riskDescription: string;
  calculationMethod: string;
  formType: string;
  dimensions: DimensionScore[];
  blocks?: Record<string, BlockData>;
  analysis: string;
  conclusion: string;
  recommendations: string[];
  riskMatrix?: RiskMatrixItem[];
  createdAt: string;
  validadeInicio?: string;
  validadeFim?: string;
  responsavelTecnico: {
    nome: string;
    profissao: string;
    registro: string;
  };
}

// Default company data for Amaggi - Tanguro
const defaultCompanyData = {
  razaoSocial: "Agropecuária Maggi Ltda",
  endereco: "Rod. MT 320 - s/n - KM - 104 + 20 Km a direita - zona rural",
  municipio: "Querência",
  estado: "Mato Grosso",
  cep: "78310000",
  cnpj: "00.315.457/0019-14",
  cnae: "01.15.6.00",
  atividadeEmpresa: "Cultivo de soja",
  grauRisco: 3,
  horarioTrabalho: "07h20min segunda-feira a sábado / 44h semanal",
};

const defaultResponsavelTecnico = {
  nome: "Andre Luiz Lopes de Oliveira",
  profissao: "Fisioterapeuta – Consultor em Ergonomia",
  registro: "CREFITO-9 26.465-F",
};

// Get probability based on score (Tanguro methodology)
function getProbabilityFromScore(score: number): number {
  if (score <= 3) return 1; // Baixa
  if (score <= 6) return 3; // Média
  return 5; // Alta
}

// Calculate NRE and generate risk matrix from dimensions
function generateRiskMatrix(dimensions: DimensionScore[], tanguroMatrix?: any[]): RiskMatrixItem[] {
  const riskMatrix: RiskMatrixItem[] = [];
  
  // Find critical dimensions (score > 5)
  const criticalDimensions = dimensions.filter(d => d.score > 5);
  
  for (const dim of criticalDimensions) {
    // Find matching risk from tanguro_risk_matrix if available
    const matchingRisk = tanguroMatrix?.find(r => 
      r.dimension?.toLowerCase() === dim.name.toLowerCase() ||
      dim.name.toLowerCase().includes(r.dimension?.toLowerCase() || '')
    );

    const severity_g = matchingRisk?.severity_g || 4;
    const probability_p = getProbabilityFromScore(dim.score);
    const detection_d = matchingRisk?.detection_d || 3;
    const nre = severity_g * probability_p * detection_d;

    riskMatrix.push({
      risk_factor: getRiskFactorName(dim.name),
      source: matchingRisk?.source || getDefaultSource(dim.name),
      severity_g,
      probability_p,
      detection_d,
      nre,
      classification: getNREClassificationLabel(nre),
      suggested_action: matchingRisk?.suggested_action || getDefaultAction(dim.name),
      dimension: dim.name,
      nr_referencia: matchingRisk?.nr_referencia || ["NR-17"],
    });
  }

  return riskMatrix.sort((a, b) => b.nre - a.nre); // Sort by NRE descending
}

function getRiskFactorName(dimensionName: string): string {
  const mapping: Record<string, string> = {
    "Pressão de Tempo": "Sobrecarga Mental por Pressão Temporal",
    "Atenção": "Alta Demanda Cognitiva",
    "Complexidade": "Complexidade Excessiva de Tarefas",
    "Monotonia": "Monotonia e Repetitividade",
    "Raciocínio": "Exigência de Raciocínio Contínuo",
    "Iniciativa": "Falta de Autonomia",
    "Isolamento": "Isolamento Social no Trabalho",
    "Horários e Turnos": "Jornada Inadequada",
    "Relacionamentos": "Conflitos Interpessoais",
    "Demandas Gerais": "Demandas Excessivas",
    "Demandas": "Sobrecarga de Demandas",
    "Controle": "Falta de Controle sobre o Trabalho",
    "Apoio Gerencial": "Insuficiência de Apoio da Chefia",
    "Apoio dos Colegas": "Baixo Suporte entre Colegas",
    "Papel/Cargo": "Ambiguidade de Função",
    "Mudanças Organizacionais": "Gestão Inadequada de Mudanças",
  };
  return mapping[dimensionName] || `Risco associado a ${dimensionName}`;
}

function getDefaultSource(dimensionName: string): string {
  const sources: Record<string, string> = {
    "Pressão de Tempo": "Ritmo de trabalho imposto, prazos curtos",
    "Atenção": "Necessidade constante de vigilância e concentração",
    "Complexidade": "Tarefas que exigem múltiplas habilidades simultâneas",
    "Monotonia": "Tarefas repetitivas sem variação",
    "Raciocínio": "Decisões complexas frequentes",
    "Iniciativa": "Baixa autonomia sobre métodos de trabalho",
    "Isolamento": "Trabalho solitário, falta de interação social",
    "Horários e Turnos": "Horários irregulares, turnos prolongados",
    "Relacionamentos": "Dificuldades nas relações interpessoais",
    "Demandas Gerais": "Volume de trabalho acima da capacidade",
  };
  return sources[dimensionName] || "Condições organizacionais do trabalho";
}

function getDefaultAction(dimensionName: string): string {
  const actions: Record<string, string> = {
    "Pressão de Tempo": "Adequar prazos e distribuir melhor as tarefas",
    "Atenção": "Implementar pausas programadas, melhorar ambiente",
    "Complexidade": "Oferecer treinamento, simplificar processos",
    "Monotonia": "Rodízio de tarefas, enriquecimento do cargo",
    "Raciocínio": "Suporte técnico, ferramentas de apoio à decisão",
    "Iniciativa": "Empoderamento, participação nas decisões",
    "Isolamento": "Atividades em grupo, comunicação regular",
    "Horários e Turnos": "Adequação de escalas, respeito aos intervalos",
    "Relacionamentos": "Mediação, treinamento em comunicação",
    "Demandas Gerais": "Dimensionamento adequado da equipe",
  };
  return actions[dimensionName] || "Avaliar e implementar medidas de controle";
}

function getNREClassificationLabel(nre: number): string {
  if (nre <= 8) return "TRIVIAL";
  if (nre <= 27) return "TOLERÁVEL";
  if (nre <= 60) return "MODERADO";
  return "CRÍTICO";
}

export function mapReportToTanguroFormat(
  report: any,
  submission: any,
  form: any,
  tanguroMatrix?: any[]
): TanguroReportData {
  // Parse dimensions_score
  const dimensionsScore = typeof report.dimensions_score === 'string' 
    ? JSON.parse(report.dimensions_score) 
    : report.dimensions_score || {};

  // Parse respondent_data
  const respondentData = typeof submission.respondent_data === 'string'
    ? JSON.parse(submission.respondent_data)
    : submission.respondent_data || {};

  // Extract dimensions array
  let dimensions: DimensionScore[] = [];
  let blocks: Record<string, BlockData> | undefined;

  if (dimensionsScore.dimensions && Array.isArray(dimensionsScore.dimensions)) {
    dimensions = dimensionsScore.dimensions;
  }

  if (dimensionsScore.blocks) {
    blocks = dimensionsScore.blocks;
  }

  // Generate risk matrix from critical dimensions
  const riskMatrix = generateRiskMatrix(dimensions, tanguroMatrix);

  // Get recommendations
  const recommendations = report.ai_recommendations || [];

  return {
    company: defaultCompanyData,
    respondent: {
      nome: respondentData.nome || "Não informado",
      setor: respondentData.setor || "Não informado",
      cargo: respondentData.cargo || "Não informado",
      cbo: respondentData.cbo,
      genero: respondentData.genero,
      tempoEmpresa: respondentData.tempo_empresa,
      turno: respondentData.turno || "Comercial",
      pausas: respondentData.pausas,
      qtdFuncionarios: respondentData.qtd_funcionarios,
    },
    trabalhoReal: respondentData.descricao_atividade || respondentData.trabalho_real,
    trabalhoPrescrito: respondentData.trabalho_prescrito || respondentData.cbo_description,
    descricaoAmbiente: respondentData.ambiente || respondentData.descricao_ambiente,
    globalScore: dimensionsScore.global_score || 0,
    riskLevel: dimensionsScore.risk_level || report.risk_level || "medio",
    riskLabel: dimensionsScore.risk_label || report.risk_level || "Aceitável",
    riskColor: dimensionsScore.risk_color || "yellow",
    riskDescription: dimensionsScore.risk_description || "",
    calculationMethod: dimensionsScore.calculation_method || form?.type || "ergos",
    formType: form?.type || "ergos",
    dimensions,
    blocks,
    analysis: report.ai_analysis_text || "",
    conclusion: report.ai_conclusion || "",
    recommendations: Array.isArray(recommendations) ? recommendations : [],
    riskMatrix,
    createdAt: report.created_at || new Date().toISOString(),
    validadeInicio: undefined,
    validadeFim: undefined,
    responsavelTecnico: defaultResponsavelTecnico,
  };
}
