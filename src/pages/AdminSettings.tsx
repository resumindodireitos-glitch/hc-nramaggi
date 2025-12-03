import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Settings, Brain, Key, Shield, Plus, Pencil, Trash2, Save, RefreshCw, Users, History, Eye, EyeOff, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CSVImporter } from "@/components/admin/CSVImporter";

interface AIPrompt {
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
  version: number | null;
  created_at: string | null;
}

interface SystemSetting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  is_secret: boolean | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string | null;
  user_email?: string;
  user_name?: string;
}

// Provider and model configurations
const AI_PROVIDERS = [
  { value: "lovable", label: "Lovable AI (Gratuito)", description: "Usa modelos Gemini e GPT sem precisar de chave" },
  { value: "openai", label: "OpenAI", description: "Requer OPENAI_API_KEY" },
  { value: "anthropic", label: "Anthropic (Claude)", description: "Requer ANTHROPIC_API_KEY" },
  { value: "deepseek", label: "DeepSeek", description: "Requer DEEPSEEK_API_KEY" },
];

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  lovable: [
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Recomendado)" },
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    { value: "openai/gpt-5", label: "GPT-5" },
    { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
    { value: "openai/gpt-5-nano", label: "GPT-5 Nano" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Recomendado)" },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Rápido)" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek Chat" },
    { value: "deepseek-coder", label: "DeepSeek Coder" },
  ],
};

const API_KEY_SETTINGS = [
  { key: "GOOGLE_API_KEY", provider: "google", label: "Google Gemini API Key", placeholder: "AIza..." },
  { key: "OPENAI_API_KEY", provider: "openai", label: "OpenAI API Key", placeholder: "sk-..." },
  { key: "ANTHROPIC_API_KEY", provider: "anthropic", label: "Anthropic API Key", placeholder: "sk-ant-..." },
  { key: "DEEPSEEK_API_KEY", provider: "deepseek", label: "DeepSeek API Key", placeholder: "sk-..." },
];

