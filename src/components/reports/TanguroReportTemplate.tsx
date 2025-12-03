import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoHC from "@/assets/logo-hc-new.png";
import logoAmaggi from "@/assets/logo-amaggi-new.png";
import DOMPurify from "dompurify";

// Sanitize HTML content to prevent XSS
const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['class', 'style'],
  });
};

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

interface TanguroReportData {
  // Company Data
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
  // Respondent Data
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
  // Work Description
  trabalhoReal?: string;
  trabalhoPrescrito?: string;
  descricaoAmbiente?: string;
  // Scores
  globalScore: number;
  riskLevel: string;
  riskLabel: string;
  riskColor: string;
  riskDescription: string;
  calculationMethod: string;
  formType: string;
  dimensions: DimensionScore[];
  blocks?: Record<string, BlockData>;
  // AI Analysis
  analysis: string;
  conclusion: string;
  recommendations: string[];
  // Risk Matrix
  riskMatrix?: RiskMatrixItem[];
  // Metadata
  createdAt: string;
  validadeInicio?: string;
  validadeFim?: string;
  responsavelTecnico: {
    nome: string;
    profissao: string;
    registro: string;
  };
}

interface TanguroReportTemplateProps {
  data: TanguroReportData;
}

const getNREClassification = (nre: number): { label: string; color: string } => {
  if (nre <= 8) return { label: "TRIVIAL", color: "bg-green-500" };
  if (nre <= 27) return { label: "TOLERÁVEL", color: "bg-yellow-500" };
  if (nre <= 60) return { label: "MODERADO", color: "bg-orange-500" };
  return { label: "CRÍTICO", color: "bg-red-500" };
};

const getScoreBarColor = (color: string): string => {
  switch (color) {
    case "green": return "bg-green-500";
    case "yellow": return "bg-yellow-500";
    case "orange": return "bg-orange-500";
    case "red": return "bg-red-500";
    default: return "bg-gray-400";
  }
};

const getRiskBadgeColor = (color: string): string => {
  switch (color) {
    case "green": return "bg-green-100 text-green-800 border-green-300";
    case "yellow": return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "orange": return "bg-orange-100 text-orange-800 border-orange-300";
    case "red": return "bg-red-100 text-red-800 border-red-300";
    default: return "bg-gray-100 text-gray-800 border-gray-300";
  }
};

