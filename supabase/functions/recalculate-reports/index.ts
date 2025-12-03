import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalculationRules {
  method: string;
  coefficient?: number;
  output_scale?: number;
  blocks?: Record<string, { name: string; dimensions: Array<{ id: string; name: string; max_score?: number }> }>;
  dimensions?: Array<{ id: string; name: string; question_ids?: string[]; weight?: number }>;
  inverted_dimensions?: string[];
}

interface RiskThresholds {
  levels: Array<{ max: number; label: string; color: string; risk_level: string; description: string }>;
  dimension_thresholds: Array<{ max: number; status: string; color: string }>;
}

interface StandardOutput {
  global_score: number;
  risk_level: string;
  risk_label: string;
  risk_color: string;
  risk_description: string;
  calculation_method: string;
  form_type: string;
  dimensions: Array<{
    name: string;
    score: number;
    normalized_score: number;
    status: string;
    color: string;
  }>;
  blocks?: Record<string, { name: string; total: number; dimensions: Array<any> }>;
}

function getDimensionStatus(score: number, thresholds: RiskThresholds["dimension_thresholds"]) {
  for (const t of thresholds) {
    if (score <= t.max) return { status: t.status, color: t.color };
  }
  return { status: "Crítico", color: "red" };
}

function getRiskLevel(score: number, thresholds: RiskThresholds["levels"]) {
  for (const t of thresholds) {
    if (score <= t.max) return { 
      risk_level: t.risk_level, 
      label: t.label, 
      color: t.color, 
      description: t.description 
    };
  }
  const last = thresholds[thresholds.length - 1];
  return { risk_level: last.risk_level, label: last.label, color: last.color, description: last.description };
}

function calculateERGOS(answers: Record<string, any>, rules: CalculationRules, thresholds: RiskThresholds): StandardOutput {
  const coefficient = rules.coefficient || 0.83;
  const blocks = rules.blocks || {};
  
  const blocksOutput: Record<string, { name: string; total: number; dimensions: any[] }> = {};
  const allDimensions: any[] = [];
  let totalBlocoA = 0;
  let totalBlocoB = 0;

  for (const [blockId, block] of Object.entries(blocks)) {
    let blockTotal = 0;
    const blockDims: any[] = [];
    
    for (const dim of block.dimensions) {
      const score = Number(answers[dim.id]) || 0;
      const maxScore = dim.max_score || 10;
      const { status, color } = getDimensionStatus(score, thresholds.dimension_thresholds);
      
      blockDims.push({
        name: dim.name,
        score,
        status,
        color
      });
      
      allDimensions.push({
        name: dim.name,
        score,
        normalized_score: Math.round((score / maxScore) * 100),
        status,
        color
      });
      
      blockTotal += score;
    }
    
    blocksOutput[blockId] = { name: block.name, total: blockTotal, dimensions: blockDims };
    
    if (blockId.includes('a') || blockId === 'bloco_a') totalBlocoA = blockTotal;
    else totalBlocoB = blockTotal;
  }

  const globalScore = Math.round(coefficient * (totalBlocoA + totalBlocoB));
  const risk = getRiskLevel(globalScore, thresholds.levels);

  return {
    global_score: globalScore,
    risk_level: risk.risk_level,
    risk_label: risk.label,
    risk_color: risk.color,
    risk_description: risk.description,
    calculation_method: "sum_with_coefficient",
    form_type: "ergos",
    dimensions: allDimensions,
    blocks: blocksOutput
  };
}

function calculateHSEIT(answers: Record<string, any>, rules: CalculationRules, thresholds: RiskThresholds): StandardOutput {
  const dimensions = rules.dimensions || [];
  const invertedDims = rules.inverted_dimensions || [];
  const outputScale = rules.output_scale || 100;
  
  const allDimensions: any[] = [];
  let totalScore = 0;
  let dimCount = 0;

  for (const dim of dimensions) {
    const questionIds = dim.question_ids || [];
    let dimTotal = 0;
    let qCount = 0;
    
    for (const qId of questionIds) {
      const val = Number(answers[qId]) || 0;
      dimTotal += val;
      qCount++;
    }
    
    let avgScore = qCount > 0 ? (dimTotal / qCount) : 0;
    
    if (invertedDims.includes(dim.id)) {
      avgScore = outputScale - avgScore;
    }
    
    const normalizedScore = Math.round(avgScore);
    const { status, color } = getDimensionStatus(normalizedScore, thresholds.dimension_thresholds);
    
    allDimensions.push({
      name: dim.name,
      score: normalizedScore,
      normalized_score: normalizedScore,
      status,
      color
    });
    
    totalScore += normalizedScore;
    dimCount++;
  }

  const globalScore = dimCount > 0 ? Math.round(totalScore / dimCount) : 0;
  const risk = getRiskLevel(globalScore, thresholds.levels);

  return {
    global_score: globalScore,
    risk_level: risk.risk_level,
    risk_label: risk.label,
    risk_color: risk.color,
    risk_description: risk.description,
    calculation_method: "average_by_dimension",
    form_type: "hse_it",
    dimensions: allDimensions
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting batch recalculation of all reports...");

    // Fetch all reports with submissions and forms
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
            calculation_rules,
            risk_thresholds
          )
        )
      `);

    if (reportsError) {
      throw new Error(`Failed to fetch reports: ${reportsError.message}`);
    }

    console.log(`Found ${reports?.length || 0} reports to recalculate`);

    const results = {
      total: reports?.length || 0,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const report of reports || []) {
      try {
        const submission = report.submissions as any;
        const form = submission.forms as any;
        const answers = submission.answers as Record<string, any>;
        
        const calculationRules = (form.calculation_rules || {}) as CalculationRules;
        const riskThresholds = (form.risk_thresholds || {
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
        }) as RiskThresholds;

        let result: StandardOutput;

        if (calculationRules.method === "sum_with_coefficient" || form.type === "ergos") {
          result = calculateERGOS(answers, calculationRules, riskThresholds);
        } else if (calculationRules.method === "average_by_dimension" || form.type === "hse_it") {
          result = calculateHSEIT(answers, calculationRules, riskThresholds);
        } else {
          result = calculateERGOS(answers, calculationRules, riskThresholds);
        }

        // Update report with new calculated scores
        const { error: updateError } = await supabase
          .from('reports')
          .update({
            dimensions_score: result,
            risk_level: result.risk_label
          })
          .eq('id', report.id);

        if (updateError) {
          throw new Error(`Failed to update report ${report.id}: ${updateError.message}`);
        }

        results.success++;
        console.log(`Successfully recalculated report ${report.id}: global_score=${result.global_score}, risk=${result.risk_label}`);

      } catch (err) {
        results.failed++;
        const errorMsg = `Report ${report.id}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log(`Batch recalculation complete: ${results.success} success, ${results.failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: `Recalculated ${results.success} of ${results.total} reports`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Batch recalculation error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
