import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * UNIVERSAL CALCULATOR
 * 
 * This edge function calculates scores from any form type using metadata-driven rules.
 * The calculation rules are stored in the forms.calculation_rules column.
 * 
 * Supported methods:
 * - sum_with_coefficient: ERGOS formula (0.83 × (A + B))
 * - average_by_dimension: HSE-IT formula (average percentage per dimension)
 * - weighted_sum: NASA-TLX formula (weighted average)
 * 
 * Output is ALWAYS normalized to a standard JSON structure:
 * {
 *   global_score: number (0-100),
 *   risk_level: "baixo" | "medio" | "alto",
 *   risk_label: string,
 *   risk_color: string,
 *   dimensions: [{ name, score, status, color }]
 * }
 */

interface CalculationRules {
  method: "sum_with_coefficient" | "average_by_dimension" | "weighted_sum";
  coefficient?: number;
  output_scale?: number;
  blocks?: Record<string, {
    name: string;
    dimensions: Array<{ id: string; name: string; max_score: number }>;
  }>;
  dimensions?: Array<{
    id: string;
    name: string;
    question_ids?: string[];
    weight?: number;
    max_score?: number;
    description?: string;
  }>;
  inverted_dimensions?: string[];
}

interface RiskThresholds {
  levels: Array<{
    max: number;
    label: string;
    risk_level: string;
    color: string;
    description?: string;
  }>;
  dimension_thresholds: Array<{
    max: number;
    status: string;
    color: string;
  }>;
}

interface StandardOutput {
  global_score: number;
  risk_level: string;
  risk_label: string;
  risk_color: string;
  risk_description: string;
  dimensions: Array<{
    name: string;
    score: number;
    normalized_score: number;
    status: string;
    color: string;
  }>;
  blocks?: Record<string, {
    name: string;
    total: number;
    dimensions: Array<{ name: string; score: number; status: string; color: string }>;
  }>;
  form_type: string;
  calculation_method: string;
}

function getDimensionStatus(
  score: number,
  thresholds: RiskThresholds["dimension_thresholds"]
): { status: string; color: string } {
  for (const threshold of thresholds) {
    if (score <= threshold.max) {
      return { status: threshold.status, color: threshold.color };
    }
  }
  return { status: "Crítico", color: "red" };
}

function getRiskLevel(
  score: number,
  thresholds: RiskThresholds["levels"]
): { risk_level: string; risk_label: string; risk_color: string; risk_description: string } {
  for (const threshold of thresholds) {
    if (score <= threshold.max) {
      return {
        risk_level: threshold.risk_level,
        risk_label: threshold.label,
        risk_color: threshold.color,
        risk_description: threshold.description || "",
      };
    }
  }
  return { risk_level: "alto", risk_label: "Crítico", risk_color: "red", risk_description: "" };
}

function calculateERGOS(
  answers: Record<string, any>,
  rules: CalculationRules,
  thresholds: RiskThresholds
): StandardOutput {
  const coefficient = rules.coefficient || 0.83;
  const blocks: StandardOutput["blocks"] = {};
  const allDimensions: StandardOutput["dimensions"] = [];
  let totalBlocoA = 0;
  let totalBlocoB = 0;

  // Process each block
  for (const [blockKey, block] of Object.entries(rules.blocks || {})) {
    const blockDimensions: Array<{ name: string; score: number; status: string; color: string }> = [];
    let blockTotal = 0;

    for (const dim of block.dimensions) {
      const rawValue = parseFloat(answers[dim.id]) || 0;
      const score = Math.min(rawValue, dim.max_score);
      blockTotal += score;

      // Normalize score to percentage for dimension status
      const normalizedScore = (score / dim.max_score) * 100;
      const { status, color } = getDimensionStatus(normalizedScore, thresholds.dimension_thresholds);

      blockDimensions.push({ name: dim.name, score, status, color });
      allDimensions.push({
        name: dim.name,
        score,
        normalized_score: normalizedScore,
        status,
        color,
      });
    }

    blocks[blockKey] = {
      name: block.name,
      total: blockTotal,
      dimensions: blockDimensions,
    };

    if (blockKey === "bloco_a") totalBlocoA = blockTotal;
    if (blockKey === "bloco_b") totalBlocoB = blockTotal;
  }

  // Apply ERGOS formula: 0.83 × (A + B)
  const globalScore = Math.round(coefficient * (totalBlocoA + totalBlocoB));
  const { risk_level, risk_label, risk_color, risk_description } = getRiskLevel(globalScore, thresholds.levels);

  return {
    global_score: globalScore,
    risk_level,
    risk_label,
    risk_color,
    risk_description,
    dimensions: allDimensions,
    blocks,
    form_type: "ergos",
    calculation_method: "sum_with_coefficient",
  };
}

