import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DimensionScore {
  score: number;
  normalized_score?: number;
  status?: string;
  color?: string;
}

interface FMEAResult {
  gravidade: number;
  probabilidade: number;
  capacidade_deteccao: number;
  nre_score: number;
  nre_classification: string;
  dimension_scores: Record<string, number>;
  risks_detected: Array<{
    dimension: string;
    risk: string;
    action: string;
    priority: string;
    nr_referencia: string[];
    source: string;
  }>;
  cross_validation?: {
    has_convergence: boolean;
    convergence_text?: string;
    divergence_text?: string;
    methodologies_compared: string[];
  };
  requires_manual_review: boolean;
  review_reason?: string;
}

// NRE Classification thresholds (Tanguro standard)
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

// HSE-IT dimension thresholds for auto-FMEA feeding
const HSE_FMEA_THRESHOLDS = {
  demandas: {
    critical: 80, // >80% stressors = insert risk
    moderate: 60,
    risk: "Sobrecarga Quantitativa de Trabalho",
    source: "Processo de Trabalho",
    gravity: 4,
    action: "Redistribuição de tarefas e revisão de metas de produção",
    nr: ["NR-17", "ISO 10075-1"]
  },
  relacionamentos: {
    critical: 70,
    moderate: 50,
    risk: "Conflitos Interpessoais no Ambiente de Trabalho",
    source: "Clima Organizacional",
    gravity: 3,
    action: "Programa de mediação de conflitos e comunicação não-violenta",
    nr: ["NR-01", "ISO 45003"]
  },
  controle: {
    critical: 60, // <60% = low control (inverted)
    moderate: 40,
    risk: "Baixa Autonomia e Controle sobre o Trabalho",
    source: "Organização do Trabalho",
    gravity: 3,
    action: "Implementar participação dos trabalhadores nas decisões operacionais",
    nr: ["NR-17", "ISO 45003"]
  },
  apoio_chefia: {
    critical: 50,
    moderate: 35,
    risk: "Isolamento Vertical - Falta de Suporte Gerencial",
    source: "Gestão de Pessoas",
    gravity: 3,
    action: "Programa de feedback estruturado e reuniões 1:1 periódicas",
    nr: ["NR-01", "ISO 45003"]
  },
  apoio_colegas: {
    critical: 50,
    moderate: 35,
    risk: "Isolamento Horizontal - Falta de Suporte de Pares",
    source: "Cultura Organizacional",
    gravity: 2,
    action: "Incentivar trabalho em equipe e mentorias entre pares",
    nr: ["NR-01", "ISO 45003"]
  },
  cargo: {
    critical: 60,
    moderate: 40,
    risk: "Ambiguidade de Papel e Falta de Clareza nas Funções",
    source: "Definição de Cargos",
    gravity: 3,
    action: "Revisar descrição de cargos e comunicar expectativas claramente",
    nr: ["NR-17", "ISO 45003"]
  },
  comunicacao_mudancas: {
    critical: 60,
    moderate: 40,
    risk: "Resistência a Mudanças por Falta de Comunicação",
    source: "Gestão de Mudanças",
    gravity: 2,
    action: "Implementar comunicação prévia e treinamento para mudanças organizacionais",
    nr: ["NR-01", "ISO 45003"]
  }
};

