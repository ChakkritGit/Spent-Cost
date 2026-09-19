# Expense & Debt Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A multi-user Next.js app that records recurring commitments, one-off spending and fixed-total debts, showing progress per debt and across all debts on a dashboard, a plans page and a calendar.

**Architecture:** Supabase Postgres holds three tables; RLS on `user_id = auth.uid()` is the only ownership boundary, so no application query carries an ownership filter. Subscriptions and debts are one table (`plans`) — a debt is a plan that knows its `total_amount`. Money and date arithmetic live in two pure modules (`src/lib/money.ts`, `src/lib/month.ts`) that are unit-tested; everything else is React Server Components reading through `@supabase/ssr` and Server Actions writing through it.

**Tech Stack:** Next.js 16.3.5 (App Router), React 19.2.8, TypeScript 5, Tailwind v4, `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`, Vitest. No charting library, no date library, no PWA plugin.

**Spec:** `docs/superpowers/specs/2026-09-19-expense-tracker-design.md`

## Global Constraints

- Language: Thai UI only. Currency: THB only. Format with `Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" })`.
- Project root: `/Volumes/SSD256GB/WebProfile/expenses`.
- Import alias is `@/*` → `src/*`.
- Do not add: Prisma, `next-intl`, a charting library, a date library, `next-pwa`. The spec replaces each with a platform feature.
- Every table has RLS enabled. Application code never writes `.eq("user_id", …)` — if a query needs it, the RLS policy is wrong.
- Money columns are `numeric(12,2)`. PostgREST returns them as JSON numbers; every row-reading path coerces with `Number()` at the boundary and every sum rounds with `Math.round(x * 100) / 100` before display.
- All four routes must render without console errors and without horizontal overflow at 375px width, in both light and dark themes.
- Commit after every task. Commit messages end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

### Task 1: Pure money and month logic, under test

This is the arithmetic every screen depends on. It has no database and no React, so it is written first and tested directly.

**Files:**
- Modify: `package.json` (add `vitest`, test scripts)
- Create: `vitest.config.ts`
- Create: `src/lib/types.ts`
- Create: `src/lib/month.ts`
- Create: `src/lib/money.ts`
- Test: `src/lib/month.test.ts`, `src/lib/money.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Plan = { id: string; user_id: string; name: string; amount: number; category: string; day_of_month: number; total_amount: number | null; active: boolean; created_at: string }`
  - `type Entry = { id: string; user_id: string; plan_id: string | null; name: string; amount: number; category: string; due_date: string; paid_at: string | null; created_at: string }`
  - `daysInMonth(year: number, month: number): number` — `month` is 0-indexed, as `Date` uses.
  - `dueDateFor(year: number, month: number, dayOfMonth: number): string` — ISO `YYYY-MM-DD`.
  - `monthKey(year: number, month: number): string` — `"2026-09"`.
  - `addMonths(year: number, month: number, n: number): { year: number; month: number }`
  - `debtProgress(plan: Plan, entries: Entry[]): { paid: number; total: number; ratio: number }`
  - `summarise(plans: Plan[], entries: Entry[], key: string): { spent: number; outstanding: number; debtTotal: number; debtPaid: number; debtRemaining: number }`
  - `byCategory(entries: Entry[]): { category: string; amount: number }[]`
  - `monthlyTotals(entries: Entry[], keys: string[]): { key: string; amount: number }[]`
  - `baht(n: number): string`

- [ ] **Step 1: Install Vitest and add scripts**

```bash
cd /Volumes/SSD256GB/WebProfile/expenses
npm install -D vitest
npm pkg set scripts.test="vitest run" scripts.test:watch="vitest" scripts.typecheck="tsc --noEmit"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 2: Write `src/lib/types.ts`**

These mirror the database columns exactly. They are written before the tests because the tests construct them.

```ts
/** A recurring commitment. `total_amount` set means it is a debt with progress. */
export type Plan = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  day_of_month: number;
  total_amount: number | null;
  active: boolean;
  created_at: string;
};

/** A dated charge. `plan_id` null means a one-off. `paid_at` null means unpaid. */
export type Entry = {
  id: string;
  user_id: string;
  plan_id: string | null;
  name: string;
  amount: number;
  category: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
};
```

- [ ] **Step 3: Write the failing tests for `month.ts`**

`src/lib/month.test.ts`:

```ts
import { expect, test } from "vitest";
import { addMonths, daysInMonth, dueDateFor, monthKey } from "@/lib/month";

test("daysInMonth knows leap years", () => {
  expect(daysInMonth(2026, 1)).toBe(28); // Feb 2026
  expect(daysInMonth(2028, 1)).toBe(29); // Feb 2028
  expect(daysInMonth(2026, 8)).toBe(30); // Sep
  expect(daysInMonth(2026, 0)).toBe(31); // Jan
});

test("dueDateFor pads to ISO", () => {
  expect(dueDateFor(2026, 8, 5)).toBe("2026-09-05");
  expect(dueDateFor(2026, 11, 25)).toBe("2026-12-25");
});

test("dueDateFor clamps a day the month does not have", () => {
  expect(dueDateFor(2026, 1, 31)).toBe("2026-02-28");
  expect(dueDateFor(2028, 1, 31)).toBe("2028-02-29");
  expect(dueDateFor(2026, 8, 31)).toBe("2026-09-30");
});

test("monthKey matches the prefix of an ISO date", () => {
  expect(monthKey(2026, 8)).toBe("2026-09");
  expect(dueDateFor(2026, 8, 5).startsWith(monthKey(2026, 8))).toBe(true);
});

test("addMonths rolls the year in both directions", () => {
  expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  expect(addMonths(2026, 8, 0)).toEqual({ year: 2026, month: 8 });
});
```

- [ ] **Step 4: Run the tests and watch them fail**

Run: `npm test -- src/lib/month.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/month"`.

- [ ] **Step 5: Write `src/lib/month.ts`**

```ts
/** Number of days in a month. `month` is 0-indexed, as `Date` uses it. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The ISO date a plan falls due in a given month. A plan billed on the 31st
 * lands on the last day of a shorter month rather than spilling into the next.
 */
export function dueDateFor(year: number, month: number, dayOfMonth: number): string {
  const day = Math.min(dayOfMonth, daysInMonth(year, month));
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** "2026-09" — the prefix every ISO date in that month shares. */
export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

export function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const d = new Date(year, month + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npm test -- src/lib/month.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Write the failing tests for `money.ts`**

`src/lib/money.test.ts`. Note the overpayment and underpayment cases — the spec requires the ratio to be reported truthfully even when the bar is clamped.

```ts
import { expect, test } from "vitest";
import { byCategory, debtProgress, monthlyTotals, summarise } from "@/lib/money";
import type { Entry, Plan } from "@/lib/types";

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: "p1",
  user_id: "u1",
  name: "หนี้รถ",
  amount: 12000,
  category: "หนี้",
  day_of_month: 5,
  total_amount: 500000,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: crypto.randomUUID(),
  user_id: "u1",
  plan_id: "p1",
  name: "หนี้รถ",
  amount: 12000,
  category: "หนี้",
  due_date: "2026-09-05",
  paid_at: "2026-09-05T00:00:00Z",
  created_at: "2026-09-01T00:00:00Z",
  ...over,
});

test("debtProgress counts only paid entries of that plan", () => {
  const entries = [
    entry({ id: "a" }),
    entry({ id: "b" }),
    entry({ id: "c", paid_at: null }),
    entry({ id: "d", plan_id: "other" }),
    entry({ id: "e", plan_id: null }),
  ];
  expect(debtProgress(plan(), entries)).toEqual({ paid: 24000, total: 500000, ratio: 0.048 });
});

test("debtProgress reports overpayment above 1 rather than clamping", () => {
  const p = plan({ total_amount: 10000 });
  expect(debtProgress(p, [entry({ amount: 12000 })]).ratio).toBe(1.2);
});

test("debtProgress on a plan with no total is ratio 0", () => {
  const p = plan({ total_amount: null });
  expect(debtProgress(p, [entry()])).toEqual({ paid: 12000, total: 0, ratio: 0 });
});

