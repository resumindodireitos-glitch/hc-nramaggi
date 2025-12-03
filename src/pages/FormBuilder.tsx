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
import { QuestionEditor, FormQuestion } from "@/components/forms/QuestionEditor";
import { FormPreview } from "@/components/forms/FormPreview";
import type { Json } from "@/integrations/supabase/types";

type FormType = "ergos" | "hse_it";

// ERGOS Template - Metodologia de Avaliação de Carga Mental (ENSIDESA 1989)
// Pontuação: 0, 2, 4 por item. Fórmula: 0,83 × (A + B)
// Interpretação: 0-30 (Satisfatório), 31-60 (Aceitável), 61-100 (Devem Melhorar)
const ERGOS_TEMPLATE: FormQuestion[] = [
  // Bloco A - Fatores Cognitivos
  { id: "pressao_tempo", type: "radio", label: "Pressão de Tempo", description: "Avalie pausas e ritmo de trabalho conforme exigências da atividade", required: true, options: [
    "0 - Não há pressão significativa de tempo",
    "2 - Pressão moderada em alguns momentos",
    "4 - Pressão constante e intensa de tempo"
  ]},
  { id: "atencao", type: "radio", label: "Atenção", description: "Avalie demandas perceptivas, atenção e trabalhos minuciosos", required: true, options: [
    "0 - Atenção básica, sem exigência de precisão",
    "2 - Atenção moderada com alguma precisão",
    "4 - Alta concentração e trabalho minucioso constante"
  ]},
  { id: "complexidade", type: "radio", label: "Complexidade", description: "Avalie a complexidade das tarefas realizadas", required: true, options: [
    "0 - Tarefas simples e rotineiras",
    "2 - Tarefas de complexidade moderada",
    "4 - Tarefas altamente complexas e variadas"
  ]},
  { id: "monotonia", type: "radio", label: "Monotonia", description: "Avalie se possui trabalhos repetitivos e variações", required: true, options: [
    "0 - Atividades variadas e estimulantes",
    "2 - Alguma repetitividade nas tarefas",
    "4 - Alta repetitividade e baixa variação"
  ]},
  { id: "raciocinio", type: "radio", label: "Raciocínio e Processos Centrais", description: "Avalie exigência de raciocínio e decisões no trabalho", required: true, options: [
    "0 - Decisões simples e previsíveis",
    "2 - Necessidade moderada de raciocínio",
    "4 - Tomada de decisões complexas frequente"
  ]},
  // Bloco B - Fatores Organizacionais
  { id: "iniciativa", type: "radio", label: "Iniciativa", description: "Avalie iniciativa própria e autonomia nas operações", required: true, options: [
    "0 - Total autonomia nas decisões do trabalho",
    "2 - Autonomia parcial com supervisão",
    "4 - Pouca ou nenhuma autonomia"
  ]},
  { id: "isolamento", type: "radio", label: "Isolamento", description: "Avalie apoio de colegas durante atividade laboral", required: true, options: [
    "0 - Trabalho em equipe constante",
    "2 - Contato ocasional com colegas",
    "4 - Trabalho isolado na maior parte do tempo"
  ]},
  { id: "horarios_turnos", type: "radio", label: "Horários e Turnos de Trabalho", description: "Avalie horários de trabalho e necessidade de horas extras", required: true, options: [
    "0 - Horário regular sem horas extras",
    "2 - Horas extras ocasionais",
    "4 - Turnos irregulares ou horas extras frequentes"
  ]},
  { id: "relacionamentos", type: "radio", label: "Relacionamentos no Trabalho", description: "Avalie trabalho em equipe e relacionamento com terceiros", required: true, options: [
    "0 - Relacionamentos harmoniosos",
    "2 - Relacionamentos profissionais adequados",
    "4 - Dificuldades de relacionamento ou conflitos"
  ]},
  { id: "demandas_gerais", type: "radio", label: "Demandas Gerais", description: "Avalie supervisão e responsabilidades sobre pessoas ou instalações", required: true, options: [
    "0 - Sem responsabilidades de supervisão",
    "2 - Responsabilidades moderadas",
    "4 - Alta responsabilidade sobre equipes ou instalações"
  ]},
];

