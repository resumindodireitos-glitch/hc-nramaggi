-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Rename concept: prompts -> agents (keeping table name for compatibility)
-- Add agent configuration columns to ai_prompts table
ALTER TABLE public.ai_prompts 
ADD COLUMN IF NOT EXISTS use_rag BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rag_top_k INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS agent_type TEXT DEFAULT 'analysis';

-- Create knowledge base table for uploaded documents
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  chunks_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create document chunks table with vector embeddings
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create junction table for agent-document access
CREATE TABLE IF NOT EXISTS public.agent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_prompts(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, document_id)
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for faster chunk lookups
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx 
ON public.document_chunks(document_id);

-- Enable RLS
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_documents
CREATE POLICY "Admins can manage documents" ON public.knowledge_documents
FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Super admins can manage documents" ON public.knowledge_documents
FOR ALL USING (is_super_admin(auth.uid()));

-- RLS Policies for document_chunks
CREATE POLICY "Admins can view chunks" ON public.document_chunks
FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Super admins can manage chunks" ON public.document_chunks
FOR ALL USING (is_super_admin(auth.uid()));

-- RLS Policies for agent_documents
CREATE POLICY "Admins can view agent documents" ON public.agent_documents
FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Super admins can manage agent documents" ON public.agent_documents
FOR ALL USING (is_super_admin(auth.uid()));

-- Create storage bucket for knowledge base files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-base',
  'knowledge-base',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
        'text/csv', 'text/plain', 'application/msword']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admins can upload knowledge files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'knowledge-base' AND is_admin(auth.uid()));

CREATE POLICY "Admins can read knowledge files" ON storage.objects
FOR SELECT USING (bucket_id = 'knowledge-base' AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete knowledge files" ON storage.objects
FOR DELETE USING (bucket_id = 'knowledge-base' AND is_admin(auth.uid()));

-- Function to search similar chunks using vector similarity
CREATE OR REPLACE FUNCTION public.search_similar_chunks(
  query_embedding vector(1536),
  agent_uuid UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  INNER JOIN agent_documents ad ON dc.document_id = ad.document_id
  WHERE ad.agent_id = agent_uuid
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;