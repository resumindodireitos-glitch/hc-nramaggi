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
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Loader2, 
  Search,
  Eye,
  ScrollText,
  RefreshCw,
  User,
  Database,
  FileText,
  Settings,
  AlertTriangle,
  CheckCircle,
  Info,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database as DB, Json } from "@/integrations/supabase/types";

type AuditLog = DB["public"]["Tables"]["audit_log"]["Row"];

export default function SystemLogs() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    fetchLogs();
  }, [isAdmin]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  };

  const getActionInfo = (action: string) => {
    const upperAction = action.toUpperCase();
    if (upperAction.includes("INSERT") || upperAction.includes("CREATE")) {
      return { label: "Criação", color: "bg-success/10 text-success", icon: CheckCircle };
    }
    if (upperAction.includes("UPDATE") || upperAction.includes("EDIT")) {
      return { label: "Atualização", color: "bg-info/10 text-info", icon: Info };
    }
    if (upperAction.includes("DELETE") || upperAction.includes("REMOVE")) {
      return { label: "Exclusão", color: "bg-destructive/10 text-destructive", icon: AlertTriangle };
    }
    if (upperAction.includes("LOGIN") || upperAction.includes("AUTH")) {
      return { label: "Autenticação", color: "bg-primary/10 text-primary", icon: User };
    }
    return { label: action, color: "bg-muted text-muted-foreground", icon: Info };
  };

  const getTableIcon = (tableName: string | null) => {
    switch (tableName) {
      case "profiles":
      case "user_roles":
        return User;
      case "forms":
      case "submissions":
        return FileText;
      case "ai_prompts":
        return Settings;
      default:
        return Database;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTable = tableFilter === "all" || log.table_name === tableFilter;
    const matchesAction = actionFilter === "all" || log.action?.toLowerCase().includes(actionFilter.toLowerCase());
    
    return matchesSearch && matchesTable && matchesAction;
  });

  const uniqueTables = [...new Set(logs.map(l => l.table_name).filter(Boolean))];

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
              <ScrollText className="h-8 w-8 text-primary" />
              Logs do Sistema
            </h1>
            <p className="text-muted-foreground mt-1">
              Auditoria detalhada de todas as ações no sistema
            </p>
          </div>
          <Button onClick={fetchLogs} variant="outline">
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
                  <ScrollText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{logs.length}</p>
                  <p className="text-sm text-muted-foreground">Total de Logs</p>
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
                  <p className="text-2xl font-bold">
                    {logs.filter(l => l.action?.toLowerCase().includes("insert") || l.action?.toLowerCase().includes("create")).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Criações</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <Info className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {logs.filter(l => l.action?.toLowerCase().includes("update")).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Atualizações</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {logs.filter(l => l.action?.toLowerCase().includes("delete")).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Exclusões</p>
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
                  placeholder="Buscar por ação, tabela ou usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por tabela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tabelas</SelectItem>
                  {uniqueTables.map(table => (
                    <SelectItem key={table} value={table!}>{table}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="insert">Criação</SelectItem>
                  <SelectItem value="update">Atualização</SelectItem>
                  <SelectItem value="delete">Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Auditoria ({filteredLogs.length})</CardTitle>
            <CardDescription>
              Clique em uma linha para ver detalhes completos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <ScrollText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum log encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm || tableFilter !== "all" || actionFilter !== "all"
                    ? "Tente ajustar os filtros de busca"
                    : "Os logs de auditoria aparecerão aqui"
                  }
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.slice(0, 100).map((log) => {
                    const actionInfo = getActionInfo(log.action);
                    const ActionIcon = actionInfo.icon;
                    const TableIcon = getTableIcon(log.table_name);

                    return (
                      <TableRow 
                        key={log.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedLog(log);
                          setDetailsOpen(true);
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(log.created_at!), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TableIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{log.table_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={actionInfo.color}>
                            <ActionIcon className="h-3 w-3 mr-1" />
                            {actionInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {log.record_id?.substring(0, 8)}...
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {log.ip_address || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {filteredLogs.length > 100 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Mostrando 100 de {filteredLogs.length} registros
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Detalhes do Log
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">ID</p>
                  <p className="font-mono text-sm">{selectedLog.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Data/Hora</p>
                  <p className="text-sm">
                    {format(new Date(selectedLog.created_at!), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tabela</p>
                  <p className="font-mono text-sm">{selectedLog.table_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Ação</p>
                  <Badge variant="outline" className={getActionInfo(selectedLog.action).color}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">ID do Registro</p>
                  <p className="font-mono text-sm">{selectedLog.record_id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">ID do Usuário</p>
                  <p className="font-mono text-sm">{selectedLog.user_id || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">IP</p>
                  <p className="text-sm">{selectedLog.ip_address || "-"}</p>
                </div>
              </div>

              {selectedLog.old_data && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Dados Anteriores</p>
                  <pre className="bg-muted/50 p-4 rounded-lg text-xs overflow-auto max-h-48 font-mono">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Dados Novos</p>
                  <pre className="bg-muted/50 p-4 rounded-lg text-xs overflow-auto max-h-48 font-mono">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