// ERGOS dimension mapping for FMEA
const ERGOS_FMEA_THRESHOLDS = {
  pressao_tempo: {
    critical: 70,
    risk: "Pressão Temporal Excessiva",
    source: "Ritmo de Trabalho",
    gravity: 4,
    action: "Revisão de prazos e implementação de pausas psicossociais",
    nr: ["NR-17", "ISO 10075-1"]
  },
  atencao: {
    critical: 70,
    risk: "Demanda Atencional Elevada",
    source: "Natureza da Tarefa",
    gravity: 3,
    action: "Rodízio de tarefas e intervalos de descanso cognitivo",
    nr: ["NR-17", "ISO 10075-1"]
  },
  complexidade: {
    critical: 70,
    risk: "Alta Complexidade Cognitiva",
    source: "Processo de Trabalho",
    gravity: 3,
    action: "Simplificação de procedimentos e suporte técnico adequado",
    nr: ["NR-17", "ISO 10075-1"]
  },
  monotonia: {
    critical: 70,
    risk: "Monotonia e Repetitividade",
    source: "Organização do Trabalho",
    gravity: 3,
    action: "Enriquecimento de cargo e variação de tarefas",
    nr: ["NR-17", "ISO 10075-1"]
  },
  raciocinio: {
    critical: 70,
    risk: "Sobrecarga de Raciocínio e Tomada de Decisão",
    source: "Demanda Cognitiva",
    gravity: 4,
    action: "Sistemas de apoio à decisão e padronização de processos",
    nr: ["NR-17", "ISO 10075-1"]
  },
  iniciativa: {
    critical: 70,
    risk: "Baixa Iniciativa e Autonomia Requerida",
    source: "Microgestão",
    gravity: 2,
    action: "Delegar responsabilidades e promover autonomia",
    nr: ["NR-17", "ISO 45003"]
  },
  isolamento: {
    critical: 70,
    risk: "Isolamento Social no Trabalho",
    source: "Ambiente de Trabalho",
    gravity: 3,
    action: "Promover interações sociais e trabalho colaborativo",
    nr: ["NR-01", "ISO 45003"]
  },
  horarios_turnos: {
    critical: 70,
    risk: "Impacto de Horários e Turnos Alternados",
    source: "Jornada de Trabalho",
    gravity: 4,
    action: "Programa de gestão de fadiga e revisão de escalas",
    nr: ["NR-17", "NR-01"]
  },
  relacionamentos: {
    critical: 70,
    risk: "Conflitos nas Relações de Trabalho",
    source: "Clima Organizacional",
    gravity: 3,
    action: "Treinamento em comunicação e gestão de conflitos",
    nr: ["NR-01", "ISO 45003"]
  },
  demandas_gerais: {
    critical: 70,
    risk: "Sobrecarga Geral de Demandas",
    source: "Carga de Trabalho",
    gravity: 4,
    action: "Revisão da distribuição de tarefas e contratações",
    nr: ["NR-17", "ISO 10075-1"]
  }
};

function calculateProbabilityFromScore(score: number): number {
  if (score <= 30) return 1; // Low risk = low probability
  if (score <= 50) return 2;
  if (score <= 70) return 3;
  if (score <= 85) return 4;
  return 5;
}

