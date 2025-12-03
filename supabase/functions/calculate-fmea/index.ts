import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DimensionScore {
  score: number;
  risk_color?: string;
}

interface FMEAResult {
  gravidade: number;
  probabilidade: number;
  capacidade_deteccao: number;
  nre_score: number;
  nre_classification: string;
  dimension_scores: Record<string, DimensionScore>;
  risks_detected: Array<{
    dimension: string;
    risk: string;
    action: string;
    priority: string;
    nr_referencia: string[];
  }>;
  requires_manual_review: boolean;
  review_reason?: string;
}

function getNREClassification(nre: number): string {
  if (nre <= 50) return "Trivial";
  if (nre <= 100) return "Tolerável";
  if (nre <= 200) return "Moderado";
  if (nre <= 400) return "Substancial";
  return "Intolerável";
}

function getPriorityFromNRE(nre: number): string {
  if (nre <= 50) return "baixa";
  if (nre <= 100) return "media";
  if (nre <= 200) return "alta";
  return "critica";
}

function calculateProbabilityFromScore(score: number): number {
  // Score 0-100 mapped to probability 1-5
  if (score >= 80) return 1; // Low risk = low probability
  if (score >= 60) return 2;
  if (score >= 40) return 3;
  if (score >= 20) return 4;
  return 5; // High risk = high probability
}

function calculateGravityFromScores(scores: Record<string, number>, formType: string): number {
  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
  
  // Lower scores = higher gravity (more severe)
  if (avgScore >= 80) return 1;
  if (avgScore >= 60) return 2;
  if (avgScore >= 40) return 3;
  if (avgScore >= 20) return 4;
  return 5;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { submissionId, reportId } = await req.json();

    if (!submissionId && !reportId) {
      throw new Error("submissionId or reportId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch submission and report data
    let submission, report, form;
    
    if (reportId) {
      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .select("*, submissions(*, forms(*))")
        .eq("id", reportId)
        .single();
      
      if (reportError) throw reportError;
      report = reportData;
      submission = reportData.submissions;
      form = reportData.submissions?.forms;
    } else {
      const { data: submissionData, error: subError } = await supabase
        .from("submissions")
        .select("*, forms(*), reports(*)")
        .eq("id", submissionId)
        .single();
      
      if (subError) throw subError;
      submission = submissionData;
      form = submissionData.forms;
      report = submissionData.reports;
    }

    if (!submission || !form) {
      throw new Error("Submission or form not found");
    }

    const formType = form.type; // 'ergos' or 'hse_it'
    const answers = submission.answers as Record<string, number>;
    const dimensionScores = report?.dimensions_score as Record<string, DimensionScore> || {};

    // Extract numeric scores
    const numericScores: Record<string, number> = {};
    for (const [key, value] of Object.entries(dimensionScores)) {
      numericScores[key] = typeof value === 'object' && value.score !== undefined 
        ? value.score 
        : (typeof value === 'number' ? value : 0);
    }

    // Calculate FMEA components
    const gravidade = calculateGravityFromScores(numericScores, formType);
    const probabilidade = calculateProbabilityFromScore(
      Object.values(numericScores).reduce((a, b) => a + b, 0) / Math.max(Object.values(numericScores).length, 1)
    );
    const capacidade_deteccao = 1; // Default: good detection capability

    const nre_score = gravidade * probabilidade * capacidade_deteccao;
    const nre_classification = getNREClassification(nre_score);

    // Fetch risks from matrix based on low-scoring dimensions
    const risksDetected: FMEAResult["risks_detected"] = [];
    const matrixTable = formType === "ergos" ? "risk_matrix_ergos" : "risk_matrix_hseit";

    for (const [dimension, score] of Object.entries(numericScores)) {
      if (score < 60) { // Flag dimensions with score < 60%
        const { data: matrixData } = await supabase
          .from(matrixTable)
          .select("*")
          .ilike("dimension", `%${dimension}%`)
          .eq("is_active", true)
          .limit(3);

        if (matrixData && matrixData.length > 0) {
          for (const risk of matrixData) {
            risksDetected.push({
              dimension: risk.dimension,
              risk: risk.perigo,
              action: risk.medida_controle_sugerida || "Avaliação necessária",
              priority: getPriorityFromNRE(nre_score),
              nr_referencia: risk.nr_referencia || [],
            });
          }
        }
      }
    }

    // Check for inconsistencies (requires manual review)
    let requires_manual_review = false;
    let review_reason = "";

    // Example: Check for contradictory scores
    const scoreValues = Object.values(numericScores);
    const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
    const variance = scoreValues.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scoreValues.length;
    
    if (variance > 400) { // High variance in scores
      requires_manual_review = true;
      review_reason = "Alta variância nas respostas entre dimensões. Possível inconsistência ou situação atípica.";
    }

    // Extreme contradiction check
    const hasHighScore = scoreValues.some(s => s > 80);
    const hasLowScore = scoreValues.some(s => s < 20);
    if (hasHighScore && hasLowScore) {
      requires_manual_review = true;
      review_reason = "Respostas extremas detectadas: algumas dimensões muito positivas e outras muito negativas. Revisar manualmente.";
    }

    const fmeaResult: FMEAResult = {
      gravidade,
      probabilidade,
      capacidade_deteccao,
      nre_score,
      nre_classification,
      dimension_scores: dimensionScores,
      risks_detected: risksDetected,
      requires_manual_review,
      review_reason,
    };

    // Store FMEA calculation
    if (report?.id) {
      const { error: fmeaError } = await supabase
        .from("fmea_calculations")
        .upsert({
          report_id: report.id,
          gravidade,
          probabilidade,
          capacidade_deteccao,
          nre_classification,
          dimension_scores: dimensionScores,
          requires_manual_review,
          review_reason,
        }, { onConflict: "report_id" });

      if (fmeaError) {
        console.error("Error storing FMEA:", fmeaError);
      }

      // Create suggested actions
      for (const risk of risksDetected) {
        await supabase.from("suggested_actions").insert({
          report_id: report.id,
          risk_detected: risk.risk,
          dimension: risk.dimension,
          action_title: risk.action,
          priority: risk.priority,
          nre_score,
          nre_classification,
          nr_referencia: risk.nr_referencia,
          source_matrix: matrixTable,
        });
      }

      // Update report with FMEA-based risk level
      await supabase
        .from("reports")
        .update({ risk_level: nre_classification.toLowerCase() })
        .eq("id", report.id);
    }

    console.log("FMEA calculation completed:", fmeaResult);

    return new Response(JSON.stringify(fmeaResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("FMEA calculation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
