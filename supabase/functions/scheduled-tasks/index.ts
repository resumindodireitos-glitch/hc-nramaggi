import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result: any = {};

    switch (task) {
      case "cleanup_pii": {
        // Execute LGPD cleanup for expired submissions
        const { data, error } = await supabase.rpc("cleanup_old_pii");
        
        if (error) {
          console.error("Cleanup PII error:", error);
          throw error;
        }

        console.log("Cleanup PII result:", data);
        result = { 
          task: "cleanup_pii", 
          anonymized_count: data,
          executed_at: new Date().toISOString()
        };

        // Log the execution
        await supabase.from("audit_log").insert({
          action: "SCHEDULED_CLEANUP_PII",
          table_name: "submissions",
          new_data: result
        });
        break;
      }

      case "calculate_pending_fmea": {
        // Find reports without FMEA calculations
        const { data: pendingReports, error: fetchError } = await supabase
          .from("reports")
          .select("id, submission_id, dimensions_score, risk_level")
          .is("is_approved", false)
          .order("created_at", { ascending: true })
          .limit(50);

        if (fetchError) throw fetchError;

        let calculated = 0;
        let failed = 0;

        for (const report of pendingReports || []) {
          // Check if FMEA already exists
          const { data: existingFmea } = await supabase
            .from("fmea_calculations")
            .select("id")
            .eq("report_id", report.id)
            .maybeSingle();

          if (existingFmea) continue; // Skip if already calculated

          // Calculate FMEA based on dimension scores
          const scores = report.dimensions_score || {};
          const scoreValues = Object.values(scores).map((s: any) => 
            typeof s === "object" ? s.score : s
          ).filter((v): v is number => typeof v === "number");

          if (scoreValues.length === 0) continue;

          const avgScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
          
          // Map to FMEA scales (1-5)
          const gravidade = Math.min(5, Math.max(1, Math.ceil(avgScore / 20)));
          const probabilidade = avgScore > 60 ? 4 : avgScore > 40 ? 3 : avgScore > 20 ? 2 : 1;
          const capacidade_deteccao = 1; // Default

          const nreScore = gravidade * probabilidade * capacidade_deteccao;
          
          // Get classification
          let classification = "Trivial";
          if (nreScore > 400) classification = "Intolerável";
          else if (nreScore > 200) classification = "Substancial";
          else if (nreScore > 100) classification = "Moderado";
          else if (nreScore > 50) classification = "Tolerável";

          const { error: insertError } = await supabase
            .from("fmea_calculations")
            .insert({
              report_id: report.id,
              gravidade,
              probabilidade,
              capacidade_deteccao,
              nre_score: nreScore,
              nre_classification: classification,
              dimension_scores: scores,
              requires_manual_review: nreScore > 200,
              review_reason: nreScore > 200 ? "NRE alto detectado automaticamente" : null
            });

          if (insertError) {
            console.error("FMEA insert error:", insertError);
            failed++;
          } else {
            calculated++;

            // Generate suggested actions for high risk
            if (nreScore > 100) {
              // Fetch relevant risk matrix entries
              const { data: riskEntries } = await supabase
                .from("risk_matrix_ergos")
                .select("*")
                .eq("is_active", true)
                .limit(3);

              for (const entry of riskEntries || []) {
                await supabase.from("suggested_actions").insert({
                  report_id: report.id,
                  risk_detected: entry.perigo,
                  action_title: entry.medida_controle_sugerida || "Implementar medida de controle",
                  action_description: entry.dano_potencial,
                  dimension: entry.dimension,
                  priority: nreScore > 200 ? "alta" : nreScore > 100 ? "media" : "baixa",
                  nre_score: nreScore,
                  nre_classification: classification,
                  nr_referencia: entry.nr_referencia,
                  source_matrix: "risk_matrix_ergos"
                });
              }
            }
          }
        }

        result = {
          task: "calculate_pending_fmea",
          total_pending: pendingReports?.length || 0,
          calculated,
          failed,
          executed_at: new Date().toISOString()
        };

        await supabase.from("audit_log").insert({
          action: "SCHEDULED_FMEA_CALCULATION",
          table_name: "fmea_calculations",
          new_data: result
        });
        break;
      }

      case "generate_pending_narratives": {
        // Find reports without AI analysis text
        const { data: pendingReports, error: fetchError } = await supabase
          .from("reports")
          .select("id")
          .or("ai_analysis_text.is.null,ai_analysis_text.eq.")
          .eq("is_approved", false)
          .limit(10);

        if (fetchError) throw fetchError;

        let generated = 0;

        for (const report of pendingReports || []) {
          try {
            // Call the narrative generation function
            const response = await fetch(`${supabaseUrl}/functions/v1/generate-narrative-report`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ reportId: report.id }),
            });

            if (response.ok) {
              generated++;
            }
          } catch (e) {
            console.error("Narrative generation error:", e);
          }
        }

        result = {
          task: "generate_pending_narratives",
          total_pending: pendingReports?.length || 0,
          generated,
          executed_at: new Date().toISOString()
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown task. Valid: cleanup_pii, calculate_pending_fmea, generate_pending_narratives" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log("Task completed:", result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