function calculateHSEIT(
  answers: Record<string, any>,
  rules: CalculationRules,
  thresholds: RiskThresholds
): StandardOutput {
  const dimensions: StandardOutput["dimensions"] = [];
  const invertedDimensions = rules.inverted_dimensions || [];
  let totalScore = 0;
  let dimensionCount = 0;

  for (const dim of rules.dimensions || []) {
    // Try to get value directly by dimension ID first
    let rawValue = parseFloat(answers[dim.id]);
    
    // If not found, try to calculate from question_ids
    if (isNaN(rawValue) && dim.question_ids && dim.question_ids.length > 0) {
      let sum = 0;
      let count = 0;
      for (const qId of dim.question_ids) {
        const qValue = parseFloat(answers[qId]);
        if (!isNaN(qValue)) {
          sum += qValue;
          count++;
        }
      }
      rawValue = count > 0 ? sum / count : 0;
    }

    if (isNaN(rawValue)) rawValue = 0;

    // For inverted dimensions (demandas, relacionamentos), high values indicate stress
    // For normal dimensions, low values indicate stress
    // Normalize to: 0% = good, 100% = bad
    let normalizedScore = rawValue;
    if (!invertedDimensions.includes(dim.id)) {
      // Invert the score for non-inverted dimensions
      normalizedScore = 100 - rawValue;
    }

    const { status, color } = getDimensionStatus(normalizedScore, thresholds.dimension_thresholds);

    dimensions.push({
      name: dim.name,
      score: rawValue,
      normalized_score: normalizedScore,
      status,
      color,
    });

    totalScore += normalizedScore;
    dimensionCount++;
  }

  const globalScore = dimensionCount > 0 ? Math.round(totalScore / dimensionCount) : 0;
  const { risk_level, risk_label, risk_color, risk_description } = getRiskLevel(globalScore, thresholds.levels);

  return {
    global_score: globalScore,
    risk_level,
    risk_label,
    risk_color,
    risk_description,
    dimensions,
    form_type: "hse_it",
    calculation_method: "average_by_dimension",
  };
}

