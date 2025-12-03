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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Send } from "lucide-react";
import type { Database, Json } from "@/integrations/supabase/types";

type Form = Database["public"]["Tables"]["forms"]["Row"];

interface FormQuestion {
  id: string;
  question: string;
  type: "text" | "textarea" | "radio" | "checkbox" | "scale";
  options?: string[];
  required?: boolean;
}

export default function FormSubmit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthContext();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Json>>({});

  useEffect(() => {
    if (id) fetchForm();
  }, [id]);

  const fetchForm = async () => {
    try {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setForm(data);
    } catch (error) {
      console.error("Error fetching form:", error);
      toast.error("Erro ao carregar formulário");
      navigate("/forms");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !user) return;

    setSubmitting(true);

    try {
      const { error } = await supabase.from("submissions").insert({
        form_id: form.id,
        answers: answers as Json,
        respondent_data: {
          user_id: user.id,
          full_name: profile?.full_name,
          email: profile?.email,
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

  const schema = (Array.isArray(form?.schema) ? form.schema : []) as unknown as FormQuestion[];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!form) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Formulário não encontrado</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/forms")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{form.title}</CardTitle>
            <CardDescription>{form.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {schema.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Este formulário ainda não possui perguntas configuradas.
                </p>
              ) : (
                schema.map((question, index) => (
                  <div key={question.id} className="space-y-3 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                    <Label className="text-base">
                      {index + 1}. {question.question}
                      {question.required && <span className="text-destructive ml-1">*</span>}
                    </Label>

                    {question.type === "text" && (
                      <Input
                        value={(answers[question.id] as string) || ""}
                        onChange={(e) => updateAnswer(question.id, e.target.value)}
                        required={question.required}
                        placeholder="Digite sua resposta"
                      />
                    )}

                    {question.type === "textarea" && (
                      <Textarea
                        value={(answers[question.id] as string) || ""}
                        onChange={(e) => updateAnswer(question.id, e.target.value)}
                        required={question.required}
                        placeholder="Digite sua resposta"
                        rows={4}
                      />
                    )}

                    {question.type === "radio" && question.options && (
                      <RadioGroup
                        value={(answers[question.id] as string) || ""}
                        onValueChange={(value) => updateAnswer(question.id, value)}
                        required={question.required}
                      >
                        {question.options.map((option) => (
                          <div key={option} className="flex items-center space-x-2">
                            <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                            <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {question.type === "checkbox" && question.options && (
                      <div className="space-y-2">
                        {question.options.map((option) => {
                          const currentValues = (answers[question.id] as string[]) || [];
                          return (
                            <div key={option} className="flex items-center space-x-2">
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
                              <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer">
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
                        className="flex gap-4 flex-wrap"
                        required={question.required}
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <div key={value} className="flex flex-col items-center">
                            <RadioGroupItem value={String(value)} id={`${question.id}-${value}`} />
                            <Label htmlFor={`${question.id}-${value}`} className="font-normal mt-1">
                              {value}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  </div>
                ))
              )}

              {schema.length > 0 && (
                <Button
                  type="submit"
                  className="w-full gradient-primary"
                  disabled={submitting}
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
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
