import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, 
  Send, 
  CheckCircle2, 
  ArrowRight,
  ArrowUp,
  Shield,
  Lock,
  Building2,
  User,
  Briefcase,
  Calendar,
  Clock,
  ChevronDown,
  Sparkles
} from "lucide-react";
import type { Database, Json } from "@/integrations/supabase/types";
import logoHC from "@/assets/logo-hc-new.png";

type Form = Database["public"]["Tables"]["forms"]["Row"];

interface FormQuestion {
  id: string;
  label: string;
  description?: string;
  type: "text" | "textarea" | "radio" | "checkbox" | "scale" | "slider" | "select" | "info";
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

// Animation variants
const slideVariants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 50 : -50,
    opacity: 0
  }),
  center: {
    y: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    y: direction < 0 ? 50 : -50,
    opacity: 0
  })
};

export default function PublicFormSubmit() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Json>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !submitting) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, answers, respondentData, submitting]);

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

  const handleNext = useCallback(() => {
    if (currentStep === 0) {
      if (!validateRespondentData()) return;
    } else {
      const currentQuestion = schema[currentStep - 1];
      if (currentQuestion?.type !== 'info' && currentQuestion?.required && !answers[currentQuestion.id]) {
        toast.error("Esta pergunta é obrigatória");
        return;
      }
    }
    
    if (currentStep < totalSteps - 1) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  }, [currentStep, totalSteps, answers, respondentData, schema]);

  const handlePrev = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!form) return;
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
              <Sparkles className="h-10 w-10 text-white animate-pulse" />
            </div>
            <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl blur-xl opacity-40 animate-pulse" />
          </div>
          <p className="text-slate-400 text-lg">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  // Form not found
  if (!form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="h-10 w-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-white">Formulário não encontrado</h2>
          <p className="text-slate-400">
            Este formulário pode ter sido desativado ou o link está incorreto.
          </p>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="text-center max-w-md"
        >
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="relative w-24 h-24 mx-auto mb-8"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full blur-xl opacity-50 animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold mb-4 text-white"
          >
            Obrigado!
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-slate-400 text-lg mb-8"
          >
            Suas respostas foram registradas com sucesso.
          </motion.p>
          
          {submissionId && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 mb-8 border border-slate-700/50"
            >
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Código da Submissão</p>
              <p className="font-mono text-xl font-bold text-emerald-400">{submissionId.slice(0, 8).toUpperCase()}</p>
            </motion.div>
          )}

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-2 text-sm text-slate-500"
          >
            <Shield className="h-4 w-4" />
            <span>Dados protegidos conforme LGPD</span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const isLastStep = currentStep === totalSteps - 1;
  const currentQuestion = currentStep > 0 ? schema[currentStep - 1] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex flex-col">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoHC} alt="HC" className="h-10 w-10 rounded-xl object-cover shadow-lg" />
            <div className="hidden sm:block">
              <p className="font-semibold text-white text-sm">HC Consultoria</p>
              <p className="text-[10px] text-slate-500">Ergonomia & Fisioterapia</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-300 font-medium">Seguro</span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1 bg-slate-800/50">
          <motion.div 
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-24 overflow-hidden">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="space-y-8"
            >
              {currentStep === 0 ? (
                <RespondentStep 
                  data={respondentData}
                  departments={departments}
                  jobRoles={filteredJobRoles}
                  updateRespondent={updateRespondent}
                  formTitle={form.title}
                  formDescription={form.description}
                />
              ) : currentQuestion ? (
                <QuestionStep
                  question={currentQuestion}
                  questionNumber={currentStep}
                  totalQuestions={schema.length}
                  value={answers[currentQuestion.id]}
                  onChange={(value) => updateAnswer(currentQuestion.id, value)}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 pb-6 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <ArrowUp className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}
          </div>

          <div className="text-sm text-slate-500">
            {currentStep + 1} / {totalSteps}
          </div>

          <Button
            onClick={handleNext}
            disabled={submitting}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl px-6 shadow-lg shadow-emerald-500/20"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isLastStep ? (
              <>
                Enviar
                <Send className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                OK
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-600">
            Pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">Enter ↵</kbd> para continuar
          </p>
        </div>
      </footer>
    </div>
  );
}

