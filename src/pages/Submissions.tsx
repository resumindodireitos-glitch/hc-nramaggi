import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Clock, CheckCircle, Loader2, Eye, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Submission = Database["public"]["Tables"]["submissions"]["Row"];
type Form = Database["public"]["Tables"]["forms"]["Row"];

interface SubmissionWithForm extends Submission {
  forms: Form | null;
}

export default function Submissions() {
  const { user } = useAuthContext();
  const [submissions, setSubmissions] = useState<SubmissionWithForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchSubmissions();
  }, [user]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("submissions")
        .select("*, forms(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubmissions((data as SubmissionWithForm[]) || []);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string | null) => {
    switch (status) {
      case "pending_ai":
        return {
          label: "Aguardando Análise",
          icon: Clock,
          color: "bg-warning/10 text-warning border-warning/20",
        };
      case "processed":
        return {
          label: "Processado",
          icon: AlertCircle,
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
          label: "Desconhecido",
          icon: AlertCircle,
          color: "bg-muted text-muted-foreground",
        };
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Minhas Submissões</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe o status das suas respostas
          </p>
        </div>

        {submissions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma submissão</h3>
              <p className="text-muted-foreground text-center mb-4">
                Você ainda não respondeu nenhum formulário
              </p>
              <Link to="/forms">
                <Button className="gradient-primary">Ver Formulários</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission, index) => {
              const statusInfo = getStatusInfo(submission.status);
              const StatusIcon = statusInfo.icon;

              return (
                <Card key={submission.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {submission.forms?.title || "Formulário"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Enviado em{" "}
                            {format(new Date(submission.created_at!), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={statusInfo.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                        {submission.status === "approved" && (
                          <Link to={`/submissions/${submission.id}/report`}>
                            <Button variant="outline" size="sm" className="gap-2">
                              <Eye className="h-4 w-4" />
                              Ver Relatório
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
