export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_documents: {
        Row: {
          agent_id: string
          created_at: string | null
          document_id: string
          id: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          document_id: string
          id?: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompts: {
        Row: {
          agent_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          form_type: string
          id: string
          is_active: boolean | null
          max_tokens: number | null
          model: string
          name: string
          output_schema: Json | null
          provider: string
          rag_top_k: number | null
          system_prompt: string
          temperature: number | null
          updated_at: string | null
          use_rag: boolean | null
          version: number | null
        }
        Insert: {
          agent_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          form_type: string
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          model?: string
          name: string
          output_schema?: Json | null
          provider?: string
          rag_top_k?: number | null
          system_prompt: string
          temperature?: number | null
          updated_at?: string | null
          use_rag?: boolean | null
          version?: number | null
        }
        Update: {
          agent_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          form_type?: string
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          model?: string
          name?: string
          output_schema?: Json | null
          provider?: string
          rag_top_k?: number | null
          system_prompt?: string
          temperature?: number | null
          updated_at?: string | null
          use_rag?: boolean | null
          version?: number | null
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          agent_id: string | null
          cost_estimate: number | null
          created_at: string | null
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          provider: string
          submission_id: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          provider: string
          submission_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          provider?: string
          submission_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "participation_control"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "ai_usage_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions_anonymized"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_limits: {
        Row: {
          created_at: string | null
          daily_token_limit: number | null
          id: string
          is_active: boolean | null
          monthly_token_limit: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          daily_token_limit?: number | null
          id?: string
          is_active?: boolean | null
          monthly_token_limit?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          daily_token_limit?: number | null
          id?: string
          is_active?: boolean | null
          monthly_token_limit?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      consent_logs: {
        Row: {
          accepted_at: string
          consent_text: string
          created_at: string | null
          device_fingerprint: string | null
          id: string
          ip_hash: string
          submission_id: string | null
          term_version: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          consent_text: string
          created_at?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_hash: string
          submission_id?: string | null
          term_version?: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          consent_text?: string
          created_at?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_hash?: string
          submission_id?: string | null
          term_version?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "participation_control"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "consent_logs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_logs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions_anonymized"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          farm_id: string | null
          id: string
          manager_name: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          farm_id?: string | null
          id?: string
          manager_name?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          farm_id?: string | null
          id?: string
          manager_name?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admission_date: string | null
          created_at: string | null
          email: string | null
          farm_id: string | null
          id: string
          is_active: boolean | null
          job_role_id: string | null
          name: string
          registration_code: string | null
          updated_at: string | null
        }
        Insert: {
          admission_date?: string | null
          created_at?: string | null
          email?: string | null
          farm_id?: string | null
          id?: string
          is_active?: boolean | null
          job_role_id?: string | null
          name: string
          registration_code?: string | null
          updated_at?: string | null
        }
        Update: {
          admission_date?: string | null
          created_at?: string | null
          email?: string | null
          farm_id?: string | null
          id?: string
          is_active?: boolean | null
          job_role_id?: string | null
          name?: string
          registration_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          cnae: string | null
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          location: string | null
          manager_name: string | null
          name: string
          risk_degree: number | null
          updated_at: string | null
        }
        Insert: {
          cnae?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          manager_name?: string | null
          name: string
          risk_degree?: number | null
          updated_at?: string | null
        }
        Update: {
          cnae?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          manager_name?: string | null
          name?: string
          risk_degree?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fmea_calculations: {
        Row: {
          calculated_at: string | null
          capacidade_deteccao: number
          created_at: string | null
          dimension_scores: Json | null
          gravidade: number
          id: string
          nre_classification: string | null
          nre_score: number | null
          probabilidade: number
          report_id: string | null
          requires_manual_review: boolean | null
          review_reason: string | null
        }
        Insert: {
          calculated_at?: string | null
          capacidade_deteccao?: number
          created_at?: string | null
          dimension_scores?: Json | null
          gravidade: number
          id?: string
          nre_classification?: string | null
          nre_score?: number | null
          probabilidade: number
          report_id?: string | null
          requires_manual_review?: boolean | null
          review_reason?: string | null
        }
        Update: {
          calculated_at?: string | null
          capacidade_deteccao?: number
          created_at?: string | null
          dimension_scores?: Json | null
          gravidade?: number
          id?: string
          nre_classification?: string | null
          nre_score?: number | null
          probabilidade?: number
          report_id?: string | null
          requires_manual_review?: boolean | null
          review_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fmea_calculations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          calculation_rules: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          risk_thresholds: Json | null
          schema: Json
          title: string
          type: Database["public"]["Enums"]["form_type"]
          updated_at: string | null
        }
        Insert: {
          calculation_rules?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          risk_thresholds?: Json | null
          schema?: Json
          title: string
          type?: Database["public"]["Enums"]["form_type"]
          updated_at?: string | null
        }
        Update: {
          calculation_rules?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          risk_thresholds?: Json | null
          schema?: Json
          title?: string
          type?: Database["public"]["Enums"]["form_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          cbo: string | null
          cbo_description: string | null
          created_at: string | null
          department_id: string | null
          description: string | null
          environment_desc: string | null
          id: string
          name: string
          risk_category: string | null
          updated_at: string | null
        }
        Insert: {
          cbo?: string | null
          cbo_description?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          environment_desc?: string | null
          id?: string
          name: string
          risk_category?: string | null
          updated_at?: string | null
        }
        Update: {
          cbo?: string | null
          cbo_description?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          environment_desc?: string | null
          id?: string
          name?: string
          risk_category?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          chunks_count: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          metadata: Json | null
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          chunks_count?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          metadata?: Json | null
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          chunks_count?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          metadata?: Json | null
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string | null
          department: string | null
          email: string
          full_name: string
          id: string
          job_title: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          full_name: string
          id: string
          job_title?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      report_signatures: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          is_verified: boolean | null
          report_id: string
          signature_hash: string
          signed_at: string | null
          signer_credential: string | null
          signer_name: string
          signer_role: string
          user_agent: string | null
          verification_code: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_verified?: boolean | null
          report_id: string
          signature_hash: string
          signed_at?: string | null
          signer_credential?: string | null
          signer_name: string
          signer_role: string
          user_agent?: string | null
          verification_code?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_verified?: boolean | null
          report_id?: string
          signature_hash?: string
          signed_at?: string | null
          signer_credential?: string | null
          signer_name?: string
          signer_role?: string
          user_agent?: string | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_signatures_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          ai_analysis_text: string | null
          ai_conclusion: string | null
          ai_recommendations: string[] | null
          created_at: string | null
          dimensions_score: Json | null
          final_text_override: string | null
          id: string
          is_approved: boolean | null
          reviewer_id: string | null
          risk_level: string | null
          submission_id: string
          updated_at: string | null
        }
        Insert: {
          ai_analysis_text?: string | null
          ai_conclusion?: string | null
          ai_recommendations?: string[] | null
          created_at?: string | null
          dimensions_score?: Json | null
          final_text_override?: string | null
          id?: string
          is_approved?: boolean | null
          reviewer_id?: string | null
          risk_level?: string | null
          submission_id: string
          updated_at?: string | null
        }
        Update: {
          ai_analysis_text?: string | null
          ai_conclusion?: string | null
          ai_recommendations?: string[] | null
          created_at?: string | null
          dimensions_score?: Json | null
          final_text_override?: string | null
          id?: string
          is_approved?: boolean | null
          reviewer_id?: string | null
          risk_level?: string | null
          submission_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "participation_control"
            referencedColumns: ["submission_id"]
          },
          {
            foreignKeyName: "reports_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions_anonymized"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_matrix_biomecanicos: {
        Row: {
          cid_relacionado: string | null
          created_at: string | null
          dano_potencial: string | null
          fonte_geradora: string | null
          gravidade_padrao: number | null
          id: string
          is_active: boolean | null
          medida_controle_sugerida: string | null
          nr_referencia: string[] | null
          observacoes: string | null
          perigo: string
          probabilidade_base: number | null
          segmento_corporal: string
          updated_at: string | null
        }
        Insert: {
          cid_relacionado?: string | null
          created_at?: string | null
          dano_potencial?: string | null
          fonte_geradora?: string | null
          gravidade_padrao?: number | null
          id?: string
          is_active?: boolean | null
          medida_controle_sugerida?: string | null
          nr_referencia?: string[] | null
          observacoes?: string | null
          perigo: string
          probabilidade_base?: number | null
          segmento_corporal: string
          updated_at?: string | null
        }
        Update: {
          cid_relacionado?: string | null
          created_at?: string | null
          dano_potencial?: string | null
          fonte_geradora?: string | null
          gravidade_padrao?: number | null
          id?: string
          is_active?: boolean | null
          medida_controle_sugerida?: string | null
          nr_referencia?: string[] | null
          observacoes?: string | null
          perigo?: string
          probabilidade_base?: number | null
          segmento_corporal?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      risk_matrix_ergos: {
        Row: {
          created_at: string | null
          dano_potencial: string | null
          dimension: string
          fonte_geradora: string | null
          gravidade_padrao: number | null
          id: string
          is_active: boolean | null
          medida_controle_sugerida: string | null
          nr_referencia: string[] | null
          observacoes: string | null
          perigo: string
          probabilidade_base: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dano_potencial?: string | null
          dimension: string
          fonte_geradora?: string | null
          gravidade_padrao?: number | null
          id?: string
          is_active?: boolean | null
          medida_controle_sugerida?: string | null
          nr_referencia?: string[] | null
          observacoes?: string | null
          perigo: string
          probabilidade_base?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dano_potencial?: string | null
          dimension?: string
          fonte_geradora?: string | null
          gravidade_padrao?: number | null
          id?: string
          is_active?: boolean | null
          medida_controle_sugerida?: string | null
          nr_referencia?: string[] | null
          observacoes?: string | null
          perigo?: string
          probabilidade_base?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      risk_matrix_hseit: {
        Row: {
          benchmark_hse: number | null
          created_at: string | null
          dano_potencial: string | null
          dimension: string
          fonte_geradora: string | null
          gravidade_padrao: number | null
          id: string
          is_active: boolean | null
          medida_controle_sugerida: string | null
          nr_referencia: string[] | null
          observacoes: string | null
          perigo: string
          probabilidade_base: number | null
          updated_at: string | null
        }
        Insert: {
          benchmark_hse?: number | null
          created_at?: string | null
          dano_potencial?: string | null
          dimension: string
          fonte_geradora?: string | null
          gravidade_padrao?: number | null
          id?: string
          is_active?: boolean | null
          medida_controle_sugerida?: string | null
          nr_referencia?: string[] | null
          observacoes?: string | null
          perigo: string
          probabilidade_base?: number | null
          updated_at?: string | null
        }
        Update: {
          benchmark_hse?: number | null
          created_at?: string | null
          dano_potencial?: string | null
          dimension?: string
          fonte_geradora?: string | null
          gravidade_padrao?: number | null
          id?: string
          is_active?: boolean | null
          medida_controle_sugerida?: string | null
          nr_referencia?: string[] | null
          observacoes?: string | null
          perigo?: string
          probabilidade_base?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      submission_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          form_id: string
          id: string
          ip_hash: string | null
          token: string
          used: boolean | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          form_id: string
          id?: string
          ip_hash?: string | null
          token: string
          used?: boolean | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          form_id?: string
          id?: string
          ip_hash?: string | null
          token?: string
          used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_tokens_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          answers: Json
          created_at: string | null
          data_retention_until: string | null
          employee_id: string | null
          form_id: string
          id: string
          ip_hash: string | null
          respondent_data: Json
          respondent_hash: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
        }
        Insert: {
          answers?: Json
          created_at?: string | null
          data_retention_until?: string | null
          employee_id?: string | null
          form_id: string
          id?: string
          ip_hash?: string | null
          respondent_data?: Json
          respondent_hash?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
        }
        Update: {
          answers?: Json
          created_at?: string | null
          data_retention_until?: string | null
          employee_id?: string | null
          form_id?: string
          id?: string
          ip_hash?: string | null
          respondent_data?: Json
          respondent_hash?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      suggested_actions: {
        Row: {
          action_description: string | null
          action_title: string
          created_at: string | null
          dimension: string | null
          due_date: string | null
          id: string
          nr_referencia: string[] | null
          nre_classification: string | null
          nre_score: number | null
          priority: string | null
          report_id: string | null
          responsible: string | null
          risk_detected: string
          source_matrix: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          action_description?: string | null
          action_title: string
          created_at?: string | null
          dimension?: string | null
          due_date?: string | null
          id?: string
          nr_referencia?: string[] | null
          nre_classification?: string | null
          nre_score?: number | null
          priority?: string | null
          report_id?: string | null
          responsible?: string | null
          risk_detected: string
          source_matrix?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          action_description?: string | null
          action_title?: string
          created_at?: string | null
          dimension?: string | null
          due_date?: string | null
          id?: string
          nr_referencia?: string[] | null
          nre_classification?: string | null
          nre_score?: number | null
          priority?: string | null
          report_id?: string | null
          responsible?: string | null
          risk_detected?: string
          source_matrix?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggested_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_secret: boolean | null
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_secret?: boolean | null
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_secret?: boolean | null
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      system_updates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          title: string
          type: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          title: string
          type?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          title?: string
          type?: string | null
          version?: string | null
        }
        Relationships: []
      }
      tanguro_risk_matrix: {
        Row: {
          created_at: string | null
          detection_d: number | null
          dimension: string | null
          id: string
          is_active: boolean | null
          nr_referencia: string[] | null
          probability_p: number | null
          risk_factor: string
          severity_g: number | null
          source: string | null
          suggested_action: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          detection_d?: number | null
          dimension?: string | null
          id?: string
          is_active?: boolean | null
          nr_referencia?: string[] | null
          probability_p?: number | null
          risk_factor: string
          severity_g?: number | null
          source?: string | null
          suggested_action?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          detection_d?: number | null
          dimension?: string | null
          id?: string
          is_active?: boolean | null
          nr_referencia?: string[] | null
          probability_p?: number | null
          risk_factor?: string
          severity_g?: number | null
          source?: string | null
          suggested_action?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_configurations: {
        Row: {
          created_at: string | null
          created_by: string | null
          external_form_id: string
          field_mapping: Json | null
          id: string
          internal_form_id: string | null
          is_active: boolean | null
          last_received_at: string | null
          name: string
          provider: string
          secret_key: string | null
          total_submissions: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          external_form_id: string
          field_mapping?: Json | null
          id?: string
          internal_form_id?: string | null
          is_active?: boolean | null
          last_received_at?: string | null
          name: string
          provider: string
          secret_key?: string | null
          total_submissions?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          external_form_id?: string
          field_mapping?: Json | null
          id?: string
          internal_form_id?: string | null
          is_active?: boolean | null
          last_received_at?: string | null
          name?: string
          provider?: string
          secret_key?: string | null
          total_submissions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configurations_internal_form_id_fkey"
            columns: ["internal_form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      aggregated_reports_by_role: {
        Row: {
          approved_reports: number | null
          avg_risk_score: number | null
          cargo: string | null
          first_submission: string | null
          form_title: string | null
          form_type: Database["public"]["Enums"]["form_type"] | null
          last_submission: string | null
          most_common_risk_level: string | null
          setor: string | null
          total_submissions: number | null
        }
        Relationships: []
      }
      participation_control: {
        Row: {
          cargo: string | null
          form_title: string | null
          form_type: Database["public"]["Enums"]["form_type"] | null
          has_report: boolean | null
          is_approved: boolean | null
          nome: string | null
          setor: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
          submission_id: string | null
          submitted_at: string | null
        }
        Relationships: []
      }
      submissions_anonymized: {
        Row: {
          answers: Json | null
          created_at: string | null
          form_id: string | null
          id: string | null
          respondent_data: Json | null
          respondent_hash: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
        }
        Insert: {
          answers?: Json | null
          created_at?: string | null
          form_id?: string | null
          id?: string | null
          respondent_data?: never
          respondent_hash?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
        }
        Update: {
          answers?: Json | null
          created_at?: string | null
          form_id?: string | null
          id?: string | null
          respondent_data?: never
          respondent_hash?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      anonymize_by_identifier: {
        Args: { target_identifier: string }
        Returns: number
      }
      anonymize_expired_submissions: { Args: never; Returns: number }
      anonymize_submission: {
        Args: { target_submission_id: string }
        Returns: boolean
      }
      cleanup_old_pii: { Args: never; Returns: number }
      export_user_data: { Args: { target_identifier: string }; Returns: Json }
      generate_respondent_hash: {
        Args: { respondent_data: Json }
        Returns: string
      }
      generate_respondent_hash_secure: {
        Args: { respondent_data: Json }
        Returns: string
      }
      generate_signature_hash: {
        Args: {
          report_uuid: string
          signed_timestamp: string
          signer_name: string
        }
        Returns: string
      }
      get_individual_responses_by_role: {
        Args: { target_cargo: string; target_setor?: string }
        Returns: {
          answers: Json
          cargo: string
          form_title: string
          nome: string
          risk_level: string
          setor: string
          submission_id: string
          submitted_at: string
        }[]
      }
      get_nre_classification: { Args: { nre: number }; Returns: string }
      get_submission_full_data: {
        Args: { submission_uuid: string }
        Returns: {
          answers: Json
          created_at: string
          form_id: string
          id: string
          respondent_data: Json
          status: string
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      mask_sensitive_data: { Args: { data: Json }; Returns: Json }
      search_similar_chunks: {
        Args: {
          agent_uuid: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
      }
      sign_report: {
        Args: {
          p_ip_address?: string
          p_signer_credential?: string
          p_signer_name: string
          p_signer_role: string
          p_user_agent?: string
          report_uuid: string
        }
        Returns: {
          signature_hash: string
          signature_id: string
          verification_code: string
        }[]
      }
      verify_signature: {
        Args: { verification_code_input: string }
        Returns: {
          is_valid: boolean
          report_id: string
          signed_at: string
          signer_credential: string
          signer_name: string
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "admin_hc" | "employee_amaggi"
      form_type: "hse_it" | "ergos"
      submission_status: "pending_ai" | "processed" | "approved"
      user_role: "admin_hc" | "employee_amaggi"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin_hc", "employee_amaggi"],
      form_type: ["hse_it", "ergos"],
      submission_status: ["pending_ai", "processed", "approved"],
      user_role: ["admin_hc", "employee_amaggi"],
    },
  },
} as const
