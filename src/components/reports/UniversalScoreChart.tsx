import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Target, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

/**
 * UNIVERSAL SCORE CHART
 * 
 * This component renders charts for ANY form type using the standardized output
 * from the universal-calculator edge function.
 * 
 * It reads ONLY the standard JSON structure:
 * {
 *   global_score: number,
 *   risk_level: string,
 *   risk_label: string,
 *   dimensions: [{ name, score, normalized_score, status, color }]
 * }
 */

interface Dimension {
  name: string;
  score: number;
  normalized_score: number;
  status: string;
  color: string;
}

interface Block {
  name: string;
  total: number;
  dimensions: Array<{ name: string; score: number; status: string; color: string }>;
}

interface StandardScoreData {
  global_score: number;
  risk_level: string;
  risk_label: string;
  risk_color: string;
  risk_description?: string;
  dimensions: Dimension[];
  blocks?: Record<string, Block>;
  form_type?: string;
  calculation_method?: string;
}

interface UniversalScoreChartProps {
  data: StandardScoreData | null;
  showRadar?: boolean;
  showBars?: boolean;
  showBlocks?: boolean;
  compact?: boolean;
}

const COLOR_MAP: Record<string, string> = {
  green: "#22c55e",
  lightgreen: "#4ade80",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  "Adequado": "bg-green-500/10 text-green-500 border-green-500/20",
  "Atenção": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  "Crítico": "bg-red-500/10 text-red-500 border-red-500/20",
  "Satisfatório": "bg-green-500/10 text-green-500 border-green-500/20",
  "Aceitável": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  "Deve Melhorar": "bg-red-500/10 text-red-500 border-red-500/20",
};

// Helper to normalize old format to new format
function normalizeScoreData(rawData: any): StandardScoreData | null {
  if (!rawData) return null;
  
  // If already in new format with dimensions array
  if (rawData.dimensions && Array.isArray(rawData.dimensions)) {
    return rawData as StandardScoreData;
  }
  
  // Convert old format (object with dimension keys) to new format
  const dimensions: Dimension[] = [];
  let totalScore = 0;
  let count = 0;
  
  // Check if it's an object with dimension data
  if (typeof rawData === 'object') {
    for (const [key, value] of Object.entries(rawData)) {
      // Skip metadata keys
      if (['global_score', 'risk_level', 'risk_label', 'risk_color', 'risk_description', 'blocks', 'form_type', 'calculation_method'].includes(key)) {
        continue;
      }
      
      let score = 0;
      let color = 'yellow';
      let status = 'Atenção';
      
      if (typeof value === 'number') {
        score = value;
      } else if (typeof value === 'object' && value !== null) {
        const v = value as any;
        score = v.score ?? v.normalized_score ?? 0;
        color = v.color ?? v.risk_color ?? 'yellow';
        status = v.status ?? 'Atenção';
      }
      
      // Determine status based on score if not provided
      if (typeof value === 'number' || (typeof value === 'object' && !(value as any).status)) {
        const normalizedScore = score > 10 ? score : (score / 10) * 100;
        if (normalizedScore <= 33) {
          status = 'Adequado';
          color = 'green';
        } else if (normalizedScore <= 66) {
          status = 'Atenção';
          color = 'yellow';
        } else {
          status = 'Crítico';
          color = 'red';
        }
      }
      
      dimensions.push({
        name: key,
        score,
        normalized_score: score > 10 ? score : (score / 10) * 100,
        status,
        color,
      });
      
      totalScore += dimensions[dimensions.length - 1].normalized_score;
      count++;
    }
  }
  
  const globalScore = rawData.global_score ?? (count > 0 ? Math.round(totalScore / count) : 0);
  const riskLevel = rawData.risk_level ?? (globalScore > 66 ? 'alto' : globalScore > 33 ? 'medio' : 'baixo');
  
  return {
    global_score: globalScore,
    risk_level: riskLevel,
    risk_label: rawData.risk_label ?? (riskLevel === 'alto' ? 'Alto' : riskLevel === 'medio' ? 'Médio' : 'Baixo'),
    risk_color: rawData.risk_color ?? (riskLevel === 'alto' ? 'red' : riskLevel === 'medio' ? 'yellow' : 'green'),
    risk_description: rawData.risk_description ?? '',
    dimensions,
    blocks: rawData.blocks,
    form_type: rawData.form_type,
    calculation_method: rawData.calculation_method,
  };
}

export function UniversalScoreChart({
  data,
  showRadar = true,
  showBars = true,
  showBlocks = false,
  compact = false,
}: UniversalScoreChartProps) {
  // Normalize data to handle both old and new formats
  const normalizedData = useMemo(() => normalizeScoreData(data), [data]);
  
  const chartData = useMemo(() => {
    if (!normalizedData?.dimensions || normalizedData.dimensions.length === 0) return [];
    return normalizedData.dimensions.map((dim) => ({
      name: dim.name,
      score: dim.normalized_score || dim.score,
      fullMark: 100,
      color: COLOR_MAP[dim.color] || "#6b7280",
    }));
  }, [normalizedData]);

  if (!normalizedData) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">
            Dados de pontuação não disponíveis
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRiskBadgeClass = () => {
    switch (normalizedData.risk_level) {
      case "baixo":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "medio":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "alto":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRiskIcon = () => {
    switch (normalizedData.risk_level) {
      case "baixo":
        return <CheckCircle className="h-4 w-4" />;
      case "alto":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  return (
    <div className={`space-y-4 ${compact ? "" : "space-y-6"}`}>
      {/* Global Score Card */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-card to-muted/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-4 w-4 text-primary" />
              </div>
              Pontuação Global
            </div>
            <Badge variant="outline" className={`${getRiskBadgeClass()} px-3 py-1 gap-2`}>
              {getRiskIcon()}
              {normalizedData.risk_label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold">{normalizedData.global_score}</span>
              <span className="text-muted-foreground mb-1">/100</span>
            </div>
            <Progress 
              value={normalizedData.global_score} 
              className="h-2"
            />
            {normalizedData.risk_description && (
              <p className="text-sm text-muted-foreground">
                {normalizedData.risk_description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blocks (ERGOS specific) */}
      {showBlocks && normalizedData.blocks && Object.keys(normalizedData.blocks).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(normalizedData.blocks).map(([key, block]) => (
            <Card key={key} className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {block.name}
                  <span className="ml-2 text-muted-foreground">
                    (Total: {block.total})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {block.dimensions.map((dim) => (
                    <div key={dim.name} className="flex items-center justify-between py-1">
                      <span className="text-sm">{dim.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{dim.score}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${STATUS_COLORS[dim.status] || ""}`}
                        >
                          {dim.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Radar Chart */}
      {showRadar && chartData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-4 w-4 text-primary" />
              </div>
              Perfil por Dimensão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    tick={{ fontSize: 10 }}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, "Pontuação"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bar Chart */}
      {showBars && chartData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              Pontuação por Dimensão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}%`, "Pontuação"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dimensions List */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhamento por Dimensão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {normalizedData.dimensions && normalizedData.dimensions.length > 0 ? (
              normalizedData.dimensions.map((dim) => (
                <div key={dim.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{dim.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{dim.normalized_score?.toFixed(1) || dim.score}%</span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${STATUS_COLORS[dim.status] || ""}`}
                      >
                        {dim.status}
                      </Badge>
                    </div>
                  </div>
                  <Progress 
                    value={dim.normalized_score || dim.score} 
                    className="h-1.5"
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma dimensão disponível</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
