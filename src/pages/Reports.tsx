import { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  Clock,
  CheckCircle,
  Loader2,
  Eye,
  Play,
  User,
  Edit3,
  Filter,
  Download,
  CalendarIcon,
  X,
  Search,
} from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Database, Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Submission = Database["public"]["Tables"]["submissions"]["Row"];
type Report = Database["public"]["Tables"]["reports"]["Row"];
type Form = Database["public"]["Tables"]["forms"]["Row"];

interface SubmissionWithDetails extends Submission {
  forms: Form | null;
  reports: Report | null;
}

interface Filters {
  search: string;
  riskLevel: string;
  formType: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export default function Reports() {
  const [searchParams] = useSearchParams();
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const defaultTab = searchParams.get("filter") === "pending" ? "pending" : "all";

  const [filters, setFilters] = useState<Filters>({
    search: "",
    riskLevel: "all",
    formType: "all",
    dateFrom: undefined,
    dateTo: undefined,
  });

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select("*, forms(*), reports(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubmissions((data as SubmissionWithDetails[]) || []);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerAIAnalysis = async (submissionId: string) => {
    setProcessingId(submissionId);
    try {
      const { error } = await supabase.functions.invoke("analyze-submission", {
        body: { submissionId },
      });

      if (error) throw error;

      toast.success("Análise iniciada!", {
        description: "O relatório será gerado em instantes.",
      });

      setTimeout(() => {
        fetchSubmissions();
      }, 3000);
    } catch (error) {
      console.error("Error triggering analysis:", error);
      toast.error("Erro ao iniciar análise");
    } finally {
      setProcessingId(null);
    }
  };

  const getRespondentName = (data: Json) => {
    if (typeof data === "object" && data !== null && "full_name" in data) {
      return (data as { full_name?: string }).full_name || "Anônimo";
    }
    return "Anônimo";
  };

  const getRespondentDepartment = (data: Json) => {
    if (typeof data === "object" && data !== null && "department" in data) {
      return (data as { department?: string }).department || "";
    }
    return "";
  };

  // Filter logic
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const name = getRespondentName(submission.respondent_data).toLowerCase();
        const formTitle = submission.forms?.title?.toLowerCase() || "";
        const dept = getRespondentDepartment(submission.respondent_data).toLowerCase();
        if (!name.includes(searchLower) && !formTitle.includes(searchLower) && !dept.includes(searchLower)) {
          return false;
        }
      }

      // Risk level filter
      if (filters.riskLevel !== "all") {
        const riskLevel = submission.reports?.risk_level?.toLowerCase();
        if (riskLevel !== filters.riskLevel) {
          return false;
        }
      }

