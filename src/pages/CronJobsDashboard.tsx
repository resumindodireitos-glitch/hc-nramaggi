import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Clock, 
  RefreshCw, 
  Play, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Calendar,
  Shield,
  Calculator,
  FileText,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CronJob {
  name: string;
  description: string;
  schedule: string;
  scheduleDescription: string;
  lastRun?: string;
  status: "active" | "paused";
  taskType: string;
  icon: React.ReactNode;
}

interface AuditLogEntry {
  id: string;
  action: string;
  created_at: string;
  new_data: any;
}

const CRON_JOBS: CronJob[] = [
  {
    name: "monthly-lgpd-cleanup",
    description: "Anonimiza dados pessoais expirados conforme política LGPD",
    schedule: "0 3 1 * *",
    scheduleDescription: "Todo dia 1º do mês às 3h",
    status: "active",
    taskType: "cleanup_pii",
    icon: <Shield className="h-5 w-5 text-primary" />
  },
  {
    name: "daily-fmea-calculation",
    description: "Calcula FMEA para relatórios pendentes",
    schedule: "0 2 * * *",
    scheduleDescription: "Todo dia às 2h",
    status: "active",
    taskType: "calculate_pending_fmea",
    icon: <Calculator className="h-5 w-5 text-orange-500" />
  },
  {
    name: "generate-pending-narratives",
    description: "Gera análises narrativas com IA para relatórios sem texto",
    schedule: "Manual",
    scheduleDescription: "Execução manual",
    status: "active",
    taskType: "generate_pending_narratives",
    icon: <FileText className="h-5 w-5 text-blue-500" />
  }
];

export default function CronJobsDashboard() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkAccess();
  }, [user]);

  const checkAccess = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    setIsSuperAdmin(!!data);

    if (!data && !isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }

    await loadAuditLogs();
    setLoading(false);
  };

  const loadAuditLogs = async () => {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .in("action", [
        "SCHEDULED_CLEANUP_PII",
        "SCHEDULED_FMEA_CALCULATION",
        "AUTOMATIC_PII_CLEANUP",
        "LGPD_ANONYMIZATION"
      ])
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setAuditLogs(data);
    }
  };

  const runTask = async (taskType: string, jobName: string) => {
    setRunning(jobName);
    try {
      const { data, error } = await supabase.functions.invoke("scheduled-tasks", {
        body: { task: taskType }
      });

      if (error) throw error;

      toast.success(`Tarefa ${jobName} executada com sucesso!`);
      await loadAuditLogs();
    } catch (error) {
      console.error("Error running task:", error);
      toast.error("Erro ao executar tarefa");
    } finally {
      setRunning(null);
    }
  };

  const getLastRunForJob = (taskType: string) => {
    const actionMap: Record<string, string[]> = {
      "cleanup_pii": ["SCHEDULED_CLEANUP_PII", "AUTOMATIC_PII_CLEANUP"],
      "calculate_pending_fmea": ["SCHEDULED_FMEA_CALCULATION"],
      "generate_pending_narratives": []
    };

    const relevantActions = actionMap[taskType] || [];
    const log = auditLogs.find(l => relevantActions.includes(l.action));
    return log?.created_at;
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("CLEANUP") || action.includes("ANONYMIZATION")) {
      return "bg-red-500/10 text-red-600 border-red-500/20";
    }
    if (action.includes("FMEA")) {
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    }
    return "bg-blue-500/10 text-blue-600 border-blue-500/20";
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
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              Tarefas Agendadas (Cron Jobs)
            </h1>
            <p className="text-muted-foreground">
              Monitoramento e execução manual das tarefas automáticas do sistema
            </p>
          </div>
          <Button variant="outline" onClick={loadAuditLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Cron Jobs Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {CRON_JOBS.map((job) => {
            const lastRun = getLastRunForJob(job.taskType);
            return (
              <Card key={job.name} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {job.icon}
                      <CardTitle className="text-base">{job.name}</CardTitle>
                    </div>
                    <Badge variant={job.status === "active" ? "default" : "secondary"}>
                      {job.status === "active" ? "Ativo" : "Pausado"}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm">
                    {job.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{job.scheduleDescription}</span>
                  </div>
                  
                  {lastRun && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span>Última execução: {format(new Date(lastRun), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}

                  <Button
                    onClick={() => runTask(job.taskType, job.name)}
                    disabled={running === job.name}
                    className="w-full gap-2"
                    variant="outline"
                  >
                    {running === job.name ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Executar Agora
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Execution History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Histórico de Execuções
            </CardTitle>
            <CardDescription>
              Últimas 20 execuções das tarefas agendadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma execução registrada ainda</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline" className={getActionBadgeColor(log.action)}>
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm">Sucesso</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {log.new_data ? (
                          <span>
                            {log.new_data.anonymized_count !== undefined && (
                              <>Anonimizados: {log.new_data.anonymized_count}</>
                            )}
                            {log.new_data.calculated !== undefined && (
                              <>FMEA calculados: {log.new_data.calculated}</>
                            )}
                            {log.new_data.generated !== undefined && (
                              <>Narrativas geradas: {log.new_data.generated}</>
                            )}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
