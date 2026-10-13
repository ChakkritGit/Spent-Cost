-- Run after migration 0006, with the retry cron still paused. No pushes occur.
-- All synthetic receipts are rolled back. This exercises the actual RPC state
-- machine; run reminder_delivery_concurrency.py for multi-connection row locks.
begin;
do $test$
declare
  test_user uuid;
  test_day date := date '1900-01-01';
  hash text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  owner uuid := gen_random_uuid();
  other_owner uuid := gen_random_uuid();
  verdict text;
begin
  select id into test_user from auth.users order by id limit 1;
  if test_user is null then raise exception 'receipt test needs one existing auth user'; end if;
  if exists (
    select 1 from unnest(array['anon', 'authenticated']) as callers(role_name)
    where has_function_privilege(role_name, 'public.claim_reminder_delivery(date,uuid,text,uuid)', 'EXECUTE')
      or has_function_privilege(role_name, 'public.finish_reminder_delivery(date,uuid,text,uuid,text)', 'EXECUTE')
      or has_table_privilege(role_name, 'public.reminder_deliveries', 'SELECT,INSERT,UPDATE,DELETE')
      or has_table_privilege(role_name, 'public.reminder_retry_config', 'SELECT,INSERT,UPDATE,DELETE')
  ) then
    raise exception 'public callers can access reminder receipts';
  end if;
  if not has_function_privilege('service_role', 'public.claim_reminder_delivery(date,uuid,text,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.finish_reminder_delivery(date,uuid,text,uuid,text)', 'EXECUTE')
    or not has_table_privilege('service_role', 'public.reminder_deliveries', 'SELECT')
    or not has_table_privilege('service_role', 'public.reminder_retry_config', 'SELECT') then
    raise exception 'service role cannot use reminder receipts';
  end if;
  if exists (
    select 1 from pg_class
    where oid in ('public.reminder_deliveries'::regclass, 'public.reminder_retry_config'::regclass)
      and not relrowsecurity
  ) then raise exception 'receipt tables require RLS'; end if;

  verdict := public.claim_reminder_delivery(test_day, test_user, hash, owner);
  if verdict <> 'claimed' then raise exception 'first owner could not claim'; end if;
  verdict := public.claim_reminder_delivery(test_day, test_user, hash, owner);
  if verdict <> 'busy' then raise exception 'same token replayed permission'; end if;
  verdict := public.claim_reminder_delivery(test_day, test_user, hash, other_owner);
  if verdict <> 'busy' then raise exception 'second owner claimed active receipt'; end if;
  if public.finish_reminder_delivery(test_day, test_user, hash, other_owner, 'sent') then
    raise exception 'wrong owner completed a receipt';
  end if;
  if not public.finish_reminder_delivery(test_day, test_user, hash, owner, 'failed') then
    raise exception 'owner could not record rejection';
  end if;
  verdict := public.claim_reminder_delivery(test_day, test_user, hash, other_owner);
  if verdict <> 'claimed' then raise exception 'explicit rejection was not retryable'; end if;
  if not public.finish_reminder_delivery(test_day, test_user, hash, other_owner, 'sent') then
    raise exception 'retry could not record acceptance';
  end if;
  verdict := public.claim_reminder_delivery(test_day, test_user, hash, owner);
  if verdict <> 'sent' then raise exception 'accepted push could be sent again'; end if;

  -- A crash/timeout leaves the outcome unknown; expiration cannot redeliver.
  verdict := public.claim_reminder_delivery(test_day + 1, test_user, hash, owner);
  update public.reminder_deliveries set lease_until = now() - interval '1 second'
  where reminder_day = test_day + 1 and user_id = test_user and endpoint_hash = hash;
  verdict := public.claim_reminder_delivery(test_day + 1, test_user, hash, other_owner);
  if verdict <> 'uncertain' then raise exception 'expired receipt allowed redelivery'; end if;
  if not public.finish_reminder_delivery(test_day + 1, test_user, hash, owner, 'sent') then
    raise exception 'original owner could not confirm a late acceptance';
  end if;

  verdict := public.claim_reminder_delivery(test_day + 2, test_user, hash, owner);
  perform public.finish_reminder_delivery(test_day + 2, test_user, hash, owner, 'failed');
  update public.reminder_deliveries set attempts = 96
  where reminder_day = test_day + 2 and user_id = test_user and endpoint_hash = hash;
  verdict := public.claim_reminder_delivery(test_day + 2, test_user, hash, other_owner);
  if verdict <> 'exhausted' then raise exception 'daily attempt limit was ignored'; end if;
end;
$test$;
rollback;
