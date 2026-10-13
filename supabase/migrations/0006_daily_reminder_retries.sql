begin;

-- Service role only. Never expose endpoint hashes or delivery history to anon.
create table public.reminder_retry_config (
  singleton boolean primary key default true check (singleton),
  start_day date not null
);
alter table public.reminder_retry_config enable row level security;
revoke all on public.reminder_retry_config from anon, authenticated;
grant all on public.reminder_retry_config to service_role;

-- A legacy run may have pushed successfully before failing to write heartbeat.
-- When rolling out after 08:00, start tomorrow unless an operator has verified
-- today's old run never sent a push. This protects the migration boundary too.
insert into public.reminder_retry_config (start_day)
values ((now() at time zone 'Asia/Bangkok')::date +
  case when (now() at time zone 'Asia/Bangkok')::time >= time '08:00' then 1 else 0 end);

create table public.reminder_deliveries (
  reminder_day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint_hash text not null check (endpoint_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('sending', 'sent', 'gone', 'failed', 'uncertain')),
  claim_id uuid not null,
  attempts integer not null default 1 check (attempts between 1 and 96),
  lease_until timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (reminder_day, user_id, endpoint_hash)
);
alter table public.reminder_deliveries enable row level security;
revoke all on public.reminder_deliveries from anon, authenticated;
grant all on public.reminder_deliveries to service_role;

create function public.claim_reminder_delivery(
  p_day date, p_user uuid, p_endpoint_hash text, p_claim uuid
) returns text language plpgsql security definer set search_path = public as $function$
declare
  receipt public.reminder_deliveries%rowtype;
  inserted boolean := false;
begin
  insert into public.reminder_deliveries
    (reminder_day, user_id, endpoint_hash, state, claim_id, lease_until)
  values (p_day, p_user, p_endpoint_hash, 'sending', p_claim, now() + interval '5 minutes')
  on conflict do nothing returning true into inserted;

  if inserted then return 'claimed'; end if;

  select * into strict receipt from public.reminder_deliveries
  where reminder_day = p_day and user_id = p_user and endpoint_hash = p_endpoint_hash
  for update;

  if receipt.state in ('sent', 'gone', 'uncertain') then return receipt.state; end if;
  if receipt.state = 'sending' then
    if receipt.lease_until <= now() then
      update public.reminder_deliveries set state = 'uncertain', updated_at = now()
      where reminder_day = p_day and user_id = p_user and endpoint_hash = p_endpoint_hash;
      return 'uncertain';
    end if;
    -- A repeated token cannot replay the first request's permission to send.
    return 'busy';
  end if;

  if receipt.attempts >= 96 then return 'exhausted'; end if;
  update public.reminder_deliveries
    set state = 'sending', claim_id = p_claim, attempts = attempts + 1,
        lease_until = now() + interval '5 minutes', updated_at = now()
    where reminder_day = p_day and user_id = p_user and endpoint_hash = p_endpoint_hash;
  return 'claimed';
end;
$function$;

create function public.finish_reminder_delivery(
  p_day date, p_user uuid, p_endpoint_hash text, p_claim uuid, p_outcome text
) returns boolean language plpgsql security definer set search_path = public as $function$
begin
  if p_outcome is null or p_outcome not in ('sent', 'gone', 'failed', 'uncertain') then
    raise exception 'invalid delivery outcome';
  end if;
  update public.reminder_deliveries set state = p_outcome, updated_at = now()
  where reminder_day = p_day and user_id = p_user and endpoint_hash = p_endpoint_hash
    and claim_id = p_claim and (state in ('sending', 'uncertain') or state = p_outcome);
  return found;
end;
$function$;

revoke all on function public.claim_reminder_delivery(date, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.finish_reminder_delivery(date, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_reminder_delivery(date, uuid, text, uuid) to service_role;
grant execute on function public.finish_reminder_delivery(date, uuid, text, uuid, text) to service_role;

-- Replace the existing named job, so 08:00 is not queued twice. Every ten
-- minutes from 08:00 to 23:50 Bangkok, queue only if today's run isn't complete.
do $migration$
declare reminder_job bigint;
begin
  select jobid into strict reminder_job from cron.job where jobname = 'push-reminders';
  perform cron.alter_job(reminder_job, schedule := '*/10 1-16 * * *', command := $command$
    select net.http_post(
      url := 'https://yavhirzrepgpvvapohyz.supabase.co/functions/v1/push-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    )
    where (now() at time zone 'Asia/Bangkok')::date >=
      (select start_day from public.reminder_retry_config where singleton)
      and not exists (
        select 1 from public.heartbeats
        where name = 'push-reminders'
          and (at at time zone 'Asia/Bangkok')::date = (now() at time zone 'Asia/Bangkok')::date
      );
  $command$);
end;
$migration$;

commit;
