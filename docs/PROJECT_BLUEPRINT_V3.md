🏭 PROJECT_BLUEPRINT.md - Ergos AI Enterprise (Amaggi Edition)
0. INSTRUÇÕES PARA O AGENTE DE IA (TRAE)
Você é um Engenheiro de Software Senior Especialista. Sua tarefa é implementar este sistema Monorepo (Server + Client) seguindo estritamente o código e a estrutura abaixo.
Inicialize o package.json na raiz e nas pastas server e client.
Instale as dependências listadas.
Implemente o Schema do Prisma.
Crie os serviços de Backend (AI, Queue, Report).
Crie o Frontend com a tela de Revisão Crítica.
1. ESTRUTURA DE DIRETÓRIOS (MONOREPO)
code
Text
ergos-enterprise/
├── docker-compose.yml         # Redis & LibreOffice
├── server/
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma      # Single Source of Truth
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts         # Validação de ENV com Zod
│   │   ├── controllers/       # Lógica HTTP
│   │   ├── services/
│   │   │   ├── ai.service.ts      # OpenAI GPT-4o Integration
│   │   │   ├── queue.service.ts   # BullMQ Setup
│   │   │   └── report.service.ts  # Docx Templater
│   │   ├── workers/
│   │   │   └── analysis.worker.ts # Processador de Fila
│   │   ├── routes/
│   │   └── app.ts
│   └── templates/
│       └── report_template.docx
└── client/
    ├── package.json
    ├── src/
    │   ├── components/
    │   │   ├── form-builder/
    │   │   └── report-viewer/     # Split View Component
    │   ├── hooks/
    │   ├── services/
    │   └── pages/
2. DATABASE SCHEMA (PRISMA)
Arquivo: server/prisma/schema.prisma
Este schema define a hierarquia da Amaggi e o fluxo de dados.
code
Prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// --- Organização (Amaggi) ---

model Department {
  id        String    @id @default(uuid())
  name      String
  code      String?   @unique // Ex: ADM-MT-01
  jobRoles  JobRole[]
  createdAt DateTime  @default(now())

  @@map("departments")
}

model JobRole {
  id           String     @id @default(uuid())
  name         String
  description  String?
  cbo          String?
  departmentId String
  department   Department @relation(fields: [departmentId], references: [id])
  employees    Employee[]
  createdAt    DateTime   @default(now())

  @@map("job_roles")
}

model Employee {
  id               String       @id @default(uuid())
  name             String
  registrationCode String       @unique // Matrícula
  email            String?
  jobRoleId        String
  jobRole          JobRole      @relation(fields: [jobRoleId], references: [id])
  submissions      Submission[]
  createdAt        DateTime     @default(now())

  @@map("employees")
}

// --- Formulários e Coleta ---

model Form {
  id          String       @id @default(uuid())
  title       String
  description String?
  slug        String       @unique
  isActive    Boolean      @default(true)
  schema      Json         // Array de perguntas: [{id, type, label, options}]
  submissions Submission[]
  createdAt   DateTime     @default(now())

  @@map("forms")
}

enum SubmissionSource {
  NATIVE
  GOOGLE_FORMS
  MICROSOFT_FORMS
}

enum AnalysisStatus {
  PENDING_AI
  PROCESSING
  DRAFT_REVIEW // Aguardando humano
  APPROVED
  FAILED
}

model Submission {
  id         String           @id @default(uuid())
  formId     String
  form       Form             @relation(fields: [formId], references: [id])
  employeeId String
  employee   Employee         @relation(fields: [employeeId], references: [id])
  source     SubmissionSource @default(NATIVE)
  rawData    Json             // Respostas originais: {"q1": "Sim"}
  status     AnalysisStatus   @default(PENDING_AI)
  analysis   Analysis?
  createdAt  DateTime         @default(now())

  @@map("submissions")
}

// --- IA e Relatórios ---

enum RiskLevel {
  LOW
  MODERATE
  HIGH
  CRITICAL
}

