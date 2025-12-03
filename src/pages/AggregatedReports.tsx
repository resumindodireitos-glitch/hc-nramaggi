import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  BarChart3, 
  Users, 
  Shield, 
  Building2, 
  Briefcase, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Download,
  Eye,
  FileText,
  Printer
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface AggregatedReport {
  cargo: string | null;
  setor: string | null;
  form_title: string | null;
  form_type: string | null;
  total_submissions: number | null;
  approved_reports: number | null;
  avg_risk_score: number | null;
  most_common_risk_level: string | null;
  first_submission: string | null;
  last_submission: string | null;
}

const RISK_COLORS: Record<string, string> = {
  baixo: "#22c55e",
  toleravel: "#22c55e",
  trivial: "#22c55e",
  medio: "#eab308",
  moderado: "#eab308",
  alto: "#f97316",
  substancial: "#f97316",
  critico: "#ef4444",
  intoleravel: "#ef4444",
};

export default function AggregatedReports() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AggregatedReport[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSetor, setFilterSetor] = useState<string>("all");
  const [setores, setSetores] = useState<string[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AggregatedReport | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailData, setDetailData] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: reports, error } = await supabase
        .from("aggregated_reports_by_role")
        .select("*");

      if (error) throw error;

      setData(reports || []);
      
      // Extract unique setores
      const uniqueSetores = [...new Set(reports?.map(r => r.setor).filter(Boolean))] as string[];
      setSetores(uniqueSetores);
    } catch (error) {
      console.error("Error fetching aggregated reports:", error);
      toast.error("Erro ao carregar dados agregados");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(item => {
    if (filterType !== "all" && item.form_type !== filterType) return false;
    if (filterSetor !== "all" && item.setor !== filterSetor) return false;
    return true;
  });

  // Prepare chart data
  const riskDistribution = filteredData.reduce((acc, item) => {
    const risk = item.most_common_risk_level?.toLowerCase() || "indefinido";
    acc[risk] = (acc[risk] || 0) + (item.total_submissions || 0);
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(riskDistribution).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: RISK_COLORS[name] || "#94a3b8"
  }));

  const barData = filteredData
    .sort((a, b) => (b.total_submissions || 0) - (a.total_submissions || 0))
    .slice(0, 10)
    .map(item => ({
      name: item.cargo?.substring(0, 20) || "N/A",
      submissions: item.total_submissions || 0,
      approved: item.approved_reports || 0,
    }));

  const totalSubmissions = filteredData.reduce((sum, item) => sum + (item.total_submissions || 0), 0);
  const totalApproved = filteredData.reduce((sum, item) => sum + (item.approved_reports || 0), 0);
  const avgRisk = filteredData.length > 0 
    ? filteredData.reduce((sum, item) => sum + (item.avg_risk_score || 0), 0) / filteredData.length 
    : 0;

  const getRiskBadge = (risk: string | null) => {
    const riskLower = risk?.toLowerCase() || "";
    const colors: Record<string, string> = {
      baixo: "bg-green-500/10 text-green-600 border-green-500/20",
      toleravel: "bg-green-500/10 text-green-600 border-green-500/20",
      trivial: "bg-green-500/10 text-green-600 border-green-500/20",
      medio: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      moderado: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      alto: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      substancial: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      critico: "bg-red-500/10 text-red-600 border-red-500/20",
      intoleravel: "bg-red-500/10 text-red-600 border-red-500/20",
    };
    return colors[riskLower] || "bg-muted text-muted-foreground";
  };

  const exportCSV = () => {
    const headers = ["Cargo", "Setor", "Formulário", "Total Submissões", "Aprovados", "Risco Médio", "Nível Predominante"];
    const rows = filteredData.map(item => [
      item.cargo || "",
      item.setor || "",
      item.form_title || "",
      item.total_submissions || 0,
      item.approved_reports || 0,
      item.avg_risk_score?.toFixed(1) || "",
      item.most_common_risk_level || ""
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_agregado.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fetch individual data for a cargo/setor (super admin only)
  const fetchDetailData = async (item: AggregatedReport) => {
    if (!isSuperAdmin) {
      toast.error("Acesso restrito a super administradores");
      return;
    }
    
    setSelectedReport(item);
    setShowDetailDialog(true);
    
    try {
      const { data: responses, error } = await supabase.rpc("get_individual_responses_by_role", {
        target_cargo: item.cargo || "",
        target_setor: item.setor || undefined
      });

      if (error) throw error;
      setDetailData(responses || []);
    } catch (error) {
      console.error("Error fetching detail data:", error);
      toast.error("Erro ao carregar dados detalhados");
    }
  };

  // Generate aggregated PDF report for setor/cargo
  const generateAggregatedPdf = async () => {
    setGeneratingPdf(true);
    try {
      const htmlContent = generateAggregatedReportHtml(filteredData, filterSetor, filterType);
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      toast.success("Relatório gerado! Use Ctrl+P para salvar como PDF.");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar relatório");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const generateAggregatedReportHtml = (reportData: AggregatedReport[], setor: string, tipo: string) => {
    const today = new Date().toLocaleDateString("pt-BR");
    
    const tableRows = reportData.map(item => `
      <tr>
        <td>${item.cargo || "-"}</td>
        <td>${item.setor || "-"}</td>
        <td>${item.total_submissions || 0}</td>
        <td>${item.approved_reports || 0}</td>
        <td>${item.avg_risk_score?.toFixed(1) || "-"}%</td>
        <td class="risk-${(item.most_common_risk_level || "").toLowerCase()}">${item.most_common_risk_level || "N/A"}</td>
      </tr>
    `).join("");

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório Agregado - AET</title>
  <style>
    @page { size: A4 landscape; margin: 1.5cm; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #333; }
    .header { border-bottom: 3px solid #005c42; padding-bottom: 10px; margin-bottom: 20px; }
    .header h1 { color: #005c42; font-size: 16pt; margin: 0; }
    .header p { color: #666; margin: 5px 0 0; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 9pt; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #005c42; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    .risk-baixo, .risk-toleravel, .risk-trivial { background: #dcfce7; color: #166534; }
    .risk-medio, .risk-moderado { background: #fef3c7; color: #92400e; }
    .risk-alto, .risk-substancial { background: #fed7aa; color: #c2410c; }
    .risk-critico, .risk-intoleravel { background: #fecaca; color: #b91c1c; }
    .footer { margin-top: 30px; font-size: 8pt; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RELATÓRIO AGREGADO - ANÁLISE ERGONÔMICA DO TRABALHO</h1>
    <p>HC Consultoria em Ergonomia e Fisioterapia</p>
  </div>
  <div class="meta">
    <span>Data: ${today}</span>
    <span>Filtro Setor: ${setor === "all" ? "Todos" : setor}</span>
    <span>Tipo: ${tipo === "all" ? "Todos" : tipo.toUpperCase()}</span>
    <span>Total de registros: ${reportData.length}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Cargo</th>
        <th>Setor</th>
        <th>Participantes</th>
        <th>Aprovados</th>
        <th>Risco Médio</th>
        <th>Nível Predominante</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <div class="footer">
    <p>Este relatório apresenta dados agregados respeitando a LGPD. Nenhum dado individual é exposto.</p>
    <p>Referências: NR-01 | NR-17 | ISO 45003</p>
  </div>
</body>
</html>
    `;
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Relatórios Agregados
            </h1>
            <p className="text-muted-foreground text-sm">
              Estatísticas por cargo/setor sem exposição de dados individuais (LGPD)
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button size="sm" onClick={generateAggregatedPdf} disabled={generatingPdf}>
              {generatingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
              Gerar PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Formulário</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ergos">ERGOS</SelectItem>
                    <SelectItem value="hse_it">HSE-IT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Setor</label>
                <Select value={filterSetor} onValueChange={setFilterSetor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {setores.map(setor => (
                      <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSubmissions}</p>
                  <p className="text-sm text-muted-foreground">Total Submissões</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalApproved}</p>
                  <p className="text-sm text-muted-foreground">Relatórios Aprovados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgRisk.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Risco Médio</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Briefcase className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{filteredData.length}</p>
                  <p className="text-sm text-muted-foreground">Cargos Analisados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Nível de Risco</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 10 Cargos por Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical">
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="submissions" fill="hsl(var(--primary))" name="Submissões" />
                    <Bar dataKey="approved" fill="hsl(142 71% 45%)" name="Aprovados" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Dados Agregados por Função
            </CardTitle>
            <CardDescription>
              Visão consolidada respeitando a privacidade individual (LGPD compliant)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="hidden sm:table-cell">Setor</TableHead>
                    <TableHead className="hidden md:table-cell">Formulário</TableHead>
                    <TableHead className="text-center">Participantes</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Aprovados</TableHead>
                    <TableHead className="text-center">Nível Risco</TableHead>
                    {isSuperAdmin && <TableHead className="text-center">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">
                        Nenhum dado encontrado com os filtros selecionados
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{item.cargo || "-"}</TableCell>
                        <TableCell className="hidden sm:table-cell">{item.setor || "-"}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline">{item.form_type?.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{item.total_submissions}</TableCell>
                        <TableCell className="text-center hidden sm:table-cell">{item.approved_reports}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={getRiskBadge(item.most_common_risk_level)}>
                            {item.most_common_risk_level || "N/A"}
                          </Badge>
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchDetailData(item)}
                              className="h-8 gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver nomes
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Detail Dialog for Super Admin */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Detalhes - {selectedReport?.cargo}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Setor: <strong>{selectedReport?.setor}</strong></span>
                <span>Total: <strong>{selectedReport?.total_submissions}</strong></span>
              </div>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Risco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          Nenhum registro encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      detailData.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.nome || "-"}</TableCell>
                          <TableCell>{item.setor || "-"}</TableCell>
                          <TableCell>{item.cargo || "-"}</TableCell>
                          <TableCell>
                            {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString("pt-BR") : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getRiskBadge(item.risk_level)}>
                              {item.risk_level || "N/A"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
