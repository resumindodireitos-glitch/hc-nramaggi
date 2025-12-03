import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AETReportPreview } from "@/components/reports/AETReportPreview";
import { UniversalScoreChart } from "@/components/reports/UniversalScoreChart";
import { TanguroReportTemplate } from "@/components/reports/TanguroReportTemplate";
import { mapReportToTanguroFormat } from "@/lib/tanguroDataMapper";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { printHtmlAsPdf } from "@/lib/pdfUtils";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Save,
  FileText,
  User,
  Download,
  Edit3,
  AlertTriangle,
  TrendingUp,
  Building2,
  Briefcase,
  Clock,
  Sparkles,
  Eye,
  RefreshCw,
  Calculator,
  Plus,
  Trash2,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database, Json } from "@/integrations/supabase/types";

type Report = Database["public"]["Tables"]["reports"]["Row"];
type Submission = Database["public"]["Tables"]["submissions"]["Row"];
type Form = Database["public"]["Tables"]["forms"]["Row"];
type FMEACalculation = Database["public"]["Tables"]["fmea_calculations"]["Row"];
type SuggestedAction = Database["public"]["Tables"]["suggested_actions"]["Row"];

interface ReportWithDetails extends Report {
  submissions: (Submission & { forms: Form | null }) | null;
}

interface EditedRespondent {
  nome: string;
  setor: string;
  cargo: string;
  cbo: string;
  turno: string;
  pausas: string;
  tempo_empresa: string;
}

interface EditedWorkDescription {
  trabalho_real: string;
  trabalho_prescrito: string;
  descricao_ambiente: string;
}

interface EditableAction {
  id?: string;
  risk_detected: string;
  dimension: string;
  action_title: string;
  action_description: string;
  priority: string;
  nre_score: number;
  nre_classification: string;
  status: string;
  isNew?: boolean;
}

