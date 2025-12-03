import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalculationRules {
  method: string;
  coefficient?: number;
  blocks?: Record<string, { name: string; dimensions: string[] }>;
  dimensions?: Record<string, { questions: string[]; is_reverse_scored: boolean }>;
  stressor_threshold?: { direct: number[]; reverse: number[] };
}

interface RiskThresholds {
  levels: Array<{ min: number; max: number; level: string; label: string; color: string; description: string }>;
  dimension_thresholds: { low: { max: number; status: string; color: string }; medium: { max: number; status: string; color: string }; high: { min: number; status: string; color: string } };
}

function getDimensionStatus(score: number, thresholds: RiskThresholds["dimension_thresholds"]): { status: string; color: string } {
  if (score <= thresholds.low.max) return { status: thresholds.low.status, color: thresholds.low.color };
  if (score <= thresholds.medium.max) return { status: thresholds.medium.status, color: thresholds.medium.color };
  return { status: thresholds.high.status, color: thresholds.high.color };
}

function getRiskLevel(score: number, levels: RiskThresholds["levels"]): { level: string; label: string; color: string; description: string } {
  for (const t of levels) {
    if (score >= t.min && score <= t.max) return { level: t.level, label: t.label, color: t.color, description: t.description };
  }
  const last = levels[levels.length - 1];
  return { level: last.level, label: last.label, color: last.color, description: last.description };
}

// Detecta formato da submissão: legacy (antigo) ou modern (novo)
function detectSubmissionFormat(answers: Record<string, any>): 'legacy' | 'modern' {
  const keys = Object.keys(answers);
  
  const legacyDimensionKeys = [
    'pressao_tempo', 'atencao', 'complexidade', 'monotonia', 'raciocinio',
    'iniciativa', 'isolamento', 'horarios', 'relacionamentos', 'demandas_gerais',
    'demandas', 'controle', 'apoio_chefia', 'apoio_colegas', 'cargo', 'mudancas'
  ];
  
  for (const key of keys) {
    const lowerKey = key.toLowerCase().replace(/ /g, '_');
    if (legacyDimensionKeys.includes(lowerKey)) {
      const val = answers[key];
      if (typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)) && val.length < 5)) {
        return 'legacy';
      }
    }
  }
  
  return 'modern';
}

// ERGOS Legacy
function calculateERGOS_Legacy(answers: Record<string, any>, thresholds: RiskThresholds) {
  const dimensionMapping: Record<string, { name: string; bloco: string }> = {
    'pressao_tempo': { name: 'Pressão de Tempo', bloco: 'A' },
    'atencao': { name: 'Atenção', bloco: 'A' },
    'complexidade': { name: 'Complexidade', bloco: 'A' },
    'monotonia': { name: 'Monotonia', bloco: 'A' },
    'raciocinio': { name: 'Raciocínio', bloco: 'A' },
    'iniciativa': { name: 'Iniciativa', bloco: 'B' },
    'isolamento': { name: 'Isolamento', bloco: 'B' },
    'horarios': { name: 'Horários e Turnos', bloco: 'B' },
    'relacionamentos': { name: 'Relacionamentos', bloco: 'B' },
    'demandas_gerais': { name: 'Demandas Gerais', bloco: 'B' }
  };
  
  const dimensions: any[] = [];
  let totalA = 0, totalB = 0, countA = 0, countB = 0;
  
  for (const [key, val] of Object.entries(answers)) {
    const normalizedKey = key.toLowerCase().replace(/ /g, '_');
    const mapping = dimensionMapping[normalizedKey];
    if (!mapping) continue;
    
    const numVal = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(numVal)) continue;
    
    const normalized = Math.round((numVal / 10) * 100);
    const { status, color } = getDimensionStatus(normalized, thresholds.dimension_thresholds);
    
    dimensions.push({ name: mapping.name, score: numVal, normalized_score: normalized, status, color, bloco: mapping.bloco });
    
    if (mapping.bloco === 'A') { totalA += numVal; countA++; }
    else { totalB += numVal; countB++; }
  }
  
  const rawScore = 0.83 * (totalA + totalB);
  const maxTheoretical = 83;
  const normalizedGlobal = Math.min(100, Math.round((rawScore / maxTheoretical) * 100));
  const risk = getRiskLevel(normalizedGlobal, thresholds.levels);
  
  return { global_score: normalizedGlobal, risk_level: risk.level, risk_label: risk.label, risk_color: risk.color, risk_description: risk.description, dimensions, blocos: { A: { total: totalA, count: countA, name: "Fatores Cognitivos" }, B: { total: totalB, count: countB, name: "Fatores Organizacionais" } }, calculation_method: "ergos_legacy", calculated_at: new Date().toISOString() };
}

