-- Fix function search_path for security
CREATE OR REPLACE FUNCTION public.get_nre_classification(nre INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE
    WHEN nre <= 50 THEN 'Trivial'
    WHEN nre <= 100 THEN 'Tolerável'
    WHEN nre <= 200 THEN 'Moderado'
    WHEN nre <= 400 THEN 'Substancial'
    ELSE 'Intolerável'
  END;
END;
$$;