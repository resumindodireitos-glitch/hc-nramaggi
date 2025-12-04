import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Send, ClipboardList, CheckCircle2 } from "lucide-react";
import { RespondentDataForm, RespondentData } from "@/components/forms/RespondentDataForm";
import { respondentDataSchema, validateWithZod } from "@/lib/validations";
import type { Database, Json } from "@/integrations/supabase/types";

type Form = Database["public"]["Tables"]["forms"]["Row"];

interface WeightedOption {
  text: string;
  weight: number;
}

interface LikertOption {
  label: string;
  value: number;
}

interface FormQuestion {
  id: string;
  label: string;
  description?: string;
  type: "text" | "textarea" | "radio" | "checkbox" | "scale" | "slider" | "select" | "info" | "weighted_radio" | "likert" | "header" | "subheader";
  options?: string[] | WeightedOption[] | LikertOption[];
  required?: boolean;
  min?: number;
  max?: number;
  dimension_group?: string;
}

export default function FormSubmit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthContext();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Json>>({});
  const [currentStep, setCurrentStep] = useState(0); // 0 = dados respondente, 1+ = perguntas
  
  const [respondentData, setRespondentData] = useState<RespondentData>({
    cpf: "",
    empresa: "Amaggi",
    setor: profile?.department || "",
    cargo: profile?.job_title || "",
    genero: "",
    tempo_empresa: "",
    data_avaliacao: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (id) fetchForm();
  }, [id]);

  useEffect(() => {
    if (profile) {
      setRespondentData(prev => ({
        ...prev,
        empresa: "Amaggi",
        setor: prev.setor || profile.department || "",
        cargo: prev.cargo || profile.job_title || "",
      }));
    }
  }, [profile]);

  const fetchForm = async () => {
    try {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Formulário não encontrado");
        navigate("/forms");
        return;
      }
      setForm(data);
    } catch (error) {
      console.error("Error fetching form:", error);
      toast.error("Erro ao carregar formulário");
      navigate("/forms");
    } finally {
      setLoading(false);
    }
  };

  const schema = (Array.isArray(form?.schema) ? form.schema : []) as unknown as FormQuestion[];
  const totalSteps = schema.length + 1; // +1 for respondent data
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const validateRespondentData = () => {
    // Manual validation that matches what we actually collect
    const cleanedCpf = respondentData.cpf?.replace(/\D/g, '') || '';
    if (cleanedCpf.length < 11) {
      toast.error("CPF é obrigatório (11 dígitos)");
      return false;
    }
    if (!respondentData.setor?.trim()) {
      toast.error("Setor é obrigatório");
      return false;
    }
    if (!respondentData.cargo?.trim()) {
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
      // Skip validation for non-question types
      const skipTypes = ['info', 'header', 'subheader'];
      if (currentQuestion && !skipTypes.includes(currentQuestion.type) && currentQuestion.required && !answers[currentQuestion.id]) {
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
    if (!form || !user) return;

    // Validate last question if required
    if (currentStep > 0) {
      const currentQuestion = schema[currentStep - 1];
      if (currentQuestion?.required && !answers[currentQuestion.id]) {
        toast.error("Esta pergunta é obrigatória");
        return;
      }
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from("submissions").insert({
        form_id: form.id,
        answers: answers as Json,
        respondent_data: {
          user_id: user.id,
          email: profile?.email,
          ...respondentData,
          empresa: "Amaggi",
        } as Json,
        status: "pending_ai",
      });

      if (error) throw error;

      toast.success("Formulário enviado com sucesso!", {
        description: "Sua submissão será analisada em breve.",
      });
      navigate("/submissions");
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Erro ao enviar formulário");
    } finally {
      setSubmitting(false);
    }
  };

  const updateAnswer = (questionId: string, value: Json) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const renderQuestion = (question: FormQuestion, index: number) => {
    return (
      <Card key={question.id} className="animate-fade-in">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
              {index + 1}
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg leading-tight">
                {question.label}
                {question.required && <span className="text-destructive ml-1">*</span>}
              </CardTitle>
              {question.description && (
                <CardDescription>{question.description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pl-14">
          {question.type === "text" && (
            <Input
              value={(answers[question.id] as string) || ""}
              onChange={(e) => updateAnswer(question.id, e.target.value)}
              placeholder="Digite sua resposta"
              className="max-w-md"
            />
          )}

          {question.type === "textarea" && (
            <Textarea
              value={(answers[question.id] as string) || ""}
              onChange={(e) => updateAnswer(question.id, e.target.value)}
              placeholder="Digite sua resposta"
              rows={4}
            />
          )}

          {question.type === "radio" && question.options && (
            <RadioGroup
              value={(answers[question.id] as string) || ""}
              onValueChange={(value) => updateAnswer(question.id, value)}
              className="space-y-3"
            >
              {question.options.map((option) => (
                <div 
                  key={option} 
                  className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => updateAnswer(question.id, option)}
                >
                  <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                  <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer flex-1">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {question.type === "checkbox" && question.options && (
            <div className="space-y-3">
              {question.options.map((option) => {
                const currentValues = (answers[question.id] as string[]) || [];
                return (
                  <div 
                    key={option} 
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
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
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateAnswer(question.id, [...currentValues, option]);
                        } else {
                          updateAnswer(question.id, currentValues.filter((v) => v !== option));
                        }
                      }}
                    />
                    <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer flex-1">
                      {option}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}

          {question.type === "scale" && (
            <RadioGroup
              value={(answers[question.id] as string) || ""}
              onValueChange={(value) => updateAnswer(question.id, value)}
              className="flex gap-2 flex-wrap"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <div 
                  key={value} 
                  className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 cursor-pointer transition-all ${
                    answers[question.id] === String(value) 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'hover:border-primary/50 hover:bg-muted/50'
                  }`}
                  onClick={() => updateAnswer(question.id, String(value))}
                >
                  <RadioGroupItem value={String(value)} id={`${question.id}-${value}`} className="sr-only" />
                  <span className="font-semibold text-lg">{value}</span>
                </div>
              ))}
            </RadioGroup>
          )}

          {question.type === "slider" && (
            <div className="space-y-4 max-w-md">
              <Slider
                value={[(answers[question.id] as number) || question.min || 0]}
                onValueChange={([value]) => updateAnswer(question.id, value)}
                min={question.min || 0}
                max={question.max || 100}
                step={10}
                className="py-4"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Baixo ({question.min || 0})</span>
                <span className="font-semibold text-foreground text-lg">
                  {(answers[question.id] as number) || question.min || 0}
                </span>
                <span>Alto ({question.max || 100})</span>
              </div>
            </div>
          )}

          {question.type === "likert" && question.options && (
            <RadioGroup
              value={String(answers[question.id] || "")}
              onValueChange={(value) => updateAnswer(question.id, parseInt(value))}
              className="space-y-3"
            >
              {(question.options as LikertOption[]).map((option, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer ${
                    answers[question.id] === option.value ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => updateAnswer(question.id, option.value)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                    answers[question.id] === option.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {option.value}
                  </div>
                  <RadioGroupItem value={String(option.value)} id={`${question.id}-${option.value}`} className="sr-only" />
                  <Label htmlFor={`${question.id}-${option.value}`} className="font-normal cursor-pointer flex-1">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {question.type === "weighted_radio" && question.options && (
            <RadioGroup
              value={(answers[question.id] as string) || ""}
              onValueChange={(value) => updateAnswer(question.id, value)}
              className="space-y-3"
            >
              {(question.options as WeightedOption[]).map((option, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer ${
                    answers[question.id] === option.text ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => updateAnswer(question.id, option.text)}
                >
                  <RadioGroupItem value={option.text} id={`${question.id}-${idx}`} className="sr-only" />
                  <Label htmlFor={`${question.id}-${idx}`} className="font-normal cursor-pointer flex-1">
                    {option.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {(question.type === "info" || question.type === "header" || question.type === "subheader") && (
            <p className="text-muted-foreground">
              {question.description || "Continue para a próxima pergunta."}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse">
              <ClipboardList className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <p className="text-muted-foreground animate-pulse">Carregando formulário...</p>
        </div>
      </AppLayout>
    );
  }

  if (!form) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Formulário não encontrado</p>
          <Button variant="outline" onClick={() => navigate("/forms")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/forms")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{form.title}</h1>
            {form.description && (
              <p className="text-sm text-muted-foreground">{form.description}</p>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Etapa {currentStep + 1} de {totalSteps}
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Content */}
        {currentStep === 0 ? (
          <RespondentDataForm
            data={respondentData}
            onChange={setRespondentData}
          />
        ) : (
          schema[currentStep - 1] && renderQuestion(schema[currentStep - 1], currentStep - 1)
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0}
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
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Enviar Respostas
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} className="gradient-primary">
              Próximo
              <Send className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* LGPD Notice */}
        <p className="text-xs text-muted-foreground text-center">
          Todas as informações são tratadas de forma sigilosa, de caráter impessoal e imparcial, 
          respeitando todos os preceitos da Lei 13.709 (LGPD).
        </p>
      </div>
    </AppLayout>
  );
}
