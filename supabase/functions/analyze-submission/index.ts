import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_PROMPT = `# SYSTEM ROLE
Você é um Fisioterapeuta Ergonomista Sênior da "HC Consultoria em Ergonomia", responsável pela elaboração de laudos AET e avaliação de Riscos Psicossociais para empresas do Grupo Amaggi.

# REGRAS
1. Use tom técnico, formal, impessoal em Português (BR).
2. Baseie-se nos dados fornecidos. Não invente riscos.
3. Siga a estrutura JSON solicitada.
4. Cite NR-01, NR-17, ISO 10075-1, ISO 45003.

# FORMATO DE SAÍDA (JSON)
{
  "risk_level": "baixo" | "medio" | "alto",
  "form_type": "ergos" | "hse_it",
  "total_score": 00.00,
  "dimensions_score": {},
  "analysis_text": "Texto da interpretação...",
  "risk_inventory": [],
  "conclusion": "Texto conclusivo...",
  "recommendations": []
}`;

const AI_ENDPOINTS = {
  lovable: "https://ai.gateway.lovable.dev/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  deepseek: "https://api.deepseek.com/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
};

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) throw new Error(`Embedding failed: ${response.status}`);
  const data = await response.json();
  return data.data[0].embedding;
}

async function searchRAG(
  supabase: any,
  agentId: string,
  query: string,
  topK: number,
  lovableApiKey: string
): Promise<string> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query, lovableApiKey);
    
    // Search similar chunks
    const { data: chunks, error } = await supabase.rpc("search_similar_chunks", {
      query_embedding: `[${embedding.join(",")}]`,
      agent_uuid: agentId,
      match_count: topK
    });

    if (error) {
      console.error("RAG search error:", error);
      return "";
    }

    if (!chunks || chunks.length === 0) {
      console.log("No RAG chunks found");
      return "";
    }

    console.log(`Found ${chunks.length} RAG chunks`);
    
    // Build context from chunks
    const context = chunks
      .map((c: any, i: number) => `[Documento ${i + 1}]\n${c.content}`)
      .join("\n\n---\n\n");

    return context;
  } catch (error) {
    console.error("RAG error:", error);
    return "";
  }
}

