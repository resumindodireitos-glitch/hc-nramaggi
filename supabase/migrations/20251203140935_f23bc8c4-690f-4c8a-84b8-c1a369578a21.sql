-- Ensure knowledge-base bucket exists and is properly configured
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-base', 
  'knowledge-base', 
  false, 
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Admin can upload knowledge docs" ON storage.objects;
DROP POLICY IF EXISTS "Admin can read knowledge docs" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete knowledge docs" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access knowledge" ON storage.objects;

-- Policy: Admins can upload files to knowledge-base bucket
CREATE POLICY "Admin can upload knowledge docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'knowledge-base' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin_hc', 'super_admin')
  )
);

-- Policy: Admins can read files from knowledge-base bucket
CREATE POLICY "Admin can read knowledge docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'knowledge-base' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin_hc', 'super_admin')
  )
);

-- Policy: Admins can delete files from knowledge-base bucket
CREATE POLICY "Admin can delete knowledge docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'knowledge-base' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin_hc', 'super_admin')
  )
);

-- Policy: Service role has full access (for edge functions)
CREATE POLICY "Service role full access knowledge"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'knowledge-base')
WITH CHECK (bucket_id = 'knowledge-base');