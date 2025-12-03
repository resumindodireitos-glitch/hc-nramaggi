import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, ClipboardList, BarChart3, AlertTriangle, CheckCircle, Clock, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  totalSubmissions: number;
  pendingReports: number;
  approvedReports: number;
  activeForms: number;
}

export default function Dashboard() {
  const { profile, isAdmin } = useAuthContext();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [isAdmin]);

  const fetchStats = async () => {
    try {
      const [submissionsRes, reportsRes, formsRes] = await Promise.all([
        supabase.from("submissions").select("id, status", { count: "exact" }),
        supabase.from("reports").select("id, is_approved", { count: "exact" }),
        supabase.from("forms").select("id", { count: "exact" }).eq("is_active", true),
      ]);

      const submissions = submissionsRes.data || [];
      const reports = reportsRes.data || [];

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

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description, 
    color 
  }: { 
    title: string; 
    value: number; 
    icon: React.ElementType; 
    description: string;
    color: string;
  }) => (
    <Card className="animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <>
            <div className="text-3xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Olá, {profile?.full_name?.split(" ")[0]}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin 
              ? "Gerencie formulários, submissões e relatórios do sistema."
              : "Acesse os formulários e acompanhe suas submissões."
            }
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Submissões"
            value={stats?.totalSubmissions || 0}
            icon={FileText}
            description="Total de respostas"
            color="bg-info/10 text-info"
          />
          <StatCard
            title="Pendentes"
            value={stats?.pendingReports || 0}
            icon={Clock}
            description="Aguardando análise"
            color="bg-warning/10 text-warning"
          />
          <StatCard
            title="Aprovados"
            value={stats?.approvedReports || 0}
            icon={CheckCircle}
            description="Relatórios finalizados"
            color="bg-success/10 text-success"
          />
          <StatCard
            title="Formulários"
            value={stats?.activeForms || 0}
            icon={ClipboardList}
            description="Ativos no sistema"
            color="bg-primary/10 text-primary"
          />
        </div>

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
