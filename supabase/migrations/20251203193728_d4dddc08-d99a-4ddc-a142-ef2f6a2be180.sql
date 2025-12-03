-- Update GOOGLE_API_KEY with user's provided key
UPDATE system_settings 
SET value = 'AIzaSyBGJ5qUpNeqPI9nSR7pJDWY6WbLnnHHy7o', updated_at = now() 
WHERE key = 'GOOGLE_API_KEY';

-- Insert if doesn't exist
INSERT INTO system_settings (key, value, description, is_secret)
SELECT 'GOOGLE_API_KEY', 'AIzaSyBGJ5qUpNeqPI9nSR7pJDWY6WbLnnHHy7o', 'Google Gemini API Key', true
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'GOOGLE_API_KEY');

-- Fix agent model: gemini-2.5-flash is not valid for direct Google API, use gemini-1.5-flash
UPDATE ai_prompts 
SET model = 'gemini-1.5-flash', updated_at = now() 
WHERE provider = 'google' AND model LIKE '%gemini-2.5%';

-- Restore status for submissions that have approved reports
UPDATE submissions 
SET status = 'approved' 
WHERE id IN (
  SELECT submission_id FROM reports WHERE is_approved = true
)
AND status != 'approved';