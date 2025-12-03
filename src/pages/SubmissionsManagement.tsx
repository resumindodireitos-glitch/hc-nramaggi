import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Loader2, 
  Search,
  Eye,
  Play,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  ClipboardList,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database, Json } from "@/integrations/supabase/types";

type Submission = Database["public"]["Tables"]["submissions"]["Row"];
type Form = Database["public"]["Tables"]["forms"]["Row"];
type Report = Database["public"]["Tables"]["reports"]["Row"];

interface SubmissionWithDetails extends Submission {
  forms: Form | null;
  reports: Report | Report[] | null;
}

export default function SubmissionsManagement() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    fetchSubmissions();
  }, [isAdmin]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select("*, forms(*), reports(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubmissions((data as unknown as SubmissionWithDetails[]) || []);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      toast.error("Erro ao carregar submissões");
    } finally {
      setLoading(false);
    }
  };

  const triggerAIAnalysis = async (submissionId: string) => {
    setProcessingId(submissionId);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-submission", {
        body: { submissionId },
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      toast.success("Análise iniciada! Relatório gerado.");
      fetchSubmissions();
      
      // Navigate to review if report was created
      if (data.reportId) {
        navigate(`/reports/${data.reportId}/review`);
      }
    } catch (error: any) {
      console.error("Error triggering analysis:", error);
      toast.error(error.message || "Erro ao processar análise");
    } finally {
      setProcessingId(null);
    }
  };

  const getRespondentData = (data: Json) => {
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return data as Record<string, string>;
    }
    return {};
  };

  const getAnswers = (data: Json) => {
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return data as Record<string, any>;
    }
    return {};
  };

  const getStatusInfo = (status: string | null) => {
    switch (status) {
      case "pending_ai":
        return {
          label: "Aguardando IA",
          icon: Clock,
          color: "bg-warning/10 text-warning border-warning/20",
        };
      case "processed":
        return {
          label: "Processado",
          icon: Sparkles,
          color: "bg-info/10 text-info border-info/20",
        };
      case "approved":
        return {
          label: "Aprovado",
          icon: CheckCircle,
          color: "bg-success/10 text-success border-success/20",
        };
      default:
        return {
          label: status || "Desconhecido",
          icon: AlertCircle,
          color: "bg-muted text-muted-foreground",
        };
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const respondent = getRespondentData(sub.respondent_data);
    const matchesSearch = 
      respondent.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      respondent.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      respondent.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.forms?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === "pending_ai").length,
    processed: submissions.filter(s => s.status === "processed").length,
    approved: submissions.filter(s => s.status === "approved").length,
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-primary" />
              Gerenciar Submissões
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualize respostas, processe com IA e revise relatórios
            </p>
          </div>
          <Button onClick={fetchSubmissions} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Aguardando IA</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <Sparkles className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.processed}</p>
                  <p className="text-sm text-muted-foreground">Processados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-sm text-muted-foreground">Aprovados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, setor, cargo ou formulário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending_ai">Aguardando IA</SelectItem>
                  <SelectItem value="processed">Processados</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Submissions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Submissões ({filteredSubmissions.length})</CardTitle>
            <CardDescription>
              Clique em "Ver Respostas" para visualizar ou "Processar IA" para gerar análise
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma submissão encontrada</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all" 
                    ? "Tente ajustar os filtros de busca"
                    : "Aguardando respostas dos formulários"
                  }
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Respondente</TableHead>
                    <TableHead>Formulário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((submission) => {
                    const respondent = getRespondentData(submission.respondent_data);
                    const statusInfo = getStatusInfo(submission.status);
                    const StatusIcon = statusInfo.icon;
                    const reportsArray = Array.isArray(submission.reports) ? submission.reports : (submission.reports ? [submission.reports] : []);
                    const hasReport = reportsArray.length > 0;

                    return (
                      <TableRow key={submission.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-primary/10">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{respondent.full_name || "Não informado"}</p>
                              <p className="text-sm text-muted-foreground">
                                {respondent.job_title || "Cargo não informado"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{submission.forms?.title}</p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {submission.forms?.type === "ergos" ? "ERGOS" : "HSE-IT"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusInfo.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(submission.created_at!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSubmission(submission);
                                setDetailsOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Respostas
                            </Button>
                            
                            {submission.status === "pending_ai" && (
                              <Button
                                size="sm"
                                onClick={() => triggerAIAnalysis(submission.id)}
                                disabled={processingId === submission.id}
                                className="gradient-primary"
                              >
                                {processingId === submission.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 mr-1" />
                                )}
                                Processar IA
                              </Button>
                            )}
                            
                            {hasReport && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/reports/${reportsArray[0].id}/review`)}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                {submission.status === "approved" ? "Ver Relatório" : "Revisar"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Submission Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Detalhes da Submissão
            </DialogTitle>
            <DialogDescription>
              Respostas completas do questionário
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <Tabs defaultValue="respondent">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="respondent">Dados do Respondente</TabsTrigger>
                <TabsTrigger value="answers">Respostas ({Object.keys(getAnswers(selectedSubmission.answers)).length})</TabsTrigger>
              </TabsList>

              <TabsContent value="respondent" className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    {Object.entries(getRespondentData(selectedSubmission.respondent_data)).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-2 border-b last:border-0">
                        <span className="text-sm text-muted-foreground capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-medium">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="answers" className="space-y-4">
                <Card>
                  <CardContent className="p-4 max-h-[400px] overflow-y-auto">
                    {Object.entries(getAnswers(selectedSubmission.answers)).map(([key, value]) => (
                      <div key={key} className="py-3 border-b last:border-0">
                        <p className="text-sm font-medium text-foreground mb-1">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Fechar
            </Button>
            {selectedSubmission?.status === "pending_ai" && (
              <Button 
                onClick={() => {
                  setDetailsOpen(false);
                  triggerAIAnalysis(selectedSubmission.id);
                }}
                className="gradient-primary"
              >
                <Play className="h-4 w-4 mr-2" />
                Processar com IA
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
