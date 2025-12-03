import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

function getInterpretacaoERGOS(pontuacao: number): string {
  if (pontuacao <= 30) {
    return "As condições de trabalho são adequadas e não existe nenhum risco em potencial. Situação satisfatória para exercício da atividade laboral.";
  } else if (pontuacao <= 60) {
    return "As condições de trabalho estão dentro dos padrões e segurança aceitáveis internacionalmente. É improvável que afetem a saúde. Porém, recomenda-se manter o controle sistemático dessas condições.";
  } else {
    return "São necessárias medidas corretivas para reduzir os riscos e proteger a saúde e qualidade de vida dos trabalhadores.";
  }
}

// Simple DOCX generator using WordprocessingML
function generateDocxContent(data: {
  respondentName: string;
  respondentJob: string;
  respondentDept: string;
  respondentCompany: string;
  farmName: string;
  evaluationDate: string;
  formType: string;
  pontuacaoTotal: number;
  somaA: number;
  somaB: number;
  dimensionsScore: Record<string, any>;
  analysisText: string;
  conclusionText: string;
  recommendations: string[];
  riskFactors: Array<{factor: string; source: string; g: number; p: number; c: number; nre: number}>;
  gender: string;
  tenure: string;
}): string {
  const isErgos = data.formType === "ergos";
  const toolName = isErgos ? "ERGOS" : "HSE-IT";
  
  // Build dimensions content
  let dimensionsContent = "";
  
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
    
    let blocoARows = "";
    let blocoBRows = "";
    
    Object.entries(blocoALabels).forEach(([key, label]) => {
      const score = Number(data.dimensionsScore[key]?.score ?? 0);
      blocoARows += `
        <w:tr>
          <w:tc><w:p><w:r><w:t>${escapeXml(label)}</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${score}</w:t></w:r></w:p></w:tc>
        </w:tr>
      `;
    });
    
    Object.entries(blocoBLabels).forEach(([key, label]) => {
      const score = Number(data.dimensionsScore[key]?.score ?? 0);
      blocoBRows += `
        <w:tr>
          <w:tc><w:p><w:r><w:t>${escapeXml(label)}</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${score}</w:t></w:r></w:p></w:tc>
        </w:tr>
      `;
    });
    
    dimensionsContent = `
      <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>ERGOS (AVALIAÇÃO DE CARGA MENTAL)</w:t></w:r></w:p>
      <w:tbl>
        <w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>
          <w:top w:val="single" w:sz="4" w:color="000000"/>
          <w:left w:val="single" w:sz="4" w:color="000000"/>
          <w:bottom w:val="single" w:sz="4" w:color="000000"/>
          <w:right w:val="single" w:sz="4" w:color="000000"/>
          <w:insideH w:val="single" w:sz="4" w:color="000000"/>
          <w:insideV w:val="single" w:sz="4" w:color="000000"/>
        </w:tblBorders></w:tblPr>
        <w:tr>
          <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Fatores Cognitivos (Bloco A)</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Pontuação</w:t></w:r></w:p></w:tc>
        </w:tr>
        ${blocoARows}
        <w:tr>
          <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Tabela A</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${data.somaA}</w:t></w:r></w:p></w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Fatores Organizacionais (Bloco B)</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Pontuação</w:t></w:r></w:p></w:tc>
        </w:tr>
        ${blocoBRows}
        <w:tr>
          <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Tabela B</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${data.somaB}</w:t></w:r></w:p></w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="005C42"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Pontuação total da carga mental</w:t></w:r></w:p></w:tc>
          <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="005C42"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>${data.pontuacaoTotal.toFixed(2)}</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    `;
  }
  
  // Build risk inventory rows
  const riskRows = data.riskFactors.map(rf => `
    <w:tr>
      <w:tc><w:p><w:r><w:t>Atividade laboral na função de ${escapeXml(data.respondentJob)}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>${escapeXml(rf.factor)}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>Transtornos relacionados à saúde mental</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${rf.g}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${rf.p}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>${rf.c}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${rf.nre}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>${getNRELabel(rf.nre)}</w:t></w:r></w:p></w:tc>
    </w:tr>
  `).join('');
  
  // Build recommendations
  const recommendationsContent = data.recommendations.length > 0 ? `
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>RECOMENDAÇÕES</w:t></w:r></w:p>
    ${data.recommendations.map((rec, i) => `
      <w:p>
        <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
        <w:r><w:t>${escapeXml(rec)}</w:t></w:r>
      </w:p>
    `).join('')}
  ` : '';

  // Generate document.xml content
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- Header -->
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:t>AET – NR17</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Subtitle"/></w:pPr>
      <w:r><w:t>Análise Ergonômica do Trabalho - Fatores de Risco Psicossociais</w:t></w:r>
    </w:p>
    <w:p/>
    
    <!-- Main Info Section -->
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>AEP/AET ANÁLISE ERGONÔMICA DO TRABALHO – RISCOS PSICOSSOCIAIS</w:t></w:r></w:p>
    
    <w:tbl>
      <w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:color="000000"/>
      </w:tblBorders></w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Setor:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escapeXml(data.respondentDept)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Unidade/Fazenda:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escapeXml(data.farmName)}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>População Exposta (função):</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escapeXml(data.respondentJob)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Colaborador:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escapeXml(data.respondentName)}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Empresa:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escapeXml(data.respondentCompany)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Data da Avaliação:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escapeXml(data.evaluationDate)}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Gênero:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escapeXml(data.gender)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Tempo na Empresa:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escapeXml(data.tenure)}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Ferramenta Utilizada:</w:t></w:r></w:p></w:tc>
        <w:tc colspan="3"><w:p><w:r><w:t>${escapeXml(toolName)}</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    
    <w:p/>
    
    <!-- Evaluation Section -->
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>AVALIAÇÃO DA CARGA MENTAL (FATORES COGNITIVOS E ORGANIZACIONAIS)</w:t></w:r></w:p>
    ${dimensionsContent}
    
    <w:p/>
    
    <!-- Interpretation -->
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>INTERPRETAÇÃO DOS RESULTADOS</w:t></w:r></w:p>
    ${isErgos ? `
      <w:p>
        <w:r><w:rPr><w:b/></w:rPr><w:t>Resultado: </w:t></w:r>
        <w:r><w:t>Na função de ${escapeXml(data.respondentJob)} após aplicação do ERGOS, o resultado total foi de </w:t></w:r>
        <w:r><w:rPr><w:b/></w:rPr><w:t>${data.pontuacaoTotal.toFixed(2)} pontos</w:t></w:r>
        <w:r><w:t>.</w:t></w:r>
      </w:p>
      <w:p><w:r><w:t>${escapeXml(getInterpretacaoERGOS(data.pontuacaoTotal))}</w:t></w:r></w:p>
    ` : ''}
    ${data.analysisText ? `<w:p><w:r><w:t>${escapeXml(data.analysisText)}</w:t></w:r></w:p>` : ''}
    
    <w:p/>
    
    <!-- Risk Inventory -->
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>INVENTÁRIO DE RISCOS PSICOSSOCIAIS</w:t></w:r></w:p>
    <w:tbl>
      <w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:color="000000"/>
      </w:tblBorders></w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="005C42"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Nominação</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="005C42"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Fator de Risco</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="005C42"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Lesões/Agravos</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="005C42"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>G</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="005C42"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>P</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="005C42"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>C</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="005C42"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>NRE</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="005C42"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Classificação</w:t></w:r></w:p></w:tc>
      </w:tr>
      ${riskRows}
    </w:tbl>
    
    <w:p/>
    <w:p><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>Legendas: (G) Gravidade; (P) Probabilidade; (C) Controle; (NRE) Nível de Risco Ergonômico Psicossocial</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>Classificação NRE: Trivial (1) | Tolerável (2 a 3) | Moderado (4 a 9) | Substancial (12 a 18) | Intolerável (27)</w:t></w:r></w:p>
    
    <w:p/>
    
    ${recommendationsContent}
    
    <!-- Conclusion -->
    ${data.conclusionText ? `
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>CONCLUSÃO</w:t></w:r></w:p>
      <w:p><w:r><w:t>${escapeXml(data.conclusionText)}</w:t></w:r></w:p>
    ` : ''}
    
    <w:p/>
    <w:p/>
    
    <!-- Signature -->
    <w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:color="000000"/></w:pBdr><w:jc w:val="center"/></w:pPr></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Responsável Técnico</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Andre Luiz Lopes de Oliveira</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Fisioterapeuta - Consultor em Ergonomia</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>CREFITO-9 26.465-F</w:t></w:r></w:p>
    
    <w:p/>
    
    <!-- Footer -->
    <w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:color="005C42"/></w:pBdr><w:jc w:val="center"/></w:pPr></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>HC – Consultoria em Ergonomia | Rua das Hortências, 156, Jardim Cuiabá – CEP 78.048-156 Cuiabá/MT</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/><w:color w:val="DC2626"/><w:b/></w:rPr><w:t>DOCUMENTO CONFIDENCIAL - USO EXCLUSIVO PARA FINS DE GESTÃO DE SAÚDE E SEGURANÇA OCUPACIONAL</w:t></w:r></w:p>
    
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return documentXml;
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
    const respondentData = submission?.respondent_data || {};
    const answers = submission?.answers || {};
    const dimensionsScore = report.dimensions_score || {};

    const respondentName = (respondentData as any).nome || (respondentData as any).full_name || employee?.name || "Não informado";
    const respondentDept = (respondentData as any).setor || (respondentData as any).department || department?.name || "Não informado";
    const respondentJob = (respondentData as any).cargo || (respondentData as any).job_title || jobRole?.name || "Não informado";
    const respondentCompany = (respondentData as any).empresa || (respondentData as any).company || "Amaggi";
    const farmName = farm?.name || (respondentData as any).fazenda || "Sede";
    const evaluationDate = formatDate((respondentData as any).data_avaliacao || report.created_at);
    const formType = form?.type || "ergos";
    const gender = (respondentData as any).genero || "Não informado";
    const tenure = (respondentData as any).tempo_empresa || "Não informado";

    const isErgos = formType === "ergos";
    
    // Calculate scores
    let somaA = 0, somaB = 0;
    if (isErgos) {
      const blocoA = ["pressao_tempo", "atencao", "complexidade", "monotonia", "raciocinio"];
      const blocoB = ["iniciativa", "isolamento", "horarios_turnos", "relacionamentos", "demandas_gerais"];
      blocoA.forEach(k => { somaA += Number((dimensionsScore as any)[k]?.score ?? (answers as any)[k] ?? 0); });
      blocoB.forEach(k => { somaB += Number((dimensionsScore as any)[k]?.score ?? (answers as any)[k] ?? 0); });
    }
    const pontuacaoTotal = (somaA + somaB) * 0.83;

    // Build risk factors
    const riskFactors: Array<{factor: string; source: string; g: number; p: number; c: number; nre: number}> = [];
    
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
          riskFactors.push({ factor: label, source: `Pontuação ${score}`, g, p: 1, c: 1, nre: g });
        }
      });
    }

    if (riskFactors.length === 0) {
      riskFactors.push({ factor: "Não identificado", source: "Sem exposição significativa", g: 1, p: 1, c: 1, nre: 1 });
    }

    const docxContent = generateDocxContent({
      respondentName,
      respondentJob,
      respondentDept,
      respondentCompany,
      farmName,
      evaluationDate,
      formType,
      pontuacaoTotal,
      somaA,
      somaB,
      dimensionsScore: dimensionsScore as Record<string, any>,
      analysisText: report.final_text_override || report.ai_analysis_text || "",
      conclusionText: report.ai_conclusion || "",
      recommendations: report.ai_recommendations || [],
      riskFactors,
      gender,
      tenure
    });

    const base64Docx = btoa(unescape(encodeURIComponent(docxContent)));

    return new Response(
      JSON.stringify({
        docx: base64Docx,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename: `AET_${respondentJob.replace(/\s+/g, '_')}_${respondentName.replace(/\s+/g, '_')}.xml`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error generating DOCX:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