test("debtProgress rounds away float drift", () => {
  const p = plan({ total_amount: 100 });
  const entries = [entry({ amount: 0.1 }), entry({ amount: 0.2 })];
  expect(debtProgress(p, entries).paid).toBe(0.3);
});

test("summarise separates this month from the debt lifetime", () => {
  const plans = [plan(), plan({ id: "p2", total_amount: 20000 }), plan({ id: "p3", total_amount: null })];
  const entries = [
    entry({ id: "a", amount: 12000 }),                                  // paid, this month
    entry({ id: "b", amount: 3000, paid_at: null }),                    // unpaid, this month
    entry({ id: "c", amount: 500, plan_id: null, category: "อาหาร" }),   // paid one-off, this month
    entry({ id: "d", amount: 12000, due_date: "2026-08-05" }),          // paid, last month
  ];
  expect(summarise(plans, entries, "2026-09")).toEqual({
    spent: 12500,
    outstanding: 3000,
    debtTotal: 520000,
    debtPaid: 24000,
    debtRemaining: 496000,
  });
});

test("summarise ignores inactive plans in the debt total", () => {
  const plans = [plan(), plan({ id: "p2", total_amount: 20000, active: false })];
  expect(summarise(plans, [], "2026-09").debtTotal).toBe(500000);
});

test("byCategory sums paid and unpaid, largest first", () => {
  const entries = [
    entry({ id: "a", amount: 300, category: "อาหาร" }),
    entry({ id: "b", amount: 12000, category: "หนี้" }),
    entry({ id: "c", amount: 200, category: "อาหาร", paid_at: null }),
  ];
  expect(byCategory(entries)).toEqual([
    { category: "หนี้", amount: 12000 },
    { category: "อาหาร", amount: 500 },
  ]);
});

test("monthlyTotals keeps requested months that have no entries", () => {
  const entries = [entry({ id: "a", amount: 100, due_date: "2026-09-05" })];
  expect(monthlyTotals(entries, ["2026-08", "2026-09"])).toEqual([
    { key: "2026-08", amount: 0 },
    { key: "2026-09", amount: 100 },
  ]);
});
```

- [ ] **Step 8: Run the tests and watch them fail**

Run: `npm test -- src/lib/money.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/money"`.

- [ ] **Step 9: Write `src/lib/money.ts`**

```ts
import type { Entry, Plan } from "@/lib/types";

/**
 * Sum in satang, return in baht. Adding baht as floats drifts by fractions of
 * a satang, which shows up as a wrong figure once rounded for display.
 */
function sum(amounts: number[]): number {
  return amounts.reduce((total, n) => total + Math.round(n * 100), 0) / 100;
}

const isPaid = (e: Entry) => e.paid_at !== null;

/**
 * How far a debt has been repaid. `ratio` is reported as it is — above 1 when
 * overpaid — and callers clamp it for the width of a bar, not for the number
 * they print.
 */
export function debtProgress(plan: Plan, entries: Entry[]): { paid: number; total: number; ratio: number } {
  const paid = sum(entries.filter((e) => e.plan_id === plan.id && isPaid(e)).map((e) => e.amount));
  const total = plan.total_amount ?? 0;
  return { paid, total, ratio: total > 0 ? Math.round((paid / total) * 1e6) / 1e6 : 0 };
}

/** The dashboard's five figures. `key` is a `monthKey`, e.g. "2026-09". */
export function summarise(plans: Plan[], entries: Entry[], key: string) {
  const thisMonth = entries.filter((e) => e.due_date.startsWith(key));
  const debts = plans.filter((p) => p.active && p.total_amount !== null);
  const debtIds = new Set(debts.map((p) => p.id));

  const debtTotal = sum(debts.map((p) => p.total_amount as number));
  const debtPaid = sum(entries.filter((e) => e.plan_id !== null && debtIds.has(e.plan_id) && isPaid(e)).map((e) => e.amount));

  return {
    spent: sum(thisMonth.filter(isPaid).map((e) => e.amount)),
    outstanding: sum(thisMonth.filter((e) => !isPaid(e)).map((e) => e.amount)),
    debtTotal,
    debtPaid,
    debtRemaining: Math.round((debtTotal - debtPaid) * 100) / 100,
  };
}

/** Spending per category, largest first. Counts unpaid entries too — the donut answers "where does the month go", not "what cleared". */
export function byCategory(entries: Entry[]): { category: string; amount: number }[] {
  const totals = new Map<string, number[]>();
  for (const e of entries) totals.set(e.category, [...(totals.get(e.category) ?? []), e.amount]);
  return [...totals]
    .map(([category, amounts]) => ({ category, amount: sum(amounts) }))
    .sort((a, b) => b.amount - a.amount);
}

/** One total per requested month, in the order given, zero-filled so the bar chart keeps its axis. */
export function monthlyTotals(entries: Entry[], keys: string[]): { key: string; amount: number }[] {
  return keys.map((key) => ({
    key,
    amount: sum(entries.filter((e) => e.due_date.startsWith(key)).map((e) => e.amount)),
  }));
}

const thb = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });

export function baht(n: number): string {
  return thb.format(n);
}
```

- [ ] **Step 10: Run the whole suite and watch it pass**

Run: `npm test`
Expected: PASS, 13 tests across two files.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add tested money and month arithmetic

Debt progress, dashboard totals, per-category and per-month sums, and the
month-end clamp for plans billed on a day their month does not have. Sums
run in satang so float drift cannot reach a displayed figure.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Database schema, indexes and RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `.env.example`
- Create: `.env.local` (gitignored — real values)

**Interfaces:**
- Consumes: the column names in `src/lib/types.ts` from Task 1.
- Produces: tables `profiles`, `plans`, `entries` in the project's Supabase database, with RLS active. Later tasks assume a query returns only the caller's rows with no filter written.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0001_init.sql`:

```sql
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
```

- [ ] **Step 2: Create the Supabase project and apply the migration**

Create a project in the Supabase dashboard. Open the SQL editor, paste `supabase/migrations/0001_init.sql`, run it.

Verify RLS is on for all three tables:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('profiles','plans','entries');
```

Expected: three rows, `rowsecurity` true for each. If any is false, the app will leak rows between users — stop and fix before continuing.

- [ ] **Step 3: Write `.env.example` and `.env.local`**

`.env.example` — committed, no real values:

```
# Supabase project settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

Copy it to `.env.local` and fill in the real values from the dashboard. Only the publishable/anon key is needed: RLS does the gating, so this app has no use for the service-role key and must not carry one.

Confirm `.env*.local` is in `.gitignore` (the Next.js scaffold puts it there) before committing.

- [ ] **Step 4: Commit**

```bash
git add supabase .env.example
git commit -m "$(cat <<'EOF'
Add schema with RLS as the only ownership boundary

Three tables, a unique (plan_id, due_date) that makes month generation
idempotent, and a trigger that gives every new user a profile row for the
PIN to write to.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Supabase clients, session middleware and login

**Files:**
- Modify: `package.json` (add `@supabase/ssr`, `@supabase/supabase-js`, `next-themes`)
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`

**Interfaces:**
- Consumes: the env vars from Task 2.
- Produces:
  - `createClient(): SupabaseClient` from `@/lib/supabase/client` — browser.
  - `createClient(): Promise<SupabaseClient>` from `@/lib/supabase/server` — server components and actions. It is async; callers must `await` it.

- [ ] **Step 1: Install**

```bash
npm install @supabase/ssr @supabase/supabase-js next-themes
```

- [ ] **Step 2: Write the browser client**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Write the server client**

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Write the middleware**

`src/middleware.ts` — refreshes the session cookie and sends signed-out visitors to `/login`.

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getUser, not getSession: it revalidates the token with Supabase rather
  // than trusting a cookie the browser could have been handed.
  const { data: { user } } = await supabase.auth.getUser();

  const isPublic = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/auth");
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-.*\\.png).*)"],
};
```

- [ ] **Step 5: Write the login page**

