-- Web Push: one row per device that allowed notifications. The morning
-- reminder (supabase/functions/push-reminders) reads these with the service
-- role; the app reads and writes only its own, through RLS like every table.
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "own push subscriptions" on push_subscriptions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The morning scan: every unpaid entry due by tomorrow, across users.
create index entries_unpaid_due_idx on entries (due_date) where paid_at is null;
