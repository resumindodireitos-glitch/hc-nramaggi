import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML escape function to prevent XSS
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

    // === AUTHORIZATION CHECK ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to this report via RLS
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

    // Check if user can access this report (RLS will filter)
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

    console.log("User authorized to access report:", reportId);
    // === END AUTHORIZATION CHECK ===

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch report with all details
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("*, submissions(*, forms(*))")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      throw new Error("Relatório não encontrado");
    }

    const submission = report.submissions;
    const form = submission?.forms;
    const respondentData = submission?.respondent_data || {};
    const answers = submission?.answers || {};

    // Get respondent info - ESCAPED to prevent XSS
    const respondentName = escapeHtml((respondentData as any).full_name) || "Anônimo";
    const respondentDept = escapeHtml((respondentData as any).department) || "";
    const respondentJob = escapeHtml((respondentData as any).job_title) || "";

    // Format date
    const reportDate = new Date(report.created_at || new Date()).toLocaleDateString("pt-BR");

    // Escape AI-generated content to prevent XSS
    const analysisText = escapeHtml(report.final_text_override || report.ai_analysis_text) || "Análise não disponível";
    const conclusionText = escapeHtml(report.ai_conclusion);
    const riskLevel = escapeHtml(report.risk_level) || "baixo";
    const formType = escapeHtml(form?.type);

    // Generate PDF content as HTML
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #228B22; padding-bottom: 20px; }
    .logo { font-size: 24px; font-weight: bold; color: #228B22; }
    .subtitle { color: #666; margin-top: 5px; }
    .section { margin: 20px 0; }
    .section-title { font-size: 16px; font-weight: bold; color: #228B22; margin-bottom: 10px; border-left: 4px solid #228B22; padding-left: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-item { padding: 8px; background: #f5f5f5; border-radius: 4px; }
    .info-label { font-size: 12px; color: #666; }
    .info-value { font-weight: bold; }
    .risk-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; text-transform: uppercase; }
    .risk-alto, .risk-critico, .risk-intoleravel { background: #fee2e2; color: #dc2626; }
    .risk-medio, .risk-moderado, .risk-substancial { background: #fef3c7; color: #d97706; }
    .risk-baixo, .risk-toleravel, .risk-adequado, .risk-trivial { background: #dcfce7; color: #16a34a; }
    .dimension-row { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; }
    .dimension-bar { width: 100px; height: 8px; background: #e5e5e5; border-radius: 4px; overflow: hidden; }
    .dimension-fill { height: 100%; background: #228B22; }
    .analysis-text { background: #f9fafb; padding: 15px; border-radius: 8px; line-height: 1.6; white-space: pre-wrap; }
    .recommendation { padding: 10px; margin: 5px 0; background: #fffbeb; border-left: 4px solid #f59e0b; }
    .conclusion { padding: 15px; background: #ecfdf5; border-radius: 8px; border-left: 4px solid #228B22; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">AMAGGI - Relatório de Riscos Psicossociais</div>
    <div class="subtitle">Programa CULTURA DE CUIDADO - Saúde Mental e Qualidade de Vida</div>
  </div>

  <div class="section">
    <div class="section-title">Informações do Respondente</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Nome</div>
        <div class="info-value">${respondentName}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Data do Relatório</div>
        <div class="info-value">${reportDate}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Departamento</div>
        <div class="info-value">${respondentDept || "N/A"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Cargo</div>
        <div class="info-value">${respondentJob || "N/A"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Tipo de Avaliação</div>
        <div class="info-value">${formType === "ergos" ? "ERGOS (Operacional)" : "HSE-IT (Administrativo)"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Nível de Risco</div>
        <div class="info-value">
          <span class="risk-badge risk-${riskLevel.toLowerCase()}">${riskLevel}</span>
        </div>
      </div>
    </div>
  </div>

  ${report.dimensions_score ? `
  <div class="section">
    <div class="section-title">Pontuação por Dimensão</div>
    ${Object.entries(report.dimensions_score as Record<string, number>)
      .map(
        ([dim, score]) => `
      <div class="dimension-row">
        <span>${escapeHtml(dim)}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="dimension-bar">
            <div class="dimension-fill" style="width: ${Math.min(100, Number(score))}%"></div>
          </div>
          <span style="font-weight: bold; width: 40px;">${escapeHtml(String(score))}</span>
        </div>
      </div>
    `
      )
      .join("")}
  </div>
  ` : ""}

  <div class="section">
    <div class="section-title">Análise Detalhada</div>
    <div class="analysis-text">${analysisText}</div>
  </div>

  ${conclusionText ? `
  <div class="section">
    <div class="section-title">Conclusão</div>
    <div class="conclusion">${conclusionText}</div>
  </div>
  ` : ""}

  ${report.ai_recommendations && report.ai_recommendations.length > 0 ? `
  <div class="section">
    <div class="section-title">Recomendações</div>
    ${report.ai_recommendations.map((rec: string, i: number) => `
      <div class="recommendation">
        <strong>${i + 1}.</strong> ${escapeHtml(rec)}
      </div>
    `).join("")}
  </div>
  ` : ""}

  <div class="footer">
    <p><strong>CONFIDENCIAL</strong> - Este documento contém informações sensíveis de saúde ocupacional.</p>
    <p>Referências: NR-01, NR-17, ISO 10075-1, ISO 45003</p>
    <p>Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
  </div>
</body>
</html>
    `;

    // Convert HTML to base64
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(htmlContent);
    const base64 = btoa(String.fromCharCode(...htmlBytes));

    console.log(`PDF generated for report ${reportId}`);

    return new Response(
      JSON.stringify({ 
        pdf: base64,
        contentType: "text/html",
        filename: `relatorio-${respondentName.replace(/\s+/g, "-")}.html`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error generating PDF:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});