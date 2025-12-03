import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { 
  Plus, 
  Loader2, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Copy, 
  ExternalLink,
  ClipboardList,
  ToggleLeft,
  ToggleRight,
  QrCode,
  Download,
  Link2
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Form = Database["public"]["Tables"]["forms"]["Row"];

export default function AdminForms() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shareForm, setShareForm] = useState<Form | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    fetchForms();
  }, [isAdmin]);

  const fetchForms = async () => {
    try {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setForms(data || []);
    } catch (error) {
      console.error("Error fetching forms:", error);
      toast.error("Erro ao carregar formulários");
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (form: Form) => {
    try {
      const { error } = await supabase
        .from("forms")
        .update({ is_active: !form.is_active })
        .eq("id", form.id);

      if (error) throw error;
      
      setForms(forms.map(f => 
        f.id === form.id ? { ...f, is_active: !f.is_active } : f
      ));
      
      toast.success(form.is_active ? "Formulário desativado" : "Formulário ativado");
    } catch (error) {
      console.error("Error toggling form:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const duplicateForm = async (form: Form) => {
    try {
      const { error } = await supabase
        .from("forms")
        .insert({
          title: `${form.title} (Cópia)`,
          description: form.description,
          type: form.type,
          schema: form.schema,
          is_active: false,
        });

      if (error) throw error;
      
      toast.success("Formulário duplicado!");
      fetchForms();
    } catch (error) {
      console.error("Error duplicating form:", error);
      toast.error("Erro ao duplicar formulário");
    }
  };

  const deleteForm = async () => {
    if (!deleteId) return;
    
    try {
      const { error } = await supabase
        .from("forms")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      
      setForms(forms.filter(f => f.id !== deleteId));
      toast.success("Formulário excluído!");
    } catch (error) {
      console.error("Error deleting form:", error);
      toast.error("Erro ao excluir formulário");
    } finally {
      setDeleteId(null);
    }
  };

  const copyLink = (formId: string) => {
    const link = `${window.location.origin}/f/${formId}`;
    navigator.clipboard.writeText(link);
    toast.success("Link público copiado!");
  };

  const getFormLink = (formId: string) => {
    return `${window.location.origin}/f/${formId}`;
  };

  const downloadQRCode = (formId: string, formTitle: string) => {
    const svg = document.getElementById(`qr-${formId}`);
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      
      const downloadLink = document.createElement("a");
      downloadLink.download = `qrcode-${formTitle.toLowerCase().replace(/\s+/g, '-')}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const getFormTypeLabel = (type: string) => {
    switch (type) {
      case "hse_it":
        return { label: "HSE-IT", color: "bg-info/10 text-info border-info/20" };
      case "ergos":
        return { label: "ERGOS", color: "bg-success/10 text-success border-success/20" };
      default:
        return { label: type, color: "bg-muted text-muted-foreground" };
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gerenciar Formulários</h1>
            <p className="text-muted-foreground mt-1">
              Crie e gerencie os formulários de avaliação
            </p>
          </div>
          <Button onClick={() => navigate("/admin/forms/new")} className="gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Novo Formulário
          </Button>
        </div>

        {/* Forms Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Formulários ({forms.length})
            </CardTitle>
            <CardDescription>
              Lista de todos os formulários cadastrados no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forms.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum formulário</h3>
                <p className="text-muted-foreground mb-4">
                  Crie seu primeiro formulário para começar a coletar respostas.
                </p>
                <Button onClick={() => navigate("/admin/forms/new")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Formulário
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Perguntas</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forms.map((form) => {
                    const typeInfo = getFormTypeLabel(form.type);
                    const questionsCount = Array.isArray(form.schema) ? form.schema.length : 0;
                    
                    return (
                      <TableRow key={form.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{form.title}</p>
                            {form.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {form.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={typeInfo.color}>
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={form.is_active ? "default" : "secondary"}>
                            {form.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>{questionsCount}</TableCell>
                        <TableCell>
                          {new Date(form.created_at!).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/admin/forms/${form.id}`)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyLink(form.id)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Copiar Link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShareForm(form)}>
                                <QrCode className="h-4 w-4 mr-2" />
                                Link e QR Code
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateForm(form)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleActive(form)}>
                                {form.is_active ? (
                                  <>
                                    <ToggleLeft className="h-4 w-4 mr-2" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <ToggleRight className="h-4 w-4 mr-2" />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(form.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Share Dialog with QR Code */}
      <Dialog open={!!shareForm} onOpenChange={() => setShareForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Compartilhar Formulário
            </DialogTitle>
            <DialogDescription>
              {shareForm?.title}
            </DialogDescription>
          </DialogHeader>
          
          {shareForm && (
            <div className="space-y-6">
              {/* QR Code */}
              <div className="flex flex-col items-center gap-4 p-6 bg-muted/50 rounded-xl">
                <div className="p-4 bg-background rounded-xl shadow-lg">
                  <QRCodeSVG
                    id={`qr-${shareForm.id}`}
                    value={getFormLink(shareForm.id)}
                    size={180}
                    level="H"
                    includeMargin
                    bgColor="transparent"
                    fgColor="currentColor"
                    className="text-foreground"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadQRCode(shareForm.id, shareForm.title)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar QR Code
                </Button>
              </div>

              {/* Link */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Link do Formulário
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={getFormLink(shareForm.id)}
                    className="text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => copyLink(shareForm.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Open Form Button */}
              <Button
                className="w-full gradient-primary"
                onClick={() => window.open(getFormLink(shareForm.id), '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Formulário
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as respostas associadas a este formulário serão mantidas, mas não poderão ser vinculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteForm} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