// ERGOS Modern
function calculateERGOS_Weighted(answers: Record<string, any>, schema: any[], rules: CalculationRules, thresholds: RiskThresholds) {
  const coefficient = rules.coefficient || 0.83;
  const questionMap: Record<string, any> = {};
  schema.forEach((item: any) => { if (item.type === "weighted_radio" && item.id) questionMap[item.id] = item; });

  const dimensionScores: Record<string, { total: number; count: number; bloco: string }> = {};
  const allDimensions = ["Pressão de Tempo", "Atenção", "Complexidade", "Monotonia", "Raciocínio", "Iniciativa", "Isolamento", "Horários e Turnos", "Relacionamentos", "Demandas Gerais"];
  const blocoA = ["Pressão de Tempo", "Atenção", "Complexidade", "Monotonia", "Raciocínio"];
  allDimensions.forEach(dim => { dimensionScores[dim] = { total: 0, count: 0, bloco: blocoA.includes(dim) ? "A" : "B" }; });

  for (const [qId, answer] of Object.entries(answers)) {
    const q = questionMap[qId];
    if (!q || q.type !== "weighted_radio") continue;
    const dimGroup = q.dimension_group;
    if (!dimGroup || !dimensionScores[dimGroup]) continue;
    
    let weight = 0;
    if (q.options && Array.isArray(q.options)) {
      const opt = q.options.find((o: any) => o.text === answer);
      if (opt) weight = opt.weight || 0;
      else if (typeof answer === "number") weight = answer;
    }
    dimensionScores[dimGroup].total += weight;
    dimensionScores[dimGroup].count += 1;
  }

  let totalA = 0, totalB = 0;
  const dimensions: any[] = [];
  for (const [name, data] of Object.entries(dimensionScores)) {
    const maxPossible = data.count * 4;
    const normalized = maxPossible > 0 ? Math.round((data.total / maxPossible) * 100) : 0;
    const { status, color } = getDimensionStatus(normalized, thresholds.dimension_thresholds);
    dimensions.push({ name, score: data.total, normalized_score: normalized, status, color, bloco: data.bloco });
    if (data.bloco === "A") totalA += data.total; else totalB += data.total;
  }

  const globalScore = Math.round(coefficient * (totalA + totalB));
  const maxTheoretical = 10 * 3 * 4 * coefficient;
  const normalizedGlobal = Math.min(100, Math.round((globalScore / maxTheoretical) * 100));
  const risk = getRiskLevel(normalizedGlobal, thresholds.levels);

  return { global_score: normalizedGlobal, risk_level: risk.level, risk_label: risk.label, risk_color: risk.color, risk_description: risk.description, dimensions, blocos: { A: { total: totalA, name: "Fatores Cognitivos" }, B: { total: totalB, name: "Fatores Organizacionais" } }, calculation_method: "ergos_weighted", calculated_at: new Date().toISOString() };
}