model Analysis {
  id             String     @id @default(uuid())
  submissionId   String     @unique
  submission     Submission @relation(fields: [submissionId], references: [id])
  
  // Dados Gerados pela IA (Editáveis)
  executiveSummary String   @db.Text
  findings         String   @db.Text
  recommendations  Json     // String[]
  methodology      String   @db.Text
  
  // Métricas
  riskScore      Int
  riskLevel      RiskLevel
  confidence     Float      // 0.0 a 1.0
  
  // Metadados do Processo
  promptUsed     String?    // Snapshot do prompt
  reviewedBy     String?    // ID do usuário (Supabase Auth ID)
  approvedAt     DateTime?
  
  // Arquivos Finais
  docxUrl        String?
  pdfUrl         String?

  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@map("analyses")
}
3. BACKEND SERVICES (CORE LOGIC)
3.1. Serviço de Fila (BullMQ)
Arquivo: server/src/services/queue.service.ts
Gerencia a fila de processamento pesado para não travar a API.
code
TypeScript
import { Queue, Worker, Job } from 'bullmq';
import { connection } from '../config/redis'; // Implementar config Redis
import { processAnalysis } from '../workers/analysis.worker';

export const analysisQueue = new Queue('ai-analysis-queue', { connection });

// Inicializa o Worker que vai consumir a fila
export const initWorkers = () => {
  const worker = new Worker(
    'ai-analysis-queue',
    async (job: Job) => {
      console.log(`Processing job ${job.id}: ${job.name}`);
      await processAnalysis(job.data.submissionId);
    },
    { connection }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed: ${err.message}`);
  });
};

export const addToAnalysisQueue = async (submissionId: string) => {
  await analysisQueue.add('analyze-submission', { submissionId });
};
3.2. Worker de Análise IA (O Cérebro)
Arquivo: server/src/workers/analysis.worker.ts
Lê os dados, chama o GPT-4o e salva o rascunho.
code
TypeScript
import { prisma } from '../lib/prisma';
import { generateErgonomicAnalysis } from '../services/ai.service';

export const processAnalysis = async (submissionId: string) => {
  // 1. Buscar dados completos
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      form: true,
      employee: { include: { jobRole: { include: { department: true } } } }
    }
  });

  if (!submission) throw new Error('Submission not found');

  // 2. Atualizar status
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'PROCESSING' }
  });

  try {
    // 3. Chamada à IA
    const aiResult = await generateErgonomicAnalysis({
      role: submission.employee.jobRole.name,
      department: submission.employee.jobRole.department.name,
      answers: submission.rawData,
      formContext: submission.form.description || ''
    });

    // 4. Salvar Análise (Draft)
    await prisma.analysis.create({
      data: {
        submissionId: submission.id,
        executiveSummary: aiResult.executive_summary,
        findings: aiResult.findings,
        recommendations: aiResult.recommendations, // Já é array string
        methodology: aiResult.methodology,
        riskScore: aiResult.risk_score,
        riskLevel: aiResult.risk_level, // Mapear string p/ ENUM se necessário
        confidence: aiResult.confidence,
        promptUsed: 'v1-standard-hse'
      }
    });

    // 5. Marcar para Revisão Humana
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'DRAFT_REVIEW' }
    });

  } catch (error) {
    console.error('AI Processing Error:', error);
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'FAILED' }
    });
    throw error;
  }
};
3.3. Serviço de IA (OpenAI Integration)
Arquivo: server/src/services/ai.service.ts
Configuração robusta do prompt e JSON mode.
code
TypeScript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AnalysisInput {
  role: string;
  department: string;
  answers: any;
  formContext: string;
}

export const generateErgonomicAnalysis = async (input: AnalysisInput) => {
  const systemPrompt = `
    Você é um Especialista Sênior em Ergonomia e Segurança do Trabalho (NR-17).
    Sua tarefa é analisar respostas de um questionário e gerar um relatório técnico.
    
    CONTEXTO:
    Cargo: ${input.role}
    Departamento: ${input.department}
    
    INSTRUÇÕES:
    1. Analise as respostas sob a ótica da metodologia HSE-IT e fatores psicossociais.
    2. Determine o Nível de Risco (LOW, MODERATE, HIGH, CRITICAL).
    3. Gere um texto formal, técnico, em Português BR.
    4. RETORNE APENAS JSON VÁLIDO.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(input.answers) }
    ],
    temperature: 0.2, // Baixa criatividade, alta precisão
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("Empty response from AI");

  return JSON.parse(content) as {
    risk_score: number;
    risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    executive_summary: string;
    findings: string;
    recommendations: string[];
    methodology: string;
    confidence: number;
  };
};
3.4. Serviço de Relatório (DocxTemplater)
Arquivo: server/src/services/report.service.ts
Preenche o template e converte.
code
TypeScript
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';
import libre from 'libreoffice-convert';
import { promisify } from 'util';

