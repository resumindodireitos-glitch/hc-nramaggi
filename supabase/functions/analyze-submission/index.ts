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

## 4. TIPIFICAÇÃO DE EXPOSIÇÃO
- Habitual: Exposição regular durante jornada
- Permanente: Exposição contínua durante toda jornada
- Intermitente: Exposição em períodos alternados
- Eventual: Exposição esporádica

## 5. TEXTOS PADRÃO POR DIMENSÃO

### ERGOS - Textos por Fator:

**Monotonia (score >= 6):**
"Na dimensão monotonia foi identificado tarefas repetitivas e baixa diversidade nas tarefas, recomendando enriquecimento de funções, rodízio de atividades e maior diversidade de tarefas conforme princípios da NR-17 e da ISO 10075-1."

**Isolamento (score >= 6):**
"Na dimensão isolamento foi identificada percepção de baixo contato interpessoal. Recomenda-se manter maior integração entre colegas e espaços de interação coletiva, conforme diretrizes da ISO 45003."

**Pressão de tempo (score >= 6):**
"Na dimensão pressão de tempo, o resultado indica que os prazos e a intensidade de execução das atividades poderão ser melhor gerenciados, conforme ISO 10075-1 e NR-17."

**Raciocínio e processos centrais (score >= 6):**
"Na dimensão raciocínio e processos centrais foi identificado nível médio para tomada de decisões e memorização de processos de trabalho, conforme orientações da ISO 10075."

**Complexidade (score >= 6):**
"Na dimensão complexidade foi identificada exigência cognitiva elevada. Recomenda-se adequação entre as exigências da tarefa e a capacidade do trabalhador."

**Iniciativa (score >= 6):**
"Na dimensão iniciativa foi identificado nível de autonomia reduzido, detectando diminuição de participação ativa nas tomadas de decisões, aspecto apresentado para ajustes conforme ISO 45003."

### HSE-IT - Textos por Dimensão:

**Demandas (>= 20%):**
"Na dimensão demandas foram identificados aspectos relacionados à carga de trabalho, prazos ou volume de tarefas que podem estar diferentes da capacidade adaptativa esperada, recomendando monitoramento e ajustes na redistribuição de atividades, seguindo orientações da ISO 10075-1 (Fatores Humanos – Carga Mental de Trabalho)."

**Controle (>= 20%):**
"Na dimensão controle foi identificado nível médio detectando diminuição de participação ativa nas tomadas de decisões e autonomia no processo de trabalho, aspecto apresentado para ajustes na ISO 45003."

**Suporte/apoio da chefia (>= 20%):**
"Na dimensão suporte/apoio da chefia foram identificadas fragilidades no apoio por parte dos superiores e nos recursos fornecidos para resolver problemas, recomendando fortalecimento do suporte gerencial conforme ISO 45003."

**Suporte/apoio dos colegas (>= 20%):**
"Na dimensão apoio de colegas foi identificada fragilidade na cooperação interpessoal e no suporte social entre colegas de trabalho, apontando possíveis conflitos ou isolamento nas atividades laborais, recomendando fortalecimento do clima organizacional e incentivo ao trabalho em equipe, conforme diretrizes da ISO 45003."

**Relacionamentos (>= 20%):**
"Na dimensão relacionamentos foram identificados aspectos relacionados a comportamentos interpessoais que necessitam atenção, recomendando fortalecimento das relações e prevenção de conflitos conforme ISO 45003."

**Cargo (>= 20%):**
"Na dimensão cargo foram identificadas fragilidades quanto à transparência nos critérios de promoção e reconhecimento profissional."

**Comunicação e mudanças (>= 20%):**
"Na dimensão comunicação e mudanças foram identificadas fragilidades na participação dos trabalhadores em processos de mudança organizacional."

## 6. MEDIDAS DE CONTROLE PADRÃO
Para QUALQUER risco identificado (NRE >= 2), a medida padrão é:
"Manter e monitorar ações aplicáveis constantes no portfólio CULTURA DE CUIDADO - Saúde Mental e Qualidade de Vida na AMAGGI."

