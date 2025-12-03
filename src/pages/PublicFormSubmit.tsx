import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, 
  Send, 
  ClipboardList, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight,
  Shield,
  Lock,
  Building2,
  User,
  Briefcase,
  Calendar,
  Clock
} from "lucide-react";
import type { Database, Json } from "@/integrations/supabase/types";
import logoHC from "@/assets/logo-hc-new.png";

type Form = Database["public"]["Tables"]["forms"]["Row"];

interface FormQuestion {
  id: string;
  label: string;
  description?: string;
  type: "text" | "textarea" | "radio" | "checkbox" | "scale" | "slider" | "select";
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
}

interface RespondentData {
  nome: string;
  empresa: string;
  setor: string;
  cargo: string;
  genero: string;
  tempo_empresa: string;
  data_avaliacao: string;
}

const GENEROS = ["Masculino", "Feminino", "Prefiro não dizer", "Outro"];
const TEMPO_EMPRESA = [
  "Menos de 6 meses",
  "De 6 meses a 1 ano",
  "De 1 a 2 anos",
  "De 2 a 5 anos",
  "De 5 a 7 anos",
  "De 7 a 10 anos",
  "De 10 a 15 anos",
  "Acima de 15 anos"
];

export default function PublicFormSubmit() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Json>>({});
  const [currentStep, setCurrentStep] = useState(0);
  
  const [respondentData, setRespondentData] = useState<RespondentData>({
    nome: "",
    empresa: "",
    setor: "",
    cargo: "",
    genero: "",
    tempo_empresa: "",
    data_avaliacao: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (id) fetchForm();
  }, [id]);

  const fetchForm = async () => {
    try {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      setForm(data);
    } catch (error) {
      console.error("Error fetching form:", error);
    } finally {
      setLoading(false);
    }
  };

  const schema = (Array.isArray(form?.schema) ? form.schema : []) as unknown as FormQuestion[];
  const totalSteps = schema.length + 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const validateRespondentData = () => {
    if (!respondentData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return false;
    }
    if (!respondentData.empresa.trim()) {
      toast.error("Empresa é obrigatória");
      return false;
    }
    if (!respondentData.setor.trim()) {
      toast.error("Setor é obrigatório");
      return false;
    }
    if (!respondentData.cargo.trim()) {
      toast.error("Cargo é obrigatório");
      return false;
    }
    if (!respondentData.tempo_empresa) {
      toast.error("Tempo na empresa é obrigatório");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (!validateRespondentData()) return;
    } else {
      const currentQuestion = schema[currentStep - 1];
      if (currentQuestion?.required && !answers[currentQuestion.id]) {
        toast.error("Esta pergunta é obrigatória");
        return;
      }
    }
    
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!form) return;

    if (currentStep > 0) {
      const currentQuestion = schema[currentStep - 1];
      if (currentQuestion?.required && !answers[currentQuestion.id]) {
        toast.error("Esta pergunta é obrigatória");
        return;
      }
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.from("submissions").insert({
        form_id: form.id,
        answers: answers as Json,
        respondent_data: {
          ...respondentData,
          submitted_at: new Date().toISOString(),
        } as Json,
        status: "pending_ai",
      }).select('id').single();

      if (error) throw error;

      setSubmissionId(data.id);
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Erro ao enviar formulário. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateAnswer = (questionId: string, value: Json) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const updateRespondent = (field: keyof RespondentData, value: string) => {
    setRespondentData(prev => ({ ...prev, [field]: value }));
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse">
            <ClipboardList className="h-8 w-8 text-primary" />
          </div>
          <p className="text-slate-400 animate-pulse">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  // Form not found
  if (!form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold mb-2">Formulário não encontrado</h2>
            <p className="text-muted-foreground">
              Este formulário pode ter sido desativado ou o link está incorreto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center animate-scale-in">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-foreground">Respostas Enviadas!</h2>
            <p className="text-muted-foreground mb-6">
              Obrigado por participar. Suas respostas foram registradas com sucesso.
            </p>
            
            {submissionId && (
              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <p className="text-xs text-muted-foreground mb-1">Código da Submissão</p>
                <p className="font-mono text-sm font-medium">{submissionId.slice(0, 8).toUpperCase()}</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Dados protegidos conforme LGPD</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoHC} alt="HC Consultoria" className="h-10 w-10 rounded-lg" />
            <div>
              <h1 className="font-bold text-white text-sm">HC Consultoria</h1>
              <p className="text-[10px] text-slate-400">Ergonomia & Fisioterapia</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="h-4 w-4 text-green-500" />
            <span className="hidden sm:inline">Dados Protegidos</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Form Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{form.title}</h1>
          {form.description && (
            <p className="text-slate-400">{form.description}</p>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              Etapa {currentStep + 1} de {totalSteps}
            </span>
            <span className="font-medium text-white">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-slate-700" />
        </div>

        {/* Content */}
        {currentStep === 0 ? (
          <Card className="border-primary/20 bg-card/95 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                Dados do Respondente
              </CardTitle>
              <CardDescription>
                Preencha seus dados para caracterização no relatório.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Nome Completo *
                  </Label>
                  <Input
                    value={respondentData.nome}
                    onChange={(e) => updateRespondent("nome", e.target.value)}
                    placeholder="Seu nome completo"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Empresa *
                  </Label>
                  <Input
                    value={respondentData.empresa}
                    onChange={(e) => updateRespondent("empresa", e.target.value)}
                    placeholder="Nome da empresa"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Setor/Departamento *
                  </Label>
                  <Input
                    value={respondentData.setor}
                    onChange={(e) => updateRespondent("setor", e.target.value)}
                    placeholder="Ex: Administrativo, Operacional"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    Cargo/Função *
                  </Label>
                  <Input
                    value={respondentData.cargo}
                    onChange={(e) => updateRespondent("cargo", e.target.value)}
                    placeholder="Ex: Analista, Operador"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Gênero
                  </Label>
                  <Select value={respondentData.genero} onValueChange={(v) => updateRespondent("genero", v)}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {GENEROS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Tempo na Empresa *
                  </Label>
                  <Select value={respondentData.tempo_empresa} onValueChange={(v) => updateRespondent("tempo_empresa", v)}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPO_EMPRESA.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 max-w-xs">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Data da Avaliação
                </Label>
                <Input
                  type="date"
                  value={respondentData.data_avaliacao}
                  onChange={(e) => updateRespondent("data_avaliacao", e.target.value)}
                  className="bg-background/50"
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          schema[currentStep - 1] && (
            <Card className="animate-fade-in bg-card/95 backdrop-blur">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold shrink-0">
                    {currentStep}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg leading-tight">
                      {schema[currentStep - 1].label}
                      {schema[currentStep - 1].required && <span className="text-destructive ml-1">*</span>}
                    </CardTitle>
                    {schema[currentStep - 1].description && (
                      <CardDescription>{schema[currentStep - 1].description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-16">
                {renderQuestionInput(schema[currentStep - 1], answers, updateAnswer)}
              </CardContent>
            </Card>
          )
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          {isLastStep ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gradient-primary"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Respostas
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} className="gradient-primary">
              Próximo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* LGPD Notice */}
        <div className="text-center space-y-3 pt-6 border-t border-slate-700/50">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Lock className="h-4 w-4" />
            <span className="text-sm font-medium">Dados Confidenciais</span>
          </div>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            Todas as informações aqui respondidas serão tratadas de forma sigilosa, de caráter impessoal e imparcial, 
            respeitando todos os preceitos da Lei 13.709 (LGPD). Seus dados são utilizados exclusivamente para 
            fins de análise ergonômica e não serão compartilhados com terceiros.
          </p>
        </div>
      </main>
    </div>
  );
}

function renderQuestionInput(
  question: FormQuestion, 
  answers: Record<string, Json>, 
  updateAnswer: (id: string, value: Json) => void
) {
  const value = answers[question.id];

  switch (question.type) {
    case "text":
      return (
        <Input
          value={(value as string) || ""}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
          placeholder="Digite sua resposta"
          className="max-w-md bg-background/50"
        />
      );

    case "textarea":
      return (
        <Textarea
          value={(value as string) || ""}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
          placeholder="Digite sua resposta"
          rows={4}
          className="bg-background/50"
        />
      );

    case "radio":
      return (
        <RadioGroup
          value={(value as string) || ""}
          onValueChange={(v) => updateAnswer(question.id, v)}
          className="space-y-3"
        >
          {question.options?.map((option) => (
            <div 
              key={option} 
              className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => updateAnswer(question.id, option)}
            >
              <RadioGroupItem value={option} id={`${question.id}-${option}`} />
              <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer flex-1">
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "checkbox":
      const currentValues = (value as string[]) || [];
      return (
        <div className="space-y-3">
          {question.options?.map((option) => (
            <div 
              key={option} 
              className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => {
                if (currentValues.includes(option)) {
                  updateAnswer(question.id, currentValues.filter((v) => v !== option));
                } else {
                  updateAnswer(question.id, [...currentValues, option]);
                }
              }}
            >
              <Checkbox
                id={`${question.id}-${option}`}
                checked={currentValues.includes(option)}
              />
              <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer flex-1">
                {option}
              </Label>
            </div>
          ))}
        </div>
      );

    case "scale":
      return (
        <RadioGroup
          value={(value as string) || ""}
          onValueChange={(v) => updateAnswer(question.id, v)}
          className="flex gap-2 flex-wrap"
        >
          {[1, 2, 3, 4, 5].map((num) => (
            <div 
              key={num} 
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 cursor-pointer transition-all ${
                value === String(num) 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
              }`}
              onClick={() => updateAnswer(question.id, String(num))}
            >
              <span className="font-semibold text-lg">{num}</span>
            </div>
          ))}
        </RadioGroup>
      );

    case "slider":
      return (
        <div className="space-y-4 max-w-md">
          <Slider
            value={[(value as number) || question.min || 0]}
            onValueChange={([v]) => updateAnswer(question.id, v)}
            min={question.min || 0}
            max={question.max || 100}
            step={10}
            className="py-4"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Baixo ({question.min || 0})</span>
            <span className="font-semibold text-foreground text-lg">
              {(value as number) || question.min || 0}
            </span>
            <span>Alto ({question.max || 100})</span>
          </div>
        </div>
      );

    case "select":
      return (
        <Select value={(value as string) || ""} onValueChange={(v) => updateAnswer(question.id, v)}>
          <SelectTrigger className="max-w-md bg-background/50">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {question.options?.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    default:
      return null;
  }
}
