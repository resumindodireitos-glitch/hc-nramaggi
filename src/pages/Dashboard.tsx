import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ClipboardList, BarChart3, AlertTriangle, CheckCircle, Clock, ArrowRight, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Stats {
  totalSubmissions: number;
  pendingReports: number;
  approvedReports: number;
  activeForms: number;
}

interface TimeSeriesData {
  date: string;
  submissions: number;
}

interface DepartmentData {
  name: string;
  baixo: number;
  medio: number;
  alto: number;
}

interface RiskDistribution {
  name: string;
  value: number;
  color: string;
}

const RISK_COLORS = {
  baixo: "hsl(var(--success))",
  medio: "hsl(var(--warning))",
  alto: "hsl(var(--destructive))",
};

export default function Dashboard() {
  const { profile, isAdmin } = useAuthContext();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<RiskDistribution[]>([]);

  useEffect(() => {
    fetchStats();
    if (isAdmin) {
      fetchTimeSeriesData();
      fetchDepartmentData();
    }
  }, [isAdmin]);

  const fetchStats = async () => {
    try {
      const [submissionsRes, reportsRes, formsRes] = await Promise.all([
        supabase.from("submissions").select("id, status", { count: "exact" }),
        supabase.from("reports").select("id, is_approved, risk_level", { count: "exact" }),
        supabase.from("forms").select("id", { count: "exact" }).eq("is_active", true),
      ]);

      const submissions = submissionsRes.data || [];
      const reports = reportsRes.data || [];

      // Calculate risk distribution
      const riskCounts = { baixo: 0, medio: 0, alto: 0 };
      reports.forEach(r => {
        if (r.risk_level === "baixo" || r.risk_level === "low") riskCounts.baixo++;
        else if (r.risk_level === "medio" || r.risk_level === "moderate") riskCounts.medio++;
        else if (r.risk_level === "alto" || r.risk_level === "high" || r.risk_level === "critical") riskCounts.alto++;
      });

      setRiskDistribution([
        { name: "Baixo", value: riskCounts.baixo, color: RISK_COLORS.baixo },
        { name: "Médio", value: riskCounts.medio, color: RISK_COLORS.medio },
        { name: "Alto", value: riskCounts.alto, color: RISK_COLORS.alto },
      ]);

      setStats({
        totalSubmissions: submissionsRes.count || 0,
        pendingReports: submissions.filter(s => s.status === "pending_ai").length,
        approvedReports: reports.filter(r => r.is_approved).length,
        activeForms: formsRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSeriesData = async () => {
    try {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data: submissions } = await supabase
        .from("submissions")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: true });

      // Group by day
      const grouped: Record<string, number> = {};
      
      // Initialize all days with 0
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), "dd/MM", { locale: ptBR });
        grouped[date] = 0;
      }

      // Count submissions per day
      submissions?.forEach(s => {
        const date = format(new Date(s.created_at), "dd/MM", { locale: ptBR });
        if (grouped[date] !== undefined) {
          grouped[date]++;
        }
      });

      const chartData = Object.entries(grouped).map(([date, submissions]) => ({
        date,
        submissions,
      }));

      setTimeSeriesData(chartData);
    } catch (error) {
      console.error("Error fetching time series:", error);
    }
  };

  const fetchDepartmentData = async () => {
    try {
      const { data: departments } = await supabase
        .from("departments")
        .select("id, name");

      const { data: employees } = await supabase
        .from("employees")
        .select("id, job_role_id, job_roles(department_id)");

      const { data: submissions } = await supabase
        .from("submissions")
        .select("employee_id, reports(risk_level)");

      // Map employees to departments
      const employeeToDept: Record<string, string> = {};
      employees?.forEach(emp => {
        const deptId = (emp.job_roles as any)?.department_id;
        if (deptId) employeeToDept[emp.id] = deptId;
      });

      // Count risks per department
      const deptRisks: Record<string, { baixo: number; medio: number; alto: number }> = {};
      departments?.forEach(d => {
        deptRisks[d.id] = { baixo: 0, medio: 0, alto: 0 };
      });

      submissions?.forEach(sub => {
        if (!sub.employee_id) return;
        const deptId = employeeToDept[sub.employee_id];
        if (!deptId || !deptRisks[deptId]) return;

        const reports = sub.reports as any;
        if (!reports) return;

        const riskLevel = Array.isArray(reports) ? reports[0]?.risk_level : reports?.risk_level;
        if (riskLevel === "baixo" || riskLevel === "low") deptRisks[deptId].baixo++;
        else if (riskLevel === "medio" || riskLevel === "moderate") deptRisks[deptId].medio++;
        else if (riskLevel === "alto" || riskLevel === "high" || riskLevel === "critical") deptRisks[deptId].alto++;
      });

      const chartData = departments?.map(d => ({
        name: d.name.length > 15 ? d.name.substring(0, 15) + "..." : d.name,
        ...deptRisks[d.id],
      })) || [];

      setDepartmentData(chartData.filter(d => d.baixo + d.medio + d.alto > 0));
    } catch (error) {
      console.error("Error fetching department data:", error);
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description, 
    color,
    delay = 0
  }: { 
    title: string; 
    value: number; 
    icon: React.ElementType; 
    description: string;
    color: string;
    delay?: number;
  }) => (
    <Card 
      className="group relative overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2.5 rounded-xl ${color} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-20 animate-pulse" />
            <Skeleton className="h-3 w-24 animate-pulse" />
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold tracking-tight animate-count-up">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header with animation */}
        <div className="animate-fade-in-down">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Olá, {profile?.full_name?.split(" ")[0]}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin 
              ? "Gerencie formulários, submissões e relatórios do sistema."
              : "Acesse os formulários e acompanhe suas submissões."
            }
          </p>
        </div>

        {/* Stats with staggered animation */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
            <StatCard
              title="Submissões"
              value={stats?.totalSubmissions || 0}
              icon={FileText}
              description="Total de respostas"
              color="bg-info/10 text-info"
            />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
            <StatCard
              title="Pendentes"
              value={stats?.pendingReports || 0}
              icon={Clock}
              description="Aguardando análise"
              color="bg-warning/10 text-warning"
              delay={100}
            />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            <StatCard
              title="Aprovados"
              value={stats?.approvedReports || 0}
              icon={CheckCircle}
              description="Relatórios finalizados"
              color="bg-success/10 text-success"
              delay={200}
            />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
            <StatCard
              title="Formulários"
              value={stats?.activeForms || 0}
              icon={ClipboardList}
              description="Ativos no sistema"
              color="bg-primary/10 text-primary"
              delay={300}
            />
          </div>
        </div>

        {/* Charts Section - Admin Only */}
        {isAdmin && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Temporal Evolution Chart */}
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Evolução de Submissões
                </CardTitle>
                <CardDescription>
                  Últimos 30 dias
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timeSeriesData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeSeriesData}>
                        <defs>
                          <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="submissions" 
                          stroke="hsl(var(--primary))" 
                          fillOpacity={1} 
                          fill="url(#colorSubmissions)"
                          name="Submissões"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Nenhuma submissão no período
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Risk Distribution Pie Chart */}
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-info" />
                  Distribuição de Risco
                </CardTitle>
                <CardDescription>
                  Classificação geral dos relatórios
                </CardDescription>
              </CardHeader>
              <CardContent>
                {riskDistribution.some(r => r.value > 0) ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={riskDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {riskDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Nenhum relatório processado
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Department Comparison Chart */}
            {departmentData.length > 0 && (
              <Card className="animate-fade-in lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-success" />
                    Comparação por Departamento
                  </CardTitle>
                  <CardDescription>
                    Níveis de risco por área
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          type="number"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis 
                          type="category"
                          dataKey="name"
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          width={120}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="baixo" name="Baixo" fill={RISK_COLORS.baixo} stackId="a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="medio" name="Médio" fill={RISK_COLORS.medio} stackId="a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="alto" name="Alto" fill={RISK_COLORS.alto} stackId="a" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Action Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Responder Formulário
              </CardTitle>
              <CardDescription>
                Preencha os questionários HSE IT ou Ergonomia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/forms">
                <Button className="w-full gradient-primary group">
                  Ver Formulários Disponíveis
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-info" />
                Minhas Submissões
              </CardTitle>
              <CardDescription>
                Acompanhe o status das suas respostas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/submissions">
                <Button variant="outline" className="w-full group">
                  Ver Histórico
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {isAdmin && (
            <>
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-success" />
                    Relatórios
                  </CardTitle>
                  <CardDescription>
                    Visualize e aprove relatórios de análise
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/reports">
                    <Button variant="outline" className="w-full group">
                      Gerenciar Relatórios
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="animate-fade-in border-warning/50 bg-warning/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Atenção Necessária
                  </CardTitle>
                  <CardDescription>
                    {stats?.pendingReports || 0} submissões aguardam análise
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/reports?filter=pending">
                    <Button variant="outline" className="w-full border-warning text-warning hover:bg-warning hover:text-warning-foreground">
                      Revisar Agora
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
