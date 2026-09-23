-- 009_voice_settings.sql

-- Add voice preference fields to the public.agents table

ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS voice_auto_detect BOOLEAN DEFAULT false;
