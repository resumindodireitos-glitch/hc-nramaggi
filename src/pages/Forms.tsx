import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, ArrowRight, Loader2, FileQuestion, Sparkles } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Form = Database["public"]["Tables"]["forms"]["Row"];

export default function Forms() {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setForms(data || []);
    } catch (error) {
      console.error("Error fetching forms:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFormTypeLabel = (type: string) => {
    switch (type) {
      case "hse_it":
        return { label: "HSE IT", color: "bg-info/10 text-info border-info/20", icon: "🧠" };
      case "ergos":
        return { label: "Ergonomia", color: "bg-success/10 text-success border-success/20", icon: "💪" };
      default:
        return { label: type, color: "bg-muted text-muted-foreground", icon: "📋" };
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse">
              <ClipboardList className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent animate-bounce" />
          </div>
          <p className="text-muted-foreground animate-pulse">Carregando formulários...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-in-down">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              Formulários
            </h1>
          </div>
          <p className="text-muted-foreground">
            Selecione um formulário para responder e contribuir com a análise ergonômica
          </p>
        </div>

        {forms.length === 0 ? (
          <Card className="animate-scale-in">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
                <FileQuestion className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-display font-semibold mb-2">Nenhum formulário disponível</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Não há formulários ativos no momento. Entre em contato com o administrador para mais informações.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {forms.map((form, index) => {
              const typeInfo = getFormTypeLabel(form.type);
              return (
                <Card 
                  key={form.id} 
                  className="group relative overflow-hidden hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
                >
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <CardHeader className="relative pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{typeInfo.icon}</span>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {form.title}
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className={`${typeInfo.color} shrink-0`}>
                        {typeInfo.label}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2 mt-2">
                      {form.description || "Responda ao questionário para contribuir com a análise de riscos ocupacionais."}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="relative pt-0">
                    <Link to={`/forms/${form.id}`}>
                      <Button className="w-full gradient-primary group/btn shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30">
                        <Sparkles className="h-4 w-4 mr-2 group-hover/btn:animate-wiggle" />
                        Responder Agora
                        <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Helper text */}
        {forms.length > 0 && (
          <div className="text-center animate-fade-in" style={{ animationDelay: '400ms' }}>
            <p className="text-sm text-muted-foreground">
              💡 Suas respostas são confidenciais e serão usadas apenas para análise ergonômica.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
