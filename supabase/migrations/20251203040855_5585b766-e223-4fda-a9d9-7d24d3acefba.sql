-- Fix privilege escalation: Add WITH CHECK clause to prevent role changes
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can update their own profile" ON profiles
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Also add policy to prevent admins from escalating to super_admin via profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can update profiles" ON profiles
FOR UPDATE 
USING (is_admin(auth.uid()))
WITH CHECK (
  is_admin(auth.uid()) AND 
  role = (SELECT role FROM profiles WHERE id = profiles.id)
);