`src/app/login/page.tsx` — email magic link, the least code that gets a real session.

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">รายจ่าย</h1>
        <p className="mt-1 text-sm text-neutral-500">เข้าสู่ระบบด้วยอีเมล</p>
      </div>
      <form onSubmit={send} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {status === "sending" ? "กำลังส่ง…" : "ส่งลิงก์เข้าสู่ระบบ"}
        </button>
      </form>
      {status === "sent" && <p className="text-sm text-neutral-500">ส่งลิงก์ไปที่ {email} แล้ว เปิดอีเมลเพื่อเข้าสู่ระบบ</p>}
      {status === "error" && <p className="text-sm text-red-600">ส่งไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
    </main>
  );
}
```

- [ ] **Step 6: Write the callback route**

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=1", request.url));
}
```

- [ ] **Step 7: Verify a real sign-in end to end**

```bash
npm run dev
```

Open `http://localhost:3000` — expect a redirect to `/login`. Enter your email, open the emailed link, and expect to land back on `/` signed in. Confirm the profile row exists:

```sql
select id, created_at from profiles;
```

Expected: one row matching your user id — proof the Task 2 trigger fired.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add Supabase auth with magic-link sign-in

Browser and server clients, middleware that refreshes the session and
gates every non-public route, and the code-exchange callback. The
middleware uses getUser so the token is revalidated rather than trusted
from a cookie.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Data reads and Server Actions

Everything that touches the database, in one place. No component queries Supabase directly.

**Files:**
- Create: `src/lib/data.ts` (reads, server-only)
- Create: `src/app/actions.ts` (writes, Server Actions)
- Test: `src/lib/data.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; `Plan`, `Entry` from `@/lib/types`; `dueDateFor`, `monthKey`, `addMonths` from `@/lib/month`.
- Produces:
  - `getPlans(): Promise<Plan[]>`
  - `getEntries(fromDate: string, toDate: string): Promise<Entry[]>`
  - `getEntriesForMonths(year: number, month: number, count: number): Promise<Entry[]>` — `count` months ending at the given one.
  - `getAllDebtEntries(): Promise<Entry[]>` — every paid entry belonging to a plan, for lifetime progress.
  - `plannedRowsFor(plans: Plan[], year: number, month: number): Omit<Entry, "id" | "created_at">[]` — pure, exported for testing.
  - Actions: `savePlan(formData)`, `deletePlan(id)`, `saveEntry(formData)`, `deleteEntry(id)`, `togglePaid(id, paid)`, `generateMonth(year, month)`, `setPin(pin)`, `verifyPin(pin)`.

- [ ] **Step 1: Write the failing test for the month-generation rows**

`generateMonth` is the one action with real logic, and the logic is pure. Extract it as `plannedRowsFor` and test that; the action itself is then one insert.

`src/lib/data.test.ts`:

```ts
import { expect, test } from "vitest";
import { plannedRowsFor } from "@/lib/data";
import type { Plan } from "@/lib/types";

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: "p1",
  user_id: "u1",
  name: "Netflix",
  amount: 419,
  category: "สมาชิก",
  day_of_month: 15,
  total_amount: null,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

test("plannedRowsFor copies each active plan into the month", () => {
  const rows = plannedRowsFor([plan(), plan({ id: "p2", name: "หนี้รถ", amount: 12000, day_of_month: 5 })], 2026, 9);
  expect(rows).toEqual([
    { user_id: "u1", plan_id: "p1", name: "Netflix", amount: 419, category: "สมาชิก", due_date: "2026-10-15", paid_at: null },
    { user_id: "u1", plan_id: "p2", name: "หนี้รถ", amount: 12000, category: "สมาชิก", due_date: "2026-10-05", paid_at: null },
  ]);
});

test("plannedRowsFor skips inactive plans", () => {
  expect(plannedRowsFor([plan({ active: false })], 2026, 9)).toEqual([]);
});

test("plannedRowsFor clamps a plan billed past the end of a short month", () => {
  const rows = plannedRowsFor([plan({ day_of_month: 31 })], 2026, 1);
  expect(rows[0].due_date).toBe("2026-02-28");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- src/lib/data.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/data"`.

- [ ] **Step 3: Write `src/lib/data.ts`**

`data.ts` imports `server-only` so a stray client component cannot pull the read layer into the browser bundle — install it first:

```bash
npm install server-only
```

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addMonths, dueDateFor, monthKey } from "@/lib/month";
import type { Entry, Plan } from "@/lib/types";

/** PostgREST sends numeric(12,2) as a JSON number, but coerce at the boundary so a driver change cannot turn amounts into strings downstream. */
const toPlan = (r: Record<string, unknown>): Plan => ({
  ...(r as Plan),
  amount: Number(r.amount),
  total_amount: r.total_amount === null ? null : Number(r.total_amount),
});

const toEntry = (r: Record<string, unknown>): Entry => ({ ...(r as Entry), amount: Number(r.amount) });

export async function getPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map(toPlan);
}

export async function getEntries(fromDate: string, toDate: string): Promise<Entry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .gte("due_date", fromDate)
    .lte("due_date", toDate)
    .order("due_date");
  if (error) throw error;
  return (data ?? []).map(toEntry);
}

/** `count` months of entries ending with the given month — the bar chart's window. */
export async function getEntriesForMonths(year: number, month: number, count: number): Promise<Entry[]> {
  const start = addMonths(year, month, -(count - 1));
  const from = `${monthKey(start.year, start.month)}-01`;
  const to = dueDateFor(year, month, 31);
  return getEntries(from, to);
}

/** Every entry attached to a plan, for lifetime debt progress. */
export async function getAllDebtEntries(): Promise<Entry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("entries").select("*").not("plan_id", "is", null);
  if (error) throw error;
  return (data ?? []).map(toEntry);
}

/** The rows a generation would insert, for exactly the month given. Pure, so it is tested directly. */
export function plannedRowsFor(plans: Plan[], year: number, month: number) {
  return plans
    .filter((p) => p.active)
    .map((p) => ({
      user_id: p.user_id,
      plan_id: p.id,
      name: p.name,
      amount: p.amount,
      category: p.category,
      due_date: dueDateFor(year, month, p.day_of_month),
      paid_at: null,
    }));
}
```

Note the signature the tests lock in: `plannedRowsFor(plans, year, month)` returns rows for **exactly the month it is given**. Stepping to the next month lives in the `generateMonth` action, which is the thing handed the month on screen.

- [ ] **Step 4: Run it and watch it pass**

Run: `npm test -- src/lib/data.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write `src/app/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { plannedRowsFor, getPlans } from "@/lib/data";
import { addMonths } from "@/lib/month";
import { hashPin } from "@/lib/pin";

async function userId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ไม่ได้เข้าสู่ระบบ");
  return user.id;
}

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/,/g, ""));

export async function savePlan(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id");
  const total = String(formData.get("total_amount") ?? "").trim();
  const row = {
    user_id: await userId(),
    name: String(formData.get("name")),
    amount: num(formData.get("amount")),
    category: String(formData.get("category")),
    day_of_month: num(formData.get("day_of_month")),
    total_amount: total === "" ? null : num(total),
    active: formData.get("active") !== null,
  };
  const { error } = id
    ? await supabase.from("plans").update(row).eq("id", String(id))
    : await supabase.from("plans").insert(row);
  if (error) throw error;
  revalidatePath("/plans");
  revalidatePath("/");
}

export async function deletePlan(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/plans");
  revalidatePath("/");
}

export async function saveEntry(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id");
  const row = {
    user_id: await userId(),
    plan_id: (formData.get("plan_id") as string) || null,
    name: String(formData.get("name")),
    amount: num(formData.get("amount")),
    category: String(formData.get("category")),
    due_date: String(formData.get("due_date")),
  };
  const { error } = id
    ? await supabase.from("entries").update(row).eq("id", String(id))
    : await supabase.from("entries").insert(row);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function deleteEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function togglePaid(id: string, paid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("entries")
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

/**
 * Copy every active plan into the month after (year, month).
 * Safe to press twice: unique (plan_id, due_date) turns a repeat into a no-op
 * for rows that already exist, so only plans added since the last press appear.
 */
export async function generateMonth(year: number, month: number) {
  const supabase = await createClient();
  const next = addMonths(year, month, 1);
  const rows = plannedRowsFor(await getPlans(), next.year, next.month);
  if (rows.length === 0) return { inserted: 0 };
  const { data, error } = await supabase
    .from("entries")
    .upsert(rows, { onConflict: "plan_id,due_date", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  revalidatePath("/", "layout");
  return { inserted: data?.length ?? 0 };
}

export async function setPin(pin: string) {
  const supabase = await createClient();
  const id = await userId();
  const { error } = await supabase.from("profiles").update({ pin_hash: await hashPin(id, pin) }).eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function clearPin() {
  const supabase = await createClient();
  const id = await userId();
  const { error } = await supabase.from("profiles").update({ pin_hash: null }).eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

/** Returns whether the PIN matched. Never returns the stored hash. */
export async function verifyPin(pin: string): Promise<boolean> {
  const supabase = await createClient();
  const id = await userId();
  const { data } = await supabase.from("profiles").select("pin_hash").eq("id", id).single();
  if (!data?.pin_hash) return true;
  return data.pin_hash === (await hashPin(id, pin));
}
```