export default function ReviewReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  
  // Report state
  const [report, setReport] = useState<ReportWithDetails | null>(null);
  const [fmeaData, setFmeaData] = useState<FMEACalculation | null>(null);
  const [suggestedActions, setSuggestedActions] = useState<EditableAction[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRespondent, setSavingRespondent] = useState(false);
  const [savingFMEA, setSavingFMEA] = useState(false);
  const [approving, setApproving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculatingFMEA, setRecalculatingFMEA] = useState(false);
  
  // Section regeneration states
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  
  // Preview mode
  const [previewMode, setPreviewMode] = useState<"simple" | "tanguro">("tanguro");
  
  // Editable fields - Analysis
  const [editedAnalysis, setEditedAnalysis] = useState("");
  const [editedConclusion, setEditedConclusion] = useState("");
  const [editedRecommendations, setEditedRecommendations] = useState("");
  
  // Editable fields - Respondent
  const [editedRespondent, setEditedRespondent] = useState<EditedRespondent>({
    nome: "", setor: "", cargo: "", cbo: "", turno: "", pausas: "", tempo_empresa: ""
  });
  
  // Editable fields - Work Description
  const [editedWorkDescription, setEditedWorkDescription] = useState<EditedWorkDescription>({
    trabalho_real: "", trabalho_prescrito: "", descricao_ambiente: ""
  });

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
      // Fetch report with related data
      const { data, error } = await supabase
        .from("reports")
        .select("*, submissions(*, forms(*))")
        .eq("id", id)
        .single();

      if (error) throw error;
      const reportData = data as ReportWithDetails;
      setReport(reportData);
      
      // Initialize analysis fields
      setEditedAnalysis(reportData.final_text_override || reportData.ai_analysis_text || "");
      setEditedConclusion(reportData.ai_conclusion || "");
      const recs = reportData.ai_recommendations || [];
      setEditedRecommendations(recs.length > 0 ? `<ul>${recs.map(r => `<li>${r}</li>`).join('')}</ul>` : "");
      
      // Initialize respondent fields
      const respondent = typeof reportData.submissions?.respondent_data === 'object' 
        ? reportData.submissions.respondent_data as Record<string, string>
        : {};
      setEditedRespondent({
        nome: respondent.nome || respondent.cpf || "",
        setor: respondent.setor || "",
        cargo: respondent.cargo || "",
        cbo: respondent.cbo || "",
        turno: respondent.turno || "Comercial",
        pausas: respondent.pausas || "",
        tempo_empresa: respondent.tempo_empresa || ""
      });
      
      // Initialize work description fields
      setEditedWorkDescription({
        trabalho_real: respondent.trabalho_real || respondent.descricao_atividade || "",
        trabalho_prescrito: respondent.trabalho_prescrito || respondent.cbo_description || "",
        descricao_ambiente: respondent.descricao_ambiente || respondent.ambiente || ""
      });
      
      // Fetch FMEA data
      const { data: fmea } = await supabase
        .from("fmea_calculations")
        .select("*")
        .eq("report_id", id)
        .maybeSingle();
      setFmeaData(fmea);
      
      // Fetch suggested actions
      const { data: actions } = await supabase
        .from("suggested_actions")
        .select("*")
        .eq("report_id", id)
        .order("nre_score", { ascending: false });
      
      if (actions) {
        setSuggestedActions(actions.map(a => ({
          id: a.id,
          risk_detected: a.risk_detected,
          dimension: a.dimension || "",
          action_title: a.action_title,
          action_description: a.action_description || "",
          priority: a.priority || "media",
          nre_score: a.nre_score || 0,
          nre_classification: a.nre_classification || "Moderado",
          status: a.status || "pendente"
        })));
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      toast.error("Erro ao carregar relatório");
      navigate("/reports");
    } finally {
      setLoading(false);
    }
  };

  // === SAVE HANDLERS ===
  
  const handleSaveAnalysis = async () => {
    if (!report) return;
    setSaving(true);

    try {
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
          ai_analysis_text: editedAnalysis,
          ai_conclusion: editedConclusion,
          ai_recommendations: recommendations,
        })
        .eq("id", report.id);

      if (error) throw error;
      toast.success("Análise salva!");
      fetchReport();
    } catch (error) {
      console.error("Error saving analysis:", error);
      toast.error("Erro ao salvar análise");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRespondentData = async () => {
    if (!report?.submissions) return;
    setSavingRespondent(true);

    try {
      const currentData = typeof report.submissions.respondent_data === 'object'
        ? report.submissions.respondent_data as Record<string, any>
        : {};

      const updatedData = {
        ...currentData,
        ...editedRespondent,
        trabalho_real: editedWorkDescription.trabalho_real,
        trabalho_prescrito: editedWorkDescription.trabalho_prescrito,
        descricao_ambiente: editedWorkDescription.descricao_ambiente,
        descricao_atividade: editedWorkDescription.trabalho_real,
        cbo_description: editedWorkDescription.trabalho_prescrito,
        ambiente: editedWorkDescription.descricao_ambiente,
      };

      const { error } = await supabase
        .from("submissions")
        .update({ respondent_data: updatedData as Json })
        .eq("id", report.submissions.id);

      if (error) throw error;
      toast.success("Dados do respondente salvos!");
      fetchReport();
    } catch (error) {
      console.error("Error saving respondent data:", error);
      toast.error("Erro ao salvar dados");
    } finally {
      setSavingRespondent(false);
    }
  };

  const handleSaveFMEA = async () => {
    if (!report) return;
    setSavingFMEA(true);

    try {
      // Update existing actions
      for (const action of suggestedActions.filter(a => a.id && !a.isNew)) {
        await supabase
          .from("suggested_actions")
          .update({
            risk_detected: action.risk_detected,
            dimension: action.dimension,
            action_title: action.action_title,
            action_description: action.action_description,
            priority: action.priority,
            nre_score: action.nre_score,
            nre_classification: action.nre_classification,
            status: action.status,
          })
          .eq("id", action.id);
      }

      // Insert new actions
      const newActions = suggestedActions.filter(a => a.isNew);
      if (newActions.length > 0) {
        await supabase
          .from("suggested_actions")
          .insert(newActions.map(a => ({
            report_id: report.id,
            risk_detected: a.risk_detected,
            dimension: a.dimension,
            action_title: a.action_title,
            action_description: a.action_description,
            priority: a.priority,
            nre_score: a.nre_score,
            nre_classification: a.nre_classification,
            status: a.status,
          })));
      }

      toast.success("Matriz FMEA salva!");
      fetchReport();
    } catch (error) {
      console.error("Error saving FMEA:", error);
      toast.error("Erro ao salvar FMEA");
    } finally {
      setSavingFMEA(false);
    }
  };

  // === REGENERATION HANDLERS ===

  const handleRegenerateSection = async (section: "analysis" | "conclusion" | "recommendations") => {
    if (!report) return;
    setRegeneratingSection(section);

    try {
      const { data, error } = await supabase.functions.invoke("generate-narrative-report", {
        body: { reportId: report.id, section },
      });

      if (error) throw error;
      
      if (data?.narrative) {
        if (section === "analysis") {
          setEditedAnalysis(data.narrative);
        } else if (section === "conclusion") {
          setEditedConclusion(data.narrative);
        } else if (section === "recommendations") {
          // Convert recommendations to HTML list
          const recs = data.narrative.split('\n').filter((r: string) => r.trim());
          setEditedRecommendations(`<ul>${recs.map((r: string) => `<li>${r.replace(/^[-•*]\s*/, '')}</li>`).join('')}</ul>`);
        }
        toast.success(`${section === "analysis" ? "Análise" : section === "conclusion" ? "Conclusão" : "Recomendações"} regenerada!`);
      }
    } catch (error) {
      console.error("Error regenerating section:", error);
      toast.error("Erro ao regenerar: " + (error as Error).message);
    } finally {
      setRegeneratingSection(null);
    }
  };

  // === RECALCULATION HANDLERS ===

  const handleRecalculateScores = async () => {
    if (!report) return;
    setRecalculating(true);

    try {
      const { data, error } = await supabase.functions.invoke("universal-calculator", {
        body: { reportId: report.id },
      });

      if (error) throw error;
      toast.success("Scores recalculados com sucesso!");
      fetchReport();
    } catch (error) {
      console.error("Error recalculating scores:", error);
      toast.error("Erro ao recalcular: " + (error as Error).message);
    } finally {
      setRecalculating(false);
    }
  };

  const handleRecalculateFMEA = async () => {
    if (!report) return;
    setRecalculatingFMEA(true);

    try {
      const { data, error } = await supabase.functions.invoke("calculate-fmea", {
        body: { reportId: report.id },
      });

      if (error) throw error;
      toast.success("FMEA recalculado!");
      fetchReport();
    } catch (error) {
      console.error("Error recalculating FMEA:", error);
      toast.error("Erro ao recalcular FMEA: " + (error as Error).message);
    } finally {
      setRecalculatingFMEA(false);
    }
  };

  // === OTHER HANDLERS ===

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
      const respondentName = editedRespondent.nome || "Relatorio";
      const jobTitle = editedRespondent.cargo || "";
      const filename = `AET_${jobTitle}_${respondentName}`.replace(/\s+/g, "_");
      
      printHtmlAsPdf(html, filename);
      
      toast.success("PDF aberto!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleAddRiskItem = () => {
    setSuggestedActions([
      ...suggestedActions,
      {
        risk_detected: "",
        dimension: "",
        action_title: "",
        action_description: "",
        priority: "media",
        nre_score: 0,
        nre_classification: "Moderado",
        status: "pendente",
        isNew: true,
      }
    ]);
  };

  const handleRemoveRiskItem = async (index: number) => {
    const action = suggestedActions[index];
    if (action.id && !action.isNew) {
      await supabase.from("suggested_actions").delete().eq("id", action.id);
    }
    setSuggestedActions(suggestedActions.filter((_, i) => i !== index));
    toast.success("Item removido");
  };

  const updateActionField = (index: number, field: keyof EditableAction, value: any) => {
    const updated = [...suggestedActions];
    updated[index] = { ...updated[index], [field]: value };
    setSuggestedActions(updated);
  };

  // === HELPER FUNCTIONS ===

  const getRiskColor = (risk: string | null) => {
    switch (risk?.toLowerCase()) {
      case "deve melhorar": case "critico": case "intoleravel": case "alto":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "aceitável": case "medio": case "moderado": case "substancial":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "satisfatório": case "baixo": case "toleravel": case "adequado": case "trivial":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRiskIcon = (risk: string | null) => {
    switch (risk?.toLowerCase()) {
      case "deve melhorar": case "critico": case "intoleravel": case "alto": case "substancial":
        return <AlertTriangle className="h-4 w-4" />;
      case "satisfatório": case "adequado": case "trivial": case "baixo":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getDimensionScores = (scores: Json): Array<{ name: string; score: number; status: string; color: string }> => {
    if (typeof scores !== "object" || scores === null) return [];
    const data = scores as Record<string, any>;
    if (data.dimensions && Array.isArray(data.dimensions)) {
      return data.dimensions.map((dim: any) => ({
        name: dim.name,
        score: Math.round(dim.normalized_score ?? dim.score ?? 0),
        status: dim.status || "N/A",
        color: dim.color || "yellow"
      }));
    }
    return [];
  };

  const getAnswers = (data: Json) => {
    if (typeof data === "object" && data !== null) {
      return data as Record<string, number | string>;
    }
    return {};
  };

  // === RENDER ===

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

  const answers = getAnswers(report.submissions?.answers || {});
  const dimensionScores = getDimensionScores(report.dimensions_score);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/reports")} className="rounded-full hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">Revisão de Relatório</h1>
              <p className="text-sm text-muted-foreground">
                {report.submissions?.forms?.title} • {format(new Date(report.created_at!), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Actions & Status Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border">
            <div className="flex items-center gap-3 flex-wrap">
              {report.risk_level && (
                <Badge variant="outline" className={`${getRiskColor(report.risk_level)} px-3 py-1.5 gap-2`}>
                  {getRiskIcon(report.risk_level)}
                  Risco {report.risk_level}
                </Badge>
              )}
              <Badge variant={report.is_approved ? "default" : "secondary"} className="px-3 py-1.5">
                {report.is_approved ? <><CheckCircle className="h-3 w-3 mr-1.5" />Aprovado</> : "Pendente Revisão"}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleRecalculateScores} disabled={recalculating} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
                Recalcular
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} className="gap-2">
                <Eye className="h-4 w-4" />Preview
              </Button>
              <Button variant="outline" size="sm" onClick={handleGeneratePdf} disabled={generatingPdf} className="gap-2">
                {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>
              {!report.is_approved && (
                <Button size="sm" onClick={handleApprove} disabled={approving} className="gap-2 bg-emerald-600 hover:bg-emerald-500">
                  {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Aprovar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="edit" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="edit" className="gap-2"><Edit3 className="h-4 w-4" />Edição</TabsTrigger>
            <TabsTrigger value="fmea" className="gap-2"><Calculator className="h-4 w-4" />Matriz FMEA</TabsTrigger>
            <TabsTrigger value="respondent" className="gap-2"><User className="h-4 w-4" />Dados</TabsTrigger>
          </TabsList>

          {/* Tab: Edição */}
          <TabsContent value="edit" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Left Column: Scores */}
              <div className="lg:col-span-2 space-y-4">
                {report.dimensions_score && (
                  <UniversalScoreChart 
                    data={report.dimensions_score as any} 
                    showRadar={false}
                    showBars={false}
                    showBlocks={report.submissions?.forms?.type === "ergos"}
                    compact
                  />
                )}
                
                {/* Answers Summary */}
                <Card className="overflow-hidden border-0 shadow-sm">
                  <CardHeader className="pb-3 border-b bg-muted/30">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4 text-primary" />
                      Respostas ({Object.keys(answers).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {Object.entries(answers).slice(0, 15).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                          <span className="text-xs text-muted-foreground truncate max-w-[55%]">{key}</span>
                          <Badge variant="secondary" className="text-xs">{String(value).slice(0, 30)}</Badge>
                        </div>
                      ))}
                      {Object.keys(answers).length > 15 && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          +{Object.keys(answers).length - 15} respostas...
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Analysis Editor */}
              <div className="lg:col-span-3 space-y-4">
                <Card className="overflow-hidden border-0 shadow-sm">
                  <CardHeader className="pb-3 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Edit3 className="h-4 w-4 text-primary" />
                        Análise do Relatório
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={handleSaveAnalysis} disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salvar Tudo
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-6">
                    {/* Analysis Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Texto de Análise</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerateSection("analysis")}
                          disabled={regeneratingSection === "analysis"}
                          className="h-7 gap-1.5 text-xs"
                        >
                          {regeneratingSection === "analysis" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          Regerar
                        </Button>
                      </div>
                      <RichTextEditor
                        content={editedAnalysis}
                        onChange={setEditedAnalysis}
                        placeholder="Digite a análise do relatório..."
                        className="min-h-[200px]"
                      />
                    </div>

                    <Separator />

                    {/* Conclusion Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Conclusão</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerateSection("conclusion")}
                          disabled={regeneratingSection === "conclusion"}
                          className="h-7 gap-1.5 text-xs"
                        >
                          {regeneratingSection === "conclusion" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          Regerar
                        </Button>
                      </div>
                      <RichTextEditor
                        content={editedConclusion}
                        onChange={setEditedConclusion}
                        placeholder="Digite a conclusão..."
                        className="min-h-[120px]"
                      />
                    </div>

                    <Separator />

                    {/* Recommendations Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Recomendações</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerateSection("recommendations")}
                          disabled={regeneratingSection === "recommendations"}
                          className="h-7 gap-1.5 text-xs"
                        >
                          {regeneratingSection === "recommendations" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          Regerar
                        </Button>
                      </div>
                      <RichTextEditor
                        content={editedRecommendations}
                        onChange={setEditedRecommendations}
                        placeholder="• Recomendação 1&#10;• Recomendação 2"
                        className="min-h-[150px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Tab: FMEA */}
          <TabsContent value="fmea" className="space-y-4">
            <Card>
              <CardHeader className="pb-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calculator className="h-4 w-4 text-primary" />
                    Inventário de Riscos (FMEA)
                    {fmeaData && (
                      <Badge variant="outline" className="ml-2">
                        NRE: {fmeaData.nre_score} ({fmeaData.nre_classification})
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleRecalculateFMEA} disabled={recalculatingFMEA} className="gap-2">
                      <RefreshCw className={`h-4 w-4 ${recalculatingFMEA ? "animate-spin" : ""}`} />
                      Recalcular
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSaveFMEA} disabled={savingFMEA} className="gap-2">
                      {savingFMEA ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {/* FMEA Summary */}
                {fmeaData && (
                  <div className="grid grid-cols-4 gap-4 mb-6 p-4 rounded-lg bg-muted/30">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Gravidade (G)</p>
                      <p className="text-2xl font-bold">{fmeaData.gravidade}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Probabilidade (P)</p>
                      <p className="text-2xl font-bold">{fmeaData.probabilidade}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Detecção (D)</p>
                      <p className="text-2xl font-bold">{fmeaData.capacidade_deteccao}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">NRE Total</p>
                      <p className="text-2xl font-bold text-primary">{fmeaData.nre_score}</p>
                    </div>
                  </div>
                )}

                {/* Actions Table */}
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px]">Risco Detectado</TableHead>
                        <TableHead className="w-[120px]">Dimensão</TableHead>
                        <TableHead>Ação Sugerida</TableHead>
                        <TableHead className="w-[100px]">Prioridade</TableHead>
                        <TableHead className="w-[80px]">NRE</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suggestedActions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhum risco identificado. Clique em "Adicionar" ou "Recalcular".
                          </TableCell>
                        </TableRow>
                      ) : (
                        suggestedActions.map((action, index) => (
                          <TableRow key={action.id || `new-${index}`}>
                            <TableCell>
                              <Input
                                value={action.risk_detected}
                                onChange={(e) => updateActionField(index, "risk_detected", e.target.value)}
                                placeholder="Risco..."
                                className="h-8 text-sm"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={action.dimension}
                                onChange={(e) => updateActionField(index, "dimension", e.target.value)}
                                placeholder="Dimensão"
                                className="h-8 text-sm"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={action.action_title}
                                onChange={(e) => updateActionField(index, "action_title", e.target.value)}
                                placeholder="Ação sugerida..."
                                className="h-8 text-sm"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={action.priority}
                                onValueChange={(val) => updateActionField(index, "priority", val)}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="baixa">Baixa</SelectItem>
                                  <SelectItem value="media">Média</SelectItem>
                                  <SelectItem value="alta">Alta</SelectItem>
                                  <SelectItem value="critica">Crítica</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={action.nre_score}
                                onChange={(e) => updateActionField(index, "nre_score", parseInt(e.target.value) || 0)}
                                className="h-8 text-sm w-16"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={action.status}
                                onValueChange={(val) => updateActionField(index, "status", val)}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pendente">Pendente</SelectItem>
                                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                                  <SelectItem value="concluido">Concluído</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveRiskItem(index)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                <Button variant="outline" onClick={handleAddRiskItem} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Risco
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Dados do Respondente */}
          <TabsContent value="respondent" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Respondent Info */}
              <Card>
                <CardHeader className="pb-3 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="h-4 w-4 text-primary" />
                      Dados do Respondente
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={handleSaveRespondentData} disabled={savingRespondent} className="gap-2">
                      {savingRespondent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Nome/CPF</Label>
                      <Input
                        value={editedRespondent.nome}
                        onChange={(e) => setEditedRespondent({ ...editedRespondent, nome: e.target.value })}
                        placeholder="Nome ou CPF"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Setor</Label>
                      <Input
                        value={editedRespondent.setor}
                        onChange={(e) => setEditedRespondent({ ...editedRespondent, setor: e.target.value })}
                        placeholder="Setor"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Cargo</Label>
                      <Input
                        value={editedRespondent.cargo}
                        onChange={(e) => setEditedRespondent({ ...editedRespondent, cargo: e.target.value })}
                        placeholder="Cargo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">CBO</Label>
                      <Input
                        value={editedRespondent.cbo}
                        onChange={(e) => setEditedRespondent({ ...editedRespondent, cbo: e.target.value })}
                        placeholder="Código CBO"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Turno</Label>
                      <Select
                        value={editedRespondent.turno}
                        onValueChange={(val) => setEditedRespondent({ ...editedRespondent, turno: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Comercial">Comercial</SelectItem>
                          <SelectItem value="Manhã">Manhã</SelectItem>
                          <SelectItem value="Tarde">Tarde</SelectItem>
                          <SelectItem value="Noite">Noite</SelectItem>
                          <SelectItem value="Integral">Integral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Tempo na Empresa</Label>
                      <Input
                        value={editedRespondent.tempo_empresa}
                        onChange={(e) => setEditedRespondent({ ...editedRespondent, tempo_empresa: e.target.value })}
                        placeholder="Ex: 2 anos"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Pausas</Label>
                    <Input
                      value={editedRespondent.pausas}
                      onChange={(e) => setEditedRespondent({ ...editedRespondent, pausas: e.target.value })}
                      placeholder="Ex: 15 min a cada 2h"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Work Description */}
              <Card>
                <CardHeader className="pb-3 border-b bg-muted/30">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Descrição do Trabalho
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Trabalho Real (Atividade Relatada)</Label>
                    <Textarea
                      value={editedWorkDescription.trabalho_real}
                      onChange={(e) => setEditedWorkDescription({ ...editedWorkDescription, trabalho_real: e.target.value })}
                      placeholder="Descreva as atividades reais executadas pelo trabalhador..."
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Trabalho Prescrito (CBO/Descrição de Cargo)</Label>
                    <Textarea
                      value={editedWorkDescription.trabalho_prescrito}
                      onChange={(e) => setEditedWorkDescription({ ...editedWorkDescription, trabalho_prescrito: e.target.value })}
                      placeholder="Descrição formal das atribuições do cargo..."
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Descrição do Ambiente de Trabalho</Label>
                    <Textarea
                      value={editedWorkDescription.descricao_ambiente}
                      onChange={(e) => setEditedWorkDescription({ ...editedWorkDescription, descricao_ambiente: e.target.value })}
                      placeholder="Características físicas e organizacionais do ambiente..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-auto p-0">
            <DialogHeader className="p-4 border-b bg-muted/30 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <DialogTitle>Preview do Relatório</DialogTitle>
                <div className="flex gap-2">
                  <Button 
                    variant={previewMode === "simple" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setPreviewMode("simple")}
                  >
                    Simples
                  </Button>
                  <Button 
                    variant={previewMode === "tanguro" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setPreviewMode("tanguro")}
                  >
                    Tanguro (Oficial)
                  </Button>
                </div>
              </div>
            </DialogHeader>
            <div className="p-0">
              {previewMode === "simple" ? (
                <div className="p-4">
                  <AETReportPreview
                    data={{
                      respondentData: editedRespondent as unknown as Record<string, string>,
                      dimensionScores: dimensionScores,
                      analysis: editedAnalysis,
                      conclusion: editedConclusion,
                      recommendations: editedRecommendations.replace(/<[^>]*>/g, '').split('\n').filter(r => r.trim()),
                      riskLevel: report.risk_level,
                      formType: report.submissions?.forms?.type || "ergos",
                      createdAt: report.created_at || new Date().toISOString(),
                    }}
                  />
                </div>
              ) : (
                <TanguroReportTemplate
                  data={mapReportToTanguroFormat(
                    {
                      ...report,
                      ai_analysis_text: editedAnalysis,
                      ai_conclusion: editedConclusion,
                      ai_recommendations: editedRecommendations.replace(/<[^>]*>/g, '').split('\n').filter(r => r.trim()),
                    },
                    {
                      ...report.submissions,
                      respondent_data: {
                        ...(typeof report.submissions?.respondent_data === 'object' ? report.submissions.respondent_data : {}),
                        ...editedRespondent,
                        trabalho_real: editedWorkDescription.trabalho_real,
                        trabalho_prescrito: editedWorkDescription.trabalho_prescrito,
                        descricao_ambiente: editedWorkDescription.descricao_ambiente,
                      }
                    },
                    report.submissions?.forms
                  )}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
