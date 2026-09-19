# Expense & Debt Tracker — Design

Date: 2026-09-19
Status: approved

## What this is

A personal expense and debt tracker. It records recurring commitments
(Netflix, loan installments, credit card payments) and one-off spending,
tracks progress on fixed-total debts, and shows the month on a dashboard
and a calendar. Multi-user, each user sees only their own rows.

Thai UI, THB only. Installs as a PWA. A PIN screen guards the app on the
device before the dashboard appears.

## Stack

Next.js 16 App Router, TypeScript, Tailwind v4, `@supabase/ssr` against
Supabase Postgres, `next-themes` for dark mode. Deployed on Vercel.

Deliberately absent: Prisma, `next-intl`, a charting library, a date
library, `next-pwa`. Each is replaced below by something already present
in the platform.

## Data model

Three tables. The central decision is that **a recurring subscription and
a debt are the same thing** — a commitment that bills monthly. A debt is
a commitment that also knows its total. One table serves both.

```sql
profiles
  id          uuid primary key references auth.users on delete cascade
  pin_hash    text
  created_at  timestamptz default now()

plans
  id            uuid primary key default gen_random_uuid()
  user_id       uuid not null references auth.users on delete cascade
  name          text not null
  amount        numeric(12,2) not null      -- charged per month
  category      text not null
  day_of_month  int not null check (day_of_month between 1 and 31)
  total_amount  numeric(12,2)               -- NOT NULL => debt with progress
  active        boolean not null default true
  created_at    timestamptz default now()

entries
  id         uuid primary key default gen_random_uuid()
  user_id    uuid not null references auth.users on delete cascade
  plan_id    uuid references plans on delete set null
  name       text not null
  amount     numeric(12,2) not null
  category   text not null
  due_date   date not null
  paid_at    timestamptz
  created_at timestamptz default now()
```

Shapes this covers:

- Netflix — a `plan` with `total_amount` null
- A 500,000 THB car loan at 12,000/month — a `plan` with
  `total_amount = 500000`
- A one-off meal — an `entry` with `plan_id` null
- A credit card bill that differs each month — a `plan` whose generated
  entry gets its amount edited before it is marked paid

### Derived numbers

- **Per-debt progress** = `sum(entries.amount where plan_id = X and
  paid_at is not null) / plans.total_amount`, clamped to 100% for the
  bar but reported truthfully in text. Paying extra or short is recorded
  as it happened; the schema stores no assumption that every installment
  equals `amount`.
- **Total debt** = `sum(total_amount)` over active plans where
  `total_amount is not null`.
- **Total paid** = the sum of paid entries belonging to those plans.
- **Remaining** = total debt − total paid.

### Isolation

Every table has RLS enabled with `user_id = auth.uid()` (`profiles`
uses `id = auth.uid()`) for select, insert, update and delete. The
application issues no ownership filter of its own — the database is the
single place ownership is enforced, so a forgotten `where` cannot leak
another user's rows.

### Indexes

- `entries (user_id, due_date)` — every month query
- `entries (plan_id) where paid_at is not null` — progress sums
- `unique (plan_id, due_date) where plan_id is not null` — makes month
  generation idempotent

## Generating next month

A button, not a scheduler. Given a target month, one insert reads the
active plans and writes an entry per plan, with `due_date` built from
the plan's `day_of_month` clamped to the length of that month (day 31 in
February lands on the 28th or 29th).

The unique index makes it safe to press twice: the insert uses
`on conflict do nothing`, so re-running adds only plans created since the
last press and never duplicates an existing row.

Skipped: pg_cron and Vercel Cron. They buy automatic appearance at the
cost of infrastructure that can fail silently between months. Add one
when pressing the button becomes a chore.

## Screens

- `/` — dashboard. Four summary cards (spent this month, outstanding
  this month, total debt remaining, total paid), a six-month bar chart,
  a by-category donut, and this month's entries with a paid toggle.
- `/plans` — recurring commitments and debts. Debts carry a progress bar
  with paid / total beneath it. Create, edit, deactivate.
- `/calendar` — a month grid. Each day shows dots for entries due, paid
  and unpaid distinguished by fill.
- `/login` — Supabase Auth.

## PIN and PWA

**PIN.** Stored as a SHA-256 hash in `profiles.pin_hash`, verified
server-side. A successful unlock sets a flag in `sessionStorage`, so the
PIN is asked once per browser session.

This is a shoulder-surfing curtain, not a security boundary. Anyone
holding a valid Supabase session could reach the data through the API
without ever seeing the PIN screen. The real boundary is Supabase Auth
plus RLS; the PIN exists so the numbers are not on screen the moment the
tab is opened. Setting it is optional and it is clearly labelled as
such.

**PWA.** `src/app/manifest.ts` — a Next.js native route, no plugin —
plus a service worker of roughly 25 lines that caches the app shell and
serves it when the network is unavailable. Financial figures are never
served stale from cache: the worker is network-first for data and
cache-first only for static shell assets.

Skipped: `next-pwa`. It wraps a Workbox config to produce what those 25
lines do here.

## Charts and calendar

Both are hand-written.

The charts are a bar chart and a donut, both plain inline SVG — a few
dozen lines each, theme-aware through CSS custom properties, and small
enough to read at a glance. A charting library would add a dependency
and a bundle for two static figures.

The calendar is a CSS grid with `Intl.DateTimeFormat` for month and
weekday names. Month length and first-weekday offset are two lines of
`Date` arithmetic. A date library earns its place when time zones and
parsing get involved; neither appears here.

## Testing

Vitest over the money logic, which is where a silent error costs
something real:

- debt progress, including overpayment and underpayment
- dashboard totals across mixed plans and one-off entries
- month generation: correct dates, day-of-month clamping at month end,
  and idempotency on a second run

The UI is verified by `next build`, `tsc --noEmit`, `eslint`, and a
Playwright pass over every route in both themes checking for console
errors and horizontal overflow — the standing bar used on the portfolio
project.

## Out of scope

Multi-currency, shared or household budgets, bank or statement import,
receipt photos, budget limits with alerts, and data export. None is
needed to record what is owed and see what is left; each can be added
against this schema without reshaping it.
