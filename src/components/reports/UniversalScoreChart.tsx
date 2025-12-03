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

export function UniversalScoreChart({
  data,
  showRadar = true,
  showBars = true,
  showBlocks = false,
  compact = false,
}: UniversalScoreChartProps) {
  const chartData = useMemo(() => {
    if (!data?.dimensions) return [];
    return data.dimensions.map((dim) => ({
      name: dim.name,
      score: dim.normalized_score || dim.score,
      fullMark: 100,
      color: COLOR_MAP[dim.color] || "#6b7280",
    }));
  }, [data]);

  if (!data) {
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
    switch (data.risk_level) {
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
    switch (data.risk_level) {
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
              {data.risk_label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold">{data.global_score}</span>
              <span className="text-muted-foreground mb-1">/100</span>
            </div>
            <Progress 
              value={data.global_score} 
              className="h-2"
            />
            {data.risk_description && (
              <p className="text-sm text-muted-foreground">
                {data.risk_description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blocks (ERGOS specific) */}
      {showBlocks && data.blocks && Object.keys(data.blocks).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(data.blocks).map(([key, block]) => (
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
            {data.dimensions.map((dim) => (
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
