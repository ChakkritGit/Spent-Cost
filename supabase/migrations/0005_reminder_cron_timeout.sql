-- Requires the pg_cron/pg_net and Vault setup in docs/push-notifications.md.
-- Update the existing named job; never trigger an extra morning delivery.
do $migration$
declare
  reminder_job record;
begin
  for reminder_job in select jobid from cron.job where jobname = 'push-reminders' loop
    perform cron.alter_job(reminder_job.jobid, command := $command$
      select net.http_post(
        url := 'https://yavhirzrepgpvvapohyz.supabase.co/functions/v1/push-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $command$);
  end loop;
end;
$migration$;