      // Form type filter
      if (filters.formType !== "all") {
        if (submission.forms?.type !== filters.formType) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        const submissionDate = new Date(submission.created_at!);
        if (filters.dateFrom && filters.dateTo) {
          if (!isWithinInterval(submissionDate, {
            start: startOfDay(filters.dateFrom),
            end: endOfDay(filters.dateTo),
          })) {
            return false;
          }
        } else if (filters.dateFrom) {
          if (submissionDate < startOfDay(filters.dateFrom)) {
            return false;
          }
        } else if (filters.dateTo) {
          if (submissionDate > endOfDay(filters.dateTo)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [submissions, filters]);

  const pendingSubmissions = filteredSubmissions.filter((s) => s.status === "pending_ai");
  const processedSubmissions = filteredSubmissions.filter((s) => s.status !== "pending_ai");

  const clearFilters = () => {
    setFilters({
      search: "",
      riskLevel: "all",
      formType: "all",
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const hasActiveFilters = filters.search || filters.riskLevel !== "all" || filters.formType !== "all" || filters.dateFrom || filters.dateTo;

  // Export to Excel
  const exportToExcel = () => {
    setExporting(true);
    try {
      const exportData = filteredSubmissions.map((sub) => ({
        "ID": sub.id,
        "Formulário": sub.forms?.title || "N/A",
        "Tipo": sub.forms?.type === "ergos" ? "ERGOS" : "HSE-IT",
        "Respondente": getRespondentName(sub.respondent_data),
        "Departamento": getRespondentDepartment(sub.respondent_data) || "N/A",
        "Data Submissão": format(new Date(sub.created_at!), "dd/MM/yyyy HH:mm"),
        "Status": sub.status === "pending_ai" ? "Pendente" : sub.status === "processed" ? "Processado" : "Aprovado",
        "Nível de Risco": sub.reports?.risk_level || "N/A",
        "Aprovado": sub.reports?.is_approved ? "Sim" : "Não",
        "Análise IA": sub.reports?.ai_analysis_text?.substring(0, 500) || "N/A",
        "Conclusão": sub.reports?.ai_conclusion || "N/A",
        "Recomendações": sub.reports?.ai_recommendations?.join("; ") || "N/A",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Relatórios");

      // Auto-width columns
      const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
        wch: Math.max(key.length, 15),
      }));
      ws["!cols"] = colWidths;

      XLSX.writeFile(wb, `relatorios-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Excel exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Erro ao exportar Excel");
    } finally {
      setExporting(false);
    }
  };

  const SubmissionCard = ({ submission, index }: { submission: SubmissionWithDetails; index: number }) => {
    const report = submission.reports;

    return (
      <Card 
        className="group hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 animate-fade-in-up" 
        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
      >
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {submission.forms?.title || "Formulário"}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {getRespondentName(submission.respondent_data)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(submission.created_at!), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {submission.status === "pending_ai" ? (
                <>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                    <Clock className="h-3 w-3 mr-1" />
                    Pendente
                  </Badge>
                  <Button
                    size="sm"
                    onClick={() => triggerAIAnalysis(submission.id)}
                    disabled={processingId === submission.id}
                    className="gap-2"
                  >
                    {processingId === submission.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Analisar
                  </Button>
                </>
              ) : (
                <>
                  <Badge
                    variant="outline"
                    className={
                      report?.is_approved
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-info/10 text-info border-info/20"
                    }
                  >
                    {report?.is_approved ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Aprovado
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 mr-1" />
                        Processado
                      </>
                    )}
                  </Badge>
                  {report && (
                    <div className="flex gap-2">
                      <Link to={`/reports/${report.id}/review`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Edit3 className="h-4 w-4" />
                          Revisar
                        </Button>
                      </Link>
                      <Link to={`/reports/${report.id}`}>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {report?.risk_level && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Nível de Risco:</span>
                <Badge
                  variant="outline"
                  className={
                    report.risk_level === "alto" || report.risk_level === "critico"
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : report.risk_level === "medio" || report.risk_level === "moderado"
                      ? "bg-warning/10 text-warning border-warning/20"
                      : "bg-success/10 text-success border-success/20"
                  }
                >
                  {report.risk_level.charAt(0).toUpperCase() + report.risk_level.slice(1)}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse">
              <BarChart3 className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <p className="text-muted-foreground animate-pulse">Carregando relatórios...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-fade-in-down">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Relatórios</h1>
            </div>
            <p className="text-muted-foreground">
              Gerencie e aprove relatórios de análise ergonômica
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  !
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={exportToExcel}
              disabled={exporting || filteredSubmissions.length === 0}
              className="gap-2"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filtros Avançados</CardTitle>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar filtros
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {/* Search */}
                <div className="space-y-2">
                  <Label>Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome, formulário..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Risk Level */}
                <div className="space-y-2">
                  <Label>Nível de Risco</Label>
                  <Select
                    value={filters.riskLevel}
                    onValueChange={(v) => setFilters({ ...filters, riskLevel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="baixo">Baixo</SelectItem>
                      <SelectItem value="adequado">Adequado</SelectItem>
                      <SelectItem value="medio">Médio</SelectItem>
                      <SelectItem value="moderado">Moderado</SelectItem>
                      <SelectItem value="alto">Alto</SelectItem>
                      <SelectItem value="critico">Crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Form Type */}
                <div className="space-y-2">
                  <Label>Tipo de Formulário</Label>
                  <Select
                    value={filters.formType}
                    onValueChange={(v) => setFilters({ ...filters, formType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="ergos">ERGOS</SelectItem>
                      <SelectItem value="hse_it">HSE-IT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date From */}
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !filters.dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateFrom}
                        onSelect={(date) => setFilters({ ...filters, dateFrom: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !filters.dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "Selecionar"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateTo}
                        onSelect={(date) => setFilters({ ...filters, dateTo: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Active Filters Summary */}
              {hasActiveFilters && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrando {filteredSubmissions.length} de {submissions.length} registros</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="all">
              Todos ({filteredSubmissions.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pendentes ({pendingSubmissions.length})
            </TabsTrigger>
            <TabsTrigger value="processed">
              Processados ({processedSubmissions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {filteredSubmissions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma submissão</h3>
                  <p className="text-muted-foreground">
                    {hasActiveFilters ? "Nenhum resultado para os filtros aplicados" : "Não há submissões para analisar"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredSubmissions.map((submission, index) => (
                <SubmissionCard key={submission.id} submission={submission} index={index} />
              ))
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {pendingSubmissions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-success mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Tudo em dia!</h3>
                  <p className="text-muted-foreground">
                    Não há submissões pendentes de análise
                  </p>
                </CardContent>
              </Card>
            ) : (
              pendingSubmissions.map((submission, index) => (
                <SubmissionCard key={submission.id} submission={submission} index={index} />
              ))
            )}
          </TabsContent>

          <TabsContent value="processed" className="space-y-4 mt-4">
            {processedSubmissions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum relatório</h3>
                  <p className="text-muted-foreground">
                    Não há relatórios processados ainda
                  </p>
                </CardContent>
              </Card>
            ) : (
              processedSubmissions.map((submission, index) => (
                <SubmissionCard key={submission.id} submission={submission} index={index} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