// HSE-IT Template - Health Safety Executive Indicator Tool
// 35 questões em 7 dimensões, escala 1-5 (nunca a sempre)
const HSE_IT_TEMPLATE: FormQuestion[] = [
  // Dimensão 1: Demandas
  { id: "demandas_1", type: "radio", label: "Demandas - Carga de Trabalho", description: "Diferentes grupos no trabalho exigem coisas que são difíceis de combinar", required: true, options: [
    "1 - Nunca", "2 - Raramente", "3 - Às vezes", "4 - Frequentemente", "5 - Sempre"
  ]},
  { id: "demandas_2", type: "radio", label: "Demandas - Prazos", description: "Tenho prazos inalcançáveis", required: true, options: [
    "1 - Nunca", "2 - Raramente", "3 - Às vezes", "4 - Frequentemente", "5 - Sempre"
  ]},
  { id: "demandas_3", type: "radio", label: "Demandas - Ritmo", description: "Tenho que trabalhar muito intensamente", required: true, options: [
    "1 - Nunca", "2 - Raramente", "3 - Às vezes", "4 - Frequentemente", "5 - Sempre"
  ]},
  { id: "demandas_4", type: "radio", label: "Demandas - Negligência", description: "Tenho que negligenciar algumas tarefas porque tenho muito a fazer", required: true, options: [
    "1 - Nunca", "2 - Raramente", "3 - Às vezes", "4 - Frequentemente", "5 - Sempre"
  ]},
  // Dimensão 2: Controle
  { id: "controle_1", type: "radio", label: "Controle - Decisões", description: "Posso decidir quando fazer uma pausa", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  { id: "controle_2", type: "radio", label: "Controle - Métodos", description: "Tenho voz sobre a maneira como faço meu trabalho", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  { id: "controle_3", type: "radio", label: "Controle - Ritmo", description: "Tenho alguma escolha sobre o que fazer no trabalho", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  // Dimensão 3: Apoio Gerencial
  { id: "apoio_chefia_1", type: "radio", label: "Apoio Gerencial - Feedback", description: "Recebo feedback sobre o trabalho que faço", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  { id: "apoio_chefia_2", type: "radio", label: "Apoio Gerencial - Suporte", description: "Posso contar com meu gerente para me ajudar com um problema de trabalho", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  { id: "apoio_chefia_3", type: "radio", label: "Apoio Gerencial - Conversa", description: "Posso conversar com meu gerente sobre algo que me perturbou no trabalho", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  // Dimensão 4: Apoio dos Colegas
  { id: "apoio_colegas_1", type: "radio", label: "Apoio dos Colegas - Respeito", description: "Recebo o respeito que mereço dos colegas", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  { id: "apoio_colegas_2", type: "radio", label: "Apoio dos Colegas - Ajuda", description: "Colegas me ajudam quando o trabalho fica difícil", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  // Dimensão 5: Relacionamentos
  { id: "relacionamentos_1", type: "radio", label: "Relacionamentos - Conflitos", description: "Sou pressionado na forma de bullying no trabalho", required: true, options: [
    "1 - Nunca", "2 - Raramente", "3 - Às vezes", "4 - Frequentemente", "5 - Sempre"
  ]},
  { id: "relacionamentos_2", type: "radio", label: "Relacionamentos - Tensão", description: "Existem atritos ou raiva entre colegas", required: true, options: [
    "1 - Nunca", "2 - Raramente", "3 - Às vezes", "4 - Frequentemente", "5 - Sempre"
  ]},
  // Dimensão 6: Cargo
  { id: "cargo_1", type: "radio", label: "Cargo - Clareza", description: "Tenho clareza sobre o que se espera de mim no trabalho", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  { id: "cargo_2", type: "radio", label: "Cargo - Objetivos", description: "Sei o que tenho que fazer para atingir meus objetivos", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  // Dimensão 7: Mudanças
  { id: "mudancas_1", type: "radio", label: "Mudanças - Comunicação", description: "Tenho tempo suficiente para entender as mudanças no trabalho", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
  { id: "mudancas_2", type: "radio", label: "Mudanças - Consulta", description: "Sou consultado sobre mudanças no trabalho", required: true, options: [
    "5 - Nunca", "4 - Raramente", "3 - Às vezes", "2 - Frequentemente", "1 - Sempre"
  ]},
];

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

  const loadTemplate = (type: FormType) => {
    const template = type === "ergos" ? ERGOS_TEMPLATE : HSE_IT_TEMPLATE;
    setQuestions(template.map(q => ({ ...q, id: `${q.id}_${Date.now()}` })));
    toast.success(`Template ${type === "ergos" ? "ERGOS" : "HSE-IT"} carregado`);
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
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => loadTemplate("ergos")}>
                  <Copy className="h-4 w-4 mr-2" />
                  Template ERGOS
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadTemplate("hse_it")}>
                  <Copy className="h-4 w-4 mr-2" />
                  Template HSE-IT
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