function calculateGravityFromScores(scores: number[], formType: string): number {
  if (scores.length === 0) return 1;
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  if (avgScore <= 30) return 1;
  if (avgScore <= 50) return 2;
  if (avgScore <= 70) return 3;
  if (avgScore <= 85) return 4;
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
    let submission: any, report: any, form: any;
    
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

    const formType = form.type as "ergos" | "hse_it";
    const dimensionsScore = report?.dimensions_score || {};
    
    // Extract dimension scores from the new format
    const normalizedScores: Record<string, number> = {};
    
    // Handle new calculation format with dimensions array
    if (dimensionsScore.dimensions && Array.isArray(dimensionsScore.dimensions)) {
      for (const dim of dimensionsScore.dimensions) {
        const key = dim.name?.toLowerCase().replace(/\s+/g, '_').replace(/[áàã]/g, 'a').replace(/[éê]/g, 'e').replace(/[íî]/g, 'i').replace(/[óôõ]/g, 'o').replace(/[úû]/g, 'u') || '';
        normalizedScores[key] = dim.normalized_score ?? dim.score ?? 0;
      }
    } else {
      // Fallback for old format
      for (const [key, value] of Object.entries(dimensionsScore)) {
        if (typeof value === 'object' && value !== null) {
          normalizedScores[key] = (value as any).normalized_score ?? (value as any).score ?? 0;
        } else if (typeof value === 'number') {
          normalizedScores[key] = value;
        }
      }
    }

    console.log("Normalized scores:", normalizedScores);

    // Auto-feed FMEA from dimension scores
    const risksDetected: FMEAResult["risks_detected"] = [];
    const thresholds = formType === "hse_it" ? HSE_FMEA_THRESHOLDS : ERGOS_FMEA_THRESHOLDS;
    
    for (const [dimensionKey, config] of Object.entries(thresholds)) {
      // Find matching dimension score
      const matchingKey = Object.keys(normalizedScores).find(k => 
        k.includes(dimensionKey) || dimensionKey.includes(k)
      );
      
      const score = matchingKey ? normalizedScores[matchingKey] : null;
      
      if (score !== null && score >= config.critical) {
        console.log(`Risk detected for ${dimensionKey}: score ${score} >= ${config.critical}`);
        risksDetected.push({
          dimension: dimensionKey,
          risk: config.risk,
          action: config.action,
          priority: getPriorityFromNRE(config.gravity * 3 * 1), // G × P × D estimate
          nr_referencia: config.nr,
          source: config.source
        });
      }
    }

    // Calculate FMEA scores
    const scoreValues = Object.values(normalizedScores).filter(v => !isNaN(v));
    const avgScore = scoreValues.length > 0 
      ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length 
      : 0;
    
    const gravidade = calculateGravityFromScores(scoreValues, formType);
    const probabilidade = calculateProbabilityFromScore(avgScore);
    const capacidade_deteccao = 1; // Default good detection

    const nre_score = gravidade * probabilidade * capacidade_deteccao;
    const nre_classification = getNREClassification(nre_score);

    // Check for cross-validation (ERGOS + NASA-TLX convergence)
    let crossValidation: FMEAResult["cross_validation"] = undefined;
    
    // Check if there's a NASA-TLX submission for the same respondent
    if (submission.respondent_hash) {
      const { data: relatedSubmissions } = await supabase
        .from("submissions")
        .select("*, forms(*), reports(*)")
        .eq("respondent_hash", submission.respondent_hash)
        .neq("id", submission.id)
        .limit(5);

      if (relatedSubmissions && relatedSubmissions.length > 0) {
        const methodologies: string[] = [formType.toUpperCase()];
        let convergenceFound = false;
        let convergenceText = "";
        let divergenceText = "";

        for (const related of relatedSubmissions) {
          const relatedType = related.forms?.type;
          if (!relatedType) continue;
          
          methodologies.push(relatedType.toUpperCase());
          
          const relatedReport = related.reports;
          if (!relatedReport?.dimensions_score) continue;
          
          const relatedScore = relatedReport.dimensions_score.global_score ?? 0;
          const currentScore = dimensionsScore.global_score ?? avgScore;
          
          // Check for convergence (both high or both low)
          const bothHigh = currentScore > 60 && relatedScore > 60;
          const bothLow = currentScore <= 40 && relatedScore <= 40;
          
          if (bothHigh) {
            convergenceFound = true;
            convergenceText = `A sobrecarga foi corroborada por dupla verificação metodológica (${formType.toUpperCase()} Score: ${currentScore.toFixed(0)} e ${relatedType.toUpperCase()} Score: ${relatedScore.toFixed(0)}), aumentando o grau de certeza do risco identificado. Recomenda-se priorização das ações corretivas.`;
          } else if (bothLow) {
            convergenceFound = true;
            convergenceText = `O baixo nível de risco foi confirmado por múltiplas metodologias (${formType.toUpperCase()} e ${relatedType.toUpperCase()}), indicando condições de trabalho adequadas no momento.`;
          } else {
            divergenceText = `Observou-se discrepância entre a avaliação ${formType.toUpperCase()} (Score: ${currentScore.toFixed(0)}) e ${relatedType.toUpperCase()} (Score: ${relatedScore.toFixed(0)}). Esta divergência pode indicar percepções distintas entre metodologias ou necessidade de investigação complementar in loco.`;
          }
        }

        if (methodologies.length > 1) {
          crossValidation = {
            has_convergence: convergenceFound,
            convergence_text: convergenceText || undefined,
            divergence_text: divergenceText || undefined,
            methodologies_compared: [...new Set(methodologies)]
          };
        }
      }
    }

    // Variance check for manual review
    let requires_manual_review = false;
    let review_reason = "";
    
    if (scoreValues.length > 1) {
      const variance = scoreValues.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scoreValues.length;
      
      if (variance > 600) {
        requires_manual_review = true;
        review_reason = "Alta variância nas respostas entre dimensões (σ² > 600). Possível inconsistência ou situação atípica que requer análise humana.";
      }
      
      const hasExtreme = scoreValues.some(s => s > 85) && scoreValues.some(s => s < 20);
      if (hasExtreme) {
        requires_manual_review = true;
        review_reason = "Respostas extremas detectadas: dimensões com scores muito positivos e muito negativos simultaneamente.";
      }
    }

    const fmeaResult: FMEAResult = {
      gravidade,
      probabilidade,
      capacidade_deteccao,
      nre_score,
      nre_classification,
      dimension_scores: normalizedScores,
      risks_detected: risksDetected,
      cross_validation: crossValidation,
      requires_manual_review,
      review_reason: review_reason || undefined,
    };

    // Store FMEA calculation
    if (report?.id) {
      // Upsert FMEA calculation
      const { error: fmeaError } = await supabase
        .from("fmea_calculations")
        .upsert({
          report_id: report.id,
          gravidade,
          probabilidade,
          capacidade_deteccao,
          nre_score,
          nre_classification,
          dimension_scores: fmeaResult.dimension_scores,
          requires_manual_review,
          review_reason: review_reason || null,
          calculated_at: new Date().toISOString()
        }, { onConflict: "report_id" });

      if (fmeaError) {
        console.error("Error storing FMEA:", fmeaError);
      }

      // Delete old suggested actions and create new ones
      await supabase
        .from("suggested_actions")
        .delete()
        .eq("report_id", report.id);

      for (const risk of risksDetected) {
        const { error: actionError } = await supabase.from("suggested_actions").insert({
          report_id: report.id,
          risk_detected: risk.risk,
          dimension: risk.dimension,
          action_title: risk.action,
          action_description: `Fonte geradora: ${risk.source}. ${risk.action}`,
          priority: risk.priority,
          nre_score,
          nre_classification,
          nr_referencia: risk.nr_referencia,
          source_matrix: formType === "hse_it" ? "risk_matrix_hseit" : "risk_matrix_ergos",
        });
        
        if (actionError) {
          console.error("Error creating action:", actionError);
        }
      }

      // Update report with cross-validation info if available
      const updateData: any = { 
        risk_level: nre_classification.toLowerCase() 
      };
      
      if (crossValidation?.convergence_text || crossValidation?.divergence_text) {
        // Append cross-validation text to analysis
        const validationText = crossValidation.convergence_text || crossValidation.divergence_text;
        const currentAnalysis = report.ai_analysis_text || "";
        
        if (!currentAnalysis.includes("CONVERGÊNCIA DE EVIDÊNCIAS") && !currentAnalysis.includes("Convergência")) {
          updateData.ai_analysis_text = currentAnalysis + `\n\n**CONVERGÊNCIA DE EVIDÊNCIAS**\n${validationText}`;
        }
      }
      
      await supabase
        .from("reports")
        .update(updateData)
        .eq("id", report.id);
    }

    console.log("FMEA calculation completed:", {
      nre_score,
      nre_classification,
      risks_count: risksDetected.length,
      has_cross_validation: !!crossValidation
    });

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
