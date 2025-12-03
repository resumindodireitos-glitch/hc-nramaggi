import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Loader2, Brain, Plus, Pencil, Trash2, Save, RefreshCw, 
  FileText, Upload, Database, Link2, CheckCircle2, XCircle, 
  Clock, AlertTriangle, File, FileSpreadsheet
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  form_type: string;
  provider: string;
  model: string;
  system_prompt: string;
  temperature: number | null;
  max_tokens: number | null;
  is_active: boolean | null;
  use_rag: boolean | null;
  rag_top_k: number | null;
  version: number | null;
  created_at: string | null;
}

interface KnowledgeDocument {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  description: string | null;
  status: string | null;
  chunks_count: number | null;
  created_at: string | null;
}

interface AgentDocument {
  agent_id: string;
  document_id: string;
}

const AI_PROVIDERS = [
  { value: "lovable", label: "Lovable AI (Gratuito)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "deepseek", label: "DeepSeek" },
];

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  lovable: [
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Recomendado)" },
    { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (Rápido)" },
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Avançado)" },
    { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro Preview (Novo)" },
    { value: "openai/gpt-5", label: "GPT-5" },
    { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
    { value: "openai/gpt-5-nano", label: "GPT-5 Nano (Econômico)" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek Chat" },
  ],
};

export default function AIAgents() {
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin } = useAuthContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [agentDocuments, setAgentDocuments] = useState<AgentDocument[]>([]);
  
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingAgent, setLinkingAgent] = useState<AIAgent | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  
  const [agentForm, setAgentForm] = useState({
    name: "",
    description: "",
    form_type: "hse_it",
    provider: "lovable",
    model: "google/gemini-2.5-flash",
    system_prompt: "",
    temperature: 0.7,
    max_tokens: 4000,
    is_active: false,
    use_rag: false,
    rag_top_k: 5
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!isAdmin && !isSuperAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    loadData();
  }, [user, isAdmin, isSuperAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [agentsRes, docsRes, linksRes] = await Promise.all([
        supabase.from("ai_prompts").select("*").order("form_type"),
        supabase.from("knowledge_documents").select("*").order("created_at", { ascending: false }),
        supabase.from("agent_documents").select("*")
      ]);
      
      if (agentsRes.data) setAgents(agentsRes.data as AIAgent[]);
      if (docsRes.data) setDocuments(docsRes.data as KnowledgeDocument[]);
      if (linksRes.data) setAgentDocuments(linksRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAgent = async () => {
    if (!agentForm.name || !agentForm.system_prompt) {
      toast.error("Preencha nome e system prompt");
      return;
    }

    try {
      const payload = {
        name: agentForm.name,
        description: agentForm.description || null,
        form_type: agentForm.form_type,
        provider: agentForm.provider,
        model: agentForm.model,
        system_prompt: agentForm.system_prompt,
        temperature: agentForm.temperature,
        max_tokens: agentForm.max_tokens,
        is_active: agentForm.is_active,
        use_rag: agentForm.use_rag,
        rag_top_k: agentForm.rag_top_k,
        updated_at: new Date().toISOString()
      };

      if (editingAgent) {
        const { error } = await supabase.from("ai_prompts").update(payload).eq("id", editingAgent.id);
        if (error) throw error;
        toast.success("Agente atualizado!");
      } else {
        const { error } = await supabase.from("ai_prompts").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast.success("Agente criado!");
      }

      setAgentDialogOpen(false);
      resetAgentForm();
      loadData();
    } catch (error) {
      console.error("Error saving agent:", error);
      toast.error("Erro ao salvar agente");
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm("Excluir este agente?")) return;
    try {
      await supabase.from("ai_prompts").delete().eq("id", id);
      toast.success("Agente excluído!");
      loadData();
    } catch (error) {
      toast.error("Erro ao excluir");
    }
  };

  const handleToggleActive = async (agent: AIAgent) => {
    try {
      if (!agent.is_active) {
        await supabase.from("ai_prompts").update({ is_active: false }).eq("form_type", agent.form_type);
      }
      await supabase.from("ai_prompts").update({ is_active: !agent.is_active }).eq("id", agent.id);
      toast.success(agent.is_active ? "Desativado" : "Ativado");
      loadData();
    } catch (error) {
      toast.error("Erro ao alterar status");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Use knowledge-docs folder (same as existing documents)
      const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const filePath = `knowledge-docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("knowledge-base")
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: doc, error: docError } = await supabase
        .from("knowledge_documents")
        .insert({
          name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for display name
          file_path: filePath,
          file_type: file.type || file.name.split('.').pop() || 'unknown',
          file_size: file.size,
          status: "pending",
          created_by: user?.id
        })
        .select()
        .single();

      if (docError) throw docError;

      toast.success("Documento enviado! Iniciando processamento...");
      loadData();
      
      // Auto-process
      processDocument(doc.id);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro no upload: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const processDocument = async (documentId: string) => {
    setProcessing(documentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ documentId })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Processing failed");
      }

      toast.success(`Processado! ${result.chunks_created} chunks criados`);
      loadData();
    } catch (error) {
      console.error("Process error:", error);
      toast.error("Erro no processamento");
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteDocument = async (doc: KnowledgeDocument) => {
    if (!confirm("Excluir este documento e todos os seus chunks?")) return;
    
    try {
      await supabase.storage.from("knowledge-base").remove([doc.file_path]);
      await supabase.from("knowledge_documents").delete().eq("id", doc.id);
      toast.success("Documento excluído!");
      loadData();
    } catch (error) {
      toast.error("Erro ao excluir");
    }
  };

  const handleLinkDocument = async (documentId: string, linked: boolean) => {
    if (!linkingAgent) return;
    
    try {
      if (linked) {
        await supabase.from("agent_documents").delete()
          .eq("agent_id", linkingAgent.id)
          .eq("document_id", documentId);
      } else {
        await supabase.from("agent_documents").insert({
          agent_id: linkingAgent.id,
          document_id: documentId
        });
      }
      loadData();
    } catch (error) {
      toast.error("Erro ao vincular");
    }
  };

  const resetAgentForm = () => {
    setEditingAgent(null);
    setAgentForm({
      name: "",
      description: "",
      form_type: "hse_it",
      provider: "lovable",
      model: "google/gemini-2.5-flash",
      system_prompt: "",
      temperature: 0.7,
      max_tokens: 4000,
      is_active: false,
      use_rag: false,
      rag_top_k: 5
    });
  };

  const openEditAgent = (agent: AIAgent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      description: agent.description || "",
      form_type: agent.form_type,
      provider: agent.provider,
      model: agent.model,
      system_prompt: agent.system_prompt,
      temperature: agent.temperature || 0.7,
      max_tokens: agent.max_tokens || 4000,
      is_active: agent.is_active || false,
      use_rag: agent.use_rag || false,
      rag_top_k: agent.rag_top_k || 5
    });
    setAgentDialogOpen(true);
  };

  const getDocIcon = (type: string) => {
    if (type.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
    if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) 
      return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
    return <File className="h-4 w-4 text-blue-500" />;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Pronto</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-700"><Clock className="h-3 w-3 mr-1 animate-spin" />Processando</Badge>;
      case "error":
        return <Badge variant="outline" className="bg-red-500/10 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-700"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const getLinkedDocsCount = (agentId: string) => {
    return agentDocuments.filter(ad => ad.agent_id === agentId).length;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Agentes de IA
            </h1>
            <p className="text-muted-foreground">
              Gerencie agentes e base de conhecimento RAG
            </p>
          </div>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Tabs defaultValue="agents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Agentes ({agents.length})
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Base de Conhecimento ({documents.length})
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Agentes Configurados</CardTitle>
                    <CardDescription>
                      Cada agente usa um prompt e modelo específico. Vincule documentos RAG para contexto adicional.
                    </CardDescription>
                  </div>
                  <Dialog open={agentDialogOpen} onOpenChange={(open) => {
                    setAgentDialogOpen(open);
                    if (!open) resetAgentForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button className="gradient-primary">
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Agente
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingAgent ? "Editar Agente" : "Novo Agente de IA"}</DialogTitle>
                        <DialogDescription>Configure o agente para análises</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Nome *</Label>
                            <Input
                              value={agentForm.name}
                              onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                              placeholder="Ex: Analista HSE-IT"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo de Formulário</Label>
                            <Select value={agentForm.form_type} onValueChange={(v) => setAgentForm({ ...agentForm, form_type: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hse_it">HSE-IT</SelectItem>
                                <SelectItem value="ergos">ERGOS</SelectItem>
                                <SelectItem value="general">Geral</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Descrição</Label>
                          <Input
                            value={agentForm.description}
                            onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
                            placeholder="Breve descrição do agente"
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Provedor</Label>
                            <Select
                              value={agentForm.provider}
                              onValueChange={(v) => {
                                const models = MODELS_BY_PROVIDER[v] || [];
                                setAgentForm({ ...agentForm, provider: v, model: models[0]?.value || "" });
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {AI_PROVIDERS.map(p => (
                                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Modelo</Label>
                            <Select value={agentForm.model} onValueChange={(v) => setAgentForm({ ...agentForm, model: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(MODELS_BY_PROVIDER[agentForm.provider] || []).map(m => (
                                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Temperatura ({agentForm.temperature})</Label>
                            <Input
                              type="range" min="0" max="1" step="0.1"
                              value={agentForm.temperature}
                              onChange={(e) => setAgentForm({ ...agentForm, temperature: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Max Tokens</Label>
                            <Input
                              type="number"
                              value={agentForm.max_tokens}
                              onChange={(e) => setAgentForm({ ...agentForm, max_tokens: parseInt(e.target.value) })}
                            />
                          </div>
                        </div>

                        {/* RAG Settings */}
                        <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-base font-medium">Usar Base de Conhecimento (RAG)</Label>
                              <p className="text-sm text-muted-foreground">O agente consultará documentos vinculados</p>
                            </div>
                            <Switch
                              checked={agentForm.use_rag}
                              onCheckedChange={(checked) => setAgentForm({ ...agentForm, use_rag: checked })}
                            />
                          </div>
                          {agentForm.use_rag && (
                            <div className="space-y-2">
                              <Label>Quantidade de chunks recuperados (top_k)</Label>
                              <Input
                                type="number" min="1" max="20"
                                value={agentForm.rag_top_k}
                                onChange={(e) => setAgentForm({ ...agentForm, rag_top_k: parseInt(e.target.value) })}
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label>System Prompt *</Label>
                          <Textarea
                            value={agentForm.system_prompt}
                            onChange={(e) => setAgentForm({ ...agentForm, system_prompt: e.target.value })}
                            placeholder="Instruções para o agente..."
                            rows={10}
                            className="font-mono text-sm"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={agentForm.is_active}
                            onCheckedChange={(checked) => setAgentForm({ ...agentForm, is_active: checked })}
                          />
                          <Label>Agente Ativo (será usado nas análises)</Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveAgent} className="gradient-primary">
                          <Save className="h-4 w-4 mr-2" />Salvar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>RAG</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">{agent.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {agent.form_type === "hse_it" ? "HSE-IT" : agent.form_type === "ergos" ? "ERGOS" : "Geral"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{agent.model}</TableCell>
                        <TableCell>
                          {agent.use_rag ? (
                            <Badge variant="secondary" className="gap-1">
                              <Database className="h-3 w-3" />
                              {getLinkedDocsCount(agent.id)} docs
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch checked={agent.is_active || false} onCheckedChange={() => handleToggleActive(agent)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {agent.use_rag && (
                              <Button variant="ghost" size="icon" onClick={() => { setLinkingAgent(agent); setLinkDialogOpen(true); }}>
                                <Link2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => openEditAgent(agent)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteAgent(agent.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {agents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum agente cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-primary" />
                      Base de Conhecimento (RAG)
                    </CardTitle>
                    <CardDescription>
                      Envie documentos para criar memória vetorial. Os agentes com RAG ativado usarão este conhecimento.
                    </CardDescription>
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Enviar Documento
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getDocIcon(doc.file_type)}
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ""} • {doc.chunks_count || 0} chunks
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(doc.status)}
                        {doc.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => processDocument(doc.id)} disabled={processing === doc.id}>
                            {processing === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Processar"}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteDocument(doc)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum documento na base de conhecimento</p>
                      <p className="text-sm">Envie PDFs, planilhas ou documentos de texto</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Link Documents Dialog */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular Documentos ao Agente</DialogTitle>
              <DialogDescription>
                Selecione quais documentos o agente "{linkingAgent?.name}" pode acessar durante análises.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {documents.filter(d => d.status === "completed").map((doc) => {
                const isLinked = agentDocuments.some(
                  ad => ad.agent_id === linkingAgent?.id && ad.document_id === doc.id
                );
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={isLinked}
                      onCheckedChange={() => handleLinkDocument(doc.id, isLinked)}
                    />
                    <div className="flex items-center gap-2 flex-1">
                      {getDocIcon(doc.file_type)}
                      <div>
                        <p className="font-medium text-sm">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.chunks_count} chunks</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {documents.filter(d => d.status === "completed").length === 0 && (
                <p className="text-center py-4 text-muted-foreground">
                  Nenhum documento processado disponível
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
