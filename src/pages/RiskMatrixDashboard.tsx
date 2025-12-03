import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  Shield,
  Activity,
  TrendingUp,
  Loader2,
  BarChart3,
  Target,
  CheckCircle,
  Clock,
  FileText,
} from "lucide-react";

interface RiskMatrixItem {
  id: string;
  dimension?: string;
  segmento_corporal?: string;
  perigo: string;
  fonte_geradora: string | null;
  dano_potencial: string | null;
  medida_controle_sugerida: string | null;
  gravidade_padrao: number;
  nr_referencia: string[] | null;
}

interface SuggestedAction {
  id: string;
  risk_detected: string;
  dimension: string | null;
  action_title: string;
  priority: string;
  nre_score: number | null;
  nre_classification: string | null;
  status: string;
}

interface AggregatedRisk {
  setor: string;
  cargo: string;
  total_submissions: number;
  avg_risk_score: number | null;
  most_common_risk_level: string | null;
}

export default function RiskMatrixDashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [ergosRisks, setErgosRisks] = useState<RiskMatrixItem[]>([]);
  const [hseitRisks, setHseitRisks] = useState<RiskMatrixItem[]>([]);
  const [bioRisks, setBioRisks] = useState<RiskMatrixItem[]>([]);
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [aggregatedRisks, setAggregatedRisks] = useState<AggregatedRisk[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso restrito");
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [isAdmin, navigate]);

  const fetchData = async () => {
    try {
      const [ergosRes, hseitRes, bioRes, actionsRes, aggRes] = await Promise.all([
        supabase.from("risk_matrix_ergos").select("*").eq("is_active", true).order("gravidade_padrao", { ascending: false }),
        supabase.from("risk_matrix_hseit").select("*").eq("is_active", true).order("gravidade_padrao", { ascending: false }),
        supabase.from("risk_matrix_biomecanicos").select("*").eq("is_active", true).order("gravidade_padrao", { ascending: false }),
        supabase.from("suggested_actions").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("aggregated_reports_by_role").select("*"),
      ]);

      if (ergosRes.data) setErgosRisks(ergosRes.data);
      if (hseitRes.data) setHseitRisks(hseitRes.data);
      if (bioRes.data) setBioRisks(bioRes.data);
      if (actionsRes.data) setActions(actionsRes.data);
      if (aggRes.data) setAggregatedRisks(aggRes.data as AggregatedRisk[]);
    } catch (error) {
      console.error("Error fetching risk data:", error);
      toast.error("Erro ao carregar dados de risco");
    } finally {
      setLoading(false);
    }
  };

  const getGravityColor = (g: number) => {
    if (g >= 5) return "bg-red-500/20 text-red-500 border-red-500/30";
    if (g >= 4) return "bg-orange-500/20 text-orange-500 border-orange-500/30";
    if (g >= 3) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
    return "bg-emerald-500/20 text-emerald-500 border-emerald-500/30";
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "critica": return "bg-red-500/20 text-red-500";
      case "alta": return "bg-orange-500/20 text-orange-500";
      case "media": return "bg-yellow-500/20 text-yellow-500";
      default: return "bg-emerald-500/20 text-emerald-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "concluida": return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "em_andamento": return <Activity className="h-4 w-4 text-blue-500" />;
      case "cancelada": return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
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
      <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto px-2 sm:px-0">
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 self-start">
            <Target className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Matriz de Riscos</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Base de conhecimento e análise FMEA psicossocial
            </p>
          </div>
        </div>

        {/* Stats Cards - Mobile Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{ergosRisks.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Riscos ERGOS</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{hseitRisks.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Riscos HSE-IT</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{bioRisks.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Biomecânicos</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{actions.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Ações Sugeridas</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs - Mobile Optimized */}
        <Tabs defaultValue="aggregated" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
            <TabsTrigger value="aggregated" className="text-xs sm:text-sm py-2">Agregado</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs sm:text-sm py-2">Ações</TabsTrigger>
            <TabsTrigger value="ergos" className="text-xs sm:text-sm py-2 hidden sm:flex">ERGOS</TabsTrigger>
            <TabsTrigger value="hseit" className="text-xs sm:text-sm py-2 hidden sm:flex">HSE-IT</TabsTrigger>
            <TabsTrigger value="bio" className="text-xs sm:text-sm py-2 hidden sm:flex">Biomec.</TabsTrigger>
          </TabsList>

          {/* Aggregated Risks by Role */}
          <TabsContent value="aggregated">
            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Riscos Agregados por Cargo
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Visão consolidada sem identificação individual (LGPD)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Mobile: Card layout */}
                <div className="sm:hidden space-y-3">
                  {aggregatedRisks.map((risk, i) => (
                    <Card key={i} className="p-3 bg-muted/30">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-sm">{risk.cargo || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">{risk.setor || "N/A"}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {risk.total_submissions} resp.
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Risco:</span>
                        <Badge className={
                          risk.most_common_risk_level === "intoleravel" || risk.most_common_risk_level === "critico"
                            ? "bg-red-500/20 text-red-500"
                            : risk.most_common_risk_level === "substancial" || risk.most_common_risk_level === "alto"
                            ? "bg-orange-500/20 text-orange-500"
                            : "bg-emerald-500/20 text-emerald-500"
                        }>
                          {risk.most_common_risk_level || "N/A"}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                  {aggregatedRisks.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      Nenhum dado agregado disponível
                    </p>
                  )}
                </div>

                {/* Desktop: Table layout */}
                <ScrollArea className="hidden sm:block h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Submissões</TableHead>
                        <TableHead>Risco Predominante</TableHead>
                        <TableHead>Score Médio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aggregatedRisks.map((risk, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{risk.cargo || "N/A"}</TableCell>
                          <TableCell>{risk.setor || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{risk.total_submissions}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              risk.most_common_risk_level === "intoleravel" || risk.most_common_risk_level === "critico"
                                ? "bg-red-500/20 text-red-500"
                                : risk.most_common_risk_level === "substancial" || risk.most_common_risk_level === "alto"
                                ? "bg-orange-500/20 text-orange-500"
                                : risk.most_common_risk_level === "moderado"
                                ? "bg-yellow-500/20 text-yellow-500"
                                : "bg-emerald-500/20 text-emerald-500"
                            }>
                              {risk.most_common_risk_level || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {risk.avg_risk_score !== null ? (
                              <div className="flex items-center gap-2">
                                <Progress value={(risk.avg_risk_score / 5) * 100} className="h-2 w-16" />
                                <span className="text-xs">{risk.avg_risk_score.toFixed(1)}</span>
                              </div>
                            ) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {aggregatedRisks.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Nenhum dado agregado disponível
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suggested Actions */}
          <TabsContent value="actions">
            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Planos de Ação Sugeridos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mobile: Card layout */}
                <div className="sm:hidden space-y-3">
                  {actions.slice(0, 10).map((action) => (
                    <Card key={action.id} className="p-3 bg-muted/30">
                      <div className="flex items-start gap-2 mb-2">
                        {getStatusIcon(action.status)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{action.action_title}</p>
                          <p className="text-xs text-muted-foreground truncate">{action.risk_detected}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`text-xs ${getPriorityColor(action.priority)}`}>
                          {action.priority}
                        </Badge>
                        {action.nre_classification && (
                          <span className="text-xs text-muted-foreground">
                            NRE: {action.nre_classification}
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                  {actions.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      Nenhuma ação sugerida ainda
                    </p>
                  )}
                </div>

                {/* Desktop: Table layout */}
                <ScrollArea className="hidden sm:block h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Risco</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>NRE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {actions.map((action) => (
                        <TableRow key={action.id}>
                          <TableCell>{getStatusIcon(action.status)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{action.risk_detected}</TableCell>
                          <TableCell className="max-w-[250px] truncate">{action.action_title}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getPriorityColor(action.priority)}>
                              {action.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {action.nre_classification && (
                              <Badge variant="secondary">{action.nre_classification}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {actions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Nenhuma ação sugerida ainda
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ERGOS Matrix */}
          <TabsContent value="ergos">
            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">Matriz ERGOS</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Riscos cognitivos e organizacionais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dimensão</TableHead>
                        <TableHead>Perigo</TableHead>
                        <TableHead>G</TableHead>
                        <TableHead>Controle</TableHead>
                        <TableHead>NRs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ergosRisks.map((risk) => (
                        <TableRow key={risk.id}>
                          <TableCell className="font-medium">{risk.dimension}</TableCell>
                          <TableCell>{risk.perigo}</TableCell>
                          <TableCell>
                            <Badge className={getGravityColor(risk.gravidade_padrao)}>
                              {risk.gravidade_padrao}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] text-xs">
                            {risk.medida_controle_sugerida || "-"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {risk.nr_referencia?.join(", ") || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HSE-IT Matrix */}
          <TabsContent value="hseit">
            <Card>
              <CardHeader>
                <CardTitle>Matriz HSE-IT</CardTitle>
                <CardDescription>Riscos psicossociais (7 dimensões HSE UK)</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dimensão</TableHead>
                        <TableHead>Perigo</TableHead>
                        <TableHead>G</TableHead>
                        <TableHead>Controle</TableHead>
                        <TableHead>Benchmark</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hseitRisks.map((risk: any) => (
                        <TableRow key={risk.id}>
                          <TableCell className="font-medium">{risk.dimension}</TableCell>
                          <TableCell>{risk.perigo}</TableCell>
                          <TableCell>
                            <Badge className={getGravityColor(risk.gravidade_padrao)}>
                              {risk.gravidade_padrao}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] text-xs">
                            {risk.medida_controle_sugerida || "-"}
                          </TableCell>
                          <TableCell>
                            {risk.benchmark_hse ? `${risk.benchmark_hse}%` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Biomechanical Matrix */}
          <TabsContent value="bio">
            <Card>
              <CardHeader>
                <CardTitle>Matriz Biomecânica</CardTitle>
                <CardDescription>Riscos por segmento corporal</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Segmento</TableHead>
                        <TableHead>Perigo</TableHead>
                        <TableHead>G</TableHead>
                        <TableHead>Controle</TableHead>
                        <TableHead>CID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bioRisks.map((risk) => (
                        <TableRow key={risk.id}>
                          <TableCell className="font-medium">{risk.segmento_corporal}</TableCell>
                          <TableCell>{risk.perigo}</TableCell>
                          <TableCell>
                            <Badge className={getGravityColor(risk.gravidade_padrao)}>
                              {risk.gravidade_padrao}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] text-xs">
                            {risk.medida_controle_sugerida || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {(risk as any).cid_relacionado || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
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
