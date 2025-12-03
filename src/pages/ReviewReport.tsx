import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Save,
  FileText,
  User,
  Download,
  BarChart3,
  Edit3,
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

export default function ReviewReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const [report, setReport] = useState<ReportWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState("");
  const [editedConclusion, setEditedConclusion] = useState("");
  const [editedRecommendations, setEditedRecommendations] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    if (id) fetchReport();
  }, [id, isAdmin]);

  const fetchReport = async () => {
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*, submissions(*, forms(*))")
        .eq("id", id)
        .single();

      if (error) throw error;
      const reportData = data as ReportWithDetails;
      setReport(reportData);
      setEditedAnalysis(reportData.final_text_override || reportData.ai_analysis_text || "");
      setEditedConclusion(reportData.ai_conclusion || "");
      setEditedRecommendations((reportData.ai_recommendations || []).join("\n"));
    } catch (error) {
      console.error("Error fetching report:", error);
      toast.error("Erro ao carregar relatório");
      navigate("/reports");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!report) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("reports")
        .update({
          final_text_override: editedAnalysis,
          ai_conclusion: editedConclusion,
          ai_recommendations: editedRecommendations.split("\n").filter(r => r.trim()),
        })
        .eq("id", report.id);

      if (error) throw error;
      toast.success("Alterações salvas!");
      fetchReport();
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
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

      toast.success("Relatório aprovado!");
      fetchReport();
    } catch (error) {
      console.error("Error approving report:", error);
      toast.error("Erro ao aprovar");
    } finally {
      setApproving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!report) return;
    setGeneratingPdf(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf", {
        body: { reportId: report.id },
      });

      if (error) throw error;

      // Open HTML in new tab for printing
      const html = atob(data.pdf);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      toast.success("PDF gerado! Use Ctrl+P para imprimir.");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const getRespondentData = (data: Json) => {
    if (typeof data === "object" && data !== null) {
      return data as Record<string, string>;
    }
    return {};
  };

  const getAnswers = (data: Json) => {
    if (typeof data === "object" && data !== null) {
      return data as Record<string, number | string>;
    }
    return {};
  };

  const getDimensionScores = (scores: Json) => {
    if (typeof scores === "object" && scores !== null && !Array.isArray(scores)) {
      return Object.entries(scores as Record<string, number>);
    }
    return [];
  };

  const getRiskColor = (risk: string | null) => {
    switch (risk?.toLowerCase()) {
      case "critico":
      case "intoleravel":
        return "bg-destructive text-destructive-foreground";
      case "alto":
      case "substancial":
        return "bg-destructive/80 text-destructive-foreground";
      case "medio":
      case "moderado":
        return "bg-warning text-warning-foreground";
      case "baixo":
      case "toleravel":
        return "bg-success/80 text-success-foreground";
      case "adequado":
      case "trivial":
        return "bg-success text-success-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
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

  const respondent = getRespondentData(report.submissions?.respondent_data || {});
  const answers = getAnswers(report.submissions?.answers || {});

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Revisão de Relatório</h1>
              <p className="text-muted-foreground text-sm">
                {report.submissions?.forms?.title} -{" "}
                {format(new Date(report.created_at!), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleGeneratePdf} disabled={generatingPdf}>
              {generatingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Gerar PDF
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
            {!report.is_approved && (
              <Button onClick={handleApprove} disabled={approving} className="gradient-primary">
                {approving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Aprovar
              </Button>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-3">
          {report.risk_level && (
            <Badge className={getRiskColor(report.risk_level)}>
              Risco: {report.risk_level}
            </Badge>
          )}
          <Badge variant={report.is_approved ? "default" : "secondary"}>
            {report.is_approved ? "Aprovado" : "Pendente Revisão"}
          </Badge>
        </div>

        {/* Split View */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Submission Data */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5 text-primary" />
                  Dados do Respondente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(respondent).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Respostas do Formulário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {Object.entries(answers).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground">{key.replace(/_/g, " ")}</span>
                      <Badge variant="outline">{value}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Dimension Scores */}
            {report.dimensions_score && getDimensionScores(report.dimensions_score).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Pontuação por Dimensão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getDimensionScores(report.dimensions_score).map(([dimension, score]) => (
                      <div key={dimension} className="flex items-center justify-between">
                        <span className="text-sm">{dimension}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, Number(score))}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: AI Analysis (Editable) */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Edit3 className="h-5 w-5 text-primary" />
                  Análise (Editável)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Texto de Análise</Label>
                  <Textarea
                    value={editedAnalysis}
                    onChange={(e) => setEditedAnalysis(e.target.value)}
                    rows={10}
                    className="resize-none"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Conclusão</Label>
                  <Textarea
                    value={editedConclusion}
                    onChange={(e) => setEditedConclusion(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Recomendações (uma por linha)</Label>
                  <Textarea
                    value={editedRecommendations}
                    onChange={(e) => setEditedRecommendations(e.target.value)}
                    rows={6}
                    className="resize-none"
                    placeholder="Recomendação 1&#10;Recomendação 2&#10;Recomendação 3"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
