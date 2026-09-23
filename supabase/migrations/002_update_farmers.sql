-- 002_update_farmers.sql
-- Add missing columns to the farmers table as requested in the Farmer Management requirements.

ALTER TABLE public.farmers
ADD COLUMN IF NOT EXISTS pincode TEXT,
ADD COLUMN IF NOT EXISTS farm_name TEXT,
ADD COLUMN IF NOT EXISTS farm_size_unit TEXT,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'Pending';

-- Optional: If you wish to migrate existing farmers to 'Verified' to not break current UI logic
UPDATE public.farmers SET verification_status = 'Verified' WHERE verification_status = 'Pending' AND created_at < NOW() - INTERVAL '1 day';
