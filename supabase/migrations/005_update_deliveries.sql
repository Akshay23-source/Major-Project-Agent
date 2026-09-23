-- Add notes to deliveries table
ALTER TABLE public.deliveries 
ADD COLUMN IF NOT EXISTS notes TEXT;
