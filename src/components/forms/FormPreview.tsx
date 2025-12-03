import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { X } from "lucide-react";
import type { FormQuestion } from "./QuestionEditor";

interface FormPreviewProps {
  title: string;
  description: string;
  questions: FormQuestion[];
  onClose: () => void;
}

export function FormPreview({ title, description, questions, onClose }: FormPreviewProps) {
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const updateAnswer = (questionId: string, value: any) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  const renderQuestion = (question: FormQuestion, index: number) => {
    const value = answers[question.id];

    return (
      <div key={question.id} className="space-y-3 p-4 bg-muted/30 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-sm font-medium text-muted-foreground">{index + 1}.</span>
          <div className="flex-1">
            <Label className="text-base font-medium">
              {question.label || "Pergunta sem título"}
              {question.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {question.description && (
              <p className="text-sm text-muted-foreground mt-1">{question.description}</p>
            )}
          </div>
        </div>

        <div className="ml-6">
          {question.type === "text" && (
            <Input
              placeholder="Resposta curta..."
              value={value || ""}
              onChange={(e) => updateAnswer(question.id, e.target.value)}
            />
          )}

          {question.type === "textarea" && (
            <Textarea
              placeholder="Resposta longa..."
              value={value || ""}
              onChange={(e) => updateAnswer(question.id, e.target.value)}
              rows={3}
            />
          )}

          {question.type === "radio" && question.options && (
            <RadioGroup
              value={value || ""}
              onValueChange={(v) => updateAnswer(question.id, v)}
            >
              {question.options.map((option, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                  <Label htmlFor={`${question.id}-${i}`}>{option || `Opção ${i + 1}`}</Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {question.type === "checkbox" && question.options && (
            <div className="space-y-2">
              {question.options.map((option, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${i}`}
                    checked={(value || []).includes(option)}
                    onCheckedChange={(checked) => {
                      const currentValues = value || [];
                      if (checked) {
                        updateAnswer(question.id, [...currentValues, option]);
                      } else {
                        updateAnswer(question.id, currentValues.filter((v: string) => v !== option));
                      }
                    }}
                  />
                  <Label htmlFor={`${question.id}-${i}`}>{option || `Opção ${i + 1}`}</Label>
                </div>
              ))}
            </div>
          )}

          {question.type === "select" && question.options && (
            <Select value={value || ""} onValueChange={(v) => updateAnswer(question.id, v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {question.options.map((option, i) => (
                  <SelectItem key={i} value={option || `option-${i}`}>
                    {option || `Opção ${i + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {question.type === "scale" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{question.min ?? 0}</span>
                <Slider
                  value={[value ?? question.min ?? 0]}
                  onValueChange={([v]) => updateAnswer(question.id, v)}
                  min={question.min ?? 0}
                  max={question.max ?? 10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">{question.max ?? 10}</span>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-primary">{value ?? question.min ?? 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-warning/10 border-b border-warning/30 px-4 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-sm font-medium text-warning-foreground">
            Modo Preview - As respostas não serão salvas
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Fechar Preview
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-2xl">{title || "Formulário sem título"}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {questions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma pergunta adicionada ao formulário
              </div>
            ) : (
              <>
                {questions.map((question, index) => renderQuestion(question, index))}
                
                <div className="pt-4 border-t">
                  <Button className="w-full" disabled>
                    Enviar Respostas (Preview)
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
