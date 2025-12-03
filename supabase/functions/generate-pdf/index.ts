import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString("pt-BR");
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function getNRELabel(nre: number): string {
  if (nre === 1) return "Trivial";
  if (nre <= 3) return "Tolerável";
  if (nre <= 9) return "Moderado";
  if (nre <= 18) return "Substancial";
  return "Intolerável";
}

function getNREClass(nre: number): string {
  if (nre === 1) return "trivial";
  if (nre <= 3) return "toleravel";
  if (nre <= 9) return "moderado";
  if (nre <= 18) return "substancial";
  return "intoleravel";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId } = await req.json();

    if (!reportId) {
      throw new Error("reportId é obrigatório");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { data: reportAccess, error: accessError } = await userClient
      .from("reports")
      .select("id")
      .eq("id", reportId)
      .single();

    if (accessError || !reportAccess) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: You don't have access to this report" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("*, submissions(*, forms(*), employees(*, job_roles(*, departments(*))))")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      throw new Error("Relatório não encontrado");
    }

    const submission = report.submissions;
    const form = submission?.forms;
    const employee = submission?.employees;
    const jobRole = employee?.job_roles;
    const department = jobRole?.departments;
    const respondentData = submission?.respondent_data || {};
    const answers = submission?.answers || {};
    const dimensionsScore = report.dimensions_score || {};

    // Extract data
    const respondentName = escapeHtml((respondentData as any).full_name || employee?.name) || "Não informado";
    const respondentDept = escapeHtml((respondentData as any).department || department?.name) || "Não informado";
    const respondentJob = escapeHtml((respondentData as any).job_title || jobRole?.name) || "Não informado";
    const respondentCompany = escapeHtml((respondentData as any).company) || "Amaggi";
    const reportDate = formatDate(report.created_at);
    const formType = form?.type || "ergos";
    const analysisText = escapeHtml(report.final_text_override || report.ai_analysis_text) || "";
    const conclusionText = escapeHtml(report.ai_conclusion) || "";
    const riskLevel = escapeHtml(report.risk_level) || "baixo";

    // Generate ERGOS or HSE-IT specific content
    const isErgos = formType === "ergos";
    const toolName = isErgos ? "ERGOS" : "HSE-IT";
    const toolDescription = isErgos 
      ? "Ferramenta de Avaliação de Carga Mental" 
      : "Health Safety Executive - Indicator Tool";

    // Build dimensions table
    let dimensionsHtml = "";
    if (isErgos) {
      const blocoA = ["pressao_tempo", "atencao", "complexidade", "monotonia", "raciocinio"];
      const blocoB = ["iniciativa", "isolamento", "horarios_turnos", "relacionamentos", "demandas_gerais"];
      const labelMap: Record<string, string> = {
        pressao_tempo: "Pressão de Tempo",
        atencao: "Atenção",
        complexidade: "Complexidade",
        monotonia: "Monotonia",
        raciocinio: "Raciocínio e Processos Centrais",
        iniciativa: "Iniciativa",
        isolamento: "Isolamento",
        horarios_turnos: "Horários e Turnos de Trabalho",
        relacionamentos: "Relacionamentos no Trabalho",
        demandas_gerais: "Demandas Gerais"
      };

      let somaA = 0, somaB = 0;
      blocoA.forEach(k => { somaA += Number((dimensionsScore as any)[k]?.score || 0); });
      blocoB.forEach(k => { somaB += Number((dimensionsScore as any)[k]?.score || 0); });
      const pontuacaoTotal = (somaA + somaB) * 0.83;

      dimensionsHtml = `
        <table class="dimensions-table">
          <thead>
            <tr>
              <th colspan="2" style="background: #228B22; color: white;">ERGOS (AVALIAÇÃO DE CARGA MENTAL)</th>
            </tr>
            <tr>
              <th>Fatores Cognitivos</th>
              <th>Pontuação</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(labelMap).map(([key, label]) => {
              const score = (dimensionsScore as any)[key]?.score || (answers as any)[key] || 0;
              return `<tr><td>${label}</td><td class="score">${score}</td></tr>`;
            }).join('')}
            <tr class="total-row">
              <td>Tabela A</td>
              <td class="score">${somaA}</td>
            </tr>
            <tr class="total-row">
              <td>Tabela B</td>
              <td class="score">${somaB}</td>
            </tr>
            <tr class="total-row final">
              <td><strong>Pontuação Total da Carga Mental</strong></td>
              <td class="score"><strong>${pontuacaoTotal.toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>
      `;
    } else {
      const dimensionLabels: Record<string, string> = {
        demandas: "Demandas",
        relacionamentos: "Relacionamentos",
        controle: "Controle",
        apoio_chefia: "Suporte/Apoio da Chefia",
        apoio_colegas: "Suporte/Apoio dos Colegas",
        cargo: "Cargo",
        comunicacao_mudancas: "Comunicação e Mudanças"
      };

      dimensionsHtml = `
        <table class="dimensions-table">
          <thead>
            <tr>
              <th colspan="2" style="background: #228B22; color: white;">HSE-IT (ESTRESSE RELACIONADO AO TRABALHO)</th>
            </tr>
            <tr>
              <th>Dimensão</th>
              <th>Distribuição do resultado por fator de estresse</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(dimensionLabels).map(([key, label]) => {
              const data = (dimensionsScore as any)[key];
              const score = data?.score || (answers as any)[key] || 0;
              return `<tr><td>${label}</td><td class="score">${score}%</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    // Build risk inventory from analysis
    let riskInventoryHtml = "";
    const recommendations = report.ai_recommendations || [];

    // Generate HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>AET - Análise Ergonômica do Trabalho - Riscos Psicossociais</title>
  <style>
    @page { size: A4; margin: 2cm; }
    * { box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      margin: 0; 
      padding: 20px;
      color: #333; 
      font-size: 11pt;
      line-height: 1.5;
    }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #228B22;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header-left { flex: 1; }
    .header-right { text-align: right; font-size: 9pt; color: #666; }
    .logo { font-size: 20px; font-weight: bold; color: #228B22; }
    .subtitle { font-size: 14px; color: #333; margin-top: 5px; }
    
    /* Section styles */
    .section { margin: 20px 0; }
    .section-title {
      font-size: 14pt;
      font-weight: bold;
      color: #228B22;
      background: linear-gradient(90deg, #f0f9f0 0%, transparent 100%);
      padding: 8px 12px;
      border-left: 4px solid #228B22;
      margin-bottom: 15px;
    }
    
    /* Info box */
    .info-box {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .info-item { padding: 8px; }
    .info-label { font-size: 10pt; color: #666; font-weight: 500; }
    .info-value { font-size: 11pt; font-weight: bold; margin-top: 2px; }
    
    /* Tables */
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; font-size: 10pt; }
    td.score { text-align: center; font-weight: bold; }
    .total-row { background: #f0f9f0; }
    .total-row.final { background: #228B22; color: white; }
    
    /* Risk badges */
    .risk-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 15px;
      font-weight: bold;
      font-size: 10pt;
      text-transform: uppercase;
    }
    .risk-baixo, .risk-trivial, .risk-toleravel { background: #dcfce7; color: #16a34a; }
    .risk-medio, .risk-moderado { background: #fef3c7; color: #d97706; }
    .risk-alto, .risk-substancial { background: #fed7aa; color: #ea580c; }
    .risk-critico, .risk-intoleravel { background: #fee2e2; color: #dc2626; }
    
    /* Analysis text */
    .analysis-box {
      background: #fafafa;
      border-left: 4px solid #228B22;
      padding: 15px;
      margin: 15px 0;
      text-align: justify;
    }
    
    /* Inventory table */
    .inventory-table th { background: #228B22; color: white; font-size: 9pt; }
    .inventory-table td { font-size: 9pt; vertical-align: top; }
    
    /* Recommendations */
    .recommendation {
      padding: 10px 15px;
      margin: 8px 0;
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      font-size: 10pt;
    }
    
    /* Conclusion */
    .conclusion-box {
      background: #ecfdf5;
      border: 2px solid #228B22;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    
    /* Footer */
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #228B22;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
    .footer .confidential { color: #dc2626; font-weight: bold; }
    
    /* Signature area */
    .signature-area {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 45%;
      text-align: center;
      padding-top: 60px;
      border-top: 1px solid #333;
    }
  </style>
</head>
<body>
  <!-- Page 1: Cover and Info -->
  <div class="page">
    <div class="header">
      <div class="header-left">
        <div class="logo">AET – NR17</div>
        <div class="subtitle">Análise Ergonômica do Trabalho: Fatores de Risco Psicossociais</div>
      </div>
      <div class="header-right">
        HC – Consultoria em Ergonomia<br>
        ERGO MT
      </div>
    </div>

    <div class="section">
      <div class="section-title">AEP/AET ANÁLISE ERGONÔMICA DO TRABALHO – RISCOS PSICOSSOCIAIS</div>
      
      <div class="info-box">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Setor</div>
            <div class="info-value">${respondentDept}</div>
          </div>
          <div class="info-item">
            <div class="info-label">População Exposta (função)</div>
            <div class="info-value">${respondentJob}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Colaborador</div>
            <div class="info-value">${respondentName}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Empresa</div>
            <div class="info-value">${respondentCompany}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Data da Avaliação</div>
            <div class="info-value">${reportDate}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Tipo de Avaliação</div>
            <div class="info-value">${toolName} (${isErgos ? "Operacional" : "Administrativo"})</div>
          </div>
          <div class="info-item">
            <div class="info-label">Nível de Risco</div>
            <div class="info-value">
              <span class="risk-badge risk-${riskLevel}">${riskLevel.toUpperCase()}</span>
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Status</div>
            <div class="info-value">${report.is_approved ? "✓ Aprovado" : "Pendente Revisão"}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">AVALIAÇÃO DA CARGA MENTAL (FATORES COGNITIVOS E ORGANIZACIONAIS)</div>
      ${dimensionsHtml}
    </div>

    <div class="section">
      <div class="section-title">INTERPRETAÇÃO DOS RESULTADOS</div>
      <div class="analysis-box">
        ${analysisText || "Análise em processamento..."}
      </div>
    </div>
  </div>

  <!-- Page 2: Risk Inventory and Conclusion -->
  <div class="page">
    <div class="header">
      <div class="header-left">
        <div class="logo">AET – NR17</div>
        <div class="subtitle">Análise Ergonômica do Trabalho: Fatores de Risco Psicossociais</div>
      </div>
      <div class="header-right">
        HC – Consultoria em Ergonomia<br>
        ${respondentJob}
      </div>
    </div>

    <div class="section">
      <div class="section-title">INVENTÁRIO DE RISCOS PSICOSSOCIAIS</div>
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Nominação da Atividade</th>
            <th>Perigo ou Fator de Risco</th>
            <th>Lesões ou Agravos</th>
            <th>Exposição</th>
            <th>G</th>
            <th>P</th>
            <th>C</th>
            <th>NRE</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Atividade laboral na função de ${respondentJob}</td>
            <td>${riskLevel === "baixo" ? "Nenhum risco significativo identificado" : "Fatores psicossociais identificados"}</td>
            <td>Transtornos relacionados à saúde mental</td>
            <td>Habitual</td>
            <td class="score">${riskLevel === "baixo" ? "1" : riskLevel === "medio" ? "2" : "3"}</td>
            <td class="score">1</td>
            <td class="score">1</td>
            <td class="score"><span class="risk-badge risk-${riskLevel === "baixo" ? "toleravel" : riskLevel === "medio" ? "moderado" : "substancial"}">${riskLevel === "baixo" ? "2" : riskLevel === "medio" ? "4" : "9"}</span></td>
            <td>Manter e monitorar ações aplicáveis constantes no portfólio CULTURA DE CUIDADO</td>
          </tr>
        </tbody>
      </table>
      
      <p style="font-size: 9pt; color: #666;">
        <strong>Legendas:</strong> (G) Gravidade; (P) Probabilidade; (C) Controle; (NRE) Nível de Risco Ergonômico Psicossocial<br>
        <strong>Classificação NRE:</strong> Trivial (1) | Tolerável (2 a 3) | Moderado (4 a 9) | Substancial (12 a 18) | Intolerável (27)
      </p>
    </div>

    ${recommendations.length > 0 ? `
    <div class="section">
      <div class="section-title">RECOMENDAÇÕES</div>
      ${recommendations.map((rec: string, i: number) => `
        <div class="recommendation">
          <strong>${i + 1}.</strong> ${escapeHtml(rec)}
        </div>
      `).join("")}
    </div>
    ` : ""}

    ${conclusionText ? `
    <div class="section">
      <div class="section-title">CONCLUSÃO</div>
      <div class="conclusion-box">
        ${conclusionText}
      </div>
    </div>
    ` : ""}

    <div class="signature-area">
      <div class="signature-box">
        <strong>Responsável Técnico</strong><br>
        Andre Luiz Lopes de Oliveira<br>
        Fisioterapeuta – Consultor em Ergonomia<br>
        CREFITO-9 26.465-F
      </div>
      <div class="signature-box">
        <strong>Representante da Empresa</strong><br>
        ${respondentCompany}
      </div>
    </div>

    <div class="footer">
      <p class="confidential">CONFIDENCIAL - Este documento contém informações sensíveis de saúde ocupacional.</p>
      <p><strong>Referências Normativas:</strong> NR-01, NR-17, ISO 10075-1, ISO 45003, ISO 31000</p>
      <p>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
      <p>Rua das Hortencias, 156 Jardim Cuiabá – CEP 78.048-156 Cuiabá/MT</p>
    </div>
  </div>
</body>
</html>
    `;

    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(htmlContent);
    const base64 = btoa(String.fromCharCode(...htmlBytes));

    console.log(`PDF generated for report ${reportId}`);

    return new Response(
      JSON.stringify({ 
        pdf: base64,
        contentType: "text/html",
        filename: `AET-${respondentJob.replace(/\s+/g, "-")}-${reportDate.replace(/\//g, "-")}.html`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating PDF:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
