-- Spent/Cost's database on the VPS (since 2026-10-15; before that, Supabase — see supabase/migrations
-- for that history). Login is still Supabase Auth: the database gateway checks the session and PostgREST
-- runs each request as `authenticated` with the user's id in the JWT, so the RLS policies below are the
-- same as on Supabase. Differences, because auth.users lives on Supabase, not here:
--   * no foreign keys to auth.users (deleting a login there no longer cascades here);
--   * no on_auth_user_created trigger: the gateway inserts a profile the first time it sees a user;
--   * no pg_cron / pg_net: the reminders service schedules the morning run itself.
-- Apply as the database owner:  psql -d expenses -f db/schema.sql   (roles come from the VPS init script)

begin;

-- ------------------------------------------------------------------ Supabase-compatible auth helpers
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- ------------------------------------------------------------------ tables (0001–0004, 0006)
-- Expense and debt tracker. A `plan` is a monthly commitment; one that knows its `total_amount` is a
-- debt and gets a progress bar. An `entry` is a dated charge, generated from a plan or entered on its own.
create table profiles (
  id         uuid primary key,
  pin_hash   text,
  created_at timestamptz not null default now()
);

create table plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  name         text not null,
  amount       numeric(12,2) not null check (amount >= 0),
  category     text not null,
  day_of_month int  not null check (day_of_month between 1 and 31),
  total_amount numeric(12,2) check (total_amount > 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  -- one-time opening balance, so a debt that predates the app shows real progress
  paid_before  numeric(12,2) not null default 0 check (paid_before >= 0)
);

create table entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  plan_id    uuid references plans on delete set null,
  name       text not null,
  amount     numeric(12,2) not null check (amount >= 0),
  category   text not null,
  due_date   date not null,
  paid_at    timestamptz,
  created_at timestamptz not null default now(),
  -- makes "generate next month" idempotent; one-off entries (plan_id null) never collide
  unique (plan_id, due_date)
);

create index entries_user_due_idx on entries (user_id, due_date);
create index entries_plan_paid_idx on entries (plan_id) where paid_at is not null;
create index plans_user_active_idx on plans (user_id) where active;
create index entries_unpaid_due_idx on entries (due_date) where paid_at is null;

-- Web Push: one row per device that allowed notifications
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- when each background job last finished (the status page reads it); service role only
create table heartbeats (name text primary key, at timestamptz not null default now());

-- daily reminder receipts: at most one morning push per device per day, retried safely
create table reminder_retry_config (
  singleton boolean primary key default true check (singleton),
  start_day date not null
);
create table reminder_deliveries (
  reminder_day date not null,
  user_id uuid not null,
  endpoint_hash text not null check (endpoint_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('sending', 'sent', 'gone', 'failed', 'uncertain')),
  claim_id uuid not null,
  attempts integer not null default 1 check (attempts between 1 and 96),
  lease_until timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (reminder_day, user_id, endpoint_hash)
);

-- ------------------------------------------------------------------ ownership (RLS), as on Supabase
alter table profiles enable row level security;
alter table plans enable row level security;
alter table entries enable row level security;
alter table push_subscriptions enable row level security;
alter table heartbeats enable row level security;
alter table reminder_retry_config enable row level security;
alter table reminder_deliveries enable row level security;

create policy "own profile" on profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "own plans" on plans
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own entries" on entries
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own push subscriptions" on push_subscriptions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Supabase's default grants (RLS does the filtering), minus what is service-role only
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
revoke all on heartbeats, reminder_retry_config, reminder_deliveries from anon, authenticated;

-- ------------------------------------------------------------------ delivery receipts (0006)
create function claim_reminder_delivery(
  p_day date, p_user uuid, p_endpoint_hash text, p_claim uuid
) returns text language plpgsql security definer set search_path = public as $function$
declare
  receipt reminder_deliveries%rowtype;
  inserted boolean := false;
begin
  insert into reminder_deliveries
    (reminder_day, user_id, endpoint_hash, state, claim_id, lease_until)
  values (p_day, p_user, p_endpoint_hash, 'sending', p_claim, now() + interval '5 minutes')
  on conflict do nothing returning true into inserted;

  if inserted then return 'claimed'; end if;

  select * into strict receipt from reminder_deliveries
  where reminder_day = p_day and user_id = p_user and endpoint_hash = p_endpoint_hash
  for update;

  if receipt.state in ('sent', 'gone', 'uncertain') then return receipt.state; end if;
  if receipt.state = 'sending' then
    if receipt.lease_until <= now() then
      update reminder_deliveries set state = 'uncertain', updated_at = now()
      where reminder_day = p_day and user_id = p_user and endpoint_hash = p_endpoint_hash;
      return 'uncertain';
    end if;
    -- a repeated token cannot replay the first request's permission to send
    return 'busy';
  end if;

  if receipt.attempts >= 96 then return 'exhausted'; end if;
  update reminder_deliveries
    set state = 'sending', claim_id = p_claim, attempts = attempts + 1,
        lease_until = now() + interval '5 minutes', updated_at = now()
    where reminder_day = p_day and user_id = p_user and endpoint_hash = p_endpoint_hash;
  return 'claimed';
end;
$function$;

create function finish_reminder_delivery(
  p_day date, p_user uuid, p_endpoint_hash text, p_claim uuid, p_outcome text
) returns boolean language plpgsql security definer set search_path = public as $function$
begin
  if p_outcome is null or p_outcome not in ('sent', 'gone', 'failed', 'uncertain') then
    raise exception 'invalid delivery outcome';
  end if;
  update reminder_deliveries set state = p_outcome, updated_at = now()
  where reminder_day = p_day and user_id = p_user and endpoint_hash = p_endpoint_hash
    and claim_id = p_claim and (state in ('sending', 'uncertain') or state = p_outcome);
  return found;
end;
$function$;

revoke all on function claim_reminder_delivery(date, uuid, text, uuid) from public, anon, authenticated;
revoke all on function finish_reminder_delivery(date, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function claim_reminder_delivery(date, uuid, text, uuid) to service_role;
grant execute on function finish_reminder_delivery(date, uuid, text, uuid, text) to service_role;

commit;
