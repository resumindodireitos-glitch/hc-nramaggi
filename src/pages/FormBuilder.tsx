import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Plus, Save, ArrowLeft, Copy, Eye } from "lucide-react";
import { QuestionEditor, type FormQuestion } from "@/components/forms/QuestionEditor";
import { FormPreview } from "@/components/forms/FormPreview";
import type { Json } from "@/integrations/supabase/types";
import { ADM_TEMPLATE, OP_TEMPLATE } from "@/lib/formTemplates";

type FormType = "ergos" | "hse_it";

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formType, setFormType] = useState<FormType>("ergos");
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);

  const isEditing = !!id;

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    
    if (isEditing) {
      fetchForm();
    }
  }, [id, isAdmin]);

  const fetchForm = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      setTitle(data.title);
      setDescription(data.description || "");
      setFormType(data.type as FormType);
      setIsActive(data.is_active ?? true);
      setQuestions((data.schema as unknown as FormQuestion[]) || []);
    } catch (error) {
      console.error("Error fetching form:", error);
      toast.error("Erro ao carregar formulário");
      navigate("/admin/forms");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    if (questions.length === 0) {
      toast.error("Adicione pelo menos uma pergunta");
      return;
    }

    setSaving(true);
    try {
      const schemaData = JSON.parse(JSON.stringify(questions)) as Json;
      
      if (isEditing) {
        const { error } = await supabase
          .from("forms")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            type: formType,
            is_active: isActive,
            schema: schemaData,
          })
          .eq("id", id);
        
        if (error) throw error;
        toast.success("Formulário atualizado!");
      } else {
        const { error } = await supabase
          .from("forms")
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            type: formType,
            is_active: isActive,
            schema: schemaData,
          });
        
        if (error) throw error;
        toast.success("Formulário criado!");
      }

      navigate("/admin/forms");
    } catch (error) {
      console.error("Error saving form:", error);
      toast.error("Erro ao salvar formulário");
    } finally {
      setSaving(false);
    }
  };

  const loadTemplate = (templateType: "adm" | "op" | "ergos" | "hse_it") => {
    let template: FormQuestion[];
    let name: string;
    
    switch (templateType) {
      case "adm":
        template = ADM_TEMPLATE;
        name = "ADM (NASA-TLX + HSE-IT)";
        setFormType("hse_it");
        break;
      case "op":
        template = OP_TEMPLATE;
        name = "OP (NASA-TLX + ERGOS)";
        setFormType("ergos");
        break;
      case "ergos":
        template = OP_TEMPLATE;
        name = "ERGOS Operacional";
        setFormType("ergos");
        break;
      case "hse_it":
        template = ADM_TEMPLATE;
        name = "HSE-IT Administrativo";
        setFormType("hse_it");
        break;
      default:
        return;
    }
    
    setQuestions(template.map(q => ({ ...q, id: `${q.id}_${Date.now()}` })));
    toast.success(`Template ${name} carregado com ${template.length} perguntas`);
  };

  const addQuestion = () => {
    const newQuestion: FormQuestion = {
      id: `q_${Date.now()}`,
      type: "text",
      label: "",
      description: "",
      required: false,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, updated: FormQuestion) => {
    const newQuestions = [...questions];
    newQuestions[index] = updated;
    setQuestions(newQuestions);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    
    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
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

  if (showPreview) {
    return (
      <FormPreview
        title={title}
        description={description}
        questions={questions}
        onClose={() => setShowPreview(false)}
      />
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/forms")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isEditing ? "Editar Formulário" : "Novo Formulário"}
              </h1>
              <p className="text-muted-foreground text-sm">
                Configure as perguntas e opções do formulário
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Form Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações Gerais</CardTitle>
            <CardDescription>Informações básicas do formulário</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Avaliação Ergonômica - Administrativo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Formulário</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as FormType)}>
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
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o propósito deste formulário..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="active">Formulário Ativo</Label>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => loadTemplate("adm")}>
                  <Copy className="h-4 w-4 mr-2" />
                  ADM Completo
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadTemplate("op")}>
                  <Copy className="h-4 w-4 mr-2" />
                  OP Completo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Perguntas ({questions.length})</CardTitle>
                <CardDescription>Configure as perguntas do formulário</CardDescription>
              </div>
              <Button onClick={addQuestion} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Pergunta
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhuma pergunta adicionada.</p>
                <p className="text-sm mt-1">Use um template ou adicione perguntas manualmente.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    index={index}
                    totalQuestions={questions.length}
                    onUpdate={(updated) => updateQuestion(index, updated)}
                    onRemove={() => removeQuestion(index)}
                    onMove={(direction) => moveQuestion(index, direction)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
