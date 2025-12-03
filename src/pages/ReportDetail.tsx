import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FileText,
  Lightbulb,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database, Json } from "@/integrations/supabase/types";

type Report = Database["public"]["Tables"]["reports"]["Row"];
type Submission = Database["public"]["Tables"]["submissions"]["Row"];
type Form = Database["public"]["Tables"]["forms"]["Row"];

interface ReportWithDetails extends Report {
  submissions: (Submission & { forms: Form | null }) | null;
}

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const [report, setReport] = useState<ReportWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (id) fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*, submissions(*, forms(*))")
        .eq("id", id)
        .single();

      if (error) throw error;
      setReport(data as ReportWithDetails);
    } catch (error) {
      console.error("Error fetching report:", error);
      toast.error("Erro ao carregar relatório");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const approveReport = async () => {
    if (!report) return;
    setApproving(true);

    try {
      const { error } = await supabase
        .from("reports")
        .update({ is_approved: true })
        .eq("id", report.id);

      if (error) throw error;

      await supabase
        .from("submissions")
        .update({ status: "approved" })
        .eq("id", report.submission_id);

      toast.success("Relatório aprovado com sucesso!");
      fetchReport();
    } catch (error) {
      console.error("Error approving report:", error);
      toast.error("Erro ao aprovar relatório");
    } finally {
      setApproving(false);
    }
  };

  const getRiskColor = (risk: string | null) => {
    switch (risk?.toLowerCase()) {
      // Labels ERGOS
      case "deve melhorar":
      case "critico":
      case "alto":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "aceitável":
      case "medio":
      case "moderado":
        return "bg-warning/10 text-warning border-warning/20";
      case "satisfatório":
      case "baixo":
      case "adequado":
        return "bg-success/10 text-success border-success/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getDimensionScores = (scores: Json): Array<{ name: string; score: number; status: string; color: string }> => {
    if (typeof scores !== "object" || scores === null) return [];
    
    const data = scores as Record<string, any>;
    
    // If has dimensions array, use it directly (new universal format)
    if (data.dimensions && Array.isArray(data.dimensions)) {
      return data.dimensions.map((dim: any) => ({
        name: dim.name,
        score: Math.round(dim.normalized_score ?? dim.score ?? 0),
        status: dim.status || "N/A",
        color: dim.color || "yellow"
      }));
    }
    
    // Fallback for legacy format - filter out metadata fields
    const excludeKeys = ['blocos', 'global_score', 'risk_level', 'risk_label', 
                         'risk_color', 'risk_description', 'calculation_method', 
                         'calculated_at', 'dimensions'];
    
    return Object.entries(data)
      .filter(([key]) => !excludeKeys.includes(key))
      .map(([name, value]) => ({
        name,
        score: Math.round(typeof value === 'object' ? ((value as any).normalized_score ?? (value as any).score ?? 0) : Number(value) || 0),
        status: typeof value === 'object' ? (value as any).status || 'N/A' : 'N/A',
        color: typeof value === 'object' ? (value as any).color || 'yellow' : 'yellow'
      }));
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Relatório não encontrado</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>

          {isAdmin && !report.is_approved && (
            <Button onClick={approveReport} disabled={approving} className="gap-2 gradient-primary">
              {approving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Aprovar Relatório
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Relatório de Análise
                </CardTitle>
                <CardDescription>
                  {report.submissions?.forms?.title || "Formulário"} -{" "}
                  {format(new Date(report.created_at!), "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {report.risk_level && (
                  <Badge variant="outline" className={getRiskColor(report.risk_level)}>
                    Risco {report.risk_level.charAt(0).toUpperCase() + report.risk_level.slice(1)}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={
                    report.is_approved
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-warning/10 text-warning border-warning/20"
                  }
                >
                  {report.is_approved ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Aprovado
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Pendente
                    </>
                  )}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dimension Scores */}
            {report.dimensions_score && getDimensionScores(report.dimensions_score).length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Pontuação por Dimensão
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {getDimensionScores(report.dimensions_score).map((dim) => (
                    <div
                      key={dim.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <span className="text-sm font-medium">{dim.name}</span>
                      <Badge
                        variant="outline"
                        className={
                          dim.color === "green" || dim.score <= 30
                            ? "bg-success/10 text-success border-success/20"
                            : dim.color === "yellow" || dim.score <= 60
                            ? "bg-warning/10 text-warning border-warning/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {dim.score}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* AI Analysis */}
            {report.ai_analysis_text && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Análise Detalhada
                </h3>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {report.final_text_override || report.ai_analysis_text}
                  </p>
                </div>
              </div>
            )}

            {/* Conclusion */}
            {report.ai_conclusion && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Conclusão
                </h3>
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm text-foreground">{report.ai_conclusion}</p>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {report.ai_recommendations && report.ai_recommendations.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-warning" />
                  Recomendações
                </h3>
                <ul className="space-y-2">
                  {report.ai_recommendations.map((rec, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-warning/10 text-warning text-sm font-medium flex items-center justify-center">
                        {index + 1}
                      </span>
                      <p className="text-sm text-foreground">{rec}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