// HSE-IT Legacy
function calculateHSEIT_Legacy(answers: Record<string, any>, thresholds: RiskThresholds) {
  const dimensionMapping: Record<string, string> = {
    'demandas': 'Demandas', 'controle': 'Controle', 'apoio_chefia': 'Apoio Chefia',
    'apoio_colegas': 'Apoio Colegas', 'relacionamentos': 'Relacionamentos',
    'cargo': 'Cargo', 'mudancas': 'Mudanças'
  };
  
  const dimensions: any[] = [];
  let totalScore = 0, count = 0;
  
  for (const [key, val] of Object.entries(answers)) {
    const normalizedKey = key.toLowerCase().replace(/ /g, '_');
    const dimName = dimensionMapping[normalizedKey];
    if (!dimName) continue;
    
    const numVal = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(numVal)) continue;
    
    const normalized = Math.round(numVal);
    const { status, color } = getDimensionStatus(normalized, thresholds.dimension_thresholds);
    dimensions.push({ name: dimName, score: numVal, normalized_score: normalized, status, color });
    totalScore += normalized;
    count++;
  }
  
  const globalPercentage = count > 0 ? Math.round(totalScore / count) : 0;
  const risk = getRiskLevel(globalPercentage, thresholds.levels);
  
  return { global_score: globalPercentage, risk_level: risk.level, risk_label: risk.label, risk_color: risk.color, risk_description: risk.description, dimensions, calculation_method: "hseit_legacy", calculated_at: new Date().toISOString() };
}

// HSE-IT Modern
function calculateHSEIT_Percentage(answers: Record<string, any>, schema: any[], rules: CalculationRules, thresholds: RiskThresholds) {
  const dimConfig = rules.dimensions || {
    "Demandas": { questions: ["d1","d2","d3","d4","d5","d6","d7","d8"], is_reverse_scored: false },
    "Relacionamentos": { questions: ["r1","r2","r3","r4"], is_reverse_scored: false },
    "Controle": { questions: ["c1","c2","c3","c4","c5","c6"], is_reverse_scored: true },
    "Apoio Chefia": { questions: ["ac1","ac2","ac3","ac4","ac5"], is_reverse_scored: true },
    "Apoio Colegas": { questions: ["acol1","acol2","acol3","acol4"], is_reverse_scored: true },
    "Cargo": { questions: ["cg1","cg2","cg3","cg4","cg5"], is_reverse_scored: true },
    "Mudanças": { questions: ["m1","m2","m3"], is_reverse_scored: true }
  };
  const stressorThreshold = rules.stressor_threshold || { direct: [4, 5], reverse: [1, 2] };

  const dimensions: any[] = [];
  let totalStressors = 0, totalQuestions = 0;

  for (const [dimName, config] of Object.entries(dimConfig)) {
    let stressorCount = 0, answeredCount = 0;
    for (const qId of config.questions) {
      const val = answers[qId];
      if (val === undefined || val === null) continue;
      const numVal = typeof val === "object" ? val.value : typeof val === "number" ? val : parseInt(val, 10);
      if (isNaN(numVal)) continue;
      answeredCount++;
      const isStressor = config.is_reverse_scored ? stressorThreshold.reverse.includes(numVal) : stressorThreshold.direct.includes(numVal);
      if (isStressor) stressorCount++;
    }
    const percentage = answeredCount > 0 ? Math.round((stressorCount / answeredCount) * 100) : 0;
    const { status, color } = getDimensionStatus(percentage, thresholds.dimension_thresholds);
    dimensions.push({ name: dimName, score: stressorCount, normalized_score: percentage, status, color });
    totalStressors += stressorCount;
    totalQuestions += answeredCount;
  }

  const globalPercentage = totalQuestions > 0 ? Math.round((totalStressors / totalQuestions) * 100) : 0;
  const risk = getRiskLevel(globalPercentage, thresholds.levels);
  return { global_score: globalPercentage, risk_level: risk.level, risk_label: risk.label, risk_color: risk.color, risk_description: risk.description, dimensions, calculation_method: "hseit_percentage", calculated_at: new Date().toISOString() };
}

