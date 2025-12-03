import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, ChevronUp, ChevronDown, GripVertical, Plus, X } from "lucide-react";

export interface FormQuestion {
  id: string;
  type: "text" | "textarea" | "radio" | "checkbox" | "scale" | "select" | "slider";
  label: string;
  description?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

interface QuestionEditorProps {
  question: FormQuestion;
  index: number;
  totalQuestions: number;
  onUpdate: (question: FormQuestion) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
}

export function QuestionEditor({
  question,
  index,
  totalQuestions,
  onUpdate,
  onRemove,
  onMove,
}: QuestionEditorProps) {
  const updateField = (field: keyof FormQuestion, value: any) => {
    onUpdate({ ...question, [field]: value });
  };

  const addOption = () => {
    const newOptions = [...(question.options || []), ""];
    updateField("options", newOptions);
  };

  const updateOption = (optionIndex: number, value: string) => {
    const newOptions = [...(question.options || [])];
    newOptions[optionIndex] = value;
    updateField("options", newOptions);
  };

  const removeOption = (optionIndex: number) => {
    const newOptions = (question.options || []).filter((_, i) => i !== optionIndex);
    updateField("options", newOptions);
  };

  const needsOptions = ["radio", "checkbox", "select"].includes(question.type);
  const needsScale = question.type === "scale" || question.type === "slider";

  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardContent className="pt-4">
        <div className="flex items-start gap-4">
          {/* Drag Handle & Move Buttons */}
          <div className="flex flex-col items-center gap-1 pt-2">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onMove("up")}
              disabled={index === 0}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground font-medium">{index + 1}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onMove("down")}
              disabled={index === totalQuestions - 1}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Question Content */}
          <div className="flex-1 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Pergunta *</Label>
                <Input
                  value={question.label}
                  onChange={(e) => updateField("label", e.target.value)}
                  placeholder="Digite a pergunta..."
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Resposta</Label>
                <Select value={question.type} onValueChange={(v) => updateField("type", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto curto</SelectItem>
                    <SelectItem value="textarea">Texto longo</SelectItem>
                    <SelectItem value="radio">Escolha única</SelectItem>
                    <SelectItem value="checkbox">Múltipla escolha</SelectItem>
                    <SelectItem value="scale">Escala 1-5</SelectItem>
                    <SelectItem value="slider">Slider (0-100)</SelectItem>
                    <SelectItem value="select">Lista suspensa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição / Ajuda</Label>
              <Textarea
                value={question.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Texto de ajuda para o respondente..."
                rows={2}
              />
            </div>

            {/* Scale Options */}
            {needsScale && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Valor Mínimo</Label>
                  <Input
                    type="number"
                    value={question.min ?? 0}
                    onChange={(e) => updateField("min", parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Máximo</Label>
                  <Input
                    type="number"
                    value={question.max ?? 10}
                    onChange={(e) => updateField("max", parseInt(e.target.value))}
                  />
                </div>
              </div>
            )}

            {/* Options for radio/checkbox/select */}
            {needsOptions && (
              <div className="space-y-2">
                <Label>Opções</Label>
                <div className="space-y-2">
                  {(question.options || []).map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updateOption(optIndex, e.target.value)}
                        placeholder={`Opção ${optIndex + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeOption(optIndex)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Opção
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Switch
                  id={`required-${question.id}`}
                  checked={question.required}
                  onCheckedChange={(checked) => updateField("required", checked)}
                />
                <Label htmlFor={`required-${question.id}`} className="text-sm">
                  Obrigatória
                </Label>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remover
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
