import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Filter,
  Building2,
  Briefcase,
  Users,
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

interface GroupedReports {
  [key: string]: ReportWithDetails[];
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
  const [groupBy, setGroupBy] = useState<"none" | "setor" | "cargo">("setor");
  const [filterSetor, setFilterSetor] = useState<string>("all");
  const [filterCargo, setFilterCargo] = useState<string>("all");

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
    const filtered = getFilteredReports();
    if (filtered.every(r => selectedIds.has(r.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const selectGroup = (groupReports: ReportWithDetails[]) => {
    const newSelected = new Set(selectedIds);
    const allSelected = groupReports.every(r => selectedIds.has(r.id));
    
    if (allSelected) {
      groupReports.forEach(r => newSelected.delete(r.id));
    } else {
      groupReports.forEach(r => newSelected.add(r.id));
    }
    setSelectedIds(newSelected);
  };

  const getRespondentData = (data: Json) => {
    if (typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;
      return {
        nome: (obj.full_name || obj.nome || "Anônimo") as string,
        setor: (obj.department || obj.setor || "Não informado") as string,
        cargo: (obj.job_title || obj.cargo || "Não informado") as string,
      };
    }
    return { nome: "Anônimo", setor: "Não informado", cargo: "Não informado" };
  };

  const getUniqueSetores = (): string[] => {
    const setores = new Set<string>();
    reports.forEach(r => {
      const { setor } = getRespondentData(r.submissions?.respondent_data || {});
      if (setor !== "Não informado") setores.add(setor);
    });
    return Array.from(setores).sort();
  };

  const getUniqueCargos = (): string[] => {
    const cargos = new Set<string>();
    reports.forEach(r => {
      const { cargo } = getRespondentData(r.submissions?.respondent_data || {});
      if (cargo !== "Não informado") cargos.add(cargo);
    });
    return Array.from(cargos).sort();
  };

  const getFilteredReports = (): ReportWithDetails[] => {
    return reports.filter(r => {
      const { setor, cargo } = getRespondentData(r.submissions?.respondent_data || {});
      if (filterSetor !== "all" && setor !== filterSetor) return false;
      if (filterCargo !== "all" && cargo !== filterCargo) return false;
      return true;
    });
  };

  const getGroupedReports = (): GroupedReports => {
    const filtered = getFilteredReports();
    if (groupBy === "none") return { "Todos os Relatórios": filtered };
    
    const grouped: GroupedReports = {};
    filtered.forEach(report => {
      const { setor, cargo } = getRespondentData(report.submissions?.respondent_data || {});
      const key = groupBy === "setor" ? setor : cargo;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(report);
    });
    return grouped;
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
      
      for (let i = 0; i < selectedReports.length; i++) {
        const report = selectedReports[i];
        const { nome, setor, cargo } = getRespondentData(report.submissions?.respondent_data || {});
        setCurrentReport(`${nome} (${cargo})`);
        setProgress(((i + 1) / selectedReports.length) * 100);

        try {
          const { data, error } = await supabase.functions.invoke("generate-pdf", {
            body: { reportId: report.id },
          });

          if (error) throw error;

          const html = atob(data.pdf);
          const fileName = `AET_${setor.replace(/\s+/g, "_")}_${cargo.replace(/\s+/g, "_")}_${nome.replace(/\s+/g, "_")}`;
          printHtmlAsPdf(html, fileName);
          
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (err) {
          console.error(`Error generating PDF for ${report.id}:`, err);
          toast.error(`Erro ao gerar PDF: ${nome}`);
        }
      }

      toast.success(`${selectedReports.length} PDFs gerados!`, {
        description: "Use 'Salvar como PDF' no diálogo de impressão",
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

  const grouped = getGroupedReports();
  const uniqueSetores = getUniqueSetores();
  const uniqueCargos = getUniqueCargos();

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
              Geração em Lote
            </h1>
            <p className="text-muted-foreground text-sm">
              Gere múltiplos PDFs por setor ou função
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
              Gerar PDFs ({selectedIds.size})
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros e Agrupamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Agrupar por:</span>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "none" | "setor" | "cargo")}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem agrupamento</SelectItem>
                    <SelectItem value="setor">Setor</SelectItem>
                    <SelectItem value="cargo">Cargo/Função</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <Select value={filterSetor} onValueChange={setFilterSetor}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    {uniqueSetores.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <Select value={filterCargo} onValueChange={setFilterCargo}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cargos</SelectItem>
                    {uniqueCargos.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

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
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Relatórios Aprovados
                </CardTitle>
                <CardDescription>
                  {getFilteredReports().length} relatórios • {selectedIds.size} selecionados
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>
                {getFilteredReports().every(r => selectedIds.has(r.id)) ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(grouped).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum relatório aprovado encontrado</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([groupName, groupReports]) => (
                  <div key={groupName} className="space-y-2">
                    {groupBy !== "none" && (
                      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          {groupBy === "setor" ? (
                            <Building2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Briefcase className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium">{groupName}</span>
                          <Badge variant="secondary">{groupReports.length}</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => selectGroup(groupReports)}
                        >
                          {groupReports.every(r => selectedIds.has(r.id)) ? "Desmarcar" : "Selecionar"}
                        </Button>
                      </div>
                    )}
                    <div className="space-y-2 pl-2">
                      {groupReports.map((report) => {
                        const { nome, setor, cargo } = getRespondentData(report.submissions?.respondent_data || {});
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
                              <p className="font-medium truncate">{nome}</p>
                              <p className="text-sm text-muted-foreground">
                                {cargo} • {setor} • {format(new Date(report.created_at!), "dd/MM/yyyy", { locale: ptBR })}
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
                                      ? "border-amber-500 text-amber-600"
                                      : "border-emerald-500 text-emerald-600"
                                  }
                                >
                                  {report.risk_level}
                                </Badge>
                              )}
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