export default function AdminSettings() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Data states
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  
  // Dialog states
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  
  // Form states for prompt
  const [promptForm, setPromptForm] = useState({
    name: "",
    description: "",
    form_type: "hse_it",
    provider: "lovable",
    model: "google/gemini-2.5-flash",
    system_prompt: "",
    temperature: 0.7,
    max_tokens: 4000,
    is_active: false
  });

  // API Key visibility states
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    checkSuperAdmin();
  }, [user]);

  const checkSuperAdmin = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    try {
      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (error) console.error("Error checking role:", error);

      const hasSuperAdmin = !!roleData;
      setIsSuperAdmin(hasSuperAdmin);

      const { data: anySuperAdmin } = await supabase
        .from("user_roles")
        .select("id")
        .eq("role", "super_admin")
        .limit(1);

      if (!anySuperAdmin?.length && isAdmin) {
        setIsSuperAdmin(true);
      }

      if (hasSuperAdmin || (!anySuperAdmin?.length && isAdmin)) {
        await loadData();
      } else if (!isAdmin) {
        toast.error("Acesso negado - Apenas Super Admins");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [promptsRes, settingsRes, rolesRes] = await Promise.all([
        supabase.from("ai_prompts").select("*").order("form_type"),
        supabase.from("system_settings").select("*").order("key"),
        supabase.from("user_roles").select("*").order("created_at", { ascending: false })
      ]);
      
      if (promptsRes.data) setPrompts(promptsRes.data as AIPrompt[]);
      if (settingsRes.data) {
        setSettings(settingsRes.data as SystemSetting[]);
        // Initialize key inputs
        const inputs: Record<string, string> = {};
        settingsRes.data.forEach(s => {
          inputs[s.key] = s.value || "";
        });
        setKeyInputs(inputs);
      }

      if (rolesRes.data) {
        const userIds = rolesRes.data.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const enrichedRoles = rolesRes.data.map(role => {
          const profile = profiles?.find(p => p.id === role.user_id);
          return {
            ...role,
            user_email: profile?.email || "N/A",
            user_name: profile?.full_name || "N/A"
          };
        });
        setUserRoles(enrichedRoles);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrompt = async () => {
    try {
      if (editingPrompt) {
        const { error } = await supabase
          .from("ai_prompts")
          .update({
            name: promptForm.name,
            description: promptForm.description || null,
            form_type: promptForm.form_type,
            provider: promptForm.provider,
            model: promptForm.model,
            system_prompt: promptForm.system_prompt,
            temperature: promptForm.temperature,
            max_tokens: promptForm.max_tokens,
            is_active: promptForm.is_active,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingPrompt.id);

        if (error) throw error;
        toast.success("Prompt atualizado!");
      } else {
        const { error } = await supabase
          .from("ai_prompts")
          .insert({
            name: promptForm.name,
            description: promptForm.description || null,
            form_type: promptForm.form_type,
            provider: promptForm.provider,
            model: promptForm.model,
            system_prompt: promptForm.system_prompt,
            temperature: promptForm.temperature,
            max_tokens: promptForm.max_tokens,
            is_active: promptForm.is_active,
            created_by: user?.id
          });

        if (error) throw error;
        toast.success("Prompt criado!");
      }

      setPromptDialogOpen(false);
      resetPromptForm();
      loadData();
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("Erro ao salvar prompt");
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este prompt?")) return;

    try {
      const { error } = await supabase.from("ai_prompts").delete().eq("id", id);
      if (error) throw error;
      toast.success("Prompt excluído!");
      loadData();
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast.error("Erro ao excluir prompt");
    }
  };

  const handleTogglePromptActive = async (prompt: AIPrompt) => {
    try {
      if (!prompt.is_active) {
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
      loadData();
    } catch (error) {
      console.error("Error toggling prompt:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const handleSaveApiKey = async (keyName: string) => {
    setSavingKey(keyName);
    try {
      const value = keyInputs[keyName];
      const existing = settings.find(s => s.key === keyName);
      
      if (existing) {
        const { error } = await supabase
          .from("system_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_settings")
          .insert({ key: keyName, value, is_secret: true });
        if (error) throw error;
      }
      
      toast.success("Chave salva com sucesso!");
      loadData();
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Erro ao salvar chave");
    } finally {
      setSavingKey(null);
    }
  };

  const handlePromoteToSuperAdmin = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" });

      if (error) throw error;
      toast.success("Usuário promovido a Super Admin!");
      loadData();
    } catch (error) {
      console.error("Error promoting user:", error);
      toast.error("Erro ao promover usuário");
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    if (!confirm("Tem certeza que deseja remover este papel?")) return;

    try {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) throw error;
      toast.success("Papel removido!");
      loadData();
    } catch (error) {
      console.error("Error removing role:", error);
      toast.error("Erro ao remover papel");
    }
  };

  const resetPromptForm = () => {
    setEditingPrompt(null);
    setPromptForm({
      name: "",
      description: "",
      form_type: "hse_it",
      provider: "lovable",
      model: "google/gemini-2.5-flash",
      system_prompt: "",
      temperature: 0.7,
      max_tokens: 4000,
      is_active: false
    });
  };

  const openEditPrompt = (prompt: AIPrompt) => {
    setEditingPrompt(prompt);
    setPromptForm({
      name: prompt.name,
      description: prompt.description || "",
      form_type: prompt.form_type,
      provider: prompt.provider,
      model: prompt.model,
      system_prompt: prompt.system_prompt,
      temperature: prompt.temperature || 0.7,
      max_tokens: prompt.max_tokens || 4000,
      is_active: prompt.is_active || false
    });
    setPromptDialogOpen(true);
  };

  const getProviderLabel = (provider: string) => {
    return AI_PROVIDERS.find(p => p.value === provider)?.label || provider;
  };

  const hasApiKeyConfigured = (provider: string) => {
    const keyConfig = API_KEY_SETTINGS.find(k => k.provider === provider);
    if (!keyConfig) return true; // Lovable doesn't need key
    const setting = settings.find(s => s.key === keyConfig.key);
    return setting?.value && setting.value.length > 0;
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

  if (!isSuperAdmin && !isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Acesso Restrito</h2>
          <p className="text-muted-foreground">Apenas Super Administradores podem acessar esta área.</p>
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
              <Shield className="h-6 w-6 text-primary" />
              Configurações do Sistema
            </h1>
            <p className="text-muted-foreground">
              Gerenciamento de IA, chaves de API e permissões
            </p>
          </div>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Tabs defaultValue="apikeys" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="apikeys" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Chaves API
            </TabsTrigger>
            <TabsTrigger value="prompts" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Prompts IA
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Permissões
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Auditoria
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="apikeys" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  Chaves de API para Provedores de IA
                </CardTitle>
                <CardDescription>
                  Configure as chaves de API para usar diferentes provedores de IA. O Lovable AI já vem configurado e não precisa de chave.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Lovable AI Card */}
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Brain className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Lovable AI</h3>
                        <p className="text-sm text-muted-foreground">Acesso a modelos Gemini e GPT sem configuração adicional</p>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  </div>
                </div>

                {/* External Providers */}
                {API_KEY_SETTINGS.map((keyConfig) => {
                  const currentValue = keyInputs[keyConfig.key] || "";
                  const isConfigured = currentValue && currentValue.length > 0;
                  const isVisible = visibleKeys[keyConfig.key];
                  
                  return (
                    <div key={keyConfig.key} className="p-4 rounded-lg border bg-card">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Key className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{keyConfig.label}</h3>
                          <p className="text-sm text-muted-foreground">
                              {AI_PROVIDERS.find(p => p.value === keyConfig.provider)?.description || `Para usar modelos ${keyConfig.provider}`}
                            </p>
                          </div>
                        </div>
                        {isConfigured ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Configurada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                            <XCircle className="h-3 w-3 mr-1" />
                            Não configurada
                          </Badge>
                        )}
                      </div>
                      
                      <div className="mt-4 flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={isVisible ? "text" : "password"}
                            value={currentValue}
                            onChange={(e) => setKeyInputs({ ...keyInputs, [keyConfig.key]: e.target.value })}
                            placeholder={keyConfig.placeholder}
                            className="pr-10 font-mono text-sm"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setVisibleKeys({ ...visibleKeys, [keyConfig.key]: !isVisible })}
                          >
                            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <Button
                          onClick={() => handleSaveApiKey(keyConfig.key)}
                          disabled={savingKey === keyConfig.key}
                        >
                          {savingKey === keyConfig.key ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <div className="p-4 rounded-lg bg-muted/50 border border-dashed">
                  <h4 className="font-medium text-sm mb-2">Como obter as chaves?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>OpenAI:</strong> <a href="https://platform.openai.com/api-keys" target="_blank" className="text-primary hover:underline">platform.openai.com/api-keys</a></li>
                    <li>• <strong>Anthropic:</strong> <a href="https://console.anthropic.com/" target="_blank" className="text-primary hover:underline">console.anthropic.com</a></li>
                    <li>• <strong>DeepSeek:</strong> <a href="https://platform.deepseek.com/" target="_blank" className="text-primary hover:underline">platform.deepseek.com</a></li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prompts Tab */}
          <TabsContent value="prompts" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gerenciamento de Prompts</CardTitle>
                    <CardDescription>
                      Configure os prompts de IA para cada tipo de formulário. Escolha o provedor e modelo desejado.
                    </CardDescription>
                  </div>
                  <Dialog open={promptDialogOpen} onOpenChange={(open) => {
                    setPromptDialogOpen(open);
                    if (!open) resetPromptForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button className="gradient-primary">
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Prompt
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          {editingPrompt ? "Editar Prompt" : "Novo Prompt de IA"}
                        </DialogTitle>
                        <DialogDescription>
                          Configure o prompt e escolha o provedor/modelo para análise
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Nome *</Label>
                            <Input
                              value={promptForm.name}
                              onChange={(e) => setPromptForm({ ...promptForm, name: e.target.value })}
                              placeholder="Ex: Análise HSE-IT v2"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo de Formulário</Label>
                            <Select
                              value={promptForm.form_type}
                              onValueChange={(v) => setPromptForm({ ...promptForm, form_type: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
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
                            value={promptForm.description}
                            onChange={(e) => setPromptForm({ ...promptForm, description: e.target.value })}
                            placeholder="Breve descrição do prompt"
                          />
                        </div>

                        {/* Provider Selection */}
                        <div className="space-y-2">
                          <Label>Provedor de IA *</Label>
                          <Select
                            value={promptForm.provider}
                            onValueChange={(v) => {
                              const models = MODELS_BY_PROVIDER[v] || [];
                              setPromptForm({ 
                                ...promptForm, 
                                provider: v, 
                                model: models[0]?.value || ""
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AI_PROVIDERS.map((provider) => (
                                <SelectItem key={provider.value} value={provider.value}>
                                  <div className="flex items-center gap-2">
                                    <span>{provider.label}</span>
                                    {!hasApiKeyConfigured(provider.value) && provider.value !== "lovable" && (
                                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700">
                                        Sem chave
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {AI_PROVIDERS.find(p => p.value === promptForm.provider)?.description}
                          </p>
                        </div>

                        {/* Model Selection */}
                        <div className="space-y-2">
                          <Label>Modelo *</Label>
                          <Select
                            value={promptForm.model}
                            onValueChange={(v) => setPromptForm({ ...promptForm, model: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(MODELS_BY_PROVIDER[promptForm.provider] || []).map((model) => (
                                <SelectItem key={model.value} value={model.value}>
                                  {model.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Temperatura ({promptForm.temperature})</Label>
                            <Input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={promptForm.temperature}
                              onChange={(e) => setPromptForm({ ...promptForm, temperature: parseFloat(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Menor = mais focado, Maior = mais criativo
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Max Tokens</Label>
                            <Input
                              type="number"
                              value={promptForm.max_tokens}
                              onChange={(e) => setPromptForm({ ...promptForm, max_tokens: parseInt(e.target.value) })}
                              min={100}
                              max={8000}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>System Prompt *</Label>
                          <Textarea
                            value={promptForm.system_prompt}
                            onChange={(e) => setPromptForm({ ...promptForm, system_prompt: e.target.value })}
                            placeholder="Digite o prompt do sistema..."
                            rows={12}
                            className="font-mono text-sm"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={promptForm.is_active}
                            onCheckedChange={(checked) => setPromptForm({ ...promptForm, is_active: checked })}
                          />
                          <Label>Prompt Ativo (será usado nas análises)</Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setPromptDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSavePrompt} className="gradient-primary">
                          <Save className="h-4 w-4 mr-2" />
                          Salvar
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
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prompts.map((prompt) => (
                      <TableRow key={prompt.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{prompt.name}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">{prompt.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {prompt.form_type === "hse_it" ? "HSE-IT" : prompt.form_type === "ergos" ? "ERGOS" : "Geral"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={prompt.provider === "lovable" ? "default" : "secondary"}>
                            {getProviderLabel(prompt.provider)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{prompt.model}</TableCell>
                        <TableCell>
                          <Switch
                            checked={prompt.is_active || false}
                            onCheckedChange={() => handleTogglePromptActive(prompt)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditPrompt(prompt)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePrompt(prompt.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {prompts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum prompt cadastrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            {/* CSV Importer for Risk Matrices */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Importar Matrizes de Risco (CSV)
                </CardTitle>
                <CardDescription>
                  Importe dados CSV para as tabelas de matriz de risco ERGOS, HSE-IT e Biomecânicos. 
                  Útil para carregar portfólios personalizados da Amaggi.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CSVImporter onImportComplete={loadData} />
              </CardContent>
            </Card>

            {/* Other Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Outras Configurações
                </CardTitle>
                <CardDescription>
                  Configurações gerais do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settings.filter(s => !API_KEY_SETTINGS.some(k => k.key === s.key)).map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <Label className="font-medium">{setting.key}</Label>
                      <p className="text-sm text-muted-foreground">{setting.description}</p>
                    </div>
                    <div className="flex items-center gap-2 w-80">
                      <Input
                        type={setting.is_secret ? "password" : "text"}
                        defaultValue={setting.value || ""}
                        onBlur={async (e) => {
                          if (e.target.value !== setting.value) {
                            const { error } = await supabase
                              .from("system_settings")
                              .update({ value: e.target.value, updated_at: new Date().toISOString() })
                              .eq("id", setting.id);
                            if (error) toast.error("Erro ao salvar");
                            else toast.success("Salvo!");
                          }
                        }}
                        placeholder="Valor"
                      />
                    </div>
                  </div>
                ))}
                {settings.filter(s => !API_KEY_SETTINGS.some(k => k.key === s.key)).length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhuma configuração adicional cadastrada
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="space-y-4">
            {userRoles.filter(r => r.role === "super_admin").length === 0 && isAdmin && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-primary">Configuração Inicial</CardTitle>
                  <CardDescription>
                    Nenhum Super Admin configurado. Você pode se tornar o primeiro Super Admin.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => handlePromoteToSuperAdmin(user?.id || "")} className="gradient-primary">
                    <Shield className="h-4 w-4 mr-2" />
                    Tornar-me Super Admin
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Permissões</CardTitle>
                <CardDescription>Controle quem tem acesso de Super Admin</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.user_name}</TableCell>
                        <TableCell>{role.user_email}</TableCell>
                        <TableCell>
                          <Badge variant={role.role === "super_admin" ? "default" : "secondary"}>
                            {role.role === "super_admin" ? "Super Admin" : role.role === "admin_hc" ? "Admin HC" : "Colaborador"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {role.created_at ? new Date(role.created_at).toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {role.user_id !== user?.id && (
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRole(role.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {userRoles.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum papel configurado ainda
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Log de Auditoria
                </CardTitle>
                <CardDescription>Histórico de ações importantes no sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Log de auditoria em implementação</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
