import { Badge } from "@/components/ui/badge";

interface DimensionScore {
  name: string;
  score: number;
  normalized_score?: number;
  status: string;
  color: string;
}

interface DimensionScoreChartProps {
  dimensions: DimensionScore[];
  title?: string;
  showPercentage?: boolean;
}

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'Adequado': 'Adequado',
    'Atenção': 'Atenção', 
    'Crítico': 'Crítico',
    'green': 'Adequado',
    'yellow': 'Atenção',
    'red': 'Crítico',
    'Satisfatório': 'Adequado',
    'Aceitável': 'Atenção',
    'Deve Melhorar': 'Crítico',
  };
  return labels[status] || status;
};

const getBarColor = (color: string, status?: string): string => {
  // Determine color based on color field or status
  if (color === 'green' || status === 'Adequado' || status === 'Satisfatório') {
    return 'bg-emerald-500';
  }
  if (color === 'yellow' || status === 'Atenção' || status === 'Aceitável') {
    return 'bg-amber-400';
  }
  if (color === 'red' || status === 'Crítico' || status === 'Deve Melhorar') {
    return 'bg-red-500';
  }
  return 'bg-slate-400';
};

const getBadgeStyle = (color: string, status?: string): string => {
  if (color === 'green' || status === 'Adequado' || status === 'Satisfatório') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-300';
  }
  if (color === 'yellow' || status === 'Atenção' || status === 'Aceitável') {
    return 'bg-amber-100 text-amber-700 border-amber-300';
  }
  if (color === 'red' || status === 'Crítico' || status === 'Deve Melhorar') {
    return 'bg-red-100 text-red-700 border-red-300';
  }
  return 'bg-slate-100 text-slate-700 border-slate-300';
};

const formatDimensionName = (name: string): string => {
  const names: Record<string, string> = {
    'pressao_tempo': 'Pressão de Tempo',
    'atencao': 'Atenção',
    'complexidade': 'Complexidade',
    'monotonia': 'Monotonia',
    'raciocinio': 'Raciocínio',
    'iniciativa': 'Iniciativa',
    'isolamento': 'Isolamento',
    'horarios_turnos': 'Horários/Turnos',
    'relacionamentos': 'Relacionamentos',
    'demandas_gerais': 'Demandas Gerais',
    'demandas': 'Demandas',
    'controle': 'Controle',
    'suporte_chefia': 'Apoio Gerencial',
    'suporte_colegas': 'Apoio Colegas',
    'cargo': 'Papel/Cargo',
    'comunicacao_mudancas': 'Mudanças',
  };
  return names[name] || name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
};

export function DimensionScoreChart({ dimensions, title = "Detalhamento por Dimensão", showPercentage = true }: DimensionScoreChartProps) {
  return (
    <div className="space-y-4">
      {title && (
        <h3 className="font-semibold text-foreground">{title}</h3>
      )}
      <div className="space-y-3">
        {dimensions.map((dim, idx) => {
          const scoreValue = dim.normalized_score ?? dim.score;
          const displayValue = showPercentage ? `${scoreValue.toFixed(1)}%` : scoreValue.toFixed(0);
          const barWidth = Math.min(100, Math.max(0, scoreValue));
          
          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {formatDimensionName(dim.name)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {displayValue}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs px-2 py-0.5 border ${getBadgeStyle(dim.color, dim.status)}`}
                  >
                    {getStatusLabel(dim.status)}
                  </Badge>
                </div>
              </div>
              <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getBarColor(dim.color, dim.status)}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GlobalScoreDisplay({ 
  score, 
  label, 
  color,
  description 
}: { 
  score: number; 
  label: string; 
  color: string;
  description?: string;
}) {
  const getBadgeColor = () => {
    if (color === 'green' || label === 'Satisfatório') return 'bg-emerald-100 text-emerald-700 border-emerald-400';
    if (color === 'yellow' || label === 'Aceitável') return 'bg-amber-100 text-amber-700 border-amber-400';
    if (color === 'red' || label === 'Deve Melhorar') return 'bg-red-100 text-red-700 border-red-400';
    return 'bg-slate-100 text-slate-700 border-slate-400';
  };

  const getScoreColor = () => {
    if (color === 'green' || label === 'Satisfatório') return 'text-emerald-600';
    if (color === 'yellow' || label === 'Aceitável') return 'text-amber-600';
    if (color === 'red' || label === 'Deve Melhorar') return 'text-red-600';
    return 'text-slate-600';
  };

  return (
    <div className="flex items-start justify-between p-4 rounded-xl bg-card border">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium text-muted-foreground">Pontuação Global</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-4xl font-bold ${getScoreColor()}`}>{score}</span>
          <span className="text-lg text-muted-foreground">/100</span>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground max-w-[200px]">{description}</p>
        )}
      </div>
      <Badge className={`${getBadgeColor()} px-3 py-1 text-sm font-medium border`}>
        {label === 'Deve Melhorar' ? '↗ Deve Melhorar' : label === 'Aceitável' ? '↗ Aceitável' : '✓ Satisfatório'}
      </Badge>
    </div>
  );
}

export default DimensionScoreChart;
