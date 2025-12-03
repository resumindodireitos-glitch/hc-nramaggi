import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Webhook, Copy, ExternalLink, Trash2, Settings, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type WebhookConfig = {
  id: string;
  name: string;
  provider: string;
  external_form_id: string;
  internal_form_id: string | null;
  field_mapping: Record<string, string>;
  is_active: boolean;
  secret_key: string | null;
  last_received_at: string | null;
  total_submissions: number;
  created_at: string;
};

type Form = {
  id: string;
  title: string;
  type: string;
};

export default function WebhookConfiguration() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    provider: "google_forms",
    external_form_id: "",
    internal_form_id: "",
    field_mapping: {
      nome: "",
      setor: "",
      cargo: "",
      genero: "",
      tempo_empresa: ""
    }
  });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhook-configurations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_configurations")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as WebhookConfig[];
    }
  });

  const { data: forms } = useQuery({
    queryKey: ["forms-for-webhook"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, type")
        .eq("is_active", true);
      
      if (error) throw error;
      return data as Form[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (webhook: typeof newWebhook) => {
      const { data, error } = await supabase
        .from("webhook_configurations")
        .insert({
          name: webhook.name,
          provider: webhook.provider,
          external_form_id: webhook.external_form_id,
          internal_form_id: webhook.internal_form_id || null,
          field_mapping: webhook.field_mapping,
          secret_key: crypto.randomUUID().replace(/-/g, "").substring(0, 32)
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-configurations"] });
      toast.success("Webhook configurado com sucesso!");
      setIsCreateOpen(false);
      setNewWebhook({
        name: "",
        provider: "google_forms",
        external_form_id: "",
        internal_form_id: "",
        field_mapping: { nome: "", setor: "", cargo: "", genero: "", tempo_empresa: "" }
      });
    },
    onError: (error) => {
      toast.error("Erro ao criar webhook: " + error.message);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("webhook_configurations")
        .update({ is_active })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-configurations"] });
      toast.success("Status atualizado!");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("webhook_configurations")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-configurations"] });
      toast.success("Webhook removido!");
    }
  });

  const getWebhookUrl = (provider: string) => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (provider === "google_forms") {
      return `${baseUrl}/functions/v1/webhook-google-forms`;
    }
    return `${baseUrl}/functions/v1/webhook-microsoft-forms`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Configuração de Webhooks</h1>
            <p className="text-muted-foreground">
              Configure integrações com Google Forms e Microsoft Forms
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Webhook
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configurar Novo Webhook</DialogTitle>
                <DialogDescription>
                  Configure uma integração com formulários externos
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Integração</Label>
                    <Input
                      placeholder="Ex: Formulário ERGOS - Tanguro"
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Provedor</Label>
                    <Select
                      value={newWebhook.provider}
                      onValueChange={(v) => setNewWebhook({ ...newWebhook, provider: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google_forms">Google Forms</SelectItem>
                        <SelectItem value="microsoft_forms">Microsoft Forms</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ID do Formulário Externo</Label>
                    <Input
                      placeholder="ID do Google/Microsoft Forms"
                      value={newWebhook.external_form_id}
                      onChange={(e) => setNewWebhook({ ...newWebhook, external_form_id: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Formulário Interno</Label>
                    <Select
                      value={newWebhook.internal_form_id}
                      onValueChange={(v) => setNewWebhook({ ...newWebhook, internal_form_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um formulário" />
                      </SelectTrigger>
                      <SelectContent>
                        {forms?.map((form) => (
                          <SelectItem key={form.id} value={form.id}>
                            {form.title} ({form.type.toUpperCase()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Mapeamento de Campos</Label>
                  <p className="text-sm text-muted-foreground">
                    Informe o nome/ID do campo no formulário externo que corresponde a cada campo
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(newWebhook.field_mapping).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-sm capitalize">{key.replace("_", " ")}</Label>
                        <Input
                          placeholder={`Campo para ${key}`}
                          value={value}
                          onChange={(e) => setNewWebhook({
                            ...newWebhook,
                            field_mapping: { ...newWebhook.field_mapping, [key]: e.target.value }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => createMutation.mutate(newWebhook)}
                  disabled={!newWebhook.name || !newWebhook.external_form_id}
                >
                  Criar Webhook
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="webhooks">
          <TabsList>
            <TabsTrigger value="webhooks">Webhooks Configurados</TabsTrigger>
            <TabsTrigger value="instructions">Instruções de Configuração</TabsTrigger>
          </TabsList>

          <TabsContent value="webhooks" className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Carregando...
                </CardContent>
              </Card>
            ) : webhooks?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Webhook className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nenhum webhook configurado</h3>
                  <p className="text-muted-foreground mb-4">
                    Configure integrações com Google Forms ou Microsoft Forms
                  </p>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Webhook
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Form ID Externo</TableHead>
                      <TableHead>Submissões</TableHead>
                      <TableHead>Última Recepção</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks?.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell className="font-medium">{webhook.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {webhook.provider === "google_forms" ? "Google Forms" : "Microsoft Forms"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {webhook.external_form_id.substring(0, 20)}...
                        </TableCell>
                        <TableCell>{webhook.total_submissions}</TableCell>
                        <TableCell>
                          {webhook.last_received_at 
                            ? new Date(webhook.last_received_at).toLocaleDateString("pt-BR")
                            : "Nunca"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={webhook.is_active}
                            onCheckedChange={(checked) => 
                              toggleMutation.mutate({ id: webhook.id, is_active: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(getWebhookUrl(webhook.provider))}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(webhook.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="instructions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5" />
                  Google Forms - Instruções
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>URL do Webhook</AlertTitle>
                  <AlertDescription className="flex items-center gap-2 mt-2">
                    <code className="bg-muted px-2 py-1 rounded text-sm flex-1">
                      {getWebhookUrl("google_forms")}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(getWebhookUrl("google_forms"))}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </AlertDescription>
                </Alert>
                
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Acesse o Google Apps Script (script.google.com)</li>
                  <li>Crie um novo projeto vinculado ao seu Google Form</li>
                  <li>Adicione o código de trigger para enviar dados ao webhook</li>
                  <li>Configure o trigger para executar em cada submissão</li>
                  <li>Configure o mapeamento de campos nesta página</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5" />
                  Microsoft Forms - Instruções
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>URL do Webhook</AlertTitle>
                  <AlertDescription className="flex items-center gap-2 mt-2">
                    <code className="bg-muted px-2 py-1 rounded text-sm flex-1">
                      {getWebhookUrl("microsoft_forms")}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(getWebhookUrl("microsoft_forms"))}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </AlertDescription>
                </Alert>
                
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Acesse o Power Automate (flow.microsoft.com)</li>
                  <li>Crie um novo fluxo automatizado</li>
                  <li>Selecione o trigger "When a new response is submitted"</li>
                  <li>Adicione uma ação HTTP POST para o webhook acima</li>
                  <li>Mapeie os campos do formulário no body da requisição</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
