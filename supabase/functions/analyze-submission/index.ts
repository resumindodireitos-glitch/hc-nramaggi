import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_PROMPT = `# SYSTEM ROLE
Você é um Fisioterapeuta Ergonomista Sênior da "HC Consultoria em Ergonomia", responsável pela elaboração de laudos AET (Análise Ergonômica do Trabalho) e avaliação de Riscos Psicossociais para empresas do Grupo Amaggi, em conformidade com a NR-01 e NR-17.

Sua tarefa é receber as respostas de questionários (ERGOS para operacional ou HSE-IT para administrativo), calcular pontuações, cruzar com a Matriz de Risco FMEA e gerar textos técnicos para o relatório final.

# REGRAS DE OURO
1. Use tom técnico, formal, impessoal e em Português (BR).
2. Baseie-se estritamente nos dados fornecidos. Não invente riscos que não estão nas respostas.
3. Siga rigorosamente a estrutura de saída JSON solicitada.
4. Cite as normas regulamentadoras adequadas (NR-01, NR-17, ISO 10075-1, ISO 45003).

# BASE DE CONHECIMENTO

## 1. FERRAMENTA ERGOS (Avaliação de Carga Mental - Operacional)
O ERGOS avalia 10 fatores cognitivos divididos em duas tabelas:

**Tabela A (Fatores Cognitivos):**
- Pressão de tempo (0-10)
- Atenção (0-10)
- Complexidade (0-10)
- Monotonia (0-10)
- Raciocínio e processos centrais (0-10)

**Tabela B (Fatores Organizacionais):**
- Iniciativa (0-10)
- Isolamento (0-10)
- Horários e turnos de trabalho (0-10)
- Relacionamentos no trabalho (0-10)
- Demandas gerais (0-10)

**Cálculo da Pontuação Total:**
- Soma Tabela A = soma dos 5 fatores da Tabela A
- Soma Tabela B = soma dos 5 fatores da Tabela B
- Pontuação Total = (Soma_A + Soma_B) * fator de ajuste (aproximadamente 0.83)

**Classificação de Risco ERGOS:**
- 0 a 30 pontos: Condições adequadas sem existência de risco em potencial
- 31 a 50 pontos: Risco Médio - necessidade de monitoramento
- 51 a 70 pontos: Risco Alto - intervenção necessária
- Acima de 70 pontos: Risco Crítico - ação imediata

## 2. FERRAMENTA HSE-IT (Estresse Relacionado ao Trabalho - Administrativo)
O HSE-IT avalia 7 dimensões em percentual de fatores estressores:

**Dimensões:**
- Demandas (carga de trabalho, exigências, organização e ambiente)
- Relacionamentos (comportamentos interpessoais, assédio)
- Controle (opinar sobre mudanças, controlar ritmo)
- Suporte/apoio da chefia (apoio de superiores, recursos)
- Suporte/apoio dos colegas (comunicação interpessoal, diversidade)
- Cargo (transparência em promoção, reconhecimento)
- Comunicação e mudanças (participação em mudanças)

**Classificação de Risco HSE-IT (por dimensão):**
- 0%: Sem fatores estressores identificados
- 1% a 20%: Risco Baixo - monitorar
- 21% a 50%: Risco Médio - atenção necessária
- Acima de 50%: Risco Alto - intervenção necessária

## 3. MATRIZ FMEA ADAPTADA (G x P x C)

**Gravidade (G):**
- 1 = Baixa: Desconforto leve, sem afastamento
- 2 = Média: Desconforto moderado, possível acompanhamento
- 3 = Alta: Agravo potencial à saúde mental, possível afastamento

**Probabilidade (P):**
- 1 = Baixa: Ocorrência improvável
- 2 = Média: Ocorrência possível sob certas condições
- 3 = Alta: Ocorrência frequente ou esperada

**Controle (C):**
- 1 = Bom: Medidas eficazes implementadas
- 2 = Parcial: Medidas existentes mas insuficientes
- 3 = Inexistente: Sem medidas de controle

**NRE (Nível de Risco Ergonômico) = G × P × C**

**Classificação NRE:**
- 1: Trivial
- 2 a 3: Tolerável
- 4 a 9: Moderado
- 12 a 18: Substancial
- 27: Intolerável

# FORMATO DE SAÍDA (JSON ESTRITO)

Retorne APENAS este JSON, sem markdown:

{
  "risk_level": "baixo" | "medio" | "alto",
  "form_type": "ergos" | "hse_it",
  "total_score": 00.00,
  "dimensions_score": {
    "dimensao1": { "score": 0, "risk_color": "verde" | "amarelo" | "vermelho" }
  },
  "analysis_text": "Texto completo da interpretação dos resultados...",
  "risk_inventory": [
    {
      "risk_factor": "Nome do fator de risco",
      "harm": "Transtornos relacionados à saúde mental",
      "source_cause": "Descrição da fonte/circunstância",
      "exposure": "Habitual" | "Permanente" | "Intermitente",
      "severity_G": 1-3,
      "probability_P": 1-3,
      "control_C": 1-3,
      "nre_value": 0,
      "nre_label": "Trivial" | "Tolerável" | "Moderado" | "Substancial" | "Intolerável",
      "action_plan": "Medida de controle..."
    }
  ],
  "conclusion": "Texto conclusivo formal...",
  "recommendations": ["Recomendação 1", "Recomendação 2"]
}`;