The `.eq("id", …)` calls above are primary-key lookups, not ownership filters — RLS still decides whether the row is visible. This is the one place `.eq` on an id is correct.

- [ ] **Step 6: Write `src/lib/pin.ts`**

```ts
/**
 * A PIN is a curtain over the screen, not a security boundary — the real one
 * is Supabase Auth plus RLS. Salting with the user id defeats rainbow tables,
 * which is as far as hashing a four-digit secret can usefully go.
 *
 * ponytail: single-round SHA-256. If the PIN ever gates anything beyond the
 * screen, move to a slow KDF (scrypt/argon2) and rate-limit verifyPin.
 */
export async function hashPin(userId: string, pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${userId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

- [ ] **Step 7: Run the suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, 16 tests; `tsc --noEmit` reports no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add data reads and server actions

Reads and writes both go through one module each, so no component talks
to Supabase directly. Month generation extracts its date logic into a pure
plannedRowsFor that is tested on its own; the action around it is a single
idempotent upsert.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: App shell — design tokens, layout, navigation, theme

Before writing this task, load the `frontend-design` skill and settle the visual direction: a minimal tracker, generous whitespace, one accent colour, numbers as the loudest element on the page.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/nav.tsx`
- Create: `src/components/theme-provider.tsx`
- Move: `src/app/page.tsx` → `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `next-themes` from Task 3.
- Produces: the `(app)` route group — every page inside it renders within the nav and, from Task 6, behind the PIN gate. CSS custom properties `--bg`, `--fg`, `--muted`, `--line`, `--accent`, `--accent-soft` defined for both themes and used by every later component.

- [ ] **Step 1: Define the tokens in `src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  --bg: #fbfbfa;
  --fg: #18181b;
  --muted: #71717a;
  --line: #e4e4e7;
  --card: #ffffff;
  --accent: #0f766e;
  --accent-soft: #ccfbf1;
}

:root.dark {
  --bg: #0b0b0c;
  --fg: #fafafa;
  --muted: #a1a1aa;
  --line: #27272a;
  --card: #141416;
  --accent: #2dd4bf;
  --accent-soft: #134e4a;
}

@theme inline {
  --color-bg: var(--bg);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-card: var(--card);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
}

body {
  background: var(--bg);
  color: var(--fg);
  font-feature-settings: "tnum";  /* figures line up in columns */
}
```

- [ ] **Step 2: Write the theme provider**

`src/components/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
```

- [ ] **Step 3: Rewrite the root layout**

`src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "รายจ่าย",
  description: "บันทึกค่าใช้จ่าย หนี้ และรายการประจำเดือน",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "รายจ่าย" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Write the nav**

