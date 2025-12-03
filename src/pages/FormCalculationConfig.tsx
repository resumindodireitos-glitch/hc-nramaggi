import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, Calculator, Palette, AlertTriangle } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface DimensionConfig {
  id: string;
  name: string;
  question_ids?: string[];
  max_score?: number;
  weight?: number;
  description?: string;
}

interface BlockConfig {
  name: string;
  dimensions: DimensionConfig[];
}

interface CalculationRules {
  method: string;
  coefficient?: number;
  output_scale?: number;
  blocks?: Record<string, BlockConfig>;
  dimensions?: DimensionConfig[];
  inverted_dimensions?: string[];
}

interface ThresholdLevel {
  max: number;
  label: string;
  color: string;
  risk_level: string;
  description: string;
}

interface DimensionThreshold {
  max: number;
  status: string;
  color: string;
}

interface RiskThresholds {
  levels: ThresholdLevel[];
  dimension_thresholds: DimensionThreshold[];
}

const defaultCalculationRules: CalculationRules = {
  method: "sum_with_coefficient",
  coefficient: 0.83,
  output_scale: 100,
  blocks: {}
};

const defaultRiskThresholds: RiskThresholds = {
  levels: [
    { max: 30, label: "Satisfatório", color: "green", risk_level: "baixo", description: "Condições adequadas" },
    { max: 60, label: "Aceitável", color: "yellow", risk_level: "medio", description: "Monitoramento necessário" },
    { max: 100, label: "Deve Melhorar", color: "red", risk_level: "alto", description: "Ação corretiva necessária" }
  ],
  dimension_thresholds: [
    { max: 3, status: "Adequado", color: "green" },
    { max: 6, status: "Atenção", color: "yellow" },
    { max: 10, status: "Crítico", color: "red" }
  ]
};

