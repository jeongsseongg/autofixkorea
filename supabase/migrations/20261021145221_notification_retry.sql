-- Retry only the current photo-intake queue; the worker preserves sent/uncertain steps.
-- Reuse the existing analytics worker credential through its protected authorize RPC.
begin;

do $guard$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'autofix_analytics_worker_key'
      and decrypted_secret ~ '^[a-f0-9]{64}$'
  ) then
    raise exception 'AUTOFIX_NOTIFICATION_WORKER_CREDENTIAL_MISSING';
  end if;
  if exists (select 1 from cron.job where jobname = 'autofix-notification-retry') then
    raise exception 'AUTOFIX_NOTIFICATION_RETRY_JOB_ALREADY_EXISTS';
  end if;
end;
$guard$;

select cron.schedule(
  'autofix-notification-retry',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://ytigiculewerivyytxza.supabase.co/functions/v1/autofix-notification-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-key', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'autofix_analytics_worker_key'
      )
    ),
    body := '{"action":"retry","limit":2}'::jsonb,
    timeout_milliseconds := 115000
  );
  $job$
);

commit;