`src/components/nav.tsx` — a bottom bar on phones, a top bar from `sm` up.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ภาพรวม" },
  { href: "/plans", label: "รายการประจำ" },
  { href: "/calendar", label: "ปฏิทิน" },
  { href: "/settings", label: "ตั้งค่า" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/90 backdrop-blur sm:static sm:border-b sm:border-t-0">
      <ul className="mx-auto flex max-w-2xl">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block px-3 py-3 text-center text-sm ${active ? "font-medium text-accent" : "text-muted"}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 5: Write the app-group layout and move the home page**

```bash
mkdir -p "src/app/(app)"
git mv src/app/page.tsx "src/app/(app)/page.tsx"
```

`src/app/(app)/layout.tsx`:

```tsx
import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:pb-10">{children}</main>
    </>
  );
}
```

- [ ] **Step 6: Replace the scaffold's home page with a placeholder**

`src/app/(app)/page.tsx` — Task 7 fills this in.

```tsx
export default function DashboardPage() {
  return <h1 className="text-xl font-semibold tracking-tight">ภาพรวม</h1>;
}
```

- [ ] **Step 7: Verify the shell renders in both themes**

```bash
npm run dev
```

Open `/`, `/plans` (404 for now — expected), and toggle the OS theme. Confirm the background and text follow the theme and the nav sits at the bottom at 375px width, at the top at 768px.

Run: `npm run build && npm run typecheck && npm run lint`
Expected: all three clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add app shell with theme tokens and navigation

Colour tokens as CSS custom properties consumed through Tailwind v4's
@theme inline, so components name --color-accent rather than a hex. Nav
sits at the bottom on phones and the top on wider screens.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: PIN gate

**Files:**
- Create: `src/components/pin-gate.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `verifyPin`, `setPin`, `clearPin` from `@/app/actions`; `hashPin` from `@/lib/pin` (Task 4).
- Produces: `<PinGate hasPin={boolean}>{children}</PinGate>` — renders children only once unlocked for this browser session.

- [ ] **Step 1: Write the gate**

`src/components/pin-gate.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { verifyPin } from "@/app/actions";

const KEY = "pin-ok";

export function PinGate({ hasPin, children }: { hasPin: boolean; children: React.ReactNode }) {
  // Starts locked and unlocks in an effect: sessionStorage does not exist during
  // the server render, and reading it in render would mismatch on hydration.
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    setUnlocked(!hasPin || sessionStorage.getItem(KEY) === "1");
    setReady(true);
  }, [hasPin]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await verifyPin(pin)) {
      sessionStorage.setItem(KEY, "1");
      setUnlocked(true);
    } else {
      setWrong(true);
      setPin("");
    }
  }

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-center text-lg font-medium">ใส่ PIN</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setWrong(false); }}
          className="rounded-lg border border-line bg-card px-3 py-3 text-center text-2xl tracking-[0.5em]"
          aria-label="PIN"
          aria-invalid={wrong}
        />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
          ปลดล็อก
        </button>
      </form>
      {wrong && <p role="alert" className="text-center text-sm text-red-600">PIN ไม่ถูกต้อง</p>}
    </div>
  );
}
```

- [ ] **Step 2: Wrap the app layout in the gate**

Replace `src/app/(app)/layout.tsx` with:

```tsx
import { Nav } from "@/components/nav";
import { PinGate } from "@/components/pin-gate";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("pin_hash").single();

  return (
    <PinGate hasPin={Boolean(data?.pin_hash)}>
      <Nav />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:pb-10">{children}</main>
    </PinGate>
  );
}
```

Only `pin_hash`'s presence crosses to the client — never the hash itself.

- [ ] **Step 3: Write the settings page**

`src/app/(app)/settings/page.tsx`:

```tsx
import { clearPin, setPin } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("pin_hash").single();
  const hasPin = Boolean(data?.pin_hash);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">ตั้งค่า</h1>
      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="font-medium">PIN</h2>
        <p className="mt-1 text-sm text-muted">
          บังหน้าจอตอนเปิดแอพ ไม่ใช่ระบบความปลอดภัย — ข้อมูลถูกกันด้วยบัญชีและ RLS อยู่แล้ว
        </p>
        <form action={async (fd: FormData) => { "use server"; await setPin(String(fd.get("pin"))); }} className="mt-3 flex gap-2">
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            required
            placeholder={hasPin ? "เปลี่ยน PIN" : "ตั้ง PIN 4–8 หลัก"}
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2"
          />
          <button className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">บันทึก</button>
        </form>
        {hasPin && (
          <form action={async () => { "use server"; await clearPin(); }} className="mt-2">
            <button className="text-sm text-muted underline">ปิดการใช้ PIN</button>
          </form>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify the gate end to end**

```bash
npm run dev
```

1. Visit `/settings`, set PIN `1234`.
2. Open a new private window, sign in, and expect the PIN screen before the dashboard.
3. Enter `9999` — expect "PIN ไม่ถูกต้อง" and no navigation.
4. Enter `1234` — expect the dashboard.
5. Reload — expect no second prompt (same session).
6. Close the window, reopen, sign in — expect the prompt again.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add PIN gate over the app routes

Verification runs server-side against a user-id-salted hash; only whether
a PIN exists is sent to the client. Unlocking is per browser session. The
settings copy says plainly that this is a screen curtain, not the security
boundary.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Dashboard — summary cards and the month's entries

**Files:**
- Modify: `src/app/(app)/page.tsx`
- Create: `src/components/summary-cards.tsx`
- Create: `src/components/entry-row.tsx`
- Create: `src/components/month-switcher.tsx`
- Create: `src/components/generate-month-button.tsx`
- Create: `src/components/entry-form.tsx`

**Interfaces:**
- Consumes: `getPlans`, `getEntriesForMonths`, `getAllDebtEntries` from `@/lib/data`; `summarise`, `baht` from `@/lib/money`; `monthKey`, `addMonths` from `@/lib/month`; `togglePaid`, `generateMonth`, `saveEntry`, `deleteEntry` from `@/app/actions`.
- Produces: the dashboard at `/`, reading `?y=&m=` for the displayed month (defaults to today).

**Plan correction — read this before Step 1.** As originally written, this plan built
`saveEntry` and `deleteEntry` in Task 4 and then never called them from anywhere, which
would ship an expense tracker that cannot record a one-off expense and cannot delete an
entry. The spec names "a one-off meal — an `entry` with `plan_id` null" as a shape the
model covers, so the capability is promised and was simply missing from the UI. This task
closes it: Step 3a adds an entry form, and Step 2's `EntryRow` gains a delete control.

- [ ] **Step 3a: Write the one-off entry form**

`src/components/entry-form.tsx`. A server-action form, same shape as the plan form in
Task 9. The date field is a native `<input type="date">` — no picker library.

```tsx
import { saveEntry } from "@/app/actions";

export function EntryForm({ defaultDate }: { defaultDate: string }) {
  const field = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm";
  return (
    <form action={saveEntry} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
      <input name="name" required placeholder="ชื่อรายการ เช่น ค่าอาหาร" className={field} />
      <div className="grid grid-cols-2 gap-3">
        <input name="amount" required type="number" step="0.01" min="0" placeholder="จำนวนเงิน" className={field} />
        <input name="due_date" required type="date" defaultValue={defaultDate} className={field} />
      </div>
      <input name="category" required placeholder="หมวด เช่น อาหาร" className={field} />
      <button className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
        เพิ่มรายการครั้งเดียว
      </button>
    </form>
  );
}
```

`saveEntry` reads `plan_id` from the form and gets `null` when the field is absent, which
is exactly what a one-off needs — so the form deliberately has no `plan_id` input.

- [ ] **Step 1: Write the summary cards**

`src/components/summary-cards.tsx`:

```tsx
import { baht } from "@/lib/money";

export function SummaryCards({ spent, outstanding, debtRemaining, debtPaid }: {
  spent: number; outstanding: number; debtRemaining: number; debtPaid: number;
}) {
  const cards = [
    { label: "จ่ายเดือนนี้", value: spent },
    { label: "ค้างจ่าย", value: outstanding },
    { label: "หนี้คงเหลือ", value: debtRemaining },
    { label: "ชำระไปแล้ว", value: debtPaid },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(({ label, value }) => (
        <div key={label} className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{baht(value)}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the entry row**

`src/components/entry-row.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { deleteEntry, togglePaid } from "@/app/actions";
import { baht } from "@/lib/money";
import type { Entry } from "@/lib/types";

export function EntryRow({ entry }: { entry: Entry }) {
  const [pending, start] = useTransition();
  const paid = entry.paid_at !== null;
  const day = Number(entry.due_date.slice(8, 10));

  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <button
        onClick={() => start(() => { void togglePaid(entry.id, !paid); })}
        disabled={pending}
        aria-pressed={paid}
        aria-label={paid ? `ทำเครื่องหมายว่ายังไม่จ่าย ${entry.name}` : `ทำเครื่องหมายว่าจ่ายแล้ว ${entry.name}`}
        className={`size-5 shrink-0 rounded-full border transition ${paid ? "border-accent bg-accent" : "border-line"} disabled:opacity-50`}
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${paid ? "text-muted line-through" : ""}`}>{entry.name}</p>
        <p className="text-xs text-muted">วันที่ {day} · {entry.category}</p>
      </div>
      <p className="shrink-0 text-sm tabular-nums">{baht(entry.amount)}</p>
      <button
        onClick={() => start(() => { void deleteEntry(entry.id); })}
        disabled={pending}
        aria-label={`ลบ ${entry.name}`}
        className="shrink-0 px-1 text-xs text-muted disabled:opacity-50"
      >
        ลบ
      </button>
    </li>
  );
}
```

- [ ] **Step 3: Write the month switcher and generate button**

`src/components/month-switcher.tsx`:

```tsx
import Link from "next/link";
import { addMonths } from "@/lib/month";

const label = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

export function MonthSwitcher({ year, month }: { year: number; month: number }) {
  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const href = (m: { year: number; month: number }) => `?y=${m.year}&m=${m.month}`;

  return (
    <div className="flex items-center justify-between">
      <Link href={href(prev)} aria-label="เดือนก่อนหน้า" className="px-2 py-1 text-muted">←</Link>
      <h1 className="text-base font-medium">{label.format(new Date(year, month, 1))}</h1>
      <Link href={href(next)} aria-label="เดือนถัดไป" className="px-2 py-1 text-muted">→</Link>
    </div>
  );
}
```

`src/components/generate-month-button.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { generateMonth } from "@/app/actions";

export function GenerateMonthButton({ year, month }: { year: number; month: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => start(async () => {
          const { inserted } = await generateMonth(year, month);
          setResult(inserted === 0 ? "สร้างไว้แล้ว ไม่มีรายการใหม่" : `เพิ่ม ${inserted} รายการ`);
        })}
        disabled={pending}
        className="rounded-lg border border-line bg-card px-3 py-2 text-sm disabled:opacity-50"
      >
        {pending ? "กำลังสร้าง…" : "สร้างรายการเดือนหน้า"}
      </button>
      {result && <p aria-live="polite" className="text-sm text-muted">{result}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Write the dashboard page**

`src/app/(app)/page.tsx`:

```tsx
import { EntryForm } from "@/components/entry-form";
import { EntryRow } from "@/components/entry-row";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { MonthSwitcher } from "@/components/month-switcher";
import { SummaryCards } from "@/components/summary-cards";
import { getAllDebtEntries, getEntriesForMonths, getPlans } from "@/lib/data";
import { daysInMonth, dueDateFor, monthKey } from "@/lib/month";
import { summarise } from "@/lib/money";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const { y, m } = await searchParams;
  const now = new Date();
  const year = y ? Number(y) : now.getFullYear();
  const month = m ? Number(m) : now.getMonth();
  const key = monthKey(year, month);

  const [plans, windowEntries, debtEntries] = await Promise.all([
    getPlans(),
    getEntriesForMonths(year, month, 6),
    getAllDebtEntries(),
  ]);

  // summarise needs the month for spending and every paid debt entry for the
  // lifetime figures, so it is given both sets with the month's duplicates removed.
  const byId = new Map([...windowEntries, ...debtEntries].map((e) => [e.id, e]));
  const summary = summarise(plans, [...byId.values()], key);
  const monthEntries = windowEntries.filter((e) => e.due_date.startsWith(key));

  return (
    <div className="flex flex-col gap-6">
      <MonthSwitcher year={year} month={month} />
      <SummaryCards {...summary} />
      <section>
        <h2 className="mb-1 text-sm font-medium text-muted">รายการเดือนนี้</h2>
        {monthEntries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">ยังไม่มีรายการในเดือนนี้</p>
        ) : (
          <ul>{monthEntries.map((e) => <EntryRow key={e.id} entry={e} />)}</ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">เพิ่มรายการครั้งเดียว</h2>
        <EntryForm defaultDate={dueDateFor(year, month, Math.min(now.getDate(), daysInMonth(year, month)))} />
      </section>
      <GenerateMonthButton year={year} month={month} />
    </div>
  );
}
```

- [ ] **Step 5: Verify against real data**

```bash
npm run dev
```

In the Supabase SQL editor, insert two plans for your user (replace the uuid with yours from `select id from profiles`):

```sql
insert into plans (user_id, name, amount, category, day_of_month, total_amount) values
  ('<your-uuid>', 'Netflix', 419, 'สมาชิก', 15, null),
  ('<your-uuid>', 'หนี้รถ', 12000, 'หนี้', 5, 500000);
```

Then on `/`:
1. Press "สร้างรายการเดือนหน้า" — expect "เพิ่ม 2 รายการ".
2. Press it again — expect "สร้างไว้แล้ว ไม่มีรายการใหม่". This is the idempotency check; if a second press inserts rows, the unique constraint from Task 2 is missing.
3. Navigate to next month with →, tick both entries paid, and confirm "จ่ายเดือนนี้" reads ฿12,419.00 and "ชำระไปแล้ว" reads ฿12,000.00 (only the debt plan counts toward the lifetime figure).
4. "หนี้คงเหลือ" should read ฿488,000.00.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add dashboard with summary cards, entry list and month generation

The month on screen comes from the query string so a month is linkable.
Generating next month reports how many rows it added, which makes the
second press visibly a no-op rather than a silent one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Charts — six-month bars and a category donut

Before writing this task, load the `dataviz` skill. It settles the palette, the axis and label rules, and the accessible contrast pairing used below; do not pick chart colours ad hoc.

**Files:**
- Create: `src/components/bar-chart.tsx`
- Create: `src/components/donut-chart.tsx`
- Modify: `src/app/(app)/page.tsx`
- Test: `src/components/donut-chart.test.ts`

**Interfaces:**
- Consumes: `monthlyTotals`, `byCategory`, `baht` from `@/lib/money`.
- Produces:
  - `<BarChart data={{ key: string; amount: number }[]} />`
  - `<DonutChart data={{ category: string; amount: number }[]} />`
  - `arcs(values: number[]): { offset: number; length: number }[]` — exported from `donut-chart.tsx` for testing.

- [ ] **Step 1: Write the failing test for the donut's arc maths**

The arc arithmetic is the only part that can be wrong without being obvious, so it is tested.

`src/components/donut-chart.test.ts`:

```ts
import { expect, test } from "vitest";
import { arcs } from "@/components/donut-chart";

test("arcs split the circumference in proportion and start where the last ended", () => {
  expect(arcs([50, 50])).toEqual([
    { offset: 0, length: 50 },
    { offset: 50, length: 50 },
  ]);
});

test("arcs handle uneven shares", () => {
  const [a, b, c] = arcs([60, 30, 10]);
  expect(a).toEqual({ offset: 0, length: 60 });
  expect(b).toEqual({ offset: 60, length: 30 });
  expect(c).toEqual({ offset: 90, length: 10 });
});

test("arcs of nothing is empty rather than NaN", () => {
  expect(arcs([])).toEqual([]);
  expect(arcs([0, 0])).toEqual([{ offset: 0, length: 0 }, { offset: 0, length: 0 }]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- src/components/donut-chart.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/donut-chart"`.

- [ ] **Step 3: Write the donut**

`src/components/donut-chart.tsx`. A circle whose `stroke-dasharray` is expressed against a circumference of exactly 100 makes each slice's length its own percentage.

```tsx
import { baht } from "@/lib/money";

/** Slice positions on a circle normalised to a circumference of 100. */
export function arcs(values: number[]): { offset: number; length: number }[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return values.map(() => ({ offset: 0, length: 0 }));
  let offset = 0;
  return values.map((v) => {
    const length = Math.round((v / total) * 1000) / 10;
    const slice = { offset, length };
    offset = Math.round((offset + length) * 10) / 10;
    return slice;
  });
}

const PALETTE = ["#0f766e", "#0891b2", "#7c3aed", "#db2777", "#ea580c", "#65a30d"];
const R = 100 / (2 * Math.PI);

export function DonutChart({ data }: { data: { category: string; amount: number }[] }) {
  const top = data.slice(0, PALETTE.length);
  const slices = arcs(top.map((d) => d.amount));
  if (top.length === 0) return <p className="py-6 text-center text-sm text-muted">ยังไม่มีข้อมูล</p>;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 40 40" className="size-28 shrink-0 -rotate-90" role="img" aria-label="สัดส่วนค่าใช้จ่ายแยกตามหมวด">
        {slices.map((s, i) => (
          <circle
            key={top[i].category}
            cx="20" cy="20" r={R}
            fill="none"
            stroke={PALETTE[i]}
            strokeWidth="6"
            strokeDasharray={`${s.length} ${100 - s.length}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 text-sm">
        {top.map((d, i) => (
          <li key={d.category} className="flex items-center gap-2 py-0.5">
            <span className="size-2 shrink-0 rounded-full" style={{ background: PALETTE[i] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-muted">{d.category}</span>
            <span className="shrink-0 tabular-nums">{baht(d.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm test -- src/components/donut-chart.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the bar chart**

`src/components/bar-chart.tsx` — CSS heights rather than SVG, because bars are rectangles and flexbox already stacks them.

```tsx
import { baht } from "@/lib/money";

const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "short" });

export function BarChart({ data }: { data: { key: string; amount: number }[] }) {
  const max = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div className="flex h-32 items-end gap-2">
      {data.map(({ key, amount }) => {
        const [y, m] = key.split("-").map(Number);
        return (
          <div key={key} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-accent"
              style={{ height: `${Math.max((amount / max) * 100, 2)}%` }}
              title={`${key}: ${baht(amount)}`}
            />
            <span className="text-[10px] text-muted">{monthLabel.format(new Date(y, m - 1, 1))}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Add both charts to the dashboard**

In `src/app/(app)/page.tsx`, add the imports:

```tsx
import { BarChart } from "@/components/bar-chart";
import { DonutChart } from "@/components/donut-chart";
import { byCategory, monthlyTotals, summarise } from "@/lib/money";
import { addMonths, monthKey } from "@/lib/month";
```

Compute the chart data after `monthEntries`:

```tsx
const keys = Array.from({ length: 6 }, (_, i) => {
  const at = addMonths(year, month, i - 5);
  return monthKey(at.year, at.month);
});
const bars = monthlyTotals(windowEntries, keys);
const categories = byCategory(monthEntries);
```

And insert both sections between `<SummaryCards …/>` and the entry list:

```tsx
<section>
  <h2 className="mb-2 text-sm font-medium text-muted">6 เดือนย้อนหลัง</h2>
  <BarChart data={bars} />
</section>
<section>
  <h2 className="mb-2 text-sm font-medium text-muted">แยกตามหมวด</h2>
  <DonutChart data={categories} />
</section>
```

- [ ] **Step 7: Verify the charts against the numbers beside them**

```bash
npm run dev
```

On `/`, confirm the tallest bar is the month with the largest total and that the donut's legend figures sum to the month's total across all entries. Check both themes and 375px width.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add six-month bar chart and category donut

Both hand-written: the donut is one SVG circle per slice on a
circumference normalised to 100, so a slice's dash length is its own
percentage, and the bars are flex children with percentage heights. The
arc arithmetic is unit-tested.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Plans page with debt progress

**Files:**
- Create: `src/app/(app)/plans/page.tsx`
- Create: `src/components/plan-form.tsx`
- Create: `src/components/progress-bar.tsx`

**Interfaces:**
- Consumes: `getPlans`, `getAllDebtEntries` from `@/lib/data`; `debtProgress`, `baht` from `@/lib/money`; `savePlan`, `deletePlan` from `@/app/actions`.
- Produces: `/plans`, and `<ProgressBar ratio={number} />`.

- [ ] **Step 1: Write the progress bar**

`src/components/progress-bar.tsx`. The bar clamps; the caller prints the true percentage.

```tsx
export function ProgressBar({ ratio }: { ratio: number }) {
  const width = Math.min(Math.max(ratio, 0), 1) * 100;
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-accent-soft"
      role="progressbar"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${width}%` }} />
    </div>
  );
}
```

- [ ] **Step 2: Write the plan form**

`src/components/plan-form.tsx` — one form for create and edit; `total_amount` left blank means a subscription.

```tsx
import { savePlan } from "@/app/actions";
import type { Plan } from "@/lib/types";

export function PlanForm({ plan }: { plan?: Plan }) {
  const field = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm";
  return (
    <form action={savePlan} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <input name="name" required defaultValue={plan?.name} placeholder="ชื่อรายการ เช่น Netflix" className={field} />
      <div className="grid grid-cols-2 gap-3">
        <input name="amount" required type="number" step="0.01" min="0" defaultValue={plan?.amount} placeholder="ยอดต่อเดือน" className={field} />
        <input name="day_of_month" required type="number" min="1" max="31" defaultValue={plan?.day_of_month} placeholder="วันที่ครบกำหนด" className={field} />
      </div>
      <input name="category" required defaultValue={plan?.category} placeholder="หมวด เช่น สมาชิก, หนี้" className={field} />
      <input name="total_amount" type="number" step="0.01" min="0" defaultValue={plan?.total_amount ?? ""} placeholder="ยอดหนี้รวม (เว้นว่างถ้าเป็นรายการประจำ)" className={field} />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="active" defaultChecked={plan?.active ?? true} />
        ใช้งานอยู่
      </label>
      <button className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
        {plan ? "บันทึก" : "เพิ่มรายการ"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write the plans page**

`src/app/(app)/plans/page.tsx`:

```tsx
import { deletePlan } from "@/app/actions";
import { PlanForm } from "@/components/plan-form";
import { ProgressBar } from "@/components/progress-bar";
import { getAllDebtEntries, getPlans } from "@/lib/data";
import { baht, debtProgress } from "@/lib/money";

export default async function PlansPage() {
  const [plans, entries] = await Promise.all([getPlans(), getAllDebtEntries()]);
  const debts = plans.filter((p) => p.total_amount !== null);
  const subs = plans.filter((p) => p.total_amount === null);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">รายการประจำ</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">หนี้</h2>
        {debts.length === 0 && <p className="text-sm text-muted">ยังไม่มีหนี้</p>}
        <ul className="flex flex-col gap-3">
          {debts.map((plan) => {
            const { paid, total, ratio } = debtProgress(plan, entries);
            return (
              <li key={plan.id} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium">{plan.name}</p>
                  <p className="shrink-0 text-sm tabular-nums text-muted">{Math.round(ratio * 100)}%</p>
                </div>
                <div className="my-2"><ProgressBar ratio={ratio} /></div>
                <p className="text-xs tabular-nums text-muted">
                  {baht(paid)} จาก {baht(total)} · เหลือ {baht(Math.round((total - paid) * 100) / 100)} · {baht(plan.amount)}/เดือน
                </p>
                <form action={deletePlan.bind(null, plan.id)} className="mt-2">
                  <button className="text-xs text-muted underline">ลบ</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">รายการประจำเดือน</h2>
        {subs.length === 0 && <p className="text-sm text-muted">ยังไม่มีรายการ</p>}
        <ul className="flex flex-col gap-2">
          {subs.map((plan) => (
            <li key={plan.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className={`truncate font-medium ${plan.active ? "" : "text-muted line-through"}`}>{plan.name}</p>
                <p className="text-xs text-muted">ทุกวันที่ {plan.day_of_month} · {plan.category}</p>
              </div>
              <p className="shrink-0 text-sm tabular-nums">{baht(plan.amount)}</p>
              <form action={deletePlan.bind(null, plan.id)}>
                <button aria-label={`ลบ ${plan.name}`} className="text-xs text-muted underline">ลบ</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">เพิ่มรายการ</h2>
        <PlanForm />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify progress reaches 100% correctly**

```bash
npm run dev
```

On `/plans`:
1. Add a debt: name `ทดสอบ`, amount `100`, day `1`, category `หนี้`, total `300`.
2. From `/`, generate the month and mark its entry paid three times across three months (generate, pay, move to next month, generate, pay…). After the third, expect `100%` and the bar full.
3. Mark a fourth paid — expect the text to read `133%` while the bar stays full. This confirms overpayment is reported, not hidden.
4. Delete the test debt.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add plans page with per-debt progress

Debts and subscriptions are one table split by whether total_amount is
set, so the page separates them on read rather than the schema on write.
The bar clamps at full; the percentage beside it tells the truth when a
debt is overpaid.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Calendar

**Files:**
- Create: `src/app/(app)/calendar/page.tsx`
- Create: `src/components/calendar-grid.tsx`
- Test: `src/components/calendar-grid.test.ts`

**Interfaces:**
- Consumes: `getEntries` from `@/lib/data`; `daysInMonth`, `monthKey` from `@/lib/month`; `baht` from `@/lib/money`.
- Produces: `/calendar`, and `calendarCells(year, month): (number | null)[]` exported for testing.

- [ ] **Step 1: Write the failing test for the grid layout**

`src/components/calendar-grid.test.ts`:

```ts
import { expect, test } from "vitest";
import { calendarCells } from "@/components/calendar-grid";

test("cells pad the start of the month with nulls to the right weekday", () => {
  // 1 Sep 2026 is a Tuesday; the week starts Sunday, so one leading blank.
  const cells = calendarCells(2026, 8);
  expect(cells.slice(0, 3)).toEqual([null, null, 1]);
  expect(cells.filter((c) => c !== null)).toHaveLength(30);
});

test("a month starting on Sunday needs no padding", () => {
  // 1 Feb 2026 is a Sunday.
  expect(calendarCells(2026, 1)[0]).toBe(1);
});

test("cells fill whole weeks", () => {
  expect(calendarCells(2026, 8).length % 7).toBe(0);
  expect(calendarCells(2026, 1).length % 7).toBe(0);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -- src/components/calendar-grid.test.ts`
Expected: FAIL — `Failed to resolve import "@/components/calendar-grid"`.

- [ ] **Step 3: Write the grid**

`src/components/calendar-grid.tsx`:

```tsx
import { baht } from "@/lib/money";
import { daysInMonth } from "@/lib/month";
import type { Entry } from "@/lib/types";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** Day numbers laid out in whole Sunday-first weeks, blanks as null. */
export function calendarCells(year: number, month: number): (number | null)[] {
  const lead = new Date(year, month, 1).getDay();
  const days = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarGrid({ year, month, entries }: { year: number; month: number; entries: Entry[] }) {
  const byDay = new Map<number, Entry[]>();
  for (const e of entries) {
    const day = Number(e.due_date.slice(8, 10));
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-xs text-muted">
        {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px rounded-xl border border-line bg-line overflow-hidden">
        {calendarCells(year, month).map((day, i) => {
          const dayEntries = day ? byDay.get(day) ?? [] : [];
          const total = dayEntries.reduce((a, e) => a + e.amount, 0);
          return (
            <div
              key={i}
              className="min-h-14 bg-card p-1"
              title={dayEntries.length ? `${dayEntries.map((e) => e.name).join(", ")} · ${baht(total)}` : undefined}
            >
              {day && <span className="text-xs tabular-nums text-muted">{day}</span>}
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {dayEntries.map((e) => (
                  <span
                    key={e.id}
                    aria-label={`${e.name} ${baht(e.amount)} ${e.paid_at ? "จ่ายแล้ว" : "ค้างจ่าย"}`}
                    className={`size-1.5 rounded-full ${e.paid_at ? "bg-accent" : "border border-accent"}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm test -- src/components/calendar-grid.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the calendar page**

`src/app/(app)/calendar/page.tsx`:

```tsx
import { CalendarGrid } from "@/components/calendar-grid";
import { MonthSwitcher } from "@/components/month-switcher";
import { getEntries } from "@/lib/data";
import { daysInMonth, monthKey } from "@/lib/month";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const { y, m } = await searchParams;
  const now = new Date();
  const year = y ? Number(y) : now.getFullYear();
  const month = m ? Number(m) : now.getMonth();
  const key = monthKey(year, month);

  const entries = await getEntries(`${key}-01`, `${key}-${String(daysInMonth(year, month)).padStart(2, "0")}`);

  return (
    <div className="flex flex-col gap-4">
      <MonthSwitcher year={year} month={month} />
      <CalendarGrid year={year} month={month} entries={entries} />
      <p className="text-xs text-muted">
        <span className="mr-1 inline-block size-1.5 rounded-full bg-accent align-middle" /> จ่ายแล้ว
        <span className="ml-3 mr-1 inline-block size-1.5 rounded-full border border-accent align-middle" /> ค้างจ่าย
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Verify the dates land on the right weekdays**

```bash
npm run dev
```

Open `/calendar`. Cross-check the current month against a system calendar — the 1st must sit under the correct weekday, and the last day must be the real last day. Confirm dots appear on the days your entries are due, filled for paid and outlined for unpaid.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add month calendar

A CSS grid padded to whole weeks, with Intl for the month name. The cell
layout is unit-tested at a month that needs leading blanks and one that
does not, since an off-by-one there is invisible until someone checks a
date against a real calendar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: PWA — manifest, icons and service worker

**Files:**
- Create: `src/app/manifest.ts`
- Create: `public/sw.js`
- Create: `src/components/sw-register.tsx`
- Create: `public/icon-192.png`, `public/icon-512.png`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: an installable app. No later task depends on this.

- [ ] **Step 1: Write the manifest**

`src/app/manifest.ts` — a native Next.js route; no plugin.

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "รายจ่าย",
    short_name: "รายจ่าย",
    description: "บันทึกค่าใช้จ่าย หนี้ และรายการประจำเดือน",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfa",
    theme_color: "#0f766e",
    lang: "th",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 2: Generate the icons**

```bash
npm install -D sharp
node -e '
const sharp = require("sharp");
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#0f766e"/>
  <text x="256" y="330" font-size="260" font-family="system-ui,sans-serif" font-weight="600"
        fill="#ffffff" text-anchor="middle">฿</text>
</svg>`);
for (const size of [192, 512]) {
  sharp(svg).resize(size, size).png().toFile(`public/icon-${size}.png`);
}
'
```

Verify both files exist and are non-empty: `ls -l public/icon-*.png`

- [ ] **Step 3: Write the service worker**

`public/sw.js`. Network-first for everything, falling back to cache only when the network fails — the figures on these screens must never be served stale while the network is fine.

```js
const CACHE = "expenses-v1";
const SHELL = ["/", "/plans", "/calendar"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/"))),
  );
});
```

- [ ] **Step 4: Register it**

`src/components/sw-register.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker?.register("/sw.js").catch(() => {
      // An unavailable service worker costs offline support and nothing else.
    });
  }, []);
  return null;
}
```

Mount it in `src/app/layout.tsx` inside `<Providers>`:

```tsx
import { ServiceWorkerRegistrar } from "@/components/sw-register";
// …
<Providers>
  {children}
  <ServiceWorkerRegistrar />
</Providers>
```

- [ ] **Step 5: Verify it installs and survives going offline**

```bash
npm run build && npm start
```

In Chrome at `http://localhost:3000`:
1. DevTools → Application → Manifest — expect the name, both icons, and no errors.
2. Application → Service Workers — expect `sw.js` activated and running.
3. Network → Offline, then reload — expect the shell to render rather than the browser's offline page.
4. Back online, change an amount in Supabase, reload — expect the new figure, not the cached one. If the old figure appears, the worker is cache-first somewhere it should not be.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add PWA manifest, icons and service worker

Next's native manifest route and about thirty lines of worker instead of
next-pwa. Network-first throughout: an offline shell is worth having, a
stale balance is not.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Full verification pass

**Files:**
- Create: `scripts/sweep.mjs`
- Create: `README.md`

**Interfaces:**
- Consumes: every route built in Tasks 5–11.
- Produces: a repeatable check and the setup instructions for a cold start.

- [ ] **Step 1: Write the sweep script**

`scripts/sweep.mjs` — loads every route in both themes, failing on a console error or horizontal overflow. This is the standing bar used on the portfolio project.

```js
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ROUTES = ["/", "/plans", "/calendar", "/settings"];
const failures = [];

const browser = await chromium.launch();
for (const colorScheme of ["light", "dark"]) {
  const context = await browser.newContext({
    colorScheme,
    viewport: { width: 375, height: 812 },
    storageState: "scripts/auth.json",
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") failures.push(`${colorScheme} console: ${m.text()}`);
  });

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) failures.push(`${colorScheme} ${route}: horizontal overflow at 375px`);
  }
  await context.close();
}
await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`OK — ${ROUTES.length * 2} page loads, 0 console errors, 0 overflow`);
```

Capture a signed-in session once so the sweep can reach the gated routes:

```bash
npm install -D playwright && npx playwright install chromium
npx playwright open --save-storage=scripts/auth.json http://localhost:3000
```

Sign in and unlock the PIN in that window, then close it. Add `scripts/auth.json` to `.gitignore` — it holds a live session.

- [ ] **Step 2: Run the whole bar**

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm start &            # then, in the same shell once it is listening:
node scripts/sweep.mjs
```

Expected: tests pass; `tsc --noEmit` silent; eslint clean; build succeeds; the sweep prints `OK — 8 page loads, 0 console errors, 0 overflow`.

Fix anything that fails before continuing. Do not record this task as done on a partial pass.

- [ ] **Step 3: Write the README**

`README.md`:

````markdown
# รายจ่าย — Expense & Debt Tracker

Records recurring commitments, one-off spending and fixed-total debts.
Multi-user, PIN-gated on the device, installable as a PWA.

Next.js 16 App Router · TypeScript · Tailwind v4 · Supabase Postgres with RLS

## Setup

```bash
npm install
cp .env.example .env.local   # fill in from Supabase → project settings → API
```

Apply `supabase/migrations/0001_init.sql` in the Supabase SQL editor, then:

```bash
npm run dev
```

## The one thing to know about the data model

A subscription and a debt are the same row. `plans.total_amount` is null
for Netflix and set for a car loan; a plan that knows its total gets a
progress bar. Entries are the dated charges, generated from plans by the
button on the dashboard or entered on their own.

Ownership is enforced only by RLS (`user_id = auth.uid()`). No query in
`src/` filters by user, and none should — if one needs to, a policy is
wrong.

## Verification

```bash
npm test && npm run typecheck && npm run lint && npm run build
node scripts/sweep.mjs   # needs the app running and scripts/auth.json
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Vitest over the money and date logic |
| `npm run typecheck` | `tsc --noEmit` |
| `node scripts/sweep.mjs` | Every route, both themes, 375px — console errors and overflow |
````

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Add verification sweep and README

The sweep loads every route in both themes at 375px and fails on a
console error or horizontal overflow, which is the bar this project is
held to.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Notes for the executor

- **Do not add a `where user_id` to any query.** RLS handles it. A query that returns another user's rows is a policy bug, fixed in SQL, not patched in TypeScript.
- **`plannedRowsFor(plans, year, month)` returns rows for the month it is passed, not the month after.** The `+1` lives in `generateMonth`, which receives the month on screen.
- **The PIN is deliberately weak.** Single-round SHA-256 salted with the user id. Do not "harden" it into a security boundary; the spec says what it is for. If it ever gates more than the screen, the `ponytail:` comment in `src/lib/pin.ts` names the upgrade.
- **Task 8 needs the `dataviz` skill and Task 5 the `frontend-design` skill** loaded before their code is written.
