import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Shield,
  Trash2,
  Download,
  Search,
  Eye,
  EyeOff,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  UserX,
  Database,
  Lock,
} from "lucide-react";

interface ConsentLog {
  id: string;
  submission_id: string | null;
  ip_hash: string;
  term_version: string;
  accepted_at: string;
  device_fingerprint: string | null;
}

interface AuditLog {
  id: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  user_id: string | null;
  new_data: Record<string, unknown> | null;
  created_at: string | null;
}

export default function LGPDManagement() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [searchIdentifier, setSearchIdentifier] = useState("");
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null);
  const [consentLogs, setConsentLogs] = useState<ConsentLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showExportResult, setShowExportResult] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      toast.error("Acesso restrito a Super Administradores");
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [isSuperAdmin, navigate]);

  const fetchData = async () => {
    try {
      const [consentsRes, auditsRes] = await Promise.all([
        supabase
          .from("consent_logs")
          .select("*")
          .order("accepted_at", { ascending: false })
          .limit(100),
        supabase
          .from("audit_log")
          .select("*")
          .in("action", ["LGPD_ANONYMIZATION_REQUEST", "LGPD_DATA_EXPORT", "AUTOMATIC_PII_CLEANUP", "PRIVILEGED_INDIVIDUAL_DATA_ACCESS"])
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (consentsRes.data) setConsentLogs(consentsRes.data);
      if (auditsRes.data) setAuditLogs(auditsRes.data as AuditLog[]);
    } catch (error) {
      console.error("Error fetching LGPD data:", error);
      toast.error("Erro ao carregar dados LGPD");
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    if (!searchIdentifier.trim()) {
      toast.error("Digite um identificador para buscar");
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("export_user_data", {
        target_identifier: searchIdentifier.trim(),
      });

      if (error) throw error;

      setExportData(data as Record<string, unknown>);
      setShowExportResult(true);
      toast.success("Dados exportados com sucesso!");
      fetchData(); // Refresh audit logs
    } catch (error) {
      console.error("Error exporting data:", error);
      toast.error("Erro ao exportar dados");
    } finally {
      setProcessing(false);
    }
  };

  const handleAnonymize = async () => {
    if (!searchIdentifier.trim()) {
      toast.error("Digite um identificador para anonimizar");
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("anonymize_by_identifier", {
        target_identifier: searchIdentifier.trim(),
      });

      if (error) throw error;

      toast.success(`${data} registro(s) anonimizado(s) com sucesso!`);
      setSearchIdentifier("");
      fetchData();
    } catch (error) {
      console.error("Error anonymizing data:", error);
      toast.error("Erro ao anonimizar dados");
    } finally {
      setProcessing(false);
    }
  };

  const handleRunCleanup = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("cleanup_old_pii");

      if (error) throw error;

      toast.success(`Limpeza automática executada: ${data} registro(s) anonimizado(s)`);
      fetchData();
    } catch (error) {
      console.error("Error running cleanup:", error);
      toast.error("Erro ao executar limpeza");
    } finally {
      setProcessing(false);
    }
  };

  const downloadExportAsJson = () => {
    if (!exportData) return;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lgpd-export-${searchIdentifier}-${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("JSON baixado com sucesso!");
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
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão LGPD</h1>
            <p className="text-sm text-muted-foreground">
              Lei 13.709/2018 - Proteção de Dados Pessoais
            </p>
          </div>
        </div>

        <Tabs defaultValue="rights" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="rights">Direitos do Titular</TabsTrigger>
            <TabsTrigger value="consent">Consentimentos</TabsTrigger>
            <TabsTrigger value="retention">Retenção</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>

          {/* Rights Tab */}
          <TabsContent value="rights" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Data Export Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-blue-500" />
                    Portabilidade de Dados
                  </CardTitle>
                  <CardDescription>
                    Exporte todos os dados de um titular (Art. 18, V)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Identificador (Nome ou Email)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite o nome ou email..."
                        value={searchIdentifier}
                        onChange={(e) => setSearchIdentifier(e.target.value)}
                      />
                      <Button onClick={handleExportData} disabled={processing}>
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Anonymization Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserX className="h-5 w-5 text-red-500" />
                    Direito ao Esquecimento
                  </CardTitle>
                  <CardDescription>
                    Anonimize dados pessoais (Art. 18, VI)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Identificador para Anonimizar</Label>
                    <Input
                      placeholder="Nome ou email do titular..."
                      value={searchIdentifier}
                      onChange={(e) => setSearchIdentifier(e.target.value)}
                    />
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" disabled={!searchIdentifier.trim()}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Anonimizar Dados
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Confirmar Anonimização
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação é <strong>irreversível</strong>. Os dados pessoais serão 
                          permanentemente removidos, mantendo apenas as respostas anonimizadas 
                          para fins estatísticos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleAnonymize} className="bg-destructive text-destructive-foreground">
                          Confirmar Anonimização
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>

            {/* Export Result */}
            {showExportResult && exportData && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-500" />
                    Resultado da Exportação
                  </CardTitle>
                  <Button onClick={downloadExportAsJson} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar JSON
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] rounded-lg border bg-muted/50 p-4">
                    <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                      {JSON.stringify(exportData, null, 2)}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Consent Tab */}
          <TabsContent value="consent">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  Registros de Consentimento
                </CardTitle>
                <CardDescription>
                  Histórico de aceite dos termos LGPD (Art. 8)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Versão do Termo</TableHead>
                        <TableHead>IP Hash</TableHead>
                        <TableHead>Submissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consentLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {format(new Date(log.accepted_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.term_version}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.ip_hash?.slice(0, 16)}...
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.submission_id?.slice(0, 8) || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {consentLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Nenhum registro de consentimento encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Retention Tab */}
          <TabsContent value="retention" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Política de Retenção de Dados
                </CardTitle>
                <CardDescription>
                  Gerenciamento automático do ciclo de vida dos dados (Art. 16)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <Database className="h-6 w-6 text-emerald-500 mb-2" />
                    <p className="text-sm font-medium text-emerald-400">Período de Retenção</p>
                    <p className="text-2xl font-bold text-emerald-300">5 Anos</p>
                    <p className="text-xs text-emerald-400/70">Prazo legal para saúde ocupacional</p>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <Lock className="h-6 w-6 text-blue-500 mb-2" />
                    <p className="text-sm font-medium text-blue-400">Após Expiração</p>
                    <p className="text-lg font-bold text-blue-300">Anonimização</p>
                    <p className="text-xs text-blue-400/70">Dados pessoais removidos automaticamente</p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <FileText className="h-6 w-6 text-amber-500 mb-2" />
                    <p className="text-sm font-medium text-amber-400">Dados Mantidos</p>
                    <p className="text-lg font-bold text-amber-300">Estatísticos</p>
                    <p className="text-xs text-amber-400/70">Respostas sem identificação</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Limpeza Manual</h4>
                  <p className="text-sm text-muted-foreground">
                    Execute a limpeza de dados expirados manualmente. Isso anonimizará todas as submissões 
                    que ultrapassaram o período de retenção de 5 anos.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Executar Limpeza de PII
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Executar Limpeza Automática</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação anonimizará todos os registros que ultrapassaram o período de retenção.
                          As respostas serão mantidas para fins estatísticos, mas os dados pessoais serão removidos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRunCleanup}>
                          Executar Limpeza
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-purple-500" />
                  Log de Auditoria LGPD
                </CardTitle>
                <CardDescription>
                  Registro de todas as operações relacionadas à proteção de dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Tabela</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                log.action.includes("ANONYMIZATION")
                                  ? "bg-red-500/10 text-red-500"
                                  : log.action.includes("EXPORT")
                                  ? "bg-blue-500/10 text-blue-500"
                                  : log.action.includes("ACCESS")
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-muted"
                              }
                            >
                              {log.action.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>{log.table_name || "-"}</TableCell>
                          <TableCell className="max-w-[300px] truncate text-xs">
                            {log.new_data ? JSON.stringify(log.new_data).slice(0, 100) + "..." : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {auditLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Nenhum registro de auditoria LGPD encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