// NASA-TLX
function calculateNASATLX(answers: Record<string, any>, thresholds: RiskThresholds) {
  const dimensionMapping: Record<string, string> = {
    'mental_demand': 'Demanda Mental', 'physical_demand': 'Demanda Física',
    'temporal_demand': 'Demanda Temporal', 'performance': 'Performance',
    'effort': 'Esforço', 'frustration': 'Frustração'
  };
  
  const dimensions: any[] = [];
  let total = 0, count = 0;
  
  for (const [key, val] of Object.entries(answers)) {
    const dimName = dimensionMapping[key];
    if (!dimName) continue;
    
    const numVal = typeof val === 'number' ? val : (Array.isArray(val) ? val[0] : parseFloat(val));
    if (isNaN(numVal)) continue;
    
    const { status, color } = getDimensionStatus(numVal, thresholds.dimension_thresholds);
    dimensions.push({ name: dimName, score: numVal, normalized_score: numVal, status, color });
    total += numVal;
    count++;
  }
  
  const globalScore = count > 0 ? Math.round(total / count) : 0;
  const risk = getRiskLevel(globalScore, thresholds.levels);
  
  return { global_score: globalScore, risk_level: risk.level, risk_label: risk.label, risk_color: risk.color, risk_description: risk.description, dimensions, calculation_method: "nasa_tlx", calculated_at: new Date().toISOString() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting batch recalculation with legacy/modern format detection...");

    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select(`
        id,
        submission_id,
        submissions!inner (
          id,
          answers,
          form_id,
          forms!inner (
            id,
            type,
            schema,
            calculation_rules,
            risk_thresholds
          )
        )
      `);

    if (reportsError) throw new Error(`Failed to fetch reports: ${reportsError.message}`);

    console.log(`Found ${reports?.length || 0} reports to recalculate`);

    const results = { total: reports?.length || 0, success: 0, failed: 0, errors: [] as string[], details: [] as any[] };

    for (const report of reports || []) {
      try {
        const submission = report.submissions as any;
        const form = submission.forms as any;
        const answers = submission.answers as Record<string, any>;
        const schema = form.schema as any[];
        const formType = form.type as string;
        
        const rules: CalculationRules = form.calculation_rules || { method: formType === "ergos" ? "ergos_weighted" : "hseit_percentage" };
        const thresholds: RiskThresholds = form.risk_thresholds || {
          levels: [{ min: 0, max: 30, level: "baixo", label: "Satisfatório", color: "green", description: "Adequado" }, { min: 31, max: 60, level: "medio", label: "Aceitável", color: "yellow", description: "Atenção" }, { min: 61, max: 100, level: "alto", label: "Deve Melhorar", color: "red", description: "Crítico" }],
          dimension_thresholds: { low: { max: 30, status: "Adequado", color: "green" }, medium: { max: 60, status: "Atenção", color: "yellow" }, high: { min: 61, status: "Crítico", color: "red" } }
        };

        // Detectar formato
        const format = detectSubmissionFormat(answers);
        console.log(`Report ${report.id}: formType=${formType}, format=${format}`);

        let result;
        
        if (formType === 'nasa_tlx' || rules.method === 'nasa_tlx') {
          result = calculateNASATLX(answers, thresholds);
        } else if (rules.method === "ergos_weighted" || formType === "ergos") {
          result = format === 'legacy' ? calculateERGOS_Legacy(answers, thresholds) : calculateERGOS_Weighted(answers, schema, rules, thresholds);
        } else {
          result = format === 'legacy' ? calculateHSEIT_Legacy(answers, thresholds) : calculateHSEIT_Percentage(answers, schema, rules, thresholds);
        }

        const { error: updateError } = await supabase
          .from('reports')
          .update({ dimensions_score: result, risk_level: result.risk_label, updated_at: new Date().toISOString() })
          .eq('id', report.id);

        if (updateError) throw new Error(`Update failed: ${updateError.message}`);
        results.success++;
        results.details.push({ id: report.id, format, method: result.calculation_method, global_score: result.global_score, risk: result.risk_label });
        console.log(`Report ${report.id}: score=${result.global_score}, risk=${result.risk_label}, method=${result.calculation_method}`);
      } catch (err) {
        results.failed++;
        results.errors.push(`Report ${report.id}: ${err instanceof Error ? err.message : 'Error'}`);
        console.error(`Error on report ${report.id}:`, err);
      }
    }

    console.log(`Complete: ${results.success} success, ${results.failed} failed`);

    return new Response(JSON.stringify({ success: true, message: `Recalculated ${results.success}/${results.total}`, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Batch error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
