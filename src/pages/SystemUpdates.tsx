import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Loader2, RefreshCw, Sparkles, Bug, Zap, ShieldCheck, Plus,
  Calendar, Tag
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SystemUpdate {
  id: string;
  title: string;
  description: string;
  version: string | null;
  type: string;
  created_at: string;
}

const UPDATE_TYPES = [
  { value: "feature", label: "Nova Funcionalidade", icon: Sparkles, color: "text-primary" },
  { value: "fix", label: "Correção", icon: Bug, color: "text-red-500" },
  { value: "improvement", label: "Melhoria", icon: Zap, color: "text-amber-500" },
  { value: "security", label: "Segurança", icon: ShieldCheck, color: "text-green-500" },
];

export default function SystemUpdates() {
  const { isSuperAdmin } = useAuthContext();
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [newType, setNewType] = useState("feature");

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("system_updates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUpdates((data as SystemUpdate[]) || []);
    } catch (error) {
      console.error("Error fetching updates:", error);
      toast.error("Erro ao carregar atualizações");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!newTitle || !newDescription) {
      toast.error("Preencha título e descrição");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("system_updates").insert({
        title: newTitle,
        description: newDescription,
        version: newVersion || null,
        type: newType,
      });

      if (error) throw error;

      toast.success("Atualização adicionada!");
      setShowAddDialog(false);
      setNewTitle("");
      setNewDescription("");
      setNewVersion("");
      setNewType("feature");
      fetchUpdates();
    } catch (error) {
      console.error("Error adding update:", error);
      toast.error("Erro ao adicionar atualização");
    } finally {
      setSaving(false);
    }
  };

  const getTypeConfig = (type: string) => {
    return UPDATE_TYPES.find(t => t.value === type) || UPDATE_TYPES[0];
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
              <Sparkles className="h-6 w-6 text-primary" />
              Atualizações do Sistema
            </h1>
            <p className="text-muted-foreground">
              Histórico de melhorias e novidades do HC Consultoria
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchUpdates} size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {isSuperAdmin && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Atualização
              </Button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
          
          <div className="space-y-6">
            {updates.map((update, index) => {
              const typeConfig = getTypeConfig(update.type);
              const TypeIcon = typeConfig.icon;
              
              return (
                <div key={update.id} className="relative pl-14">
                  {/* Timeline dot */}
                  <div className={cn(
                    "absolute left-4 w-4 h-4 rounded-full border-2 border-background",
                    update.type === "feature" && "bg-primary",
                    update.type === "fix" && "bg-red-500",
                    update.type === "improvement" && "bg-amber-500",
                    update.type === "security" && "bg-green-500",
                  )} />
                  
                  <Card className="border-border/50 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            update.type === "feature" && "bg-primary/10",
                            update.type === "fix" && "bg-red-500/10",
                            update.type === "improvement" && "bg-amber-500/10",
                            update.type === "security" && "bg-green-500/10",
                          )}>
                            <TypeIcon className={cn("h-5 w-5", typeConfig.color)} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{update.title}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {typeConfig.label}
                              </Badge>
                              {update.version && (
                                <Badge className="bg-primary/10 text-primary border-0 text-xs">
                                  v{update.version}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(update.created_at), "dd MMM yyyy", { locale: ptBR })}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">
                        {update.description}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {updates.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Nenhuma atualização registrada</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Update Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Atualização</DialogTitle>
            <DialogDescription>
              Registre uma nova atualização do sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                placeholder="Ex: Nova funcionalidade de relatórios"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UPDATE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className={cn("h-4 w-4", type.color)} />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Versão (opcional)</Label>
                <Input
                  placeholder="Ex: 1.2.0"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva a atualização em detalhes..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddUpdate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
