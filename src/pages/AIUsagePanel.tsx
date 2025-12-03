import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Brain, 
  TrendingUp, 
  DollarSign, 
  Zap, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface AIUsageData {
  id: string;
  model: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_estimate: number;
  created_at: string;
}

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
}

interface ModelUsage {
  name: string;
  tokens: number;
  cost: number;
  color: string;
}

// Cost per 1M tokens (approximate)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "google/gemini-2.5-flash-lite": { input: 0.02, output: 0.08 },
  "openai/gpt-5": { input: 5.00, output: 15.00 },
  "openai/gpt-5-mini": { input: 0.15, output: 0.60 },
  "openai/gpt-5-nano": { input: 0.05, output: 0.20 },
};

const MODEL_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(192 91% 50%)",
];

export default function AIUsagePanel() {
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<AIUsageData[]>([]);
  const [period, setPeriod] = useState<"7d" | "30d" | "month">("30d");
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [totals, setTotals] = useState({
    totalTokens: 0,
    totalCost: 0,
    avgDailyTokens: 0,
    trend: 0
  });

  useEffect(() => {
    fetchUsageData();
  }, [period]);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "7d":
        return { start: subDays(now, 7), end: now };
      case "30d":
        return { start: subDays(now, 30), end: now };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: subDays(now, 30), end: now };
    }
  };

  const fetchUsageData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      const { data, error } = await supabase
        .from("ai_usage")
        .select("*")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      setUsageData(data || []);
      processData(data || [], start, end);
    } catch (error) {
      console.error("Error fetching AI usage:", error);
      toast.error("Erro ao carregar dados de uso de IA");
    } finally {
      setLoading(false);
    }
  };

  const processData = (data: AIUsageData[], start: Date, end: Date) => {
    // Calculate totals
    const totalTokens = data.reduce((sum, d) => sum + (d.total_tokens || 0), 0);
    const totalCost = data.reduce((sum, d) => sum + (d.cost_estimate || 0), 0);
    
    // Calculate daily usage
    const dailyMap: Record<string, { tokens: number; cost: number }> = {};
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < days; i++) {
      const date = format(subDays(end, days - 1 - i), "dd/MM");
      dailyMap[date] = { tokens: 0, cost: 0 };
    }

    data.forEach(d => {
      const date = format(new Date(d.created_at), "dd/MM");
      if (dailyMap[date]) {
        dailyMap[date].tokens += d.total_tokens || 0;
        dailyMap[date].cost += d.cost_estimate || 0;
      }
    });

    const dailyData = Object.entries(dailyMap).map(([date, vals]) => ({
      date,
      tokens: vals.tokens,
      cost: vals.cost
    }));

    // Calculate trend (compare first half vs second half)
    const midpoint = Math.floor(dailyData.length / 2);
    const firstHalf = dailyData.slice(0, midpoint).reduce((sum, d) => sum + d.tokens, 0);
    const secondHalf = dailyData.slice(midpoint).reduce((sum, d) => sum + d.tokens, 0);
    const trend = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

    // Calculate model usage
    const modelMap: Record<string, { tokens: number; cost: number }> = {};
    data.forEach(d => {
      const model = d.model || "unknown";
      if (!modelMap[model]) {
        modelMap[model] = { tokens: 0, cost: 0 };
      }
      modelMap[model].tokens += d.total_tokens || 0;
      modelMap[model].cost += d.cost_estimate || 0;
    });

    const modelData = Object.entries(modelMap)
      .map(([name, vals], idx) => ({
        name: name.split("/").pop() || name,
        tokens: vals.tokens,
        cost: vals.cost,
        color: MODEL_COLORS[idx % MODEL_COLORS.length]
      }))
      .sort((a, b) => b.tokens - a.tokens);

    setDailyUsage(dailyData);
    setModelUsage(modelData);
    setTotals({
      totalTokens,
      totalCost,
      avgDailyTokens: Math.round(totalTokens / days),
      trend
    });
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4
    }).format(cost);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              Uso de IA
            </h1>
            <p className="text-muted-foreground">
              Monitore o consumo de tokens e custos estimados
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={(v: "7d" | "30d" | "month") => setPeriod(v)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon" onClick={fetchUsageData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Tokens
              </CardTitle>
              <Zap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatTokens(totals.totalTokens)}</div>
                  <p className="text-xs text-muted-foreground">
                    {totals.totalTokens.toLocaleString("pt-BR")} tokens
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/10 via-background to-background border-success/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Custo Estimado
              </CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCost(totals.totalCost)}</div>
                  <p className="text-xs text-muted-foreground">
                    Baseado em preços Lovable AI
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-info/10 via-background to-background border-info/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Média Diária
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatTokens(totals.avgDailyTokens)}</div>
                  <p className="text-xs text-muted-foreground">
                    tokens/dia
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/10 via-background to-background border-warning/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tendência
              </CardTitle>
              {totals.trend >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-destructive" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-success" />
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${totals.trend >= 0 ? "text-destructive" : "text-success"}`}>
                    {totals.trend >= 0 ? "+" : ""}{totals.trend.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    vs. período anterior
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Usage Trend Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolução do Consumo
              </CardTitle>
              <CardDescription>
                Tokens consumidos ao longo do tempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : dailyUsage.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyUsage}>
                      <defs>
                        <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => formatTokens(v)}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [value.toLocaleString("pt-BR"), "Tokens"]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="tokens" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorTokens)"
                        name="Tokens"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado de uso no período
                </div>
              )}
            </CardContent>
          </Card>

          {/* Model Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-info" />
                Uso por Modelo
              </CardTitle>
              <CardDescription>
                Distribuição de tokens por modelo de IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : modelUsage.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={modelUsage}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="tokens"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {modelUsage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [formatTokens(value), "Tokens"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost by Model */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-success" />
                Custo por Modelo
              </CardTitle>
              <CardDescription>
                Custo estimado por modelo de IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[250px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : modelUsage.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={modelUsage} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        type="number"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v.toFixed(4)}`}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={100}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [formatCost(value), "Custo"]}
                      />
                      <Bar 
                        dataKey="cost" 
                        fill="hsl(var(--success))"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Usage Table */}
        <Card>
          <CardHeader>
            <CardTitle>Uso Recente</CardTitle>
            <CardDescription>Últimas requisições de IA</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : usageData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Data</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Modelo</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Input</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Output</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total</th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageData.slice(-10).reverse().map((usage) => (
                      <tr key={usage.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-2">
                          {format(new Date(usage.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {usage.model?.split("/").pop() || "unknown"}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          {(usage.input_tokens || 0).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          {(usage.output_tokens || 0).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-medium">
                          {(usage.total_tokens || 0).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-success">
                          {formatCost(usage.cost_estimate || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro de uso de IA encontrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
