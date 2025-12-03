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

const AI_ENDPOINTS = {
  lovable: "https://ai.gateway.lovable.dev/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  deepseek: "https://api.deepseek.com/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
};

async function callLovableAI(systemPrompt: string, userPrompt: string, apiKey: string, model = "google/gemini-2.5-flash") {
  console.log("Calling Lovable AI with model:", model);
  
  const response = await fetch(AI_ENDPOINTS.lovable, {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${apiKey}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Lovable AI error:", response.status, err);
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function callOpenAI(systemPrompt: string, userPrompt: string, apiKey: string, model: string) {
  console.log("Calling OpenAI with model:", model);
  
  const response = await fetch(AI_ENDPOINTS.openai, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("OpenAI error:", response.status, err);
    throw new Error(`OpenAI error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function callAnthropic(systemPrompt: string, userPrompt: string, apiKey: string, model: string) {
  console.log("Calling Anthropic with model:", model);
  
  const response = await fetch(AI_ENDPOINTS.anthropic, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Anthropic error:", response.status, err);
    throw new Error(`Anthropic error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.content?.[0]?.text;
}

async function callGoogleGemini(systemPrompt: string, userPrompt: string, apiKey: string, model: string) {
  // Handle model names like "gemini-1.5-flash" or "google/gemini-1.5-flash"
  const modelName = model.includes("/") ? model.split("/")[1] : model;
  const url = `${AI_ENDPOINTS.google}/${modelName}:generateContent?key=${apiKey}`;
  
  console.log("Calling Google Gemini with model:", modelName, "URL:", url);
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Google Gemini error:", response.status, errorText);
    throw new Error(`Google Gemini error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function callDeepSeek(systemPrompt: string, userPrompt: string, apiKey: string, model: string) {
  console.log("Calling DeepSeek with model:", model);
  
  const response = await fetch(AI_ENDPOINTS.deepseek, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("DeepSeek error:", response.status, err);
    throw new Error(`DeepSeek error: ${response.status}`);
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
    const dimensionScores = report.dimensions_score || {};

    // Get form type and fetch active AI agent
    const formType = form?.type || "ergos";
    console.log("Fetching active agent for form type:", formType);

    const { data: agent } = await supabase
      .from("ai_prompts")
      .select("*")
      .eq("form_type", formType)
      .eq("is_active", true)
      .maybeSingle();

    // Determine provider and model from agent or use defaults
    let provider = "lovable";
    let model = "google/gemini-2.5-flash";
    let systemPrompt = NARRATIVE_SYSTEM_PROMPT;

    if (agent) {
      console.log("Using agent:", agent.name, "Provider:", agent.provider, "Model:", agent.model);
      provider = agent.provider || "lovable";
      model = agent.model || model;
      // Use agent's system prompt if available, but append narrative-specific instructions
      if (agent.system_prompt) {
        systemPrompt = agent.system_prompt + "\n\n" + NARRATIVE_SYSTEM_PROMPT;
      }
    } else {
      console.log("No active agent found, using defaults");
    }

    // Get API keys from system_settings
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY", "GOOGLE_API_KEY"]);

    const apiKeys: Record<string, string> = {};
    settingsData?.forEach(s => { if (s.value) apiKeys[s.key] = s.value; });
    
    console.log("Available API keys:", Object.keys(apiKeys));

    // Build context for AI
    const cargo = respondent.cargo || "Não informado";
    const setor = respondent.setor || "Não informado";

    // Format dimension scores
    let scoresText = "";
    if (dimensionScores.dimensions && Array.isArray(dimensionScores.dimensions)) {
      scoresText = dimensionScores.dimensions
        .map((dim: any) => `- ${dim.name}: ${dim.normalized_score || dim.score}% (${dim.status || dim.color})`)
        .join("\n");
    } else {
      scoresText = Object.entries(dimensionScores)
        .filter(([key]) => !['blocos', 'global_score', 'risk_level', 'risk_label', 'risk_color', 'risk_description', 'calculation_method', 'calculated_at', 'dimensions'].includes(key))
        .map(([dim, data]: [string, any]) => {
          const score = typeof data === "object" ? (data.normalized_score || data.score) : data;
          const risk = typeof data === "object" ? data.color || data.status : "";
          return `- ${dim}: ${score}% ${risk ? `(${risk})` : ""}`;
        })
        .join("\n");
    }

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
${scoresText || "Nenhuma dimensão disponível"}

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
    console.log("Using provider:", provider, "Model:", model);

    let narrative: string | null = null;

    try {
      switch (provider) {
        case "google":
          if (apiKeys["GOOGLE_API_KEY"]) {
            narrative = await callGoogleGemini(systemPrompt, userPrompt, apiKeys["GOOGLE_API_KEY"], model);
          } else if (lovableApiKey) {
            console.log("GOOGLE_API_KEY not found, falling back to Lovable AI");
            narrative = await callLovableAI(systemPrompt, userPrompt, lovableApiKey);
          }
          break;
          
        case "openai":
          if (apiKeys["OPENAI_API_KEY"]) {
            narrative = await callOpenAI(systemPrompt, userPrompt, apiKeys["OPENAI_API_KEY"], model);
          } else if (lovableApiKey) {
            console.log("OPENAI_API_KEY not found, falling back to Lovable AI");
            narrative = await callLovableAI(systemPrompt, userPrompt, lovableApiKey);
          }
          break;
          
        case "anthropic":
          if (apiKeys["ANTHROPIC_API_KEY"]) {
            narrative = await callAnthropic(systemPrompt, userPrompt, apiKeys["ANTHROPIC_API_KEY"], model);
          } else if (lovableApiKey) {
            console.log("ANTHROPIC_API_KEY not found, falling back to Lovable AI");
            narrative = await callLovableAI(systemPrompt, userPrompt, lovableApiKey);
          }
          break;
          
        case "deepseek":
          if (apiKeys["DEEPSEEK_API_KEY"]) {
            narrative = await callDeepSeek(systemPrompt, userPrompt, apiKeys["DEEPSEEK_API_KEY"], model);
          } else if (lovableApiKey) {
            console.log("DEEPSEEK_API_KEY not found, falling back to Lovable AI");
            narrative = await callLovableAI(systemPrompt, userPrompt, lovableApiKey);
          }
          break;
          
        case "lovable":
        default:
          if (lovableApiKey) {
            narrative = await callLovableAI(systemPrompt, userPrompt, lovableApiKey, model);
          }
          break;
      }
    } catch (aiError) {
      console.error("AI call failed:", aiError);
      
      // Try fallback to Lovable AI if primary provider fails
      if (provider !== "lovable" && lovableApiKey) {
        console.log("Primary provider failed, trying Lovable AI fallback");
        try {
          narrative = await callLovableAI(systemPrompt, userPrompt, lovableApiKey);
        } catch (fallbackError) {
          console.error("Lovable AI fallback also failed:", fallbackError);
        }
      }
    }

    if (!narrative) {
      console.error("All AI providers failed");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to generate narrative - all AI providers failed",
          narrative: "Análise não disponível. Por favor, verifique a configuração do agente de IA.",
          fallback: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    const inputTokens = Math.ceil(userPrompt.length / 4);
    const outputTokens = Math.ceil(narrative.length / 4);
    
    await supabase.from("ai_usage").insert({
      model: model,
      provider: provider,
      submission_id: submission?.id,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      agent_id: agent?.id || null,
    });

    console.log("Narrative generated successfully, length:", narrative.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        narrative,
        section: section || "analysis",
        provider,
        model
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
