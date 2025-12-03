-- Melhorar o trigger handle_new_user para ser mais robusto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role_value user_role;
  app_role_value app_role;
  user_full_name text;
  user_email text;
BEGIN
  -- Get safe values with fallbacks
  user_email := COALESCE(NEW.email, 'unknown@email.com');
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'name',
    split_part(user_email, '@', 1)
  );
  
  -- Get role from metadata, defaulting to employee_amaggi
  -- Only accept valid user_role values: admin_hc or employee_amaggi
  BEGIN
    user_role_value := COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role, 
      'employee_amaggi'
    );
  EXCEPTION WHEN OTHERS THEN
    -- If role is invalid (like super_admin), default to admin_hc
    user_role_value := 'admin_hc';
  END;
  
  -- Insert into profiles with ON CONFLICT to handle duplicates
  INSERT INTO public.profiles (id, full_name, email, role, company)
  VALUES (
    NEW.id,
    user_full_name,
    user_email,
    user_role_value,
    'Amaggi'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    updated_at = now();
  
  -- Map user_role to app_role
  IF user_role_value = 'admin_hc' THEN
    app_role_value := 'admin_hc';
  ELSE
    app_role_value := 'employee_amaggi';
  END IF;
  
  -- Insert into user_roles with ON CONFLICT
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, app_role_value)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the signup
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;