const convertAsync = promisify(libre.convert);

export const generateReportFiles = async (analysisId: string, data: any) => {
  // 1. Carregar Template
  const content = fs.readFileSync(
    path.resolve(__dirname, '../../templates/report_template.docx'),
    'binary'
  );

  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // 2. Renderizar Dados (Data cleaning antes)
  doc.render({
    employee_name: data.employeeName,
    role: data.role,
    risk_level: data.riskLevel,
    executive_summary: data.executiveSummary,
    recommendations: data.recommendations, // Loop no docx: {#recommendations} {-w:p str} {/recommendations}
    findings: data.findings
  });

  const buf = doc.getZip().generate({ type: 'nodebuffer' });
  const docxPath = `/tmp/report-${analysisId}.docx`;
  const pdfPath = `/tmp/report-${analysisId}.pdf`;

  fs.writeFileSync(docxPath, buf);

  // 3. Converter para PDF
  const pdfBuf = await convertAsync(buf, '.pdf', undefined);
  fs.writeFileSync(pdfPath, pdfBuf);

  // 4. Upload para Supabase Storage (Simulado aqui)
  // const pdfUrl = await supabaseStorage.upload(pdfPath);
  
  return { docxPath, pdfPath };
};
4. FRONTEND (REACT + VITE)
4.1. Componente de Revisão Crítica (Split View)
Arquivo: client/src/pages/analysis/ReviewAnalysis.tsx
Esta é a tela principal onde o profissional valida a IA.
code
Tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';

// Interface dos dados que vem da API
interface AnalysisData {
  id: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  executiveSummary: string;
  findings: string;
  recommendations: string[];
  submission: {
    employee: { name: string; jobRole: { name: string } };
    rawData: Record<string, any>;
  };
}

