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

function getInterpretacaoERGOS(pontuacao: number): string {
  if (pontuacao <= 30) {
    return "As condições de trabalho são adequadas e não existe nenhum risco em potencial. Situação satisfatória para exercício da atividade laboral.";
  } else if (pontuacao <= 60) {
    return "As condições de trabalho estão dentro dos padrões e segurança aceitáveis internacionalmente. É improvável que afetem a saúde. Porém, recomenda-se manter o controle sistemático dessas condições.";
  } else {
    return "São necessárias medidas corretivas para reduzir os riscos e proteger a saúde e qualidade de vida dos trabalhadores.";
  }
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
      .select("*, submissions(*, forms(*), employees(*, job_roles(*, departments(*, farms(*)))))")
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
    const farm = department?.farms;
    const respondentData = (submission?.respondent_data || {}) as Record<string, string>;
    const answers = (submission?.answers || {}) as Record<string, number | string>;
    const dimensionsScore = (report.dimensions_score || {}) as Record<string, { score: number; risk_color?: string }>;

    console.log("Respondent data:", JSON.stringify(respondentData));
    console.log("Answers:", JSON.stringify(answers));
    console.log("Dimensions score:", JSON.stringify(dimensionsScore));

    // Extract data - check multiple field name variations
    const respondentName = escapeHtml(
      respondentData.nome || 
      respondentData.full_name || 
      respondentData.name ||
      employee?.name
    ) || "Não informado";
    
    const respondentDept = escapeHtml(
      respondentData.setor || 
      respondentData.department || 
      respondentData.departamento ||
      department?.name
    ) || "Não informado";
    
    const respondentJob = escapeHtml(
      respondentData.cargo || 
      respondentData.job_title || 
      respondentData.funcao ||
      jobRole?.name
    ) || "Não informado";
    
    const respondentCompany = escapeHtml(
      respondentData.empresa || 
      respondentData.company
    ) || "Amaggi";
    
    const farmName = escapeHtml(
      farm?.name || 
      respondentData.fazenda || 
      respondentData.unidade
    ) || "Sede";
    
    const reportDate = formatDate(report.created_at);
    const evaluationDate = formatDate(respondentData.data_avaliacao || report.created_at);
    const formType = form?.type || "ergos";
    const analysisText = escapeHtml(report.final_text_override || report.ai_analysis_text) || "";
    const conclusionText = escapeHtml(report.ai_conclusion) || "";
    const recommendations = report.ai_recommendations || [];
    
    const gender = escapeHtml(
      respondentData.genero || 
      respondentData.sexo ||
      respondentData.gender
    ) || "Não informado";
    
    const tenure = escapeHtml(
      respondentData.tempo_empresa || 
      respondentData.tempo_funcao ||
      respondentData.tenure
    ) || "Não informado";

    const isErgos = formType === "ergos";
    const toolName = isErgos ? "ERGOS" : "HSE-IT";

    // Build ERGOS dimensions
    let ergosTableHtml = "";
    let pontuacaoTotal = 0;
    let somaA = 0;
    let somaB = 0;

    if (isErgos) {
      const blocoALabels: Record<string, string> = {
        pressao_tempo: "Pressão de tempo",
        atencao: "Atenção",
        complexidade: "Complexidade",
        monotonia: "Monotonia",
        raciocinio: "Raciocínio e processos centrais"
      };
      const blocoBLabels: Record<string, string> = {
        iniciativa: "Iniciativa",
        isolamento: "Isolamento",
        horarios_turnos: "Horários e turnos de trabalho",
        relacionamentos: "Relacionamentos no trabalho",
        demandas_gerais: "Demandas gerais"
      };

      let rowsA = "";
      let rowsB = "";

      Object.entries(blocoALabels).forEach(([key, label]) => {
        const score = Number((dimensionsScore as any)[key]?.score ?? (answers as any)[key] ?? 0);
        somaA += score;
        rowsA += `<tr><td>${label}</td><td class="score">${score}</td></tr>`;
      });

      Object.entries(blocoBLabels).forEach(([key, label]) => {
        const score = Number((dimensionsScore as any)[key]?.score ?? (answers as any)[key] ?? 0);
        somaB += score;
        rowsB += `<tr><td>${label}</td><td class="score">${score}</td></tr>`;
      });

      pontuacaoTotal = (somaA + somaB) * 0.83;

      ergosTableHtml = `
        <table class="ergos-table">
          <thead>
            <tr>
              <th colspan="2" class="section-header">ERGOS (AVALIAÇÃO DE CARGA MENTAL)</th>
            </tr>
          </thead>
          <tbody>
            <tr class="subheader">
              <td colspan="2"><strong>Fatores Cognitivos (Bloco A)</strong></td>
            </tr>
            ${rowsA}
            <tr class="subtotal">
              <td><strong>Tabela A</strong></td>
              <td class="score"><strong>${somaA}</strong></td>
            </tr>
            <tr class="subheader">
              <td colspan="2"><strong>Fatores Organizacionais (Bloco B)</strong></td>
            </tr>
            ${rowsB}
            <tr class="subtotal">
              <td><strong>Tabela B</strong></td>
              <td class="score"><strong>${somaB}</strong></td>
            </tr>
            <tr class="total">
              <td><strong>Pontuação total da carga mental</strong></td>
              <td class="score"><strong>${pontuacaoTotal.toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>
      `;
    }

    // Build HSE-IT dimensions
    let hseitTableHtml = "";
    if (!isErgos) {
      const hseitLabels: Record<string, string> = {
        demandas: "Demandas",
        relacionamentos: "Relacionamentos",
        controle: "Controle",
        apoio_chefia: "Apoio da chefia",
        apoio_colegas: "Apoio dos colegas",
        cargo: "Cargo",
        comunicacao_mudancas: "Comunicação e mudanças"
      };

      let rows = "";
      Object.entries(hseitLabels).forEach(([key, label]) => {
        const score = Number((dimensionsScore as any)[key]?.score ?? (answers as any)[key] ?? 0);
        const barWidth = Math.min(100, score);
        const barColor = score <= 15 ? '#22c55e' : score <= 30 ? '#f59e0b' : '#ef4444';
        rows += `
          <tr>
            <td>${label}</td>
            <td class="bar-cell">
              <div class="bar-container">
                <div class="bar" style="width: ${barWidth}%; background-color: ${barColor};"></div>
              </div>
              <span class="bar-value">${score}%</span>
            </td>
          </tr>
        `;
      });

      hseitTableHtml = `
        <table class="hseit-table">
          <thead>
            <tr>
              <th colspan="2" class="section-header">HSE-IT (ESTRESSE RELACIONADO AO TRABALHO)</th>
            </tr>
            <tr>
              <th>Dimensão</th>
              <th>Distribuição do resultado por fator de estresse</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }

    // Build risk inventory
    const riskLevel = report.risk_level || "baixo";
    const nreValue = riskLevel === "baixo" ? 3 : riskLevel === "medio" ? 6 : riskLevel === "alto" ? 12 : 18;
    const gValue = riskLevel === "baixo" ? 1 : riskLevel === "medio" ? 2 : 3;

    // Identify risk factors from dimensions
    const riskFactors: Array<{factor: string, source: string, g: number, p: number, c: number, nre: number}> = [];
    
    if (isErgos) {
      const factorMapping: Record<string, string> = {
        pressao_tempo: "Pressão de tempo",
        atencao: "Atenção elevada",
        complexidade: "Complexidade",
        monotonia: "Monotonia",
        raciocinio: "Raciocínio e processos centrais",
        iniciativa: "Falta de iniciativa/autonomia",
        isolamento: "Isolamento",
        horarios_turnos: "Horários e turnos de trabalho",
        relacionamentos: "Relacionamentos no trabalho",
        demandas_gerais: "Demandas gerais"
      };

      Object.entries(factorMapping).forEach(([key, label]) => {
        const score = Number((dimensionsScore as any)[key]?.score ?? (answers as any)[key] ?? 0);
        if (score >= 6) {
          const g = score >= 8 ? 3 : 2;
          const p = 1;
          const c = 1;
          riskFactors.push({
            factor: label,
            source: `Pontuação ${score} na dimensão ${label.toLowerCase()}`,
            g, p, c,
            nre: g * p * c
          });
        }
      });
    } else {
      const hseitFactors: Record<string, string> = {
        demandas: "Demandas de trabalho",
        relacionamentos: "Relacionamentos interpessoais",
        controle: "Falta de controle",
        apoio_chefia: "Falta de apoio da chefia",
        apoio_colegas: "Falta de apoio dos colegas",
        cargo: "Clareza de cargo",
        comunicacao_mudancas: "Comunicação e mudanças"
      };

      Object.entries(hseitFactors).forEach(([key, label]) => {
        const score = Number((dimensionsScore as any)[key]?.score ?? (answers as any)[key] ?? 0);
        if (score >= 15) {
          const g = score >= 30 ? 3 : 2;
          const p = 1;
          const c = 1;
          riskFactors.push({
            factor: label,
            source: `${score}% na dimensão ${label.toLowerCase()}`,
            g, p, c,
            nre: g * p * c
          });
        }
      });
    }

    // If no specific risks, add a general entry
    if (riskFactors.length === 0) {
      riskFactors.push({
        factor: "Não identificado",
        source: "Sem exposição com significância",
        g: 1, p: 1, c: 1,
        nre: 1
      });
    }

    let inventoryRowsHtml = riskFactors.map(rf => `
      <tr>
        <td>Atividade laboral na função de ${respondentJob}</td>
        <td>${rf.factor}</td>
        <td>Transtornos relacionados à saúde mental</td>
        <td>${rf.source}</td>
        <td>Habitual</td>
        <td>Ações aplicáveis constantes no portfólio CULTURA DE CUIDADO</td>
        <td class="score">${rf.g}</td>
        <td class="score">${rf.p}</td>
        <td class="score">${rf.c}</td>
        <td class="score nre-${getNREClass(rf.nre)}">${rf.nre}</td>
        <td>Manter e monitorar ações aplicáveis</td>
      </tr>
    `).join('');

    // Build recommendations HTML
    let recommendationsHtml = "";
    if (recommendations.length > 0) {
      recommendationsHtml = `
        <div class="section">
          <h2 class="section-title">RECOMENDAÇÕES</h2>
          <ul class="recommendations-list">
            ${recommendations.map((rec: string) => `<li>${escapeHtml(rec)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Generate HTML with proper UTF-8 encoding
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>AET - Análise Ergonômica do Trabalho - Riscos Psicossociais</title>
  <style>
    @page { 
      size: A4; 
      margin: 1.5cm 2cm;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; }
      .no-break { page-break-inside: avoid; }
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body { 
      font-family: 'Segoe UI', 'Arial', sans-serif; 
      font-size: 10pt;
      line-height: 1.4;
      color: #333;
      background: white;
    }
    
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15px;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #005c42;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .header-left {
      display: flex;
      flex-direction: column;
    }
    .header-title {
      font-size: 14pt;
      font-weight: bold;
      color: #005c42;
    }
    .header-subtitle {
      font-size: 10pt;
      color: #666;
    }
    .header-right {
      text-align: right;
      font-size: 9pt;
      color: #666;
    }
    .header-right strong {
      color: #005c42;
    }
    
    /* Section styles */
    .section {
      margin: 15px 0;
    }
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      color: white;
      background: #005c42;
      padding: 8px 12px;
      margin-bottom: 10px;
    }
    
    /* Info table */
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .info-table th, .info-table td {
      border: 1px solid #ddd;
      padding: 6px 10px;
      text-align: left;
      font-size: 9pt;
    }
    .info-table th {
      background: #f5f5f5;
      font-weight: bold;
      width: 30%;
      color: #005c42;
    }
    
    /* ERGOS table */
    .ergos-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    .ergos-table th, .ergos-table td {
      border: 1px solid #ddd;
      padding: 6px 10px;
      font-size: 9pt;
    }
    .ergos-table .section-header {
      background: #005c42;
      color: white;
      text-align: center;
      font-weight: bold;
    }
    .ergos-table .subheader td {
      background: #e8f5e9;
      font-weight: bold;
    }
    .ergos-table .subtotal td {
      background: #f5f5f5;
    }
    .ergos-table .total td {
      background: #005c42;
      color: white;
      font-weight: bold;
    }
    .ergos-table .score {
      text-align: center;
      width: 80px;
    }
    
    /* HSE-IT table */
    .hseit-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    .hseit-table th, .hseit-table td {
      border: 1px solid #ddd;
      padding: 8px 10px;
      font-size: 9pt;
    }
    .hseit-table .section-header {
      background: #005c42;
      color: white;
      text-align: center;
      font-weight: bold;
    }
    .hseit-table th {
      background: #f5f5f5;
      font-weight: bold;
    }
    .bar-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bar-container {
      flex: 1;
      height: 16px;
      background: #eee;
      border-radius: 3px;
      overflow: hidden;
    }
    .bar {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s;
    }
    .bar-value {
      font-weight: bold;
      min-width: 40px;
      text-align: right;
    }
    
    /* Inventory table */
    .inventory-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 8pt;
    }
    .inventory-table th, .inventory-table td {
      border: 1px solid #ddd;
      padding: 5px 6px;
      vertical-align: top;
    }
    .inventory-table th {
      background: #005c42;
      color: white;
      font-weight: bold;
      text-align: center;
    }
    .inventory-table .score {
      text-align: center;
      font-weight: bold;
    }
    
    /* NRE colors */
    .nre-trivial { background: #dcfce7; color: #166534; }
    .nre-toleravel { background: #d1fae5; color: #166534; }
    .nre-moderado { background: #fef3c7; color: #92400e; }
    .nre-substancial { background: #fed7aa; color: #9a3412; }
    .nre-intoleravel { background: #fee2e2; color: #991b1b; }
    
    /* Interpretation box */
    .interpretation-box {
      background: #f8f9fa;
      border-left: 4px solid #005c42;
      padding: 12px 15px;
      margin: 10px 0;
      font-size: 10pt;
    }
    .interpretation-box strong {
      color: #005c42;
    }
    
    /* Conclusion box */
    .conclusion-box {
      background: #e8f5e9;
      border: 2px solid #005c42;
      border-radius: 5px;
      padding: 15px;
      margin: 15px 0;
    }
    
    /* Recommendations */
    .recommendations-list {
      list-style-type: decimal;
      padding-left: 25px;
    }
    .recommendations-list li {
      margin-bottom: 8px;
      padding: 8px 10px;
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
    }
    
    /* Signature */
    .signature-area {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
    }
    .signature-box {
      width: 45%;
      text-align: center;
      padding-top: 50px;
      border-top: 1px solid #333;
    }
    
    /* Footer */
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 2px solid #005c42;
      text-align: center;
      font-size: 8pt;
      color: #666;
    }
    
    /* Legends */
    .legends {
      margin-top: 10px;
      font-size: 8pt;
      color: #666;
    }
    .legends p {
      margin-bottom: 3px;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div class="header-title">AET – NR17</div>
        <div class="header-subtitle">Análise Ergonômica do Trabalho</div>
        <div class="header-subtitle">Fatores de Risco Psicossociais</div>
      </div>
      <div class="header-right">
        <strong>HC – Consultoria em Ergonomia</strong><br>
        ERGO MT<br>
        Responsabilidade Técnica:<br>
        Andre Luiz Lopes de Oliveira<br>
        CREFITO-9 26.465-F
      </div>
    </div>

    <!-- Main Info -->
    <div class="section">
      <h2 class="section-title">AEP/AET ANÁLISE ERGONÔMICA DO TRABALHO – RISCOS PSICOSSOCIAIS</h2>
      
      <table class="info-table">
        <tr>
          <th>Setor:</th>
          <td>${respondentDept}</td>
          <th>Unidade/Fazenda:</th>
          <td>${farmName}</td>
        </tr>
        <tr>
          <th>População Exposta (função):</th>
          <td>${respondentJob}</td>
          <th>Nº de colaboradores:</th>
          <td>01</td>
        </tr>
        <tr>
          <th>Colaborador:</th>
          <td>${respondentName}</td>
          <th>Empresa:</th>
          <td>${respondentCompany}</td>
        </tr>
        <tr>
          <th>Turno:</th>
          <td>Adm./Comercial (&gt;5h às &lt;22h)</td>
          <th>Jornada de Trabalho:</th>
          <td>7h30 às 17h18 de segunda a sexta</td>
        </tr>
        <tr>
          <th>Gênero:</th>
          <td>${gender}</td>
          <th>Tempo na Empresa:</th>
          <td>${tenure}</td>
        </tr>
        <tr>
          <th>Data da Avaliação:</th>
          <td>${evaluationDate}</td>
          <th>Ferramenta Utilizada:</th>
          <td>${toolName}</td>
        </tr>
      </table>
    </div>

    <!-- Evaluation -->
    <div class="section">
      <h2 class="section-title">AVALIAÇÃO DA CARGA MENTAL (FATORES COGNITIVOS E ORGANIZACIONAIS)</h2>
      ${isErgos ? ergosTableHtml : hseitTableHtml}
    </div>

    <!-- Interpretation -->
    <div class="section">
      <h2 class="section-title">INTERPRETAÇÃO DOS RESULTADOS</h2>
      <div class="interpretation-box">
        ${isErgos ? `
          <p><strong>Resultado:</strong> Na função de ${respondentJob} após aplicação do ERGOS, o resultado total foi de <strong>${pontuacaoTotal.toFixed(2)} pontos</strong>.</p>
          <p style="margin-top: 8px;">${getInterpretacaoERGOS(pontuacaoTotal)}</p>
        ` : ''}
        ${analysisText ? `<p style="margin-top: 10px;">${analysisText}</p>` : ''}
      </div>
    </div>

    <div class="page-break"></div>

    <!-- Risk Inventory -->
    <div class="section no-break">
      <h2 class="section-title">INVENTÁRIO DE RISCOS PSICOSSOCIAIS</h2>
      <table class="inventory-table">
        <thead>
          <tr>
            <th>Nominação da atividade</th>
            <th>Perigo ou fator de risco</th>
            <th>Lesões ou agravos</th>
            <th>Fontes e circunstâncias</th>
            <th>Exposição</th>
            <th>Medidas de controle</th>
            <th>G</th>
            <th>P</th>
            <th>C</th>
            <th>NRE</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryRowsHtml}
        </tbody>
      </table>
      
      <div class="legends">
        <p><strong>Legendas:</strong> (G) Gravidade; (P) Probabilidade; (C) Controle; (NRE) Nível de Risco Ergonômico Psicossocial</p>
        <p><strong>Classificação NRE:</strong> Trivial (1) | Tolerável (2 a 3) | Moderado (4 a 9) | Substancial (12 a 18) | Intolerável (27)</p>
      </div>
    </div>

    ${recommendationsHtml}

    <!-- Conclusion -->
    ${conclusionText ? `
    <div class="section">
      <h2 class="section-title">CONCLUSÃO</h2>
      <div class="conclusion-box">
        ${conclusionText}
      </div>
    </div>
    ` : ''}

    <!-- Signature -->
    <div class="signature-area">
      <div class="signature-box">
        <strong>Responsável Técnico</strong><br>
        Andre Luiz Lopes de Oliveira<br>
        Fisioterapeuta - Consultor em Ergonomia<br>
        CREFITO-9 26.465-F
      </div>
      <div class="signature-box">
        <strong>Empresa</strong><br>
        ${respondentCompany}<br>
        Unidade: ${farmName}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>Rua das Hortências, 156, Jardim Cuiabá – CEP 78.048-156 Cuiabá/MT</p>
      <p>HC – Consultoria em Ergonomia | ftandreoliveira@yahoo.com.br | (65) 99976-1706</p>
      <p style="color: #dc2626; font-weight: bold; margin-top: 5px;">DOCUMENTO CONFIDENCIAL - USO EXCLUSIVO PARA FINS DE GESTÃO DE SAÚDE E SEGURANÇA OCUPACIONAL</p>
    </div>
  </div>
</body>
</html>
`;

    const base64Html = btoa(unescape(encodeURIComponent(htmlContent)));

    return new Response(
      JSON.stringify({
        pdf: base64Html,
        contentType: "text/html",
        filename: `AET_${respondentJob.replace(/\s+/g, '_')}_${respondentName.replace(/\s+/g, '_')}.html`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error generating PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
