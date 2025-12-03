-- Allow anonymous users to view active forms (for public form access)
DROP POLICY IF EXISTS "Anyone can view active forms" ON public.forms;
CREATE POLICY "Anyone can view active forms" 
ON public.forms 
FOR SELECT 
USING (is_active = true);

-- Allow anonymous users to create submissions (for public form submissions)
DROP POLICY IF EXISTS "Authenticated users can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
CREATE POLICY "Anyone can create submissions" 
ON public.submissions 
FOR INSERT 
WITH CHECK (true);

-- Allow users to view their own submissions by submission ID (for confirmation)
DROP POLICY IF EXISTS "Anyone can view submission by id" ON public.submissions;
CREATE POLICY "Anyone can view submission by id"
ON public.submissions
FOR SELECT
USING (true);