export default function ReviewAnalysis({ analysisId }: { analysisId: string }) {
  const { data, isLoading } = useQuery(['analysis', analysisId], () => 
    api.get<AnalysisData>(`/analyses/${analysisId}`).then(res => res.data)
  );

  const { register, handleSubmit, control } = useForm({
    values: data, // Popula o form com os dados da IA
  });

  const approveMutation = useMutation((formData: any) => 
    api.post(`/analyses/${analysisId}/approve`, formData)
  );

  if (isLoading || !data) return <div>Carregando análise...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* LADO ESQUERDO: DADOS ORIGINAIS (READ-ONLY) */}
      <div className="w-1/3 p-6 overflow-y-auto border-r bg-white">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800">{data.submission.employee.name}</h2>
          <p className="text-sm text-gray-500">{data.submission.employee.jobRole.name}</p>
        </div>

        <Card className="mb-4">
          <CardHeader><CardTitle>Respostas Coletadas</CardTitle></CardHeader>
          <CardContent>
            {Object.entries(data.submission.rawData).map(([key, value]) => (
              <div key={key} className="mb-3 border-b pb-2">
                <p className="text-xs font-bold uppercase text-gray-500">{key}</p>
                <p className="text-sm">{String(value)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* LADO DIREITO: EDITOR DA IA (EDITÁVEL) */}
      <div className="w-2/3 p-6 overflow-y-auto">
        <form onSubmit={handleSubmit((d) => approveMutation.mutate(d))}>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Revisão Técnica</h1>
              <Badge variant={data.riskLevel === 'CRITICAL' ? 'destructive' : 'default'}>
                Risco: {data.riskLevel} ({data.riskScore})
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" type="button">Regenerar Texto</Button>
              <Button type="submit" disabled={approveMutation.isLoading}>
                {approveMutation.isLoading ? 'Gerando PDF...' : 'Aprovar e Finalizar'}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-2">
              <label className="font-semibold">Resumo Executivo</label>
              <Textarea 
                {...register('executiveSummary')} 
                className="min-h-[150px] font-serif text-lg leading-relaxed" 
              />
            </div>

            <div className="grid gap-2">
              <label className="font-semibold">Detalhamento dos Achados</label>
              <Textarea 
                {...register('findings')} 
                className="min-h-[200px]" 
              />
            </div>

            {/* Para recomendações, idealmente usar um FieldArray para adicionar/remover */}
            <div className="grid gap-2">
              <label className="font-semibold">Recomendações (JSON editável)</label>
              <Textarea 
                {...register('recommendations')} // Simplificação para o exemplo
                className="min-h-[100px] font-mono text-sm" 
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
5. DOCKER COMPOSE (INFRAESTRUTURA LOCAL)
Arquivo: docker-compose.yml
Configura Redis (para filas) e PostgreSQL (caso não queira usar o Supabase nuvem no dev).
code
Yaml
version: '3.8'

services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes

  # Serviço opcional se quiser converter PDF localmente sem instalar LibreOffice na máquina host
  libreoffice:
    image: lscr.io/linuxserver/libreoffice:latest
    volumes:
      - ./server/uploads:/uploads
    entrypoint: /bin/bash
    tty: true
6. DEPENDÊNCIAS (PACKAGE.JSON)
Server (server/package.json)
code
JSON
{
  "dependencies": {
    "express": "^4.18.2",
    "prisma": "^5.10.0",
    "@prisma/client": "^5.10.0",
    "openai": "^4.28.0",
    "bullmq": "^5.4.0",
    "docxtemplater": "^3.45.0",
    "pizzip": "^3.1.6",
    "libreoffice-convert": "^1.5.1",
    "zod": "^3.22.4",
    "dotenv": "^16.4.5",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "@types/node": "^20.11.20",
    "@types/express": "^4.17.21"
  }
}
Client (client/package.json)
code
JSON
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.1",
    "react-hook-form": "^7.50.1",
    "@tanstack/react-query": "^5.24.1",
    "axios": "^1.6.7",
    "lucide-react": "^0.331.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "@radix-ui/react-slot": "^1.0.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.4",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3"
  }
}
7. CONFIGURAÇÃO INICIAL (ENVIRONMENT)
Arquivo: .env (na raiz do server)
code
Env
# Database (Supabase Transaction Pooler)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# AI
OPENAI_API_KEY="sk-..."

# Queue
REDIS_HOST="localhost"
REDIS_PORT=6379

# App
PORT=3001
CLIENT_URL="http://localhost:5173"
8. BACKEND CONTROLLERS & ROUTES
8.1. Controllers
Arquivo: server/src/controllers/submission.controller.ts
Gerencia a entrada de dados e dispara a fila de IA.
code
TypeScript
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { addToAnalysisQueue } from '../services/queue.service';
import { z } from 'zod';

// Schema de validação para entrada nativa
const submissionSchema = z.object({
  formId: z.string().uuid(),
  employeeId: z.string().uuid(),
  answers: z.record(z.any()) // { "q1": "Valor" }
});

export const createNativeSubmission = async (req: Request, res: Response) => {
  try {
    const { formId, employeeId, answers } = submissionSchema.parse(req.body);

    const submission = await prisma.submission.create({
      data: {
        formId,
        employeeId,
        source: 'NATIVE',
        rawData: answers,
        status: 'PENDING_AI'
      }
    });

    // Dispara o Worker de IA
    await addToAnalysisQueue(submission.id);

    return res.status(201).json({ 
      message: 'Submission received. AI processing started.', 
      submissionId: submission.id 
    });

  } catch (error) {
    return res.status(400).json({ error: error });
  }
};

// Webhook para Google Forms (Exemplo simplificado)
export const handleGoogleWebhook = async (req: Request, res: Response) => {
  const { formSlug } = req.params;
  const googleData = req.body; // Payload do Google Apps Script

  // Lógica de mapeamento: Google Keys -> Ergos Schema
  // Isso seria idealmente configurável no banco, aqui hardcoded para o blueprint
  const mappedAnswers = {
    "pergunta_1": googleData["Entry 1"],
    // ...
  };

  // Buscar form e employee padrão (ou extrair do payload)
  const form = await prisma.form.findUnique({ where: { slug: formSlug } });
  if (!form) return res.status(404).send('Form not found');

  // Criar submissão
  const submission = await prisma.submission.create({
    data: {
      formId: form.id,
      employeeId: "default-employee-uuid", // Ajustar lógica real
      source: 'GOOGLE_FORMS',
      rawData: mappedAnswers,
      status: 'PENDING_AI'
    }
  });

  await addToAnalysisQueue(submission.id);
  res.status(200).send('Webhook processed');
};
Arquivo: server/src/controllers/analysis.controller.ts
Gerencia a aprovação e geração final do PDF.
code
TypeScript
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { generateReportFiles } from '../services/report.service';

export const getAnalysis = async (req: Request, res: Response) => {
  const { id } = req.params;
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: {
      submission: {
        include: {
          employee: { include: { jobRole: true } }
        }
      }
    }
  });
  if (!analysis) return res.status(404).json({ error: 'Not found' });
  res.json(analysis);
};

