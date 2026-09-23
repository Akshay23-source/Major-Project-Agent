-- marketplace_callback_cron.sql  (run ONCE in the Supabase SQL editor, after 014)
--
-- Safety net for the marketplace callback queue: every minute, pg_cron asks the
-- marketplace-callback-worker Edge Function to drain due / retrying callbacks.
-- (The apps also nudge the worker right after each status change, so callbacks
-- normally go out within a second; this sweep handles retries and app crashes.)
--
-- Replace the two placeholders below before running:
--   <PROJECT_REF>  e.g. abcdefghijklmnopqrst   (Project Settings → General)
--   <ANON_KEY>     your project's anon / publishable key (it is public anyway)
--
-- This file is intentionally NOT in supabase/migrations because it contains
-- project-specific values.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Re-runnable: drop the old schedule first
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'marketplace-callback-worker';

SELECT cron.schedule(
  'marketplace-callback-worker',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/marketplace-callback-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);

-- Check it:   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
-- Remove it:  SELECT cron.unschedule('marketplace-callback-worker');
