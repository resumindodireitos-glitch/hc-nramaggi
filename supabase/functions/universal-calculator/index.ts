import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  
  // Keys do formato legacy (dimensões diretas como "pressao_tempo", "atencao", etc.)
  const legacyDimensionKeys = [
    'pressao_tempo', 'atencao', 'complexidade', 'monotonia', 'raciocinio',
    'iniciativa', 'isolamento', 'horarios', 'relacionamentos', 'demandas_gerais',
    'demandas', 'controle', 'apoio_chefia', 'apoio_colegas', 'cargo', 'mudancas'
  ];
  
  // Se tem keys legacy com valores numéricos diretos
  for (const key of keys) {
    const lowerKey = key.toLowerCase().replace(/ /g, '_');
    if (legacyDimensionKeys.includes(lowerKey)) {
      const val = answers[key];
      if (typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)) && val.length < 5)) {
        console.log(`Detected LEGACY format - key: ${key}, value: ${val}`);
        return 'legacy';
      }
    }
  }
  
  // Se tem keys no formato "pt_1", "at_1", "d1", etc. com valores de texto = modern
  const modernPatterns = [/^pt_\d+$/, /^at_\d+$/, /^cp_\d+$/, /^mn_\d+$/, /^rc_\d+$/, /^in_\d+$/, /^is_\d+$/, /^ht_\d+$/, /^rl_\d+$/, /^dg_\d+$/, /^d\d+$/, /^c\d+$/, /^ac\d+$/, /^acol\d+$/, /^r\d+$/, /^cg\d+$/, /^m\d+$/];
  for (const key of keys) {
    if (modernPatterns.some(p => p.test(key))) {
      const val = answers[key];
      if (typeof val === 'string' && val.length > 5) {
        console.log(`Detected MODERN format - key: ${key}, value type: string`);
        return 'modern';
      }
    }
  }
  
  // Default: assume modern para novas submissões
  return 'modern';
}

// ERGOS Legacy: Calcula usando valores numéricos diretos por dimensão
function calculateERGOS_Legacy(answers: Record<string, any>, thresholds: RiskThresholds) {
  console.log("=== ERGOS LEGACY (numeric dimensions) ===");
  
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
    
    // Legacy format: valores 0-10
    const normalized = Math.round((numVal / 10) * 100);
    const { status, color } = getDimensionStatus(normalized, thresholds.dimension_thresholds);
    
    dimensions.push({
      name: mapping.name,
      score: numVal,
      normalized_score: normalized,
      status,
      color,
      bloco: mapping.bloco
    });
    
    if (mapping.bloco === 'A') {
      totalA += numVal;
      countA++;
    } else {
      totalB += numVal;
      countB++;
    }
  }
  
  // Fórmula ERGOS: 0.83 × (soma A + soma B)
  const rawScore = 0.83 * (totalA + totalB);
  // Normalizar para 0-100 (máximo teórico: 10 dimensões × 10 pontos × 0.83 = 83)
  const maxTheoretical = 83;
  const normalizedGlobal = Math.min(100, Math.round((rawScore / maxTheoretical) * 100));
  
  const risk = getRiskLevel(normalizedGlobal, thresholds.levels);
  
  console.log(`Legacy calc: totalA=${totalA}, totalB=${totalB}, raw=${rawScore}, normalized=${normalizedGlobal}`);
  
  return {
    global_score: normalizedGlobal,
    risk_level: risk.level,
    risk_label: risk.label,
    risk_color: risk.color,
    risk_description: risk.description,
    dimensions,
    blocos: {
      A: { total: totalA, count: countA, name: "Fatores Cognitivos" },
      B: { total: totalB, count: countB, name: "Fatores Organizacionais" }
    },
    calculation_method: "ergos_legacy",
    calculated_at: new Date().toISOString()
  };
}