// Respondent Data Step Component
function RespondentStep({
  data,
  departments,
  jobRoles,
  updateRespondent,
  formTitle,
  formDescription
}: {
  data: RespondentData;
  departments: Department[];
  jobRoles: JobRole[];
  updateRespondent: (field: keyof RespondentData, value: string) => void;
  formTitle: string;
  formDescription: string | null;
}) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl font-bold text-white"
        >
          {formTitle}
        </motion.h1>
        {formDescription && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-lg max-w-lg mx-auto"
          >
            {formDescription}
          </motion.p>
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-800/30 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 space-y-6"
      >
        <div className="flex items-center gap-3 pb-4 border-b border-slate-700/50">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <User className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Seus Dados</h2>
            <p className="text-xs text-slate-500">Informações para caracterização</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TypeformInput
            icon={<User className="h-4 w-4" />}
            label="Nome Completo"
            required
            value={data.nome}
            onChange={(v) => updateRespondent("nome", v)}
            placeholder="Digite seu nome..."
          />

          <TypeformInput
            icon={<Building2 className="h-4 w-4" />}
            label="Empresa"
            value="Amaggi"
            disabled
          />

          <TypeformSelect
            icon={<Building2 className="h-4 w-4" />}
            label="Setor"
            required
            value={data.setor}
            onChange={(v) => {
              updateRespondent("setor", v);
              updateRespondent("cargo", "");
            }}
            options={departments.map(d => d.name)}
            placeholder="Selecione o setor..."
          />

          <TypeformSelect
            icon={<Briefcase className="h-4 w-4" />}
            label="Cargo"
            required
            value={data.cargo}
            onChange={(v) => updateRespondent("cargo", v)}
            options={jobRoles.map(r => r.name)}
            placeholder="Selecione o cargo..."
          />

          <TypeformSelect
            icon={<User className="h-4 w-4" />}
            label="Gênero"
            value={data.genero}
            onChange={(v) => updateRespondent("genero", v)}
            options={GENEROS}
            placeholder="Selecione..."
          />

          <TypeformSelect
            icon={<Clock className="h-4 w-4" />}
            label="Tempo na Empresa"
            required
            value={data.tempo_empresa}
            onChange={(v) => updateRespondent("tempo_empresa", v)}
            options={TEMPO_EMPRESA}
            placeholder="Selecione..."
          />
        </div>
      </motion.div>
    </div>
  );
}

