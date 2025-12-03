import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Loader2, 
  Plus, 
  Brain, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle,
  Copy,
  Eye,
  Settings2,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database, Json } from "@/integrations/supabase/types";

type AIPrompt = Database["public"]["Tables"]["ai_prompts"]["Row"];

const AVAILABLE_MODELS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Recomendado)", description: "Rápido e balanceado" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Máxima qualidade" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "Mais rápido e econômico" },
  { value: "openai/gpt-5", label: "GPT-5", description: "Alta precisão" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", description: "Bom custo-benefício" },
];

interface PromptFormData {
  name: string;
  description: string;
  form_type: "ergos" | "hse_it";
  provider: string;
  model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
}

const DEFAULT_ERGOS_PROMPT = `# SYSTEM ROLE
Você é um Fisioterapeuta Ergonomista Sênior da "HC Consultoria em Ergonomia", responsável pela elaboração de laudos AET (Análise Ergonômica do Trabalho) e avaliação de Riscos Psicossociais para empresas do Grupo Amaggi.

# METODOLOGIA ERGOS
O ERGOS avalia 10 dimensões em duas tabelas:

**Bloco A (Fatores Cognitivos):** Pressão de tempo, Atenção, Complexidade, Monotonia, Raciocínio
**Bloco B (Fatores Organizacionais):** Iniciativa, Isolamento, Horários/Turnos, Relacionamentos, Demandas gerais

**Pontuação:** 0, 2 ou 4 por item
**Fórmula:** Carga Mental = 0,83 × (Soma_A + Soma_B)
**Classificação:** 0-30 (Satisfatório), 31-60 (Aceitável), 61-100 (Devem Melhorar)

# FORMATO DE SAÍDA (JSON)
{
  "risk_level": "baixo" | "medio" | "alto",
  "form_type": "ergos",
  "total_score": 00.00,
  "dimensions_score": { "dimensao": { "score": 0, "risk_color": "verde" } },
  "analysis_text": "Texto técnico da análise...",
  "risk_inventory": [{ "risk_factor": "...", "nre_value": 0, "nre_label": "..." }],
  "conclusion": "Conclusão formal...",
  "recommendations": ["Recomendação 1", "Recomendação 2"]
}`;

const DEFAULT_HSEIT_PROMPT = `# SYSTEM ROLE
Você é um Fisioterapeuta Ergonomista Sênior da "HC Consultoria em Ergonomia", responsável pela elaboração de laudos AET e avaliação de Riscos Psicossociais para empresas do Grupo Amaggi.

# METODOLOGIA HSE-IT
O HSE-IT avalia 7 dimensões: Demandas, Controle, Apoio Chefia, Apoio Colegas, Relacionamentos, Cargo, Mudanças

**Escala:** 1-5 (Nunca a Sempre)
**Classificação por dimensão:**
- 0-20%: Risco Baixo
- 21-50%: Risco Médio
- >50%: Risco Alto

# FORMATO DE SAÍDA (JSON)
{
  "risk_level": "baixo" | "medio" | "alto",
  "form_type": "hse_it",
  "total_score": 00.00,
  "dimensions_score": { "dimensao": { "score": 0, "percentage": 0, "risk_color": "verde" } },
  "analysis_text": "Texto técnico da análise...",
  "risk_inventory": [{ "risk_factor": "...", "nre_value": 0, "nre_label": "..." }],
  "conclusion": "Conclusão formal...",
  "recommendations": ["Recomendação 1", "Recomendação 2"]
}`;