## 7. TEXTO DE RESULTADO SEM RISCO (0% ou score baixo)
"A aplicação do instrumento resultou em condições psicossociais adequadas, não havendo evidências de sobrecarga, desequilíbrio no suporte organizacional ou conflitos interpessoais que possam comprometer a atividade laboral. Reforça-se monitoramento dos fatores conforme diretrizes NR-1, anexo 2, para manutenção de um ambiente de trabalho em conformidade."

---

# INSTRUÇÕES DE PROCESSAMENTO

1. **Identifique o tipo de formulário:**
   - Se contém campos como "pressao_tempo", "atencao", "monotonia" → ERGOS (operacional)
   - Se contém campos como "demandas", "relacionamentos", "controle" → HSE-IT (administrativo)

2. **Para ERGOS:**
   - Calcule a soma da Tabela A (pressao_tempo + atencao + complexidade + monotonia + raciocinio)
   - Calcule a soma da Tabela B (iniciativa + isolamento + horarios_turnos + relacionamentos + demandas_gerais)
   - Pontuação Total ≈ (Tabela_A + Tabela_B) * 0.83
   - Identifique fatores com score >= 6 como pontos de atenção
   - Gere o texto de interpretação baseado nos resultados

3. **Para HSE-IT:**
   - Analise cada dimensão em percentual
   - Identifique dimensões com >= 20% como pontos de atenção
   - Gere o texto de interpretação baseado nos resultados

4. **Gere o Inventário de Riscos:**
   - Para cada fator de risco identificado (score alto):
     - Determine G, P, C baseado na severidade do score
     - Calcule NRE = G × P × C
     - Classifique o NRE
     - Atribua a medida de controle padrão

5. **Monte a Conclusão:**
   - Se todos os fatores estão adequados: use texto padrão de conformidade
   - Se há riscos identificados: liste as dimensões e recomendações específicas

# FORMATO DE SAÍDA (JSON ESTRITO)

Retorne APENAS este JSON, sem markdown:

