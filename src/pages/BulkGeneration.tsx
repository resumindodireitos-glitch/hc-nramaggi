import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { printHtmlAsPdf } from "@/lib/pdfUtils";
import {
  Loader2,
  Download,
  FileArchive,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
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

export default function BulkGeneration() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentReport, setCurrentReport] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    fetchReports();
  }, [isAdmin]);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*, submissions(*, forms(*))")
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports((data as ReportWithDetails[]) || []);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === reports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reports.map((r) => r.id)));
    }
  };

  const getRespondentName = (data: Json) => {
    if (typeof data === "object" && data !== null && "full_name" in data) {
      return (data as { full_name?: string }).full_name || "Anônimo";
    }
    return "Anônimo";
  };

  const handleBulkGenerate = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um relatório");
      return;
    }

    setGenerating(true);
    setProgress(0);

    try {
      const selectedReports = reports.filter((r) => selectedIds.has(r.id));
      
      // Generate all PDFs and open each in a new tab
      for (let i = 0; i < selectedReports.length; i++) {
        const report = selectedReports[i];
        const respondentName = getRespondentName(report.submissions?.respondent_data || {});
        setCurrentReport(respondentName);
        setProgress(((i + 1) / selectedReports.length) * 100);

        try {
          const { data, error } = await supabase.functions.invoke("generate-pdf", {
            body: { reportId: report.id },
          });

          if (error) throw error;

          // Open HTML with print dialog
          const html = atob(data.pdf);
          printHtmlAsPdf(html, `AET_${respondentName.replace(/\s+/g, "_")}`);
          
          // Small delay between opening tabs
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error(`Error generating PDF for ${report.id}:`, err);
        }
      }

      toast.success(`${selectedReports.length} PDFs gerados!`, {
        description: "Selecione 'Salvar como PDF' no diálogo de impressão de cada aba",
        duration: 6000,
      });
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error in bulk generation:", error);
      toast.error("Erro na geração em massa");
    } finally {
      setGenerating(false);
      setProgress(0);
      setCurrentReport("");
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileArchive className="h-6 w-6 text-primary" />
              Geração em Massa
            </h1>
            <p className="text-muted-foreground text-sm">
              Gere múltiplos PDFs de uma vez e baixe em ZIP
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchReports}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button
              onClick={handleBulkGenerate}
              disabled={generating || selectedIds.size === 0}
              className="gradient-primary"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Gerar ZIP ({selectedIds.size})
            </Button>
          </div>
        </div>

        {/* Progress */}
        {generating && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Gerando: {currentReport}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reports List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Relatórios Aprovados</CardTitle>
                <CardDescription>Selecione os relatórios para gerar PDFs</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {selectedIds.size === reports.length ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum relatório aprovado encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((report) => {
                  const respondentName = getRespondentName(report.submissions?.respondent_data || {});
                  const isSelected = selectedIds.has(report.id);

                  return (
                    <div
                      key={report.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer ${
                        isSelected ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleSelect(report.id)}
                    >
                      <Checkbox checked={isSelected} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{respondentName}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.submissions?.forms?.title} -{" "}
                          {format(new Date(report.created_at!), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {report.risk_level && (
                          <Badge
                            variant="outline"
                            className={
                              report.risk_level === "alto"
                                ? "border-destructive text-destructive"
                                : report.risk_level === "medio"
                                ? "border-warning text-warning"
                                : "border-success text-success"
                            }
                          >
                            {report.risk_level}
                          </Badge>
                        )}
                        <CheckCircle className="h-4 w-4 text-success" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