export default function FormCalculationConfig() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [calculationRules, setCalculationRules] = useState<CalculationRules>(defaultCalculationRules);
  const [riskThresholds, setRiskThresholds] = useState<RiskThresholds>(defaultRiskThresholds);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    fetchForm();
  }, [id, isAdmin]);

  const fetchForm = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Erro ao carregar formulário");
      navigate("/admin/forms");
      return;
    }

    setForm(data);
    
    if (data.calculation_rules && Object.keys(data.calculation_rules as object).length > 0) {
      setCalculationRules(data.calculation_rules as unknown as CalculationRules);
    }
    
    if (data.risk_thresholds && Object.keys(data.risk_thresholds as object).length > 0) {
      setRiskThresholds(data.risk_thresholds as unknown as RiskThresholds);
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);

    const { error } = await supabase
      .from("forms")
      .update({
        calculation_rules: calculationRules as unknown as Json,
        risk_thresholds: riskThresholds as unknown as Json
      })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      toast.success("Configurações salvas com sucesso!");
    }
    setSaving(false);
  };

  const updateMethod = (method: string) => {
    setCalculationRules(prev => ({ ...prev, method }));
  };

  const updateCoefficient = (coefficient: number) => {
    setCalculationRules(prev => ({ ...prev, coefficient }));
  };

  const updateOutputScale = (output_scale: number) => {
    setCalculationRules(prev => ({ ...prev, output_scale }));
  };

  const addBlock = () => {
    const blockId = `bloco_${Object.keys(calculationRules.blocks || {}).length + 1}`;
    setCalculationRules(prev => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [blockId]: { name: `Bloco ${Object.keys(prev.blocks || {}).length + 1}`, dimensions: [] }
      }
    }));
  };

  const updateBlockName = (blockId: string, name: string) => {
    setCalculationRules(prev => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [blockId]: { ...prev.blocks![blockId], name }
      }
    }));
  };

  const addDimensionToBlock = (blockId: string) => {
    const dimId = `dim_${Date.now()}`;
    setCalculationRules(prev => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [blockId]: {
          ...prev.blocks![blockId],
          dimensions: [
            ...prev.blocks![blockId].dimensions,
            { id: dimId, name: "Nova Dimensão", max_score: 10 }
          ]
        }
      }
    }));
  };

  const updateDimensionInBlock = (blockId: string, dimIndex: number, field: string, value: any) => {
    setCalculationRules(prev => {
      const newBlocks = { ...prev.blocks };
      newBlocks[blockId].dimensions[dimIndex] = {
        ...newBlocks[blockId].dimensions[dimIndex],
        [field]: value
      };
      return { ...prev, blocks: newBlocks };
    });
  };

  const removeDimensionFromBlock = (blockId: string, dimIndex: number) => {
    setCalculationRules(prev => {
      const newBlocks = { ...prev.blocks };
      newBlocks[blockId].dimensions.splice(dimIndex, 1);
      return { ...prev, blocks: newBlocks };
    });
  };

  const removeBlock = (blockId: string) => {
    setCalculationRules(prev => {
      const newBlocks = { ...prev.blocks };
      delete newBlocks[blockId];
      return { ...prev, blocks: newBlocks };
    });
  };

  const updateThresholdLevel = (index: number, field: string, value: any) => {
    setRiskThresholds(prev => {
      const newLevels = [...prev.levels];
      newLevels[index] = { ...newLevels[index], [field]: value };
      return { ...prev, levels: newLevels };
    });
  };

  const updateDimensionThreshold = (index: number, field: string, value: any) => {
    setRiskThresholds(prev => {
      const newThresholds = [...prev.dimension_thresholds];
      newThresholds[index] = { ...newThresholds[index], [field]: value };
      return { ...prev, dimension_thresholds: newThresholds };
    });
  };

  const getColorBadge = (color: string) => {
    const colors: Record<string, string> = {
      green: "bg-green-500",
      yellow: "bg-yellow-500",
      orange: "bg-orange-500",
      red: "bg-red-500"
    };
    return colors[color] || "bg-gray-500";
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/forms")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Configuração de Cálculo</h1>
              <p className="text-muted-foreground">{form?.title}</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>

        <Tabs defaultValue="calculation" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calculation" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Regras de Cálculo
            </TabsTrigger>
            <TabsTrigger value="thresholds" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Limiares de Risco
            </TabsTrigger>
          </TabsList>

          {/* Calculation Rules Tab */}
          <TabsContent value="calculation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Método de Cálculo</CardTitle>
                <CardDescription>
                  Define como os scores são calculados a partir das respostas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Método</Label>
                    <Select value={calculationRules.method} onValueChange={updateMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum_with_coefficient">Soma com Coeficiente (ERGOS)</SelectItem>
                        <SelectItem value="average_by_dimension">Média por Dimensão (HSE-IT)</SelectItem>
                        <SelectItem value="weighted_sum">Soma Ponderada (NASA-TLX)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {calculationRules.method === "sum_with_coefficient" && (
                    <div className="space-y-2">
                      <Label>Coeficiente</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={calculationRules.coefficient || 0.83}
                        onChange={(e) => updateCoefficient(parseFloat(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Fórmula: {calculationRules.coefficient || 0.83} × (Bloco A + Bloco B)
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label>Escala de Saída</Label>
                    <Input
                      type="number"
                      value={calculationRules.output_scale || 100}
                      onChange={(e) => updateOutputScale(parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Score máximo possível
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Blocks Configuration */}
            {calculationRules.method === "sum_with_coefficient" && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Blocos de Dimensões</CardTitle>
                    <CardDescription>
                      Configure os blocos e dimensões do formulário
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addBlock}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Bloco
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(calculationRules.blocks || {}).map(([blockId, block]) => (
                    <div key={blockId} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Input
                          value={block.name}
                          onChange={(e) => updateBlockName(blockId, e.target.value)}
                          className="max-w-xs font-medium"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addDimensionToBlock(blockId)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Dimensão
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeBlock(blockId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {block.dimensions.map((dim, dimIndex) => (
                          <div key={dim.id} className="flex items-center gap-3 bg-muted/50 p-3 rounded-md">
                            <Input
                              placeholder="ID"
                              value={dim.id}
                              onChange={(e) => updateDimensionInBlock(blockId, dimIndex, "id", e.target.value)}
                              className="w-32"
                            />
                            <Input
                              placeholder="Nome"
                              value={dim.name}
                              onChange={(e) => updateDimensionInBlock(blockId, dimIndex, "name", e.target.value)}
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              placeholder="Max"
                              value={dim.max_score || 10}
                              onChange={(e) => updateDimensionInBlock(blockId, dimIndex, "max_score", parseInt(e.target.value))}
                              className="w-20"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDimensionFromBlock(blockId, dimIndex)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        {block.dimensions.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhuma dimensão configurada. Clique em "Dimensão" para adicionar.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {Object.keys(calculationRules.blocks || {}).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum bloco configurado.</p>
                      <p className="text-sm">Clique em "Adicionar Bloco" para começar.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Risk Thresholds Tab */}
          <TabsContent value="thresholds" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Níveis de Risco Global</CardTitle>
                <CardDescription>
                  Define os limiares para classificação do risco geral
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {riskThresholds.levels.map((level, index) => (
                    <div key={index} className="grid grid-cols-6 gap-3 items-center">
                      <div className={`h-4 w-4 rounded-full ${getColorBadge(level.color)}`} />
                      <Input
                        type="number"
                        value={level.max}
                        onChange={(e) => updateThresholdLevel(index, "max", parseInt(e.target.value))}
                        placeholder="Máximo"
                      />
                      <Input
                        value={level.label}
                        onChange={(e) => updateThresholdLevel(index, "label", e.target.value)}
                        placeholder="Rótulo"
                      />
                      <Select
                        value={level.color}
                        onValueChange={(value) => updateThresholdLevel(index, "color", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="green">Verde</SelectItem>
                          <SelectItem value="yellow">Amarelo</SelectItem>
                          <SelectItem value="orange">Laranja</SelectItem>
                          <SelectItem value="red">Vermelho</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={level.risk_level}
                        onValueChange={(value) => updateThresholdLevel(index, "risk_level", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixo">Baixo</SelectItem>
                          <SelectItem value="medio">Médio</SelectItem>
                          <SelectItem value="alto">Alto</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={level.description}
                        onChange={(e) => updateThresholdLevel(index, "description", e.target.value)}
                        placeholder="Descrição"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Limiares por Dimensão</CardTitle>
                <CardDescription>
                  Define os limiares para classificação de cada dimensão individual (escala 0-10)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {riskThresholds.dimension_thresholds.map((threshold, index) => (
                    <div key={index} className="grid grid-cols-4 gap-3 items-center">
                      <div className={`h-4 w-4 rounded-full ${getColorBadge(threshold.color)}`} />
                      <Input
                        type="number"
                        value={threshold.max}
                        onChange={(e) => updateDimensionThreshold(index, "max", parseInt(e.target.value))}
                        placeholder="Máximo"
                      />
                      <Input
                        value={threshold.status}
                        onChange={(e) => updateDimensionThreshold(index, "status", e.target.value)}
                        placeholder="Status"
                      />
                      <Select
                        value={threshold.color}
                        onValueChange={(value) => updateDimensionThreshold(index, "color", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="green">Verde</SelectItem>
                          <SelectItem value="yellow">Amarelo</SelectItem>
                          <SelectItem value="orange">Laranja</SelectItem>
                          <SelectItem value="red">Vermelho</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Pré-visualização</CardTitle>
                <CardDescription>
                  Como os níveis de risco aparecerão nos relatórios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 flex-wrap">
                  {riskThresholds.levels.map((level, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge className={`${getColorBadge(level.color)} text-white`}>
                        ≤ {level.max}
                      </Badge>
                      <span className="text-sm">{level.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
