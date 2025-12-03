import { z } from "zod";

// ========== Respondent Data Schema ==========
export const respondentDataSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  empresa: z.string().default("Amaggi"),
  setor: z.string().trim().min(1, "Setor é obrigatório").max(100, "Setor muito longo"),
  cargo: z.string().trim().min(1, "Cargo é obrigatório").max(100, "Cargo muito longo"),
  genero: z.string().optional(),
  tempo_empresa: z.string().min(1, "Tempo na empresa é obrigatório"),
  data_avaliacao: z.string().min(1, "Data de avaliação é obrigatória"),
});

export type RespondentDataSchema = z.infer<typeof respondentDataSchema>;

// ========== Form Submission Schema ==========
export const submissionSchema = z.object({
  form_id: z.string().uuid("ID do formulário inválido"),
  respondent_data: respondentDataSchema,
  answers: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])),
});

export type SubmissionSchema = z.infer<typeof submissionSchema>;

// ========== User Registration Schema ==========
export const registrationSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(72, "Senha muito longa"),
  full_name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
});

export type RegistrationSchema = z.infer<typeof registrationSchema>;

// ========== Login Schema ==========
export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type LoginSchema = z.infer<typeof loginSchema>;

// ========== Form Builder Schema ==========
export const questionSchema = z.object({
  id: z.string().min(1, "ID é obrigatório"),
  label: z.string().trim().min(1, "Texto da pergunta é obrigatório").max(500, "Texto muito longo"),
  description: z.string().max(1000, "Descrição muito longa").optional(),
  type: z.enum(["text", "textarea", "radio", "checkbox", "scale", "slider", "select", "info"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const formSchema = z.object({
  title: z.string().trim().min(3, "Título deve ter pelo menos 3 caracteres").max(200, "Título muito longo"),
  description: z.string().max(1000, "Descrição muito longa").optional(),
  type: z.enum(["ergos", "hse_it"]),
  schema: z.array(questionSchema).min(1, "Formulário deve ter pelo menos uma pergunta"),
  is_active: z.boolean().default(true),
});

export type FormSchema = z.infer<typeof formSchema>;

// ========== Department Schema ==========
export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  code: z.string().trim().max(20, "Código muito longo").optional(),
  description: z.string().max(500, "Descrição muito longa").optional(),
  manager_name: z.string().max(100, "Nome do gestor muito longo").optional(),
});

export type DepartmentSchema = z.infer<typeof departmentSchema>;

// ========== Job Role Schema ==========
export const jobRoleSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  cbo: z.string().trim().max(20, "CBO muito longo").optional(),
  description: z.string().max(500, "Descrição muito longa").optional(),
  department_id: z.string().uuid("ID do departamento inválido").optional().nullable(),
  risk_category: z.string().max(50, "Categoria de risco muito longa").optional(),
});

export type JobRoleSchema = z.infer<typeof jobRoleSchema>;

// ========== Employee Schema ==========
export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo").optional().nullable(),
  registration_code: z.string().trim().max(50, "Matrícula muito longa").optional().nullable(),
  job_role_id: z.string().uuid("ID do cargo inválido").optional().nullable(),
  admission_date: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

export type EmployeeSchema = z.infer<typeof employeeSchema>;

// ========== AI Agent Schema ==========
export const agentSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100, "Nome muito longo"),
  description: z.string().max(500, "Descrição muito longa").optional(),
  form_type: z.string().min(1, "Tipo de formulário é obrigatório"),
  provider: z.enum(["lovable", "openai", "anthropic", "deepseek", "google"]),
  model: z.string().min(1, "Modelo é obrigatório"),
  system_prompt: z.string().min(10, "Prompt deve ter pelo menos 10 caracteres"),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().min(100).max(16000).default(4000),
  is_active: z.boolean().default(false),
  use_rag: z.boolean().default(false),
  rag_top_k: z.number().min(1).max(20).default(5),
});

export type AgentSchema = z.infer<typeof agentSchema>;

// ========== Webhook Payload Schemas ==========
export const googleFormsWebhookSchema = z.object({
  form_id: z.string(),
  response_id: z.string(),
  responses: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  respondent_email: z.string().email().optional(),
  timestamp: z.string(),
});

export type GoogleFormsWebhookSchema = z.infer<typeof googleFormsWebhookSchema>;

export const microsoftFormsWebhookSchema = z.object({
  formId: z.string(),
  responseId: z.string(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  respondentEmail: z.string().email().optional(),
  submittedAt: z.string(),
});

export type MicrosoftFormsWebhookSchema = z.infer<typeof microsoftFormsWebhookSchema>;

// ========== System Settings Schema ==========
export const systemSettingSchema = z.object({
  key: z.string().trim().min(1, "Chave é obrigatória").max(100, "Chave muito longa"),
  value: z.string().max(5000, "Valor muito longo").optional().nullable(),
  description: z.string().max(500, "Descrição muito longa").optional(),
  is_secret: z.boolean().default(false),
});

export type SystemSettingSchema = z.infer<typeof systemSettingSchema>;

// ========== Report Review Schema ==========
export const reportReviewSchema = z.object({
  ai_analysis_text: z.string().min(10, "Análise deve ter pelo menos 10 caracteres"),
  ai_conclusion: z.string().min(10, "Conclusão deve ter pelo menos 10 caracteres"),
  ai_recommendations: z.array(z.string().min(1)).min(1, "Deve ter pelo menos uma recomendação"),
});

export type ReportReviewSchema = z.infer<typeof reportReviewSchema>;

// ========== Utility function to validate and return errors ==========
export function validateWithZod<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: boolean; 
  data?: T; 
  errors?: Record<string, string[]> 
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string[]> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(err.message);
  });
  
  return { success: false, errors };
}
