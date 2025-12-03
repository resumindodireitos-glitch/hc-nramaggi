import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AETReportPreview } from "@/components/reports/AETReportPreview";
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
  AlertTriangle,
  TrendingUp,
  Building2,
  Briefcase,
  Clock,
  Sparkles,
  Eye,
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
  const [showPreview, setShowPreview] = useState(false);
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
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
      // Convert recommendations array to HTML list
      const recs = reportData.ai_recommendations || [];
      setEditedRecommendations(recs.length > 0 ? `<ul>${recs.map(r => `<li>${r}</li>`).join('')}</ul>` : "");
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
      // Extract text from HTML for recommendations (strip tags and split by list items)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = editedRecommendations;
      const listItems = tempDiv.querySelectorAll('li');
      const recommendations = listItems.length > 0 
        ? Array.from(listItems).map(li => li.textContent?.trim() || '').filter(Boolean)
        : editedRecommendations.replace(/<[^>]*>/g, '').split('\n').filter(r => r.trim());

      const { error } = await supabase
        .from("reports")
        .update({
          final_text_override: editedAnalysis,
          ai_conclusion: editedConclusion,
          ai_recommendations: recommendations,
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

  const handleRegenerateAnalysis = async () => {
    if (!report) return;
    setRegenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-narrative-report", {
        body: { reportId: report.id },
      });

      if (error) throw error;
      
      if (data?.analysis) {
        setEditedAnalysis(data.analysis);
        toast.success("Análise regenerada com IA!");
      }
    } catch (error) {
      console.error("Error regenerating analysis:", error);
      toast.error("Erro ao regenerar análise");
    } finally {
      setRegenerating(false);
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

  const handleGenerateDocx = async () => {
    if (!report) return;
    setGeneratingDocx(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-docx", {
        body: { reportId: report.id },
      });

      if (error) throw error;

      const xml = atob(data.docx);
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "relatorio_aet.xml";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("DOCX gerado com sucesso!");
    } catch (error) {
      console.error("Error generating DOCX:", error);
      toast.error("Erro ao gerar DOCX");
    } finally {
      setGeneratingDocx(false);
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

  const getDimensionScores = (scores: Json): Array<[string, number]> => {
    if (typeof scores === "object" && scores !== null && !Array.isArray(scores)) {
      return Object.entries(scores as Record<string, unknown>).map(([key, value]) => {
        // Handle both plain numbers and objects with {score, risk_color}
        if (typeof value === "object" && value !== null && "score" in value) {
          return [key, (value as { score: number }).score];
        }
        return [key, typeof value === "number" ? value : 0];
      });
    }
    return [];
  };

  const getRiskColor = (risk: string | null) => {
    switch (risk?.toLowerCase()) {
      case "critico":
      case "intoleravel":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "alto":
      case "substancial":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "medio":
      case "moderado":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "baixo":
      case "toleravel":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "adequado":
      case "trivial":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRiskIcon = (risk: string | null) => {
    switch (risk?.toLowerCase()) {
      case "critico":
      case "intoleravel":
      case "alto":
      case "substancial":
        return <AlertTriangle className="h-4 w-4" />;
      case "adequado":
      case "trivial":
      case "baixo":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-emerald-500";
    if (score >= 40) return "bg-yellow-500";
    if (score >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  const fieldLabels: Record<string, string> = {
    nome: "Nome",
    empresa: "Empresa",
    setor: "Setor",
    cargo: "Cargo",
    genero: "Gênero",
    tempo_empresa: "Tempo na Empresa",
    data_avaliacao: "Data da Avaliação",
  };

  // Fields to exclude (duplicates/internal)
  const excludedFields = ["full_name", "sexo", "tempo_funcao", "submitted_at", "user_id"];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando relatório...</p>
          </div>
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
  const dimensionScores = getDimensionScores(report.dimensions_score);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/reports")}
              className="rounded-full hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">
                Revisão de Relatório
              </h1>
              <p className="text-sm text-muted-foreground">
                {report.submissions?.forms?.title} • {format(new Date(report.created_at!), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Actions & Status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border">
            <div className="flex items-center gap-3">
              {report.risk_level && (
                <Badge variant="outline" className={`${getRiskColor(report.risk_level)} px-3 py-1.5 gap-2`}>
                  {getRiskIcon(report.risk_level)}
                  Risco {report.risk_level}
                </Badge>
              )}
              <Badge variant={report.is_approved ? "default" : "secondary"} className="px-3 py-1.5">
                {report.is_approved ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1.5" />
                    Aprovado
                  </>
                ) : (
                  "Pendente Revisão"
                )}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowPreview(true)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleGeneratePdf} 
                disabled={generatingPdf}
                className="gap-2"
              >
                {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Gerar PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSave} 
                disabled={saving}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
              {!report.is_approved && (
                <Button 
                  size="sm"
                  onClick={handleApprove} 
                  disabled={approving} 
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500"
                >
                  {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Aprovar Relatório
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: Data */}
          <div className="lg:col-span-2 space-y-4">
            {/* Respondent Data */}
            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  Dados do Respondente
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {Object.entries(respondent)
                    .filter(([key]) => !excludedFields.includes(key))
                    .map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        {key === "nome" && <User className="h-3.5 w-3.5" />}
                        {key === "empresa" && <Building2 className="h-3.5 w-3.5" />}
                        {key === "setor" && <Building2 className="h-3.5 w-3.5" />}
                        {key === "cargo" && <Briefcase className="h-3.5 w-3.5" />}
                        {key === "tempo_empresa" && <Clock className="h-3.5 w-3.5" />}
                        {fieldLabels[key] || key}
                      </span>
                      <span className="text-sm font-medium text-foreground">{value || "-"}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Dimension Scores */}
            {dimensionScores.length > 0 && (
              <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-card to-muted/20">
                <CardHeader className="pb-3 border-b bg-muted/30">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </div>
                    Pontuação por Dimensão
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {dimensionScores.map(([dimension, score]) => (
                      <div key={dimension} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{dimension}</span>
                          <span className="text-sm font-bold">{score}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${getScoreColor(Number(score))}`}
                            style={{ width: `${Math.min(100, Number(score))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Form Answers */}
            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  Respostas do Formulário
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {Object.entries(answers).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-sm text-muted-foreground truncate max-w-[60%]">{key}</span>
                      <Badge variant="secondary" className="font-medium">{value}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Analysis */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Edit3 className="h-4 w-4 text-primary" />
                  </div>
                  Análise do Relatório
                  <Badge variant="outline" className="ml-2 text-xs">Editável</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Texto de Análise</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRegenerateAnalysis}
                      disabled={regenerating}
                      className="h-7 gap-1.5 text-xs"
                    >
                      {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Regerar IA
                    </Button>
                  </div>
                  <RichTextEditor
                    content={editedAnalysis}
                    onChange={setEditedAnalysis}
                    placeholder="Digite a análise do relatório..."
                    className="min-h-[300px]"
                  />
                </div>

                <Separator className="bg-border/50" />

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Conclusão</Label>
                  <RichTextEditor
                    content={editedConclusion}
                    onChange={setEditedConclusion}
                    placeholder="Digite a conclusão..."
                    className="min-h-[150px]"
                  />
                </div>

                <Separator className="bg-border/50" />

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Recomendações</Label>
                  <p className="text-xs text-muted-foreground">Use listas ou parágrafos para cada recomendação</p>
                  <RichTextEditor
                    content={editedRecommendations}
                    onChange={setEditedRecommendations}
                    placeholder="• Recomendação 1&#10;• Recomendação 2&#10;• Recomendação 3"
                    className="min-h-[180px]"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Preview do Relatório AET</DialogTitle>
            </DialogHeader>
            <AETReportPreview
              data={{
                respondentData: respondent,
                dimensionScores: dimensionScores,
                analysis: editedAnalysis,
                conclusion: editedConclusion,
                recommendations: editedRecommendations.replace(/<[^>]*>/g, '').split('\n').filter(r => r.trim()),
                riskLevel: report.risk_level,
                formType: report.submissions?.forms?.type || "ergos",
                createdAt: report.created_at || new Date().toISOString(),
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
