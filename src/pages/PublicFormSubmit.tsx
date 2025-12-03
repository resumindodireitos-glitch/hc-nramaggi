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

interface Department {
  id: string;
  name: string;
}

interface JobRole {
  id: string;
  name: string;
  department_id: string | null;
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
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  
  const [respondentData, setRespondentData] = useState<RespondentData>({
    nome: "",
    empresa: "Amaggi",
    setor: "",
    cargo: "",
    genero: "",
    tempo_empresa: "",
    data_avaliacao: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (id) {
      fetchForm();
      fetchSelectData();
    }
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

  const fetchSelectData = async () => {
    try {
      const [deptRes, rolesRes] = await Promise.all([
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("job_roles").select("id, name, department_id").order("name")
      ]);

      if (deptRes.data) setDepartments(deptRes.data);
      if (rolesRes.data) setJobRoles(rolesRes.data);
    } catch (error) {
      console.error("Error fetching select data:", error);
    }
  };

  const schema = (Array.isArray(form?.schema) ? form.schema : []) as unknown as FormQuestion[];
  const totalSteps = schema.length + 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Filter job roles by selected department
  const filteredJobRoles = respondentData.setor 
    ? jobRoles.filter(jr => {
        const dept = departments.find(d => d.name === respondentData.setor);
        return dept ? jr.department_id === dept.id : true;
      })
    : jobRoles;

  const validateRespondentData = () => {
    if (!respondentData.nome.trim()) {
      toast.error("Nome é obrigatório");
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
          empresa: "Amaggi",
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
        <Card className="max-w-md w-full text-center border-0 bg-slate-800/50 backdrop-blur">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-white">Formulário não encontrado</h2>
            <p className="text-slate-400">
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
        <Card className="max-w-md w-full text-center animate-scale-in border-0 bg-slate-800/50 backdrop-blur">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Respostas Enviadas!</h2>
            <p className="text-slate-400 mb-6">
              Obrigado por participar. Suas respostas foram registradas com sucesso.
            </p>
            
            {submissionId && (
              <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
                <p className="text-xs text-slate-400 mb-1">Código da Submissão</p>
                <p className="font-mono text-sm font-medium text-white">{submissionId.slice(0, 8).toUpperCase()}</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
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
            <img src={logoHC} alt="HC Consultoria" className="h-10 w-10 rounded-lg object-cover" />
            <div>
              <h1 className="font-bold text-white text-sm">HC Consultoria</h1>
              <p className="text-[10px] text-slate-400">Ergonomia & Fisioterapia</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline">Dados Protegidos</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Form Title */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{form.title}</h1>
          {form.description && (
            <p className="text-slate-400 max-w-xl mx-auto">{form.description}</p>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              Etapa {currentStep + 1} de {totalSteps}
            </span>
            <span className="font-medium text-emerald-400">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        {currentStep === 0 ? (
          <Card className="border-0 bg-slate-800/50 backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <User className="h-5 w-5 text-emerald-400" />
                Dados do Respondente
              </CardTitle>
              <CardDescription className="text-slate-400">
                Preencha seus dados para caracterização no relatório. Todas as informações são tratadas de forma sigilosa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-300">
                    <User className="h-4 w-4 text-slate-500" />
                    Nome Completo *
                  </Label>
                  <Input
                    value={respondentData.nome}
                    onChange={(e) => updateRespondent("nome", e.target.value)}
                    placeholder="Seu nome completo"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-300">
                    <Building2 className="h-4 w-4 text-slate-500" />
                    Empresa
                  </Label>
                  <Input
                    value="Amaggi"
                    disabled
                    className="bg-slate-700/30 border-slate-600 text-slate-300 font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-300">
                    <Building2 className="h-4 w-4 text-slate-500" />
                    Setor/Departamento *
                  </Label>
                  <Select 
                    value={respondentData.setor} 
                    onValueChange={(v) => {
                      updateRespondent("setor", v);
                      updateRespondent("cargo", "");
                    }}
                  >
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Selecione o setor..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name} className="text-white hover:bg-slate-700">
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-300">
                    <Briefcase className="h-4 w-4 text-slate-500" />
                    Cargo/Função *
                  </Label>
                  <Select value={respondentData.cargo} onValueChange={(v) => updateRespondent("cargo", v)}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Selecione o cargo..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {filteredJobRoles.map((role) => (
                        <SelectItem key={role.id} value={role.name} className="text-white hover:bg-slate-700">
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-300">
                    <User className="h-4 w-4 text-slate-500" />
                    Gênero
                  </Label>
                  <Select value={respondentData.genero} onValueChange={(v) => updateRespondent("genero", v)}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {GENEROS.map((g) => (
                        <SelectItem key={g} value={g} className="text-white hover:bg-slate-700">{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-300">
                    <Clock className="h-4 w-4 text-slate-500" />
                    Tempo na Empresa *
                  </Label>
                  <Select value={respondentData.tempo_empresa} onValueChange={(v) => updateRespondent("tempo_empresa", v)}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {TEMPO_EMPRESA.map((t) => (
                        <SelectItem key={t} value={t} className="text-white hover:bg-slate-700">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 max-w-xs">
                <Label className="flex items-center gap-2 text-slate-300">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Data da Avaliação
                </Label>
                <Input
                  type="date"
                  value={respondentData.data_avaliacao}
                  onChange={(e) => updateRespondent("data_avaliacao", e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          schema[currentStep - 1] && (
            <Card className="animate-fade-in border-0 bg-slate-800/50 backdrop-blur">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-lg shrink-0">
                    {currentStep}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg leading-tight text-white">
                      {schema[currentStep - 1].label}
                      {schema[currentStep - 1].required && <span className="text-red-400 ml-1">*</span>}
                    </CardTitle>
                    {schema[currentStep - 1].description && (
                      <CardDescription className="text-slate-400">{schema[currentStep - 1].description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-20">
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
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          {isLastStep ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
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
            <Button onClick={handleNext} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              Próximo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center pt-8 pb-4">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <Lock className="h-3 w-3" />
            <span>Dados confidenciais protegidos conforme LGPD</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

// Question input renderer
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
          placeholder="Sua resposta..."
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500"
        />
      );

    case "textarea":
      return (
        <Textarea
          value={(value as string) || ""}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
          placeholder="Sua resposta..."
          rows={4}
          className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 resize-none"
        />
      );

    case "radio":
      return (
        <RadioGroup
          value={(value as string) || ""}
          onValueChange={(v) => updateAnswer(question.id, v)}
          className="space-y-3"
        >
          {question.options?.map((option, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 p-3 rounded-lg border border-slate-700 hover:border-emerald-500/50 transition-colors bg-slate-700/30"
            >
              <RadioGroupItem value={option} id={`${question.id}-${index}`} className="border-slate-500 text-emerald-500" />
              <Label htmlFor={`${question.id}-${index}`} className="cursor-pointer flex-1 text-slate-200">
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "checkbox":
      return (
        <div className="space-y-3">
          {question.options?.map((option, index) => {
            const checked = Array.isArray(value) && (value as string[]).includes(option);
            return (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 rounded-lg border border-slate-700 hover:border-emerald-500/50 transition-colors bg-slate-700/30"
              >
                <Checkbox
                  id={`${question.id}-${index}`}
                  checked={checked}
                  onCheckedChange={(c) => {
                    const current = Array.isArray(value) ? (value as string[]) : [];
                    const newValue = c
                      ? [...current, option]
                      : current.filter((v) => v !== option);
                    updateAnswer(question.id, newValue);
                  }}
                  className="border-slate-500 data-[state=checked]:bg-emerald-500"
                />
                <Label htmlFor={`${question.id}-${index}`} className="cursor-pointer flex-1 text-slate-200">
                  {option}
                </Label>
              </div>
            );
          })}
        </div>
      );

    case "scale":
      return (
        <div className="space-y-4">
          <div className="flex justify-between text-sm text-slate-400">
            <span>Discordo totalmente</span>
            <span>Concordo totalmente</span>
          </div>
          <RadioGroup
            value={(value as string) || ""}
            onValueChange={(v) => updateAnswer(question.id, v)}
            className="flex justify-between gap-2"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex flex-col items-center gap-2">
                <RadioGroupItem
                  value={String(n)}
                  id={`${question.id}-${n}`}
                  className="h-10 w-10 border-2 border-slate-600 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500/20"
                />
                <Label htmlFor={`${question.id}-${n}`} className="text-sm text-slate-400">
                  {n}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      );

    case "slider":
      const min = question.min ?? 0;
      const max = question.max ?? 10;
      const sliderValue = typeof value === "number" ? value : min;
      return (
        <div className="space-y-4 pt-2">
          <Slider
            value={[sliderValue]}
            onValueChange={([v]) => updateAnswer(question.id, v)}
            min={min}
            max={max}
            step={1}
            className="py-4"
          />
          <div className="flex justify-between text-sm text-slate-400">
            <span>{min}</span>
            <span className="text-lg font-bold text-emerald-400">{sliderValue}</span>
            <span>{max}</span>
          </div>
        </div>
      );

    case "select":
      return (
        <Select value={(value as string) || ""} onValueChange={(v) => updateAnswer(question.id, v)}>
          <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
            <SelectValue placeholder="Selecione uma opção..." />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {question.options?.map((option, index) => (
              <SelectItem key={index} value={option} className="text-white hover:bg-slate-700">
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    default:
      return null;
  }
}