async function callLovableAI(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
  const response = await fetch(AI_ENDPOINTS.lovable, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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

async function callOpenAI(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
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

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function callAnthropic(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
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

  if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text;
}

async function callDeepSeek(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
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

  if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function callGoogleGemini(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
  const modelName = model.includes("/") ? model.split("/")[1] : model;
  const url = `${AI_ENDPOINTS.google}/${modelName}:generateContent?key=${apiKey}`;
  
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
    throw new Error(`Google Gemini error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

/**
 * Calculates scores using the universal calculator logic inline
 * This ensures consistent calculation even without calling the edge function
 */
function calculateUniversalScore(formType: string, answers: Record<string, any>, form: any) {
  const dimensionsScore: Record<string, { score: number; normalized_score: number; status: string; color: string }> = {};
  let globalScore = 0;

  // Get calculation rules from form or use defaults
  const rules = form?.calculation_rules || {};
  const thresholds = form?.risk_thresholds || {
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

  const getDimensionStatus = (score: number) => {
    for (const t of thresholds.dimension_thresholds || []) {
      if (score <= t.max) return { status: t.status, color: t.color };
    }
    return { status: "Crítico", color: "red" };
  };

  const getRiskLevel = (score: number) => {
    for (const t of thresholds.levels || []) {
      if (score <= t.max) return { risk_level: t.risk_level, label: t.label };
    }
    return { risk_level: "alto", label: "Alto" };
  };

  if (formType === "ergos") {
    // ERGOS calculation: 0.83 × (Bloco A + Bloco B)
    const blocoA = ["pressao_tempo", "atencao", "complexidade", "monotonia", "raciocinio"];
    const blocoB = ["iniciativa", "isolamento", "horarios_turnos", "relacionamentos", "demandas_gerais"];
    
    let sumA = 0, sumB = 0;
    
    [...blocoA, ...blocoB].forEach(f => {
      const val = parseFloat(answers[f]) || 0;
      const normalizedScore = (val / 10) * 100;
      const { status, color } = getDimensionStatus(normalizedScore);
      dimensionsScore[f] = { score: val, normalized_score: normalizedScore, status, color };
      
      if (blocoA.includes(f)) sumA += val;
      else sumB += val;
    });
    
    globalScore = Math.round(0.83 * (sumA + sumB));
  } else {
    // HSE-IT calculation: average percentage per dimension
    const dimensions = ["demandas", "relacionamentos", "controle", "suporte_chefia", "suporte_colegas", "cargo", "comunicacao_mudancas"];
    const invertedDimensions = ["demandas", "relacionamentos"];
    let total = 0;
    let count = 0;
    
    dimensions.forEach(d => {
      const val = parseFloat(answers[d]) || 0;
      // For inverted dimensions, high values = stress; for others, invert
      let normalizedScore = val;
      if (!invertedDimensions.includes(d)) {
        normalizedScore = 100 - val;
      }
      
      const { status, color } = getDimensionStatus(normalizedScore);
      dimensionsScore[d] = { score: val, normalized_score: normalizedScore, status, color };
      total += normalizedScore;
      count++;
    });
    
    globalScore = count > 0 ? Math.round(total / count) : 0;
  }

  const { risk_level, label } = getRiskLevel(globalScore);

  return {
    global_score: globalScore,
    risk_level,
    risk_label: label,
    dimensions: Object.entries(dimensionsScore).map(([name, data]) => ({
      name,
      ...data,
    })),
  };
}

function generateFallbackAnalysis(formType: string, answers: Record<string, any>, form?: any) {
  const calculated = calculateUniversalScore(formType, answers, form);

  return {
    risk_level: calculated.risk_level,
    form_type: formType,
    total_score: calculated.global_score,
    dimensions_score: calculated,
    analysis_text: "Análise básica gerada. Configure um agente de IA para análises detalhadas.",
    risk_inventory: [],
    conclusion: "Relatório gerado sem análise de IA completa.",
    recommendations: ["Configure um agente de IA ativo para recomendações personalizadas."]
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { submissionId } = await req.json();

    if (!submissionId) {
      return new Response(
        JSON.stringify({ error: "submissionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: userRole } = await userClient.from("user_roles").select("role").eq("user_id", user.id).single();
    if (!userRole || (userRole.role !== "admin_hc" && userRole.role !== "super_admin")) {
      return new Response(JSON.stringify({ error: "Admin access required" }), 
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("User authorized:", user.id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch submission
    const { data: submission, error: fetchError } = await supabase
      .from("submissions")
      .select("*, forms(*)")
      .eq("id", submissionId)
      .single();

    if (fetchError || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const formType = submission.forms?.type || "ergos";
    let systemPrompt = MASTER_PROMPT;
    let modelToUse = "google/gemini-2.5-flash";
    let providerToUse = "lovable";
    let useRag = false;
    let ragTopK = 5;
    let agentId: string | null = null;

    // Fetch active agent
    const { data: agent, error: agentError } = await supabase
      .from("ai_prompts")
      .select("*")
      .eq("form_type", formType)
      .eq("is_active", true)
      .maybeSingle();

    if (agent && !agentError) {
      console.log("Using agent:", agent.name);
      systemPrompt = agent.system_prompt;
      modelToUse = agent.model || modelToUse;
      providerToUse = agent.provider || providerToUse;
      useRag = agent.use_rag || false;
      ragTopK = agent.rag_top_k || 5;
      agentId = agent.id;
    }

    // Get API keys
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY", "GOOGLE_API_KEY"]);

    const apiKeys: Record<string, string> = {};
    settingsData?.forEach(s => { if (s.value) apiKeys[s.key] = s.value; });

    console.log("Provider:", providerToUse, "Model:", modelToUse, "RAG:", useRag);

    const formTitle = submission.forms?.title || "Formulário";
    const answers = submission.answers;
    const respondentData = submission.respondent_data || {};

    // Build RAG context if enabled
    let ragContext = "";
    if (useRag && agentId && lovableApiKey) {
      const queryText = `${respondentData.cargo || ""} ${respondentData.setor || ""} ${JSON.stringify(answers).slice(0, 500)}`;
      ragContext = await searchRAG(supabase, agentId, queryText, ragTopK, lovableApiKey);
      
      if (ragContext) {
        systemPrompt += `\n\n# CONTEXTO DA BASE DE CONHECIMENTO\nUse as informações abaixo como referência adicional:\n\n${ragContext}`;
        console.log("RAG context added to prompt");
      }
    }

    const userPrompt = `# DADOS DO COLABORADOR
- Nome: ${respondentData.full_name || respondentData.nome || "Não informado"}
- Função: ${respondentData.job_title || respondentData.cargo || "Não informado"}
- Setor: ${respondentData.department || respondentData.setor || "Não informado"}
- Empresa: Amaggi

# FORMULÁRIO
- Título: ${formTitle}
- Tipo: ${formType}

# RESPOSTAS
${JSON.stringify(answers, null, 2)}

Analise e gere o relatório técnico em JSON.`;

    let analysisResult;
    let aiContent: string | null = null;

    try {
      switch (providerToUse) {
        case "lovable":
          if (lovableApiKey) {
            aiContent = await callLovableAI(systemPrompt, userPrompt, modelToUse, lovableApiKey);
          }
          break;
        case "openai":
          if (apiKeys["OPENAI_API_KEY"]) {
            aiContent = await callOpenAI(systemPrompt, userPrompt, modelToUse, apiKeys["OPENAI_API_KEY"]);
          } else if (lovableApiKey) {
            aiContent = await callLovableAI(systemPrompt, userPrompt, "google/gemini-2.5-flash", lovableApiKey);
          }
          break;
        case "anthropic":
          if (apiKeys["ANTHROPIC_API_KEY"]) {
            aiContent = await callAnthropic(systemPrompt, userPrompt, modelToUse, apiKeys["ANTHROPIC_API_KEY"]);
          } else if (lovableApiKey) {
            aiContent = await callLovableAI(systemPrompt, userPrompt, "google/gemini-2.5-flash", lovableApiKey);
          }
          break;
        case "deepseek":
          if (apiKeys["DEEPSEEK_API_KEY"]) {
            aiContent = await callDeepSeek(systemPrompt, userPrompt, modelToUse, apiKeys["DEEPSEEK_API_KEY"]);
          } else if (lovableApiKey) {
            aiContent = await callLovableAI(systemPrompt, userPrompt, "google/gemini-2.5-flash", lovableApiKey);
          }
          break;
        case "google":
          if (apiKeys["GOOGLE_API_KEY"]) {
            aiContent = await callGoogleGemini(systemPrompt, userPrompt, modelToUse, apiKeys["GOOGLE_API_KEY"]);
          } else if (lovableApiKey) {
            aiContent = await callLovableAI(systemPrompt, userPrompt, "google/gemini-2.5-flash", lovableApiKey);
          }
          break;
      }

      if (aiContent) {
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Could not parse AI response");
        analysisResult = JSON.parse(jsonMatch[0]);
        
        // Ensure dimensions_score uses the universal format
        if (!analysisResult.dimensions_score?.global_score) {
          const calculated = calculateUniversalScore(formType, answers, submission.forms);
          analysisResult.dimensions_score = calculated;
        }
      } else {
        analysisResult = generateFallbackAnalysis(formType, answers, submission.forms);
      }
    } catch (aiError) {
      console.error("AI call failed:", aiError);
      analysisResult = generateFallbackAnalysis(formType, answers, submission.forms);
    }

    // Create report
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert({
        submission_id: submissionId,
        risk_level: analysisResult.risk_level,
        dimensions_score: analysisResult.dimensions_score,
        ai_analysis_text: analysisResult.analysis_text,
        ai_conclusion: analysisResult.conclusion,
        ai_recommendations: analysisResult.recommendations,
        is_approved: false,
      })
      .select()
      .single();

    if (reportError) throw reportError;

    await supabase.from("submissions").update({ status: "processed" }).eq("id", submissionId);

    console.log("Report created:", report.id);

    return new Response(
      JSON.stringify({ success: true, reportId: report.id }),
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