function calculateWeightedSum(
  answers: Record<string, any>,
  rules: CalculationRules,
  thresholds: RiskThresholds
): StandardOutput {
  const dimensions: StandardOutput["dimensions"] = [];
  let weightedTotal = 0;
  let totalWeight = 0;

  for (const dim of rules.dimensions || []) {
    const rawValue = parseFloat(answers[dim.id]) || 0;
    const weight = dim.weight || 1;
    const maxScore = dim.max_score || 100;
    
    // Normalize to percentage
    const normalizedScore = (rawValue / maxScore) * 100;
    const { status, color } = getDimensionStatus(normalizedScore, thresholds.dimension_thresholds);

    dimensions.push({
      name: dim.name,
      score: rawValue,
      normalized_score: normalizedScore,
      status,
      color,
    });

    weightedTotal += normalizedScore * weight;
    totalWeight += weight;
  }

  const globalScore = totalWeight > 0 ? Math.round(weightedTotal / totalWeight) : 0;
  const { risk_level, risk_label, risk_color, risk_description } = getRiskLevel(globalScore, thresholds.levels);

  return {
    global_score: globalScore,
    risk_level,
    risk_label,
    risk_color,
    risk_description,
    dimensions,
    form_type: "weighted",
    calculation_method: "weighted_sum",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { submissionId, reportId } = await req.json();

    if (!submissionId && !reportId) {
      return new Response(
        JSON.stringify({ error: "submissionId or reportId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let submissionIdToUse = submissionId;

    // If reportId provided, get submissionId from report
    if (reportId && !submissionId) {
      const { data: report, error: reportError } = await supabase
        .from("reports")
        .select("submission_id")
        .eq("id", reportId)
        .single();

      if (reportError || !report) {
        return new Response(
          JSON.stringify({ error: "Report not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      submissionIdToUse = report.submission_id;
    }

    // Fetch submission with form data
    const { data: submission, error: fetchError } = await supabase
      .from("submissions")
      .select("*, forms(*)")
      .eq("id", submissionIdToUse)
      .single();

    if (fetchError || !submission) {
      return new Response(
        JSON.stringify({ error: "Submission not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const form = submission.forms;
    if (!form) {
      return new Response(
        JSON.stringify({ error: "Form not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing submission:", submissionIdToUse, "Form type:", form.type);

    // Get calculation rules and thresholds from form
    let calculationRules: CalculationRules = form.calculation_rules as CalculationRules;
    let riskThresholds: RiskThresholds = form.risk_thresholds as RiskThresholds;

    // Fallback to defaults if not configured
    if (!calculationRules || Object.keys(calculationRules).length === 0) {
      console.log("Using default calculation rules for", form.type);
      calculationRules = form.type === "ergos" 
        ? { method: "sum_with_coefficient", coefficient: 0.83 }
        : { method: "average_by_dimension" };
    }

    if (!riskThresholds || !riskThresholds.levels) {
      console.log("Using default risk thresholds");
      riskThresholds = {
        levels: [
          { max: 33, label: "Baixo", risk_level: "baixo", color: "green" },
          { max: 66, label: "Médio", risk_level: "medio", color: "yellow" },
          { max: 100, label: "Alto", risk_level: "alto", color: "red" },
        ],
        dimension_thresholds: [
          { max: 33, status: "Adequado", color: "green" },
          { max: 66, status: "Atenção", color: "yellow" },
          { max: 100, status: "Crítico", color: "red" },
        ],
      };
    }

    const answers = submission.answers as Record<string, any>;
    let result: StandardOutput;

    // Apply the appropriate calculation method
    switch (calculationRules.method) {
      case "sum_with_coefficient":
        result = calculateERGOS(answers, calculationRules, riskThresholds);
        break;
      case "average_by_dimension":
        result = calculateHSEIT(answers, calculationRules, riskThresholds);
        break;
      case "weighted_sum":
        result = calculateWeightedSum(answers, calculationRules, riskThresholds);
        break;
      default:
        // Fallback based on form type
        if (form.type === "ergos") {
          result = calculateERGOS(answers, calculationRules, riskThresholds);
        } else {
          result = calculateHSEIT(answers, calculationRules, riskThresholds);
        }
    }

    // Update form_type to match actual form
    result.form_type = form.type;

    console.log("Calculation result:", {
      global_score: result.global_score,
      risk_level: result.risk_level,
      dimensions_count: result.dimensions.length,
    });

    // If reportId provided, update the report with calculated scores
    if (reportId) {
      const { error: updateError } = await supabase
        .from("reports")
        .update({
          dimensions_score: result,
          risk_level: result.risk_label,
        })
        .eq("id", reportId);

      if (updateError) {
        console.error("Error updating report:", updateError);
      } else {
        console.log("Report updated with new scores");
      }
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Universal calculator error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