// API endpoints for different providers
const AI_ENDPOINTS = {
  lovable: "https://ai.gateway.lovable.dev/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  deepseek: "https://api.deepseek.com/v1/chat/completions",
};

async function callLovableAI(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
  const response = await fetch(AI_ENDPOINTS.lovable, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
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
    const errorText = await response.text();
    console.error("Lovable AI error:", response.status, errorText);
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

async function callOpenAI(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
  const response = await fetch(AI_ENDPOINTS.openai, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
    const errorText = await response.text();
    console.error("OpenAI error:", response.status, errorText);
    throw new Error(`OpenAI error: ${response.status}`);
  }

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
      messages: [
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic error:", response.status, errorText);
    throw new Error(`Anthropic error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text;
}

async function callDeepSeek(systemPrompt: string, userPrompt: string, model: string, apiKey: string) {
  const response = await fetch(AI_ENDPOINTS.deepseek, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
    const errorText = await response.text();
    console.error("DeepSeek error:", response.status, errorText);
    throw new Error(`DeepSeek error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content;
}

function generateFallbackAnalysis(formType: string, answers: Record<string, any>) {
  // Basic analysis without AI
  const isErgos = formType === "ergos";
  
  let totalScore = 0;
  const dimensionsScore: Record<string, { score: number; risk_color: string }> = {};

  if (isErgos) {
    // Calculate ERGOS score
    const factors = ["pressao_tempo", "atencao", "complexidade", "monotonia", "raciocinio", 
                     "iniciativa", "isolamento", "horarios_turnos", "relacionamentos", "demandas_gerais"];
    let sum = 0;
    factors.forEach(f => {
      const val = parseInt(answers[f]) || 0;
      sum += val;
      dimensionsScore[f] = {
        score: val,
        risk_color: val >= 7 ? "vermelho" : val >= 4 ? "amarelo" : "verde"
      };
    });
    totalScore = Math.round(sum * 0.83);
  } else {
    // HSE-IT calculation
    const dimensions = ["demandas", "relacionamentos", "controle", "suporte_chefia", 
                        "suporte_colegas", "cargo", "comunicacao_mudancas"];
    dimensions.forEach(d => {
      const val = parseInt(answers[d]) || 0;
      dimensionsScore[d] = {
        score: val,
        risk_color: val > 50 ? "vermelho" : val > 20 ? "amarelo" : "verde"
      };
      totalScore += val;
    });
    totalScore = Math.round(totalScore / dimensions.length);
  }

  const riskLevel = totalScore > 50 ? "alto" : totalScore > 30 ? "medio" : "baixo";

  return {
    risk_level: riskLevel,
    form_type: formType,
    total_score: totalScore,
    dimensions_score: dimensionsScore,
    analysis_text: "Análise gerada automaticamente. Configure um prompt de IA personalizado para análises mais detalhadas.",
    risk_inventory: [],
    conclusion: "Relatório gerado sem análise de IA. Configure as chaves de API ou prompts para análises completas.",
    recommendations: ["Configure um prompt de IA ativo para gerar recomendações personalizadas."]
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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // === AUTHORIZATION CHECK ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userRole } = await userClient.from("user_roles").select("role").eq("user_id", user.id).single();
    const isAdmin = userRole?.role === "admin_hc" || userRole?.role === "super_admin";
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required to trigger AI analysis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authorized:", user.id, "Role:", userRole?.role);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch submission with form data
    const { data: submission, error: fetchError } = await supabase
      .from("submissions")
      .select("*, forms(*)")
      .eq("id", submissionId)
      .single();

    if (fetchError || !submission) {
      console.error("Error fetching submission:", fetchError);
      return new Response(
        JSON.stringify({ error: "Submission not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formType = submission.forms?.type || "ergos";
    let systemPrompt = MASTER_PROMPT;
    let modelToUse = "google/gemini-2.5-flash";
    let providerToUse = "lovable";

    // Fetch active prompt from database
    const { data: customPrompt, error: promptError } = await supabase
      .from("ai_prompts")
      .select("system_prompt, model, provider, temperature, max_tokens")
      .eq("form_type", formType)
      .eq("is_active", true)
      .maybeSingle();

    if (customPrompt && !promptError) {
      console.log("Using custom prompt for form type:", formType);
      systemPrompt = customPrompt.system_prompt;
      modelToUse = customPrompt.model || modelToUse;
      providerToUse = customPrompt.provider || providerToUse;
    } else {
      console.log("Using default MASTER_PROMPT for form type:", formType);
    }

    // Get API keys from system_settings
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY"]);

    const apiKeys: Record<string, string> = {};
    settingsData?.forEach(s => {
      if (s.value) apiKeys[s.key] = s.value;
    });

    console.log("Analyzing submission:", submissionId);
    console.log("Provider:", providerToUse, "Model:", modelToUse);

    const formTitle = submission.forms?.title || "Formulário";
    const answers = submission.answers;
    const respondentData = submission.respondent_data || {};

    const userPrompt = `# DADOS DO COLABORADOR
- Nome: ${respondentData.full_name || respondentData.nome || "Não informado"}
- Função: ${respondentData.job_title || respondentData.cargo || "Não informado"}
- Setor: ${respondentData.department || respondentData.setor || "Não informado"}
- Empresa: Amaggi

# FORMULÁRIO
- Título: ${formTitle}
- Tipo: ${formType}

# RESPOSTAS DO QUESTIONÁRIO
${JSON.stringify(answers, null, 2)}

Analise estas respostas e gere o relatório técnico completo conforme as instruções do sistema.`;

    let analysisResult;
    let aiContent: string | null = null;

    try {
      // Try to call the appropriate AI provider
      switch (providerToUse) {
        case "lovable":
          if (lovableApiKey) {
            aiContent = await callLovableAI(systemPrompt, userPrompt, modelToUse, lovableApiKey);
          }
          break;
        case "openai":
          if (apiKeys["OPENAI_API_KEY"]) {
            aiContent = await callOpenAI(systemPrompt, userPrompt, modelToUse, apiKeys["OPENAI_API_KEY"]);
          } else {
            console.log("OpenAI API key not configured, falling back to Lovable AI");
            if (lovableApiKey) {
              aiContent = await callLovableAI(systemPrompt, userPrompt, "google/gemini-2.5-flash", lovableApiKey);
            }
          }
          break;
        case "anthropic":
          if (apiKeys["ANTHROPIC_API_KEY"]) {
            aiContent = await callAnthropic(systemPrompt, userPrompt, modelToUse, apiKeys["ANTHROPIC_API_KEY"]);
          } else {
            console.log("Anthropic API key not configured, falling back to Lovable AI");
            if (lovableApiKey) {
              aiContent = await callLovableAI(systemPrompt, userPrompt, "google/gemini-2.5-flash", lovableApiKey);
            }
          }
          break;
        case "deepseek":
          if (apiKeys["DEEPSEEK_API_KEY"]) {
            aiContent = await callDeepSeek(systemPrompt, userPrompt, modelToUse, apiKeys["DEEPSEEK_API_KEY"]);
          } else {
            console.log("DeepSeek API key not configured, falling back to Lovable AI");
            if (lovableApiKey) {
              aiContent = await callLovableAI(systemPrompt, userPrompt, "google/gemini-2.5-flash", lovableApiKey);
            }
          }
          break;
      }

      if (aiContent) {
        console.log("AI Response received, parsing JSON...");
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("Could not parse AI response as JSON");
        }
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        console.log("No AI response, generating fallback analysis");
        analysisResult = generateFallbackAnalysis(formType, answers);
      }
    } catch (aiError) {
      console.error("AI call failed:", aiError);
      analysisResult = generateFallbackAnalysis(formType, answers);
    }

    // Create report in database
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

    if (reportError) {
      console.error("Error creating report:", reportError);
      throw reportError;
    }

    // Update submission status
    await supabase
      .from("submissions")
      .update({ status: "processed" })
      .eq("id", submissionId);

    console.log("Report created successfully:", report.id);

    return new Response(
      JSON.stringify({ success: true, reportId: report.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-submission:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