export function TanguroReportTemplate({ data }: TanguroReportTemplateProps) {
  return (
    <div className="bg-white text-black min-h-screen" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt' }}>
      {/* ========== PAGE 1: COVER ========== */}
      <div className="p-8 min-h-[297mm] flex flex-col">
        {/* Header with logos */}
        <div className="flex items-center justify-between border-b-2 border-blue-700 pb-4 mb-8">
          <img src={logoHC} alt="HC Consultoria" className="h-16 object-contain" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-blue-800">AEP/AET – NR17</h1>
            <p className="text-sm text-gray-600">Análise Ergonômica do Trabalho</p>
          </div>
          <img src={logoAmaggi} alt="Amaggi" className="h-16 object-contain" />
        </div>

        {/* Main Title */}
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
          <h1 className="text-3xl font-bold text-blue-900 leading-tight">
            ANÁLISE ERGONÔMICA DO TRABALHO
          </h1>
          <h2 className="text-xl font-semibold text-blue-700">
            INTEGRAÇÃO DE PROGRAMA DE GERENCIAMENTO<br />
            DE RISCOS PSICOSSOCIAIS – NR1 E NR17
          </h2>
          
          <div className="w-32 h-1 bg-blue-700 my-4" />
          
          <div className="text-lg">
            <p className="font-semibold">{data.company.razaoSocial}</p>
            <p className="text-gray-600">Unidade: Fazenda Tanguro</p>
          </div>

          <div className="mt-8 p-4 border rounded-lg bg-gray-50">
            <p className="text-sm text-gray-600">Vigência</p>
            <p className="font-semibold">
              {data.validadeInicio || format(new Date(), "dd/MM/yyyy")} a {data.validadeFim || format(new Date(Date.now() + 365*24*60*60*1000), "dd/MM/yyyy")}
            </p>
          </div>
        </div>

        {/* Footer with technical responsibility */}
        <div className="border-t pt-4 mt-8">
          <div className="flex justify-between items-end text-xs text-gray-500">
            <div>
              <p>HC – Consultoria em Ergonomia</p>
              <p>Rua das Hortencias, 156, Jardim Cuiabá, Cuiabá/MT</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">Responsabilidade Técnica:</p>
              <p>{data.responsavelTecnico.nome}</p>
              <p>{data.responsavelTecnico.registro}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========== PAGE 2: COMPANY PROFILE ========== */}
      <div className="p-8 border-t-4 border-blue-700 page-break-before">
        <PageHeader title="PERFIL DA EMPRESA" pageNum={2} />
        
        <table className="w-full border-collapse mt-6">
          <tbody>
            <TableRow label="Razão Social" value={data.company.razaoSocial} />
            <TableRow label="Endereço" value={data.company.endereco} />
            <TableRow label="Município / Estado" value={`${data.company.municipio} / ${data.company.estado}`} />
            <TableRow label="CEP" value={data.company.cep} />
            <TableRow label="CNPJ" value={data.company.cnpj} />
            <TableRow label="CNAE" value={data.company.cnae} />
            <TableRow label="Atividade da Empresa" value={data.company.atividadeEmpresa} />
            <TableRow label="Grau de Risco" value={String(data.company.grauRisco).padStart(2, '0')} />
            <TableRow label="Horário de Trabalho" value={data.company.horarioTrabalho} />
          </tbody>
        </table>
      </div>

      {/* ========== PAGE 3: METHODOLOGY ========== */}
      <div className="p-8 border-t-4 border-blue-700 page-break-before">
        <PageHeader title="METODOLOGIA" pageNum={3} />
        
        <div className="mt-6 space-y-6 text-justify text-sm leading-relaxed">
          <section>
            <h3 className="font-bold text-blue-800 mb-2">5.1 Normas de Referência</h3>
            <p>
              Este documento tem como base legal a Norma Regulamentadora N.º 01 – Disposições Gerais e 
              Gerenciamento de Riscos Ocupacionais, a NR-17 – Ergonomia, e as normas ISO 10075-1 (Princípios 
              Ergonômicos relacionados à Carga Mental de Trabalho), ISO 45003 (Gestão da Saúde e Segurança 
              Ocupacional - Riscos Psicossociais) e ISO 31000 (Gestão de Riscos).
            </p>
          </section>

          <section>
            <h3 className="font-bold text-blue-800 mb-2">5.2 Ferramentas Ergonômicas</h3>
            
            {data.formType === "ergos" ? (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-700 mb-2">Ferramenta ERGOS</h4>
                <p className="mb-2">
                  O ERGOS é um instrumento para mensuração da carga de trabalho, estruturado em 10 dimensões 
                  distribuídas em dois blocos:
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li><strong>Bloco A - Psicofisiológico:</strong> Pressão de Tempo, Atenção, Complexidade, Monotonia, Raciocínio</li>
                  <li><strong>Bloco B - Organizacional:</strong> Iniciativa, Isolamento, Horários/Turnos, Relacionamentos, Demandas Gerais</li>
                </ul>
                <p className="mt-2 font-mono text-sm bg-white p-2 rounded">
                  Fórmula: Score Global = 0,83 × (Bloco A + Bloco B)
                </p>
              </div>
            ) : (
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-700 mb-2">Ferramenta HSE-IT (Health Safety Executive - Indicator Tool)</h4>
                <p className="mb-2">
                  O HSE-IT é uma ferramenta de avaliação de estresse ocupacional desenvolvida pelo Health and Safety 
                  Executive do Reino Unido, estruturada em 7 dimensões:
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li><strong>Demandas:</strong> Carga de trabalho e condições</li>
                  <li><strong>Controle:</strong> Autonomia sobre métodos de trabalho</li>
                  <li><strong>Apoio Gerencial:</strong> Suporte da liderança</li>
                  <li><strong>Apoio dos Colegas:</strong> Solidariedade entre colegas</li>
                  <li><strong>Relacionamentos:</strong> Qualidade das relações interpessoais</li>
                  <li><strong>Papel/Cargo:</strong> Clareza de funções</li>
                  <li><strong>Mudanças:</strong> Gestão de mudanças organizacionais</li>
                </ul>
              </div>
            )}
          </section>

          <section>
            <h3 className="font-bold text-blue-800 mb-2">5.3 Matriz de Risco FMEA</h3>
            <p className="mb-2">
              A metodologia FMEA (Failure Mode and Effects Analysis) adaptada ao contexto psicossocial utiliza 
              a seguinte fórmula para cálculo do Nível de Risco Ergonômico (NRE):
            </p>
            <div className="bg-gray-100 p-4 rounded-lg text-center">
              <p className="font-mono text-lg font-bold">NRE = G × P × D</p>
              <p className="text-sm mt-2">
                Onde: G = Gravidade (1-5) | P = Probabilidade (1-5) | D = Detecção (1-5)
              </p>
            </div>
            
            <table className="w-full mt-4 border-collapse text-xs">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border p-2">NRE</th>
                  <th className="border p-2">Classificação</th>
                  <th className="border p-2">Ação Requerida</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2 text-center">1-8</td>
                  <td className="border p-2"><span className="px-2 py-0.5 rounded bg-green-500 text-white text-xs">TRIVIAL</span></td>
                  <td className="border p-2">Risco aceitável, manter monitoramento</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border p-2 text-center">9-27</td>
                  <td className="border p-2"><span className="px-2 py-0.5 rounded bg-yellow-500 text-black text-xs">TOLERÁVEL</span></td>
                  <td className="border p-2">Monitorar e implementar melhorias quando possível</td>
                </tr>
                <tr>
                  <td className="border p-2 text-center">28-60</td>
                  <td className="border p-2"><span className="px-2 py-0.5 rounded bg-orange-500 text-white text-xs">MODERADO</span></td>
                  <td className="border p-2">Ação corretiva necessária em prazo determinado</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border p-2 text-center">&gt;60</td>
                  <td className="border p-2"><span className="px-2 py-0.5 rounded bg-red-500 text-white text-xs">CRÍTICO</span></td>
                  <td className="border p-2">Ação imediata requerida</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {/* ========== PAGE 4: FUNCTION ANALYSIS ========== */}
      <div className="p-8 border-t-4 border-blue-700 page-break-before">
        <PageHeader title="ANÁLISE POR FUNÇÃO (GHE)" pageNum={4} />

        {/* Function Characterization Table */}
        <div className="mt-6">
          <h3 className="font-bold text-blue-800 mb-3 bg-blue-100 p-2 rounded">
            CARACTERIZAÇÃO DA FUNÇÃO
          </h3>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border">
                <td className="border p-2 bg-gray-100 font-semibold w-1/4">Setor:</td>
                <td className="border p-2">{data.respondent.setor}</td>
                <td className="border p-2 bg-gray-100 font-semibold w-1/4">Função:</td>
                <td className="border p-2">{data.respondent.cargo}</td>
              </tr>
              <tr className="border">
                <td className="border p-2 bg-gray-100 font-semibold">CBO:</td>
                <td className="border p-2">{data.respondent.cbo || "N/I"}</td>
                <td className="border p-2 bg-gray-100 font-semibold">Qtd. Funcionários:</td>
                <td className="border p-2">{data.respondent.qtdFuncionarios || "N/I"}</td>
              </tr>
              <tr className="border">
                <td className="border p-2 bg-gray-100 font-semibold">Turno:</td>
                <td className="border p-2">{data.respondent.turno || "Comercial"}</td>
                <td className="border p-2 bg-gray-100 font-semibold">Pausas:</td>
                <td className="border p-2">{data.respondent.pausas || "Conforme NR-17"}</td>
              </tr>
              <tr className="border">
                <td className="border p-2 bg-gray-100 font-semibold">Nome:</td>
                <td className="border p-2" colSpan={3}>{data.respondent.nome}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Work Description */}
        <div className="mt-6 space-y-4">
          <div>
            <h4 className="font-semibold text-blue-700 mb-2">Trabalho Prescrito (CBO):</h4>
            <div className="bg-gray-50 p-3 rounded text-sm text-justify">
              {data.trabalhoPrescrito || "Descrição do trabalho conforme CBO não informada."}
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-blue-700 mb-2">Trabalho Real (Atividade Relatada):</h4>
            <div className="bg-blue-50 p-3 rounded text-sm text-justify">
              {data.trabalhoReal || "Descrição da atividade real não informada."}
            </div>
          </div>
          {data.descricaoAmbiente && (
            <div>
              <h4 className="font-semibold text-blue-700 mb-2">Condições Ambientais:</h4>
              <div className="bg-gray-50 p-3 rounded text-sm text-justify">
                {data.descricaoAmbiente}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========== PAGE 5: SCORES CHART ========== */}
      <div className="p-8 border-t-4 border-blue-700 page-break-before">
        <PageHeader title="AVALIAÇÃO QUANTITATIVA" pageNum={5} />

        {/* Global Score */}
        <div className="mt-6 flex items-center justify-between bg-gray-100 p-4 rounded-lg">
          <div>
            <p className="text-sm text-gray-600">Score Global</p>
            <p className="text-4xl font-bold text-blue-800">{data.globalScore}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Classificação</p>
            <Badge className={`${getRiskBadgeColor(data.riskColor)} px-4 py-2 text-lg font-bold border`}>
              {data.riskLabel}
            </Badge>
          </div>
        </div>

        {/* Blocks (for ERGOS) */}
        {data.blocks && Object.keys(data.blocks).length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4">
            {Object.entries(data.blocks).map(([blockId, block]) => (
              <div key={blockId} className="border rounded-lg p-4">
                <h4 className="font-semibold text-blue-700 mb-3">{block.name}</h4>
                <p className="text-2xl font-bold text-center mb-4">{block.total}</p>
                <div className="space-y-2">
                  {block.dimensions.map((dim, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs w-24 truncate">{dim.name}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full ${getScoreBarColor(dim.color)} transition-all`}
                          style={{ width: `${(dim.score / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold w-6 text-right">{dim.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dimensions Table */}
        <div className="mt-6">
          <h3 className="font-bold text-blue-800 mb-3">Pontuação por Dimensão</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="border border-blue-900 p-2 text-left">Dimensão</th>
                <th className="border border-blue-900 p-2 text-center w-20">Score</th>
                <th className="border border-blue-900 p-2 text-center w-40">Gráfico</th>
                <th className="border border-blue-900 p-2 text-center w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.dimensions.map((dim, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border p-2">{dim.name}</td>
                  <td className="border p-2 text-center font-bold">{dim.score}</td>
                  <td className="border p-2">
                    <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full ${getScoreBarColor(dim.color)}`}
                        style={{ width: `${(dim.score / 10) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="border p-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskBadgeColor(dim.color)}`}>
                      {dim.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== PAGE 6: TECHNICAL OPINION ========== */}
      <div className="p-8 border-t-4 border-blue-700 page-break-before">
        <PageHeader title="PARECER TÉCNICO" pageNum={6} />

        <div className="mt-6 space-y-6">
          <section>
            <h3 className="font-bold text-blue-800 mb-3 bg-blue-100 p-2 rounded">ANÁLISE</h3>
            <div 
              className="prose prose-sm max-w-none text-justify leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.analysis || "<p>Análise não disponível.</p>") }}
            />
          </section>

          <section>
            <h3 className="font-bold text-blue-800 mb-3 bg-blue-100 p-2 rounded">CONCLUSÃO</h3>
            <div 
              className="prose prose-sm max-w-none text-justify leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.conclusion || "<p>Conclusão não disponível.</p>") }}
            />
          </section>

          {/* Risk Description Box */}
          <div className={`p-4 rounded-lg border-2 ${
            data.riskColor === "green" ? "bg-green-50 border-green-300" :
            data.riskColor === "yellow" ? "bg-yellow-50 border-yellow-300" :
            data.riskColor === "red" ? "bg-red-50 border-red-300" :
            "bg-gray-50 border-gray-300"
          }`}>
            <p className="font-semibold mb-2">Interpretação do Resultado ({data.riskLabel}):</p>
            <p className="text-sm">{data.riskDescription}</p>
          </div>
        </div>
      </div>

      {/* ========== PAGE 7: RISK INVENTORY (FMEA) ========== */}
      {data.riskMatrix && data.riskMatrix.length > 0 && (
        <div className="p-8 border-t-4 border-blue-700 page-break-before">
          <PageHeader title="INVENTÁRIO DE RISCOS (FMEA)" pageNum={7} />

          <table className="w-full border-collapse text-xs mt-6">
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="border border-blue-900 p-2">Fator de Risco</th>
                <th className="border border-blue-900 p-2">Fonte Geradora</th>
                <th className="border border-blue-900 p-2 w-10">G</th>
                <th className="border border-blue-900 p-2 w-10">P</th>
                <th className="border border-blue-900 p-2 w-10">D</th>
                <th className="border border-blue-900 p-2 w-12">NRE</th>
                <th className="border border-blue-900 p-2 w-20">Class.</th>
                <th className="border border-blue-900 p-2">Ação Sugerida</th>
              </tr>
            </thead>
            <tbody>
              {data.riskMatrix.map((item, idx) => {
                const { label, color } = getNREClassification(item.nre);
                return (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border p-2">{item.risk_factor}</td>
                    <td className="border p-2">{item.source || "-"}</td>
                    <td className="border p-2 text-center font-bold">{item.severity_g}</td>
                    <td className="border p-2 text-center font-bold">{item.probability_p}</td>
                    <td className="border p-2 text-center font-bold">{item.detection_d}</td>
                    <td className="border p-2 text-center font-bold">{item.nre}</td>
                    <td className="border p-2 text-center">
                      <span className={`px-1 py-0.5 rounded text-white text-[10px] ${color}`}>
                        {label}
                      </span>
                    </td>
                    <td className="border p-2 text-[10px]">{item.suggested_action || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 text-xs text-gray-500">
            <p><strong>Legenda:</strong> G = Gravidade | P = Probabilidade | D = Detecção | NRE = Nível de Risco Ergonômico</p>
          </div>
        </div>
      )}

      {/* ========== PAGE 8: RECOMMENDATIONS ========== */}
      <div className="p-8 border-t-4 border-blue-700 page-break-before">
        <PageHeader title="RECOMENDAÇÕES E PLANO DE AÇÃO" pageNum={8} />

        <div className="mt-6">
          {data.recommendations.length > 0 ? (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-blue-800 text-white">
                  <th className="border border-blue-900 p-2 w-8">#</th>
                  <th className="border border-blue-900 p-2">Recomendação</th>
                  <th className="border border-blue-900 p-2 w-24">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {data.recommendations.map((rec, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border p-2 text-center font-bold">{idx + 1}</td>
                    <td className="border p-2">{rec}</td>
                    <td className="border p-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        idx < 2 ? "bg-red-100 text-red-800" :
                        idx < 4 ? "bg-yellow-100 text-yellow-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {idx < 2 ? "Alta" : idx < 4 ? "Média" : "Baixa"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-center py-8">Nenhuma recomendação disponível.</p>
          )}
        </div>

        {/* Normative References */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">Referências Normativas:</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• NR-01 - Disposições Gerais e Gerenciamento de Riscos Ocupacionais</li>
            <li>• NR-17 - Ergonomia</li>
            <li>• ISO 10075-1 - Princípios Ergonômicos relacionados à Carga Mental de Trabalho</li>
            <li>• ISO 45003 - Gestão da Saúde e Segurança Ocupacional - Riscos Psicossociais</li>
            <li>• ISO 31000 - Gestão de Riscos</li>
          </ul>
        </div>
      </div>

      {/* ========== PAGE 9: SIGNATURE ========== */}
      <div className="p-8 border-t-4 border-blue-700 page-break-before">
        <PageHeader title="ENCERRAMENTO E ASSINATURA" pageNum={9} />

        <div className="mt-12 space-y-16">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-8">
              Este documento foi elaborado conforme os preceitos técnicos e científicos da Ergonomia, 
              atendendo às exigências legais da NR-01 e NR-17.
            </p>
            <p className="text-sm">
              {data.company.municipio}, {format(new Date(data.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="flex justify-center">
            <div className="text-center w-80">
              <div className="border-b-2 border-black mb-2 h-16" />
              <p className="font-bold">{data.responsavelTecnico.nome}</p>
              <p className="text-sm text-gray-600">{data.responsavelTecnico.profissao}</p>
              <p className="text-sm text-gray-600">{data.responsavelTecnico.registro}</p>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 mt-16">
            <p>HC – Consultoria em Ergonomia e Fisioterapia</p>
            <p>Rua das Hortencias, 156, Jardim Cuiabá – CEP 78.048-156 – Cuiabá/MT</p>
            <p>ftandreoliveira@yahoo.com.br | (65) 99976-1706</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function PageHeader({ title, pageNum }: { title: string; pageNum: number }) {
  return (
    <div className="flex items-center justify-between border-b border-blue-300 pb-2">
      <h2 className="text-lg font-bold text-blue-800">{title}</h2>
      <div className="text-xs text-gray-500">
        <span>Página {pageNum}</span>
      </div>
    </div>
  );
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border">
      <td className="border p-3 bg-gray-100 font-semibold w-1/3">{label}:</td>
      <td className="border p-3">{value}</td>
    </tr>
  );
}

export default TanguroReportTemplate;