{
  "risk_level": "baixo" | "medio" | "alto",
  "form_type": "ergos" | "hse_it",
  "total_score": 00.00,
  "dimensions_score": {
    "dimensao1": { "score": 0, "risk_color": "verde" | "amarelo" | "vermelho" },
    "dimensao2": { "score": 0, "risk_color": "verde" | "amarelo" | "vermelho" }
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

    // Verify user has access via RLS
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

    // Check if user is admin (only admins can trigger AI analysis)
    const { data: userRole } = await userClient.from("user_roles").select("role").eq("user_id", user.id).single();
    const isAdmin = userRole?.role === "admin_hc" || userRole?.role === "super_admin";
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required to trigger AI analysis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User authorized:", user.id, "Role:", userRole?.role);
    // === END AUTHORIZATION CHECK ===

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

    // Determine form type and fetch active prompt from database
    const formType = submission.forms?.type || "ergos";
    let systemPrompt = MASTER_PROMPT;
    let modelToUse = "google/gemini-2.5-flash";

    // Try to fetch custom prompt from ai_prompts table
    const { data: customPrompt, error: promptError } = await supabase
      .from("ai_prompts")
      .select("system_prompt, model, temperature, max_tokens")
      .eq("form_type", formType)
      .eq("is_active", true)
      .maybeSingle();

    if (customPrompt && !promptError) {
      console.log("Using custom prompt for form type:", formType);
      systemPrompt = customPrompt.system_prompt;
      modelToUse = customPrompt.model || modelToUse;
    } else {
      console.log("Using default MASTER_PROMPT for form type:", formType);
    }

    console.log("Analyzing submission:", submissionId);
    console.log("Form type:", submission.forms?.type);
    console.log("Answers:", JSON.stringify(submission.answers));

    // Build context for AI analysis
    const formTitle = submission.forms?.title || "Formulário";
    const answers = submission.answers;
    const respondentData = submission.respondent_data || {};

    const userPrompt = `# DADOS DO COLABORADOR
- Nome: ${respondentData.full_name || "Não informado"}
- Função: ${respondentData.job_title || "Não informado"}
- Setor: ${respondentData.department || "Não informado"}
- Empresa: ${respondentData.company || "Amaggi"}

# FORMULÁRIO
- Título: ${formTitle}
- Tipo: ${formType}

# RESPOSTAS DO QUESTIONÁRIO
${JSON.stringify(answers, null, 2)}

Analise estas respostas e gere o relatório técnico completo conforme as instruções do sistema.`;

    let analysisResult;

    if (lovableApiKey) {
      // Use Lovable AI Gateway
      console.log("Calling Lovable AI Gateway with model:", modelToUse);
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required. Please add credits to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content;
      
      console.log("AI Response content:", content);

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse AI response as JSON");
      }
      analysisResult = JSON.parse(jsonMatch[0]);
    } else {
      // Fallback: Generate a basic report without AI
      console.log("No AI API key configured, generating basic report");
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

// Fallback analysis when AI is not available
function generateFallbackAnalysis(formType: string, answers: Record<string, any>) {
  if (formType === "ergos") {
    // Calculate ERGOS scores
    const tabelaA = (answers.pressao_tempo || 0) + (answers.atencao || 0) + 
                    (answers.complexidade || 0) + (answers.monotonia || 0) + 
                    (answers.raciocinio || 0);
    const tabelaB = (answers.iniciativa || 0) + (answers.isolamento || 0) + 
                    (answers.horarios_turnos || 0) + (answers.relacionamentos || 0) + 
                    (answers.demandas_gerais || 0);
    const totalScore = (tabelaA + tabelaB) * 0.83;
    
    const riskLevel = totalScore <= 30 ? "baixo" : totalScore <= 50 ? "medio" : "alto";

    return {
      risk_level: riskLevel,
      form_type: "ergos",
      total_score: Math.round(totalScore * 100) / 100,
      dimensions_score: {
        "Tabela A (Cognitivos)": { score: tabelaA, risk_color: tabelaA > 25 ? "vermelho" : tabelaA > 15 ? "amarelo" : "verde" },
        "Tabela B (Organizacionais)": { score: tabelaB, risk_color: tabelaB > 25 ? "vermelho" : tabelaB > 15 ? "amarelo" : "verde" },
      },
      analysis_text: `Após aplicação do ERGOS, o resultado total foi de ${totalScore.toFixed(2)} pontos. Análise automática baseada nas respostas fornecidas. Recomenda-se revisão manual por especialista em Ergonomia.`,
      conclusion: "Os dados indicam necessidade de avaliação mais detalhada por profissional de saúde ocupacional.",
      recommendations: [
        "Realizar avaliação ergonômica presencial",
        "Verificar condições do posto de trabalho",
        "Monitorar ações do portfólio CULTURA DE CUIDADO - Saúde Mental e Qualidade de Vida na AMAGGI",
      ],
    };
  } else {
    // HSE-IT fallback
    const dimensions = ["demandas", "relacionamentos", "controle", "apoio_chefia", "apoio_colegas", "cargo", "comunicacao_mudancas"];
    const scores: Record<string, { score: number; risk_color: string }> = {};
    let maxScore = 0;

    dimensions.forEach(dim => {
      const score = answers[dim] || 0;
      scores[dim] = {
        score,
        risk_color: score > 50 ? "vermelho" : score > 20 ? "amarelo" : "verde"
      };
      if (score > maxScore) maxScore = score;
    });

    const riskLevel = maxScore > 50 ? "alto" : maxScore > 20 ? "medio" : "baixo";

    return {
      risk_level: riskLevel,
      form_type: "hse_it",
      total_score: maxScore,
      dimensions_score: scores,
      analysis_text: `Análise automática do HSE-IT. O maior percentual de fatores estressores identificado foi de ${maxScore}%. Recomenda-se revisão manual por especialista.`,
      conclusion: "Os dados indicam necessidade de avaliação mais detalhada por profissional de saúde ocupacional.",
      recommendations: [
        "Realizar avaliação ergonômica presencial",
        "Verificar condições psicossociais do ambiente de trabalho",
        "Monitorar ações do portfólio CULTURA DE CUIDADO - Saúde Mental e Qualidade de Vida na AMAGGI",
      ],
    };
  }
}