export default function AIPromptsManagement() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPrompt | null>(null);
  const [formData, setFormData] = useState<PromptFormData>({
    name: "",
    description: "",
    form_type: "ergos",
    provider: "lovable",
    model: "google/gemini-2.5-flash",
    system_prompt: DEFAULT_ERGOS_PROMPT,
    temperature: 0.3,
    max_tokens: 4000,
    is_active: false,
  });

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    fetchPrompts();
  }, [isAdmin]);

  const fetchPrompts = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error("Error fetching prompts:", error);
      toast.error("Erro ao carregar prompts");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (prompt?: AIPrompt) => {
    if (prompt) {
      setSelectedPrompt(prompt);
      setFormData({
        name: prompt.name,
        description: prompt.description || "",
        form_type: prompt.form_type as "ergos" | "hse_it",
        provider: prompt.provider,
        model: prompt.model,
        system_prompt: prompt.system_prompt,
        temperature: prompt.temperature || 0.3,
        max_tokens: prompt.max_tokens || 4000,
        is_active: prompt.is_active || false,
      });
    } else {
      setSelectedPrompt(null);
      setFormData({
        name: "",
        description: "",
        form_type: "ergos",
        provider: "lovable",
        model: "google/gemini-2.5-flash",
        system_prompt: DEFAULT_ERGOS_PROMPT,
        temperature: 0.3,
        max_tokens: 4000,
        is_active: false,
      });
    }
    setDialogOpen(true);
  };

  const handleFormTypeChange = (type: "ergos" | "hse_it") => {
    setFormData({
      ...formData,
      form_type: type,
      system_prompt: type === "ergos" ? DEFAULT_ERGOS_PROMPT : DEFAULT_HSEIT_PROMPT,
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!formData.system_prompt.trim()) {
      toast.error("Prompt do sistema é obrigatório");
      return;
    }

    setSaving(true);
    try {
      // If activating this prompt, deactivate others of same form_type
      if (formData.is_active) {
        await supabase
          .from("ai_prompts")
          .update({ is_active: false })
          .eq("form_type", formData.form_type)
          .neq("id", selectedPrompt?.id || "");
      }

      if (selectedPrompt) {
        const { error } = await supabase
          .from("ai_prompts")
          .update({
            name: formData.name,
            description: formData.description || null,
            form_type: formData.form_type,
            provider: formData.provider,
            model: formData.model,
            system_prompt: formData.system_prompt,
            temperature: formData.temperature,
            max_tokens: formData.max_tokens,
            is_active: formData.is_active,
          })
          .eq("id", selectedPrompt.id);

        if (error) throw error;
        toast.success("Prompt atualizado!");
      } else {
        const { error } = await supabase
          .from("ai_prompts")
          .insert({
            name: formData.name,
            description: formData.description || null,
            form_type: formData.form_type,
            provider: formData.provider,
            model: formData.model,
            system_prompt: formData.system_prompt,
            temperature: formData.temperature,
            max_tokens: formData.max_tokens,
            is_active: formData.is_active,
          });

        if (error) throw error;
        toast.success("Prompt criado!");
      }

      setDialogOpen(false);
      fetchPrompts();
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("Erro ao salvar prompt");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (prompt: AIPrompt) => {
    try {
      if (!prompt.is_active) {
        // Deactivate others of same type first
        await supabase
          .from("ai_prompts")
          .update({ is_active: false })
          .eq("form_type", prompt.form_type);
      }

      const { error } = await supabase
        .from("ai_prompts")
        .update({ is_active: !prompt.is_active })
        .eq("id", prompt.id);

      if (error) throw error;
      toast.success(prompt.is_active ? "Prompt desativado" : "Prompt ativado");
      fetchPrompts();
    } catch (error) {
      console.error("Error toggling prompt:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este prompt?")) return;

    try {
      const { error } = await supabase
        .from("ai_prompts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Prompt excluído!");
      fetchPrompts();
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast.error("Erro ao excluir prompt");
    }
  };

  const handleDuplicate = async (prompt: AIPrompt) => {
    try {
      const { error } = await supabase
        .from("ai_prompts")
        .insert({
          name: `${prompt.name} (Cópia)`,
          description: prompt.description,
          form_type: prompt.form_type,
          provider: prompt.provider,
          model: prompt.model,
          system_prompt: prompt.system_prompt,
          temperature: prompt.temperature,
          max_tokens: prompt.max_tokens,
          is_active: false,
        });

      if (error) throw error;
      toast.success("Prompt duplicado!");
      fetchPrompts();
    } catch (error) {
      console.error("Error duplicating prompt:", error);
      toast.error("Erro ao duplicar prompt");
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

  const ergosPrompts = prompts.filter(p => p.form_type === "ergos");
  const hseitPrompts = prompts.filter(p => p.form_type === "hse_it");

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Brain className="h-8 w-8 text-primary" />
              Gestão de Prompts IA
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure os prompts de análise para cada tipo de formulário
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Novo Prompt
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Sparkles className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{prompts.length}</p>
                  <p className="text-sm text-muted-foreground">Total de Prompts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <CheckCircle className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{prompts.filter(p => p.is_active).length}</p>
                  <p className="text-sm text-muted-foreground">Prompts Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Settings2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{AVAILABLE_MODELS.length}</p>
                  <p className="text-sm text-muted-foreground">Modelos Disponíveis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prompts by Type */}
        <Tabs defaultValue="ergos">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ergos" className="flex items-center gap-2">
              ERGOS (Operacional)
              {ergosPrompts.some(p => p.is_active) && (
                <Badge variant="outline" className="bg-success/10 text-success text-xs">Ativo</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="hse_it" className="flex items-center gap-2">
              HSE-IT (Administrativo)
              {hseitPrompts.some(p => p.is_active) && (
                <Badge variant="outline" className="bg-success/10 text-success text-xs">Ativo</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ergos">
            <PromptTable 
              prompts={ergosPrompts}
              onEdit={handleOpenDialog}
              onToggle={handleToggleActive}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onPreview={(p) => { setSelectedPrompt(p); setPreviewOpen(true); }}
            />
          </TabsContent>

          <TabsContent value="hse_it">
            <PromptTable 
              prompts={hseitPrompts}
              onEdit={handleOpenDialog}
              onToggle={handleToggleActive}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onPreview={(p) => { setSelectedPrompt(p); setPreviewOpen(true); }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPrompt ? "Editar Prompt" : "Novo Prompt de IA"}
            </DialogTitle>
            <DialogDescription>
              Configure o prompt que será usado na análise de formulários
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Análise ERGOS v2.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Formulário *</Label>
                <Select
                  value={formData.form_type}
                  onValueChange={(v) => handleFormTypeChange(v as "ergos" | "hse_it")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ergos">ERGOS (Operacional)</SelectItem>
                    <SelectItem value="hse_it">HSE-IT (Administrativo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do prompt..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Modelo de IA *</Label>
                <Select
                  value={formData.model}
                  onValueChange={(v) => setFormData({ ...formData, model: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_MODELS.map(model => (
                      <SelectItem key={model.value} value={model.value}>
                        <div>
                          <p>{model.label}</p>
                          <p className="text-xs text-muted-foreground">{model.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Temperatura ({formData.temperature})</Label>
                <Input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Menor = mais preciso, Maior = mais criativo
                </p>
              </div>
              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input
                  type="number"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prompt do Sistema *</Label>
              <Textarea
                value={formData.system_prompt}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                rows={15}
                className="font-mono text-sm"
                placeholder="Instruções para a IA..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="active">
                Ativar este prompt (desativa outros do mesmo tipo)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedPrompt ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview do Prompt: {selectedPrompt?.name}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
            {selectedPrompt?.system_prompt}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function PromptTable({ 
  prompts, 
  onEdit, 
  onToggle, 
  onDelete, 
  onDuplicate,
  onPreview 
}: {
  prompts: AIPrompt[];
  onEdit: (prompt: AIPrompt) => void;
  onToggle: (prompt: AIPrompt) => void;
  onDelete: (id: string) => void;
  onDuplicate: (prompt: AIPrompt) => void;
  onPreview: (prompt: AIPrompt) => void;
}) {
  if (prompts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum prompt configurado</h3>
          <p className="text-muted-foreground">
            Crie um prompt para este tipo de formulário
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Atualizado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prompts.map((prompt) => (
              <TableRow key={prompt.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{prompt.name}</p>
                    {prompt.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {prompt.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {prompt.model.split("/").pop()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={prompt.is_active ? "default" : "secondary"}
                    className={prompt.is_active ? "bg-success text-success-foreground" : ""}
                  >
                    {prompt.is_active ? (
                      <><CheckCircle className="h-3 w-3 mr-1" /> Ativo</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Inativo</>
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  {prompt.updated_at && format(new Date(prompt.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onPreview(prompt)} title="Visualizar">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(prompt)} title="Editar">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDuplicate(prompt)} title="Duplicar">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onToggle(prompt)} title={prompt.is_active ? "Desativar" : "Ativar"}>
                      {prompt.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(prompt.id)} title="Excluir" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