// ERGOS Modern: Soma de pesos com coeficiente 0.83 (formato novo com weighted_radio)
function calculateERGOS_Weighted(answers: Record<string, any>, schema: any[], rules: CalculationRules, thresholds: RiskThresholds) {
  console.log("=== ERGOS WEIGHTED (modern format) ===");
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
    const maxPossible = data.count * 4; // Peso máximo por pergunta é 4
    const normalized = maxPossible > 0 ? Math.round((data.total / maxPossible) * 100) : 0;
    const { status, color } = getDimensionStatus(normalized, thresholds.dimension_thresholds);
    dimensions.push({ name, score: data.total, normalized_score: normalized, status, color, bloco: data.bloco });
    if (data.bloco === "A") totalA += data.total; else totalB += data.total;
  }

  const globalScore = Math.round(coefficient * (totalA + totalB));
  const maxTheoretical = 10 * 3 * 4 * coefficient; // 10 dimensões × 3 perguntas × peso 4 × 0.83
  const normalizedGlobal = Math.min(100, Math.round((globalScore / maxTheoretical) * 100));
  const risk = getRiskLevel(normalizedGlobal, thresholds.levels);

  console.log(`Modern calc: totalA=${totalA}, totalB=${totalB}, global=${globalScore}, normalized=${normalizedGlobal}`);

  return { global_score: normalizedGlobal, risk_level: risk.level, risk_label: risk.label, risk_color: risk.color, risk_description: risk.description, dimensions, blocos: { A: { total: totalA, name: "Fatores Cognitivos" }, B: { total: totalB, name: "Fatores Organizacionais" } }, calculation_method: "ergos_weighted", calculated_at: new Date().toISOString() };
}

// HSE-IT Legacy: Calcula usando valores numéricos diretos por dimensão
function calculateHSEIT_Legacy(answers: Record<string, any>, thresholds: RiskThresholds) {
  console.log("=== HSE-IT LEGACY (numeric dimensions) ===");
  
  const dimensionMapping: Record<string, string> = {
    'demandas': 'Demandas',
    'controle': 'Controle',
    'apoio_chefia': 'Apoio Chefia',
    'apoio_colegas': 'Apoio Colegas',
    'relacionamentos': 'Relacionamentos',
    'cargo': 'Cargo',
    'mudancas': 'Mudanças'
  };
  
  const dimensions: any[] = [];
  let totalScore = 0, count = 0;
  
  for (const [key, val] of Object.entries(answers)) {
    const normalizedKey = key.toLowerCase().replace(/ /g, '_');
    const dimName = dimensionMapping[normalizedKey];
    if (!dimName) continue;
    
    const numVal = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(numVal)) continue;
    
    // Legacy HSE-IT: valores já são porcentagens 0-100
    const normalized = Math.round(numVal);
    const { status, color } = getDimensionStatus(normalized, thresholds.dimension_thresholds);
    
    dimensions.push({
      name: dimName,
      score: numVal,
      normalized_score: normalized,
      status,
      color
    });
    
    totalScore += normalized;
    count++;
  }
  
  const globalPercentage = count > 0 ? Math.round(totalScore / count) : 0;
  const risk = getRiskLevel(globalPercentage, thresholds.levels);
  
  console.log(`Legacy HSE-IT: count=${count}, total=${totalScore}, global=${globalPercentage}`);
  
  return {
    global_score: globalPercentage,
    risk_level: risk.level,
    risk_label: risk.label,
    risk_color: risk.color,
    risk_description: risk.description,
    dimensions,
    calculation_method: "hseit_legacy",
    calculated_at: new Date().toISOString()
  };
}

