-- Add notes to payments and farmer_settlements tables
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.farmer_settlements 
ADD COLUMN IF NOT EXISTS notes TEXT;