export const approveAnalysis = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { executiveSummary, findings, recommendations } = req.body;

  // 1. Atualizar Análise com texto revisado pelo humano
  const updatedAnalysis = await prisma.analysis.update({
    where: { id },
    data: {
      executiveSummary,
      findings,
      recommendations, // JSON array
      status: 'APPROVED',
      approvedAt: new Date(),
      // reviewedBy: req.user.id // Pegar do middleware de auth
    },
    include: {
      submission: {
        include: {
          employee: { include: { jobRole: true } }
        }
      }
    }
  });

  // 2. Gerar PDF Final
  try {
    const reportData = {
      employeeName: updatedAnalysis.submission.employee.name,
      role: updatedAnalysis.submission.employee.jobRole.name,
      riskLevel: updatedAnalysis.riskLevel,
      executiveSummary: updatedAnalysis.executiveSummary,
      findings: updatedAnalysis.findings,
      recommendations: updatedAnalysis.recommendations
    };

    const { docxPath, pdfPath } = await generateReportFiles(id, reportData);

    // Em produção: Upload para S3/Supabase Storage aqui
    // Por enquanto, atualiza com caminhos locais ou URL simulada
    await prisma.analysis.update({
      where: { id },
      data: {
        docxUrl: docxPath,
        pdfUrl: pdfPath
      }
    });

    res.json({ status: 'APPROVED', pdfPath });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
};
8.2. Rotas e App Entry
Arquivo: server/src/routes.ts
code
TypeScript
import { Router } from 'express';
import * as SubmissionCtrl from './controllers/submission.controller';
import * as AnalysisCtrl from './controllers/analysis.controller';

const router = Router();

// Coleta
router.post('/submissions/native', SubmissionCtrl.createNativeSubmission);
router.post('/webhooks/google/:formSlug', SubmissionCtrl.handleGoogleWebhook);

// Análise e Revisão
router.get('/analyses/:id', AnalysisCtrl.getAnalysis);
router.post('/analyses/:id/approve', AnalysisCtrl.approveAnalysis);