// HSE-IT Modern: Porcentagem de questões estressoras
function calculateHSEIT_Percentage(answers: Record<string, any>, schema: any[], rules: CalculationRules, thresholds: RiskThresholds) {
  console.log("=== HSE-IT PERCENTAGE (modern format) ===");
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

// NASA-TLX: Média simples dos 6 sliders 0-100
function calculateNASATLX(answers: Record<string, any>, schema: any[], thresholds: RiskThresholds) {
  console.log("=== NASA-TLX CALCULATION ===");
  
  const dimensionMapping: Record<string, string> = {
    'mental_demand': 'Demanda Mental',
    'physical_demand': 'Demanda Física',
    'temporal_demand': 'Demanda Temporal',
    'performance': 'Performance',
    'effort': 'Esforço',
    'frustration': 'Frustração'
  };
  
  const dimensions: any[] = [];
  let total = 0, count = 0;
  
  for (const [key, val] of Object.entries(answers)) {
    const dimName = dimensionMapping[key];
    if (!dimName) continue;
    
    const numVal = typeof val === 'number' ? val : (Array.isArray(val) ? val[0] : parseFloat(val));
    if (isNaN(numVal)) continue;
    
    const { status, color } = getDimensionStatus(numVal, thresholds.dimension_thresholds);
    dimensions.push({
      name: dimName,
      score: numVal,
      normalized_score: numVal,
      status,
      color
    });
    
    total += numVal;
    count++;
  }
  
  const globalScore = count > 0 ? Math.round(total / count) : 0;
  const risk = getRiskLevel(globalScore, thresholds.levels);
  
  console.log(`NASA-TLX: count=${count}, total=${total}, global=${globalScore}`);
  
  return {
    global_score: globalScore,
    risk_level: risk.level,
    risk_label: risk.label,
    risk_color: risk.color,
    risk_description: risk.description,
    dimensions,
    calculation_method: "nasa_tlx",
    calculated_at: new Date().toISOString()
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { submissionId, reportId } = await req.json();
    if (!submissionId && !reportId) throw new Error("submissionId ou reportId obrigatório");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let targetId = submissionId;
    if (reportId && !submissionId) {
      const { data: r } = await supabase.from("reports").select("submission_id").eq("id", reportId).single();
      if (r) targetId = r.submission_id;
    }

    const { data: sub, error } = await supabase.from("submissions").select("*, forms(*)").eq("id", targetId).single();
    if (error || !sub) throw new Error("Submission não encontrada");

    const form = (sub as any).forms;
    const answers = sub.answers as Record<string, any>;
    const schema = form.schema as any[];
    const formType = form.type as string;
    const rules: CalculationRules = form.calculation_rules || { method: formType === "ergos" ? "ergos_weighted" : "hseit_percentage" };
    const thresholds: RiskThresholds = form.risk_thresholds || {
      levels: [{ min: 0, max: 30, level: "baixo", label: "Satisfatório", color: "green", description: "Adequado" }, { min: 31, max: 60, level: "medio", label: "Aceitável", color: "yellow", description: "Atenção" }, { min: 61, max: 100, level: "alto", label: "Deve Melhorar", color: "red", description: "Crítico" }],
      dimension_thresholds: { low: { max: 30, status: "Adequado", color: "green" }, medium: { max: 60, status: "Atenção", color: "yellow" }, high: { min: 61, status: "Crítico", color: "red" } }
    };

    // Detectar formato da submissão
    const format = detectSubmissionFormat(answers);
    console.log(`Form type: ${formType}, Submission format: ${format}, Answers keys: ${Object.keys(answers).slice(0, 5).join(', ')}...`);

    let result;
    
    // NASA-TLX tem lógica própria
    if (formType === 'nasa_tlx' || rules.method === 'nasa_tlx') {
      result = calculateNASATLX(answers, schema, thresholds);
    }
    // ERGOS
    else if (rules.method === "ergos_weighted" || formType === "ergos") {
      if (format === 'legacy') {
        result = calculateERGOS_Legacy(answers, thresholds);
      } else {
        result = calculateERGOS_Weighted(answers, schema, rules, thresholds);
      }
    }
    // HSE-IT
    else {
      if (format === 'legacy') {
        result = calculateHSEIT_Legacy(answers, thresholds);
      } else {
        result = calculateHSEIT_Percentage(answers, schema, rules, thresholds);
      }
    }

    if (reportId) {
      await supabase.from("reports").update({ dimensions_score: result, risk_level: result.risk_label, updated_at: new Date().toISOString() }).eq("id", reportId);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
