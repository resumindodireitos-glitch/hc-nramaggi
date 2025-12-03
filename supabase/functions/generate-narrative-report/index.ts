import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NARRATIVE_SYSTEM_PROMPT = `# ROLE
Você é um Fisioterapeuta Ergonomista Sênior especializado em análise de riscos psicossociais e ergonômicos ocupacionais.

# ESTILO
- Tom técnico, formal, impessoal em Português Brasil
- Linguagem encontrada em documentos AET profissionais
- Cite explicitamente NRs quando detectar risco alto (NR-01, NR-17)
- Referencie ISO 10075-1 para carga mental, ISO 45003 para riscos psicossociais

# ESTRUTURA DA ANÁLISE
1. **Caracterização do Posto**: Breve descrição do cargo/função avaliado
2. **Principais Achados**: Pontos críticos identificados nos scores
3. **Riscos Identificados**: Lista objetiva com gravidade
4. **Correlações**: Relação entre dimensões (ex: alta demanda + baixo controle = estresse)
5. **Recomendações Prioritárias**: Ações baseadas no NRE calculado

# REGRAS
- NÃO invente dados - use apenas os scores fornecidos
- NÃO cite nomes de funcionários individuais
- Foque na FUNÇÃO, não na pessoa
- Priorize recomendações baseadas no NRE (Intolerável > Substancial > Moderado)
- Mantenha o texto entre 300-600 palavras

# OUTPUT
Retorne APENAS o texto narrativo da análise, sem JSON ou formatação especial.`;

async function callLovableAI(systemPrompt: string, userPrompt: string, apiKey: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("AI error:", response.status, err);
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId, section } = await req.json();

    if (!reportId) {
      return new Response(
        JSON.stringify({ error: "reportId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Authorization check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch report with all related data
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select(`
        *,
        submissions (
          *,
          forms (*)
        ),
        fmea_calculations (*),
        suggested_actions (*)
      `)
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      console.error("Report fetch error:", reportError);
      return new Response(JSON.stringify({ error: "Report not found" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const submission = report.submissions;
    const form = submission?.forms;
    const fmea = report.fmea_calculations?.[0];
    const actions = report.suggested_actions || [];
    const respondent = submission?.respondent_data || {};
    const answers = submission?.answers || {};
    const dimensionScores = report.dimensions_score || {};

    // Build context for AI
    const formType = form?.type || "ergos";
    const cargo = respondent.cargo || "Não informado";
    const setor = respondent.setor || "Não informado";

    // Format dimension scores
    const scoresText = Object.entries(dimensionScores)
      .map(([dim, data]: [string, any]) => {
        const score = typeof data === "object" ? data.score : data;
        const risk = typeof data === "object" ? data.risk_color : "";
        return `- ${dim}: ${score}% ${risk ? `(${risk})` : ""}`;
      })
      .join("\n");

    // Format FMEA data
    const fmeaText = fmea 
      ? `NRE: ${fmea.nre_score} (${fmea.nre_classification})
Gravidade: ${fmea.gravidade}/5
Probabilidade: ${fmea.probabilidade}/5
Capacidade de Detecção: ${fmea.capacidade_deteccao}/5`
      : "FMEA não calculado";

    // Format suggested actions
    const actionsText = actions.length > 0
      ? actions.map((a: any) => `- ${a.action_title} (Prioridade: ${a.priority})`).join("\n")
      : "Sem ações sugeridas";

    const userPrompt = `# DADOS PARA ANÁLISE

## Caracterização
- Cargo: ${cargo}
- Setor: ${setor}
- Tipo de Avaliação: ${formType.toUpperCase()}
- Formulário: ${form?.title || "N/A"}

## Scores por Dimensão
${scoresText}

## Avaliação FMEA
${fmeaText}

## Ações Sugeridas pelo Sistema
${actionsText}

## Nível de Risco Geral
${report.risk_level || "Não classificado"}

---

${section === "conclusion" 
  ? "Gere uma CONCLUSÃO técnica de 100-150 palavras resumindo os achados principais e o plano de ação prioritário."
  : section === "recommendations"
  ? "Gere uma lista de 5-7 RECOMENDAÇÕES específicas e acionáveis, priorizando as de maior NRE."
  : "Gere o texto completo da ANÁLISE ERGONÔMICA seguindo a estrutura definida no system prompt."
}`;

    console.log("Generating narrative for report:", reportId, "section:", section || "full");

    const narrative = await callLovableAI(NARRATIVE_SYSTEM_PROMPT, userPrompt, lovableApiKey);

    if (!narrative) {
      throw new Error("Failed to generate narrative");
    }

    // Optionally update the report with the generated text
    if (section === "conclusion") {
      await supabase
        .from("reports")
        .update({ ai_conclusion: narrative })
        .eq("id", reportId);
    } else if (section === "recommendations") {
      const recommendations = narrative
        .split("\n")
        .filter((line: string) => line.trim().startsWith("-") || line.trim().match(/^\d+\./))
        .map((line: string) => line.replace(/^[-\d.]+\s*/, "").trim());
      
      await supabase
        .from("reports")
        .update({ ai_recommendations: recommendations })
        .eq("id", reportId);
    } else {
      await supabase
        .from("reports")
        .update({ ai_analysis_text: narrative })
        .eq("id", reportId);
    }

    // Log AI usage
    await supabase.from("ai_usage").insert({
      model: "google/gemini-2.5-flash",
      provider: "lovable",
      submission_id: submission?.id,
      input_tokens: userPrompt.length / 4, // Rough estimate
      output_tokens: narrative.length / 4,
      total_tokens: (userPrompt.length + narrative.length) / 4,
    });

    console.log("Narrative generated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        narrative,
        section: section || "analysis"
      }),
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