// Listagem (Dashboard)
router.get('/submissions', async (req, res) => {
  // Implementação simples de lista para o Dashboard
  const { prisma } = await import('./lib/prisma');
  const list = await prisma.submission.findMany({
    include: { employee: true, analysis: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(list);
});

export { router };
Arquivo: server/src/app.ts
code
TypeScript
import express from 'express';
import cors from 'cors';
import { router } from './routes';
import { initWorkers } from './services/queue.service';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', router);

// Inicializa Workers do BullMQ ao subir o servidor
initWorkers();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
9. FRONTEND DASHBOARD
Arquivo: client/src/pages/Dashboard.tsx
Uma tabela simples para ver o status das análises e navegar para a revisão.
code
Tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const { data: submissions, isLoading } = useQuery(['submissions'], () =>
    api.get('/submissions').then((res) => res.data)
  );

  if (isLoading) return <div className="p-8">Carregando Dashboard...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard de Análises</h1>
          <p className="text-gray-500">Gerencie as submissões e validações da IA.</p>
        </div>
        <Button>Nova Coleta</Button>
      </header>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pendentes IA</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{submissions?.filter((s:any) => s.status === 'PENDING_AI').length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Aguardando Revisão</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-600">{submissions?.filter((s:any) => s.status === 'DRAFT_REVIEW').length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Finalizados</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{submissions?.filter((s:any) => s.analysis?.status === 'APPROVED').length}</div></CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-md border">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-4 font-medium">Colaborador</th>
              <th className="p-4 font-medium">Data</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Risco (IA)</th>
              <th className="p-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {submissions?.map((sub: any) => (
              <tr key={sub.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{sub.employee.name}</td>
                <td className="p-4 text-gray-500">{new Date(sub.createdAt).toLocaleDateString()}</td>
                <td className="p-4">
                  <Badge variant={sub.status === 'DRAFT_REVIEW' ? 'outline' : 'default'}>
                    {sub.status}
                  </Badge>
                </td>
                <td className="p-4">
                  {sub.analysis ? (
                    <Badge className={
                      sub.analysis.riskLevel === 'CRITICAL' ? 'bg-red-500' : 
                      sub.analysis.riskLevel === 'HIGH' ? 'bg-orange-500' : 'bg-green-500'
                    }>
                      {sub.analysis.riskLevel}
                    </Badge>
                  ) : '-'}
                </td>
                <td className="p-4 text-right">
                  {sub.status === 'DRAFT_REVIEW' && sub.analysis && (
                    <Link to={`/analysis/${sub.analysis.id}`}>
                      <Button size="sm">Revisar</Button>
                    </Link>
                  )}
                  {sub.analysis?.status === 'APPROVED' && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(sub.analysis.pdfUrl)}>
                      Baixar PDF
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
10. INSTRUÇÕES DE EXECUÇÃO (PARA O TRAE)
Passo 1: Infraestrutura
code
Bash
# 1. Iniciar Redis (necessário para a fila da IA)
docker-compose up -d redis

# 2. Configurar variáveis de ambiente
# Crie o arquivo server/.env com as chaves do Supabase e OpenAI
Passo 2: Banco de Dados
code
Bash
cd server
# Instalar deps
npm install
# Gerar cliente Prisma
npx prisma generate
# Empurrar schema para o Supabase (ou DB local)
npx prisma db push
Passo 3: Backend (Server + Workers)
code
Bash
cd server
# Rodar em modo desenvolvimento (API + Worker juntos no app.ts)
npm run dev
Passo 4: Frontend (Client)
code
Bash
cd client
npm install
npm run dev
11. RESUMO FINAL DO FLUXO (HOW IT WORKS)
Ingestão: O sistema recebe dados em /api/submissions/native.
Fila: O controller joga o ID na fila Redis ai-analysis-queue.
Processamento: O analysis.worker.ts pega o job, monta o prompt com contexto da Amaggi e chama o GPT-4o.
Rascunho: O JSON da IA é salvo na tabela Analysis com status DRAFT_REVIEW.
Notificação: O Frontend atualiza o Dashboard mostrando "Aguardando Revisão".
Humano: O Ergonomista abre a tela de revisão, altera texto se necessário e clica em "Aprovar".
Geração: O backend pega o template .docx, substitui as variáveis, converte para PDF e salva a URL.
Entrega: O PDF fica disponível para download no Dashboard.
12. UTILITIES & CONFIGURAÇÕES (SERVER)
12.1. Prisma Client Singleton
Arquivo: server/src/lib/prisma.ts
Evita múltiplas conexões com o banco durante o hot-reload em desenvolvimento.
code
TypeScript
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
12.2. Redis Configuration
Arquivo: server/src/config/redis.ts
Centraliza a conexão para ser usada tanto pelo BullMQ quanto por cache futuro.
code
TypeScript
import { ConnectionOptions } from 'bullmq';

export const connection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  // Se usar senha em produção:
  // password: process.env.REDIS_PASSWORD, 
};
13. FRONTEND ENTRY POINTS & ROUTING
13.1. API Client (Axios)
Arquivo: client/src/services/api.ts
code
TypeScript
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

// Interceptor simples para tratamento de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);
13.2. Configuração de Rotas (React Router)
Arquivo: client/src/App.tsx
Define a navegação do Dashboard e da Tela de Revisão.
code
Tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ReviewAnalysis from './pages/analysis/ReviewAnalysis';
// Importar FormBuilder page futuramente

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background font-sans antialiased">
        {/* Navbar componente poderia vir aqui */}
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analysis/:analysisId" element={<ReviewAnalysis />} />
          
          {/* Rota pública para coleta (futuro) */}
          {/* <Route path="/f/:slug" element={<PublicForm />} /> */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
13.3. Main Entry Point (Providers)
Arquivo: client/src/main.tsx
Configura o React Query e estilos globais.
code
Tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css'; // Tailwind directives

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
13.4. Tailwind CSS Config
Arquivo: client/src/index.css
Garante que o Tailwind funcione com as classes do Shadcn/ui.
code
CSS
@tailwind base;
@tailwind components;
@tailwind utilities;
 
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    /* Adicionar outras variáveis do shadcn theme aqui se necessário */
  }
 
  body {
    @apply bg-background text-foreground;
  }
}
14. CHECKLIST DE VALIDAÇÃO FINAL (PARA O TRAE)
Ao finalizar a implementação, peça para o Trae rodar este checklist mentalmente ou via script:

Banco de Dados: O container postgres (ou Supabase) está acessível e as tabelas (submissions, analyses) foram criadas?

Redis: O container redis está rodando na porta 6379?

Backend: O servidor iniciou na porta 3001 e conectou ao Redis?

Worker: O log exibe "Worker initialized"?

Frontend: A build do Vite concluiu e a página abre em localhost:5173?

Integração: Ao enviar um POST para /api/submissions/native, um job aparece no log do Worker?
Fim do PROJECT_BLUEPRINT.md

15. TIPAGEM COMPARTILHADA (SHARED TYPES)
Instrução para o Trae: Crie um arquivo em server/src/types/shared.ts e configure o client para importar dele ou copie para client/src/types/index.ts para garantir consistência.
code
TypeScript
// server/src/types/shared.ts

export enum RiskLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AnalysisResult {
  id: string;
  submissionId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  executiveSummary: string;
  findings: string;
  recommendations: string[]; // Array de strings simples
  methodology: string;
  confidence: number;
  status: 'DRAFT' | 'APPROVED';
  pdfUrl?: string;
}

export interface EmployeeDTO {
  id: string;
  name: string;
  jobRole: string;
  department: string;
}

export interface SubmissionDTO {
  id: string;
  employee: EmployeeDTO;
  rawData: Record<string, any>; // As respostas do form
  createdAt: string;
  status: 'PENDING_AI' | 'PROCESSING' | 'DRAFT_REVIEW' | 'APPROVED';
  analysis?: AnalysisResult;
}
16. CONFIGURAÇÃO DE UI (SHADCN COMPONENTS)
Instrução para o Trae: Ao configurar o frontend, execute a instalação dos seguintes componentes obrigatoriamente.
Arquivo: client/components.json (Crie este arquivo na raiz do client antes de instalar)
code
JSON
{
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
Lista de Instalação (Comando para o Trae rodar):
code
Bash
cd client
npx shadcn-ui@latest init -y
npx shadcn-ui@latest add button card badge textarea input label toast table progress skeleton alert-dialog tabs
17. SCRIPT GERADOR DE TEMPLATE (SOLUÇÃO DO .DOCX)
Problema: Você não pode "colar" um arquivo Word aqui.
Solução: Adicione este script de setup no backend. Ele cria um arquivo .docx válido com os placeholders corretos programaticamente.
Arquivo: server/scripts/create-template.ts
code
TypeScript
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs';
import path from 'path';

// Este script cria um arquivo .docx inicial válido para o sistema usar
const createTemplate = () => {
  // Conteúdo XML mínimo de um DOCX válido com placeholders
  // Isso evita que precisemos subir um binário agora
  console.log("Criando template placeholder...");
  
  const dir = path.resolve(__dirname, '../templates');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Nota: Em um cenário real, substitua o arquivo gerado aqui pelo seu .docx oficial da Amaggi.
  // Para o MVP rodar, vamos criar um arquivo de texto renomeado apenas para o teste, 
  // OU instruir o usuário a colocar o arquivo real.
  
  console.log("⚠️ ATENÇÃO: O sistema precisa do arquivo 'report_template.docx' na pasta server/templates.");
  console.log("⚠️ Como sou uma IA, não posso gerar binários complexos do Word.");
  console.log("⚠️ Por favor, coloque seu arquivo .docx lá com as tags: {employee_name}, {role}, {executive_summary}");
};

createTemplate();
Correção Estratégica para o Trae:
Como o script acima é limitado, adicione esta Instrução Especial no final do Blueprint:
🔴 INSTRUÇÃO CRÍTICA FINAL:
O sistema de relatórios depende do arquivo server/templates/report_template.docx.
Como você (IA) não pode criar arquivos binários do Word:
Crie a pasta server/templates.
Crie um arquivo dummy chamado README_TEMPLATE.txt dentro dela explicando quais placeholders o arquivo Word deve ter: {employee_name}, {role}, {department}, {risk_level}, {executive_summary}, {findings}, {#recommendations}{.}{/recommendations}.
No código report.service.ts, adicione uma verificação: if (!fs.existsSync(templatePath)) throw new Error("Template DOCX ausente. Por favor adicione report_template.docx na pasta templates");