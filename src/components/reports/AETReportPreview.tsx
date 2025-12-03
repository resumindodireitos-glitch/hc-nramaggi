import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DimensionScore {
  name: string;
  score: number;
  status?: string;
  color?: string;
}

interface ReportData {
  respondentData: Record<string, string>;
  dimensionScores: DimensionScore[] | Array<[string, number]>;
  analysis: string;
  conclusion: string;
  recommendations: string[];
  riskLevel: string | null;
  formType: string;
  createdAt: string;
}

interface AETReportPreviewProps {
  data: ReportData;
}

export function AETReportPreview({ data }: AETReportPreviewProps) {
  const getNRELabel = (score: number): string => {
    if (score <= 50) return "TRIVIAL";
    if (score <= 100) return "TOLERÁVEL";
    if (score <= 200) return "MODERADO";
    if (score <= 400) return "SUBSTANCIAL";
    return "INTOLERÁVEL";
  };

  const getNREColor = (label: string): string => {
    switch (label.toUpperCase()) {
      case "TRIVIAL": return "bg-green-500 text-white";
      case "TOLERÁVEL": return "bg-emerald-500 text-white";
      case "MODERADO": return "bg-yellow-500 text-black";
      case "SUBSTANCIAL": return "bg-orange-500 text-white";
      case "INTOLERÁVEL": return "bg-red-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-emerald-600";
    if (score >= 40) return "text-yellow-600";
    if (score >= 20) return "text-orange-600";
    return "text-red-600";
  };

  // Normalize dimension scores to consistent format
  const normalizedScores: DimensionScore[] = data.dimensionScores.map(item => {
    if (Array.isArray(item)) {
      // Legacy tuple format [name, score]
      return { name: item[0], score: item[1] };
    }
    // New object format
    return item;
  });

  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto print:p-0" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="border-b-2 border-primary pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">
              ANÁLISE ERGONÔMICA DO TRABALHO - AET
            </h1>
            <p className="text-sm text-gray-600">
              HC Consultoria em Ergonomia e Fisioterapia
            </p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Data: {format(new Date(data.createdAt), "dd/MM/yyyy", { locale: ptBR })}</p>
            <p>Tipo: {data.formType?.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Respondent Data */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-primary border-b border-gray-300 pb-1 mb-3">
          1. IDENTIFICAÇÃO
        </h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-2 font-semibold w-1/4">Nome:</td>
              <td className="py-2">{data.respondentData.nome || "-"}</td>
              <td className="py-2 font-semibold w-1/4">Empresa:</td>
              <td className="py-2">{data.respondentData.empresa || "Amaggi"}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 font-semibold">Setor:</td>
              <td className="py-2">{data.respondentData.setor || "-"}</td>
              <td className="py-2 font-semibold">Cargo:</td>
              <td className="py-2">{data.respondentData.cargo || "-"}</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 font-semibold">Tempo na Empresa:</td>
              <td className="py-2">{data.respondentData.tempo_empresa || "-"}</td>
              <td className="py-2 font-semibold">Gênero:</td>
              <td className="py-2">{data.respondentData.genero || "-"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Risk Classification */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-primary border-b border-gray-300 pb-1 mb-3">
          2. CLASSIFICAÇÃO DE RISCO ERGONÔMICO
        </h2>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <span className="text-sm font-semibold">Nível de Risco:</span>
          </div>
          <Badge className={`${getNREColor(data.riskLevel || "")} px-4 py-1 text-sm`}>
            {data.riskLevel?.toUpperCase() || "N/A"}
          </Badge>
        </div>
      </section>

      {/* Dimension Scores */}
      {normalizedScores.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-primary border-b border-gray-300 pb-1 mb-3">
            3. PONTUAÇÃO POR DIMENSÃO
          </h2>
          <table className="w-full border-collapse text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Dimensão</th>
                <th className="border p-2 text-center w-24">Pontuação</th>
                <th className="border p-2 text-center w-32">Classificação</th>
              </tr>
            </thead>
            <tbody>
              {normalizedScores.map((dim, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border p-2">{dim.name}</td>
                  <td className={`border p-2 text-center font-bold ${getScoreColor(Number(dim.score))}`}>
                    {dim.score}%
                  </td>
                  <td className="border p-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      dim.color === "green" || Number(dim.score) <= 30 ? "bg-green-100 text-green-800" :
                      dim.color === "yellow" || Number(dim.score) <= 60 ? "bg-yellow-100 text-yellow-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {dim.status || (
                        Number(dim.score) <= 30 ? "Satisfatório" :
                        Number(dim.score) <= 60 ? "Aceitável" : "Deve Melhorar"
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Analysis */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-primary border-b border-gray-300 pb-1 mb-3">
          4. ANÁLISE ERGONÔMICA
        </h2>
        <div 
          className="prose prose-sm max-w-none text-justify"
          dangerouslySetInnerHTML={{ __html: data.analysis || "<p>Análise não disponível.</p>" }}
        />
      </section>

      {/* Conclusion */}
      <section className="mb-6">
        <h2 className="text-lg font-bold text-primary border-b border-gray-300 pb-1 mb-3">
          5. CONCLUSÃO
        </h2>
        <div 
          className="prose prose-sm max-w-none text-justify"
          dangerouslySetInnerHTML={{ __html: data.conclusion || "<p>Conclusão não disponível.</p>" }}
        />
      </section>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-primary border-b border-gray-300 pb-1 mb-3">
            6. RECOMENDAÇÕES
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {data.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Footer */}
      <section className="mt-8 pt-4 border-t-2 border-gray-300">
        <div className="flex justify-between items-end text-xs text-gray-500">
          <div>
            <p className="font-semibold">Referências Normativas:</p>
            <p>NR-01 | NR-17 | ISO 10075-1 | ISO 45003 | ISO 31000</p>
          </div>
          <div className="text-right">
            <p>HC Consultoria em Ergonomia e Fisioterapia</p>
            <p>Documento gerado automaticamente</p>
          </div>
        </div>
      </section>
    </div>
  );
}