// Question Step Component
function QuestionStep({
  question,
  questionNumber,
  totalQuestions,
  value,
  onChange
}: {
  question: FormQuestion;
  questionNumber: number;
  totalQuestions: number;
  value: Json;
  onChange: (value: Json) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-mono text-sm">
            {questionNumber}/{totalQuestions}
          </span>
          {question.required && (
            <span className="text-red-400 text-xs">Obrigatória</span>
          )}
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
          {question.label}
        </h2>
        
        {question.description && (
          <p className="text-slate-400 text-lg">{question.description}</p>
        )}
      </div>

      <div className="pt-4">
        <QuestionInput question={question} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

// Typeform-style Input
function TypeformInput({
  icon,
  label,
  required,
  value,
  onChange,
  placeholder,
  disabled
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-slate-400 text-sm">
        {icon}
        {label}
        {required && <span className="text-red-400">*</span>}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl h-12 disabled:opacity-60"
      />
    </div>
  );
}

// Typeform-style Select
function TypeformSelect({
  icon,
  label,
  required,
  value,
  onChange,
  options,
  placeholder
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-slate-400 text-sm">
        {icon}
        {label}
        {required && <span className="text-red-400">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white rounded-xl h-12 focus:ring-emerald-500/20">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-700 rounded-xl">
          {options.map((option) => (
            <SelectItem 
              key={option} 
              value={option} 
              className="text-white hover:bg-slate-800 focus:bg-slate-800 rounded-lg"
            >
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Question Input Renderer
function QuestionInput({
  question,
  value,
  onChange
}: {
  question: FormQuestion;
  value: Json;
  onChange: (value: Json) => void;
}) {
  switch (question.type) {
    case "text":
      return (
        <Input
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite sua resposta..."
          className="bg-slate-800/50 border-slate-700 text-white text-xl placeholder:text-slate-600 focus:border-emerald-500 rounded-xl h-14"
          autoFocus
        />
      );

    case "textarea":
      return (
        <Textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite sua resposta..."
          rows={4}
          className="bg-slate-800/50 border-slate-700 text-white text-lg placeholder:text-slate-600 focus:border-emerald-500 rounded-xl resize-none"
          autoFocus
        />
      );

    case "radio":
      return (
        <RadioGroup
          value={(value as string) || ""}
          onValueChange={onChange}
          className="space-y-3"
        >
          {question.options?.map((option, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <label
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  value === option
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 hover:border-slate-600 bg-slate-800/30"
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm font-bold ${
                  value === option ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"
                }`}>
                  {String.fromCharCode(65 + index)}
                </div>
                <RadioGroupItem value={option} className="sr-only" />
                <span className="text-white text-lg">{option}</span>
              </label>
            </motion.div>
          ))}
        </RadioGroup>
      );

    case "checkbox":
      return (
        <div className="space-y-3">
          {question.options?.map((option, index) => {
            const checked = Array.isArray(value) && (value as string[]).includes(option);
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <label
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    checked
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-700 hover:border-slate-600 bg-slate-800/30"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      const current = Array.isArray(value) ? (value as string[]) : [];
                      const newValue = c
                        ? [...current, option]
                        : current.filter((v) => v !== option);
                      onChange(newValue);
                    }}
                    className="h-6 w-6 rounded-lg border-2 border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                  />
                  <span className="text-white text-lg">{option}</span>
                </label>
              </motion.div>
            );
          })}
        </div>
      );

    case "scale":
      return (
        <div className="space-y-6">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Discordo totalmente</span>
            <span>Concordo totalmente</span>
          </div>
          <RadioGroup
            value={(value as string) || ""}
            onValueChange={onChange}
            className="flex justify-between gap-2"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <motion.label
                key={n}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: n * 0.05 }}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  value === String(n)
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 hover:border-slate-600 bg-slate-800/30"
                }`}
              >
                <RadioGroupItem value={String(n)} className="sr-only" />
                <span className={`text-2xl font-bold ${value === String(n) ? "text-emerald-400" : "text-slate-400"}`}>
                  {n}
                </span>
              </motion.label>
            ))}
          </RadioGroup>
        </div>
      );

    case "slider":
      const min = question.min ?? 0;
      const max = question.max ?? 100;
      const sliderValue = typeof value === "number" ? value : min;
      return (
        <div className="space-y-8 pt-4">
          <div className="text-center">
            <span className="text-6xl font-bold text-emerald-400">{sliderValue}</span>
          </div>
          <Slider
            value={[sliderValue]}
            onValueChange={([v]) => onChange(v)}
            min={min}
            max={max}
            step={1}
            className="py-4"
          />
          <div className="flex justify-between text-sm text-slate-500">
            <span>{min}</span>
            <span>{max}</span>
          </div>
        </div>
      );

    case "select":
      return (
        <Select value={(value as string) || ""} onValueChange={onChange}>
          <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white rounded-xl h-14 text-lg">
            <SelectValue placeholder="Selecione uma opção..." />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700 rounded-xl">
            {question.options?.map((option, index) => (
              <SelectItem 
                key={index} 
                value={option} 
                className="text-white hover:bg-slate-800 focus:bg-slate-800 rounded-lg text-lg py-3"
              >
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "info":
      return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50"
        >
          <p className="text-slate-300 text-lg leading-relaxed">
            {question.description || "Continue para a próxima seção."}
          </p>
        </motion.div>
      );

    default:
      return null;
  }
}
