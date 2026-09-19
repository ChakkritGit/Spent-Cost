-- Expense and debt tracker. A `plan` is a monthly commitment; one that knows
-- its `total_amount` is a debt and gets a progress bar. An `entry` is a dated
-- charge, generated from a plan or entered on its own.

create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  pin_hash   text,
  created_at timestamptz not null default now()
);

create table plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  name         text not null,
  amount       numeric(12,2) not null check (amount >= 0),
  category     text not null,
  day_of_month int  not null check (day_of_month between 1 and 31),
  total_amount numeric(12,2) check (total_amount > 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  plan_id    uuid references plans on delete set null,
  name       text not null,
  amount     numeric(12,2) not null check (amount >= 0),
  category   text not null,
  due_date   date not null,
  paid_at    timestamptz,
  created_at timestamptz not null default now(),
  -- Makes "generate next month" idempotent. Not a partial index: Postgres
  -- treats NULLs as distinct, so one-off entries (plan_id null) never collide.
  unique (plan_id, due_date)
);

create index entries_user_due_idx on entries (user_id, due_date);
create index entries_plan_paid_idx on entries (plan_id) where paid_at is not null;
create index plans_user_active_idx on plans (user_id) where active;

-- Ownership lives here and nowhere else. No application query filters by user.
alter table profiles enable row level security;
alter table plans    enable row level security;
alter table entries  enable row level security;

create policy "own profile" on profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own plans" on plans
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own entries" on entries
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Every signed-up user gets a profile row, so the PIN screen has somewhere to write.
create function handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
