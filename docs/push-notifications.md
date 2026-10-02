# Push notifications — setup

A reminder at 08:00 Bangkok: the day before a bill, on the day, and every
morning it stays unpaid. One notification per person per morning.

```
pg_cron (Supabase, 01:00 UTC)
  └─ pg_net POST + x-cron-secret ─► Edge Function push-reminders ─► Web Push ─► phone
Settings "ส่งทดสอบ" ─ user session ─┘   (service role lives here, never in the app)
```

The Next.js app keeps using only the publishable key. The service role that
reads every user's entries exists only inside the Edge Function, where
Supabase injects it.

The values below live in `.env.local` (gitignored): `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `PUSH_CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Never
paste the private key or the cron secret into git or Vercel.

## 1. Table

Supabase → SQL Editor → run `supabase/migrations/0003_push_subscriptions.sql`.

## 2. Function and its secrets

```bash
npx supabase login
npx supabase link --project-ref yavhirzrepgpvvapohyz
npx supabase secrets set $(grep -E '^(VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY|PUSH_CRON_SECRET)=' .env.local | xargs)
# --no-verify-jwt: the function checks the cron secret or the user's session itself
# (the project's publishable key is not a JWT, so the gateway check cannot be used).
npx supabase functions deploy push-reminders --no-verify-jwt
```

## 3. Public key in Vercel

Vercel → Project → Settings → Environment Variables → add
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` with the value from `.env.local`, then redeploy.
Until then Settings says the key is not configured.

## 4. The morning schedule

SQL Editor, replacing `<PUSH_CRON_SECRET>` with the value from `.env.local`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<PUSH_CRON_SECRET>', 'push_cron_secret');

select cron.schedule(
  'push-reminders',
  '0 1 * * *', -- 01:00 UTC = 08:00 Bangkok
  $$
  select net.http_post(
    url := 'https://yavhirzrepgpvvapohyz.supabase.co/functions/v1/push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

To run it once now, run the `select net.http_post(...)` part on its own; the
response lands in `net._http_response`.

## 5. On the phone

iOS 16.4+: open the app in Safari → Share → Add to Home Screen → open it from
the icon → Settings → เปิดการแจ้งเตือน → ส่งทดสอบ. In Safari itself iOS does
not offer Web Push; Settings says so.

## Health alerts

The status worker (`portfolio/status`) uses this same function: with its own
`x-status-secret` header (never the cron secret, so it cannot trigger the morning
run) it can ask when the morning job last ran (`{"health":true}`) and push an
alert (`{"alert":{"title","body"}}`) to one user's devices. To turn that on:

1. Run migration `0004_heartbeats.sql` (the morning job writes its last run there).
2. `npx supabase secrets set STATUS_SECRET=<new random value> ALERT_USER_ID=<your auth user id>`; set the same `STATUS_SECRET` on the status worker with `npx wrangler secret put STATUS_SECRET`
3. Redeploy: `npx supabase functions deploy push-reminders --no-verify-jwt`

## What is verified, and what is not

- `supabase/functions/_shared/reminders.ts` (who gets what text, and which plan
  rows a month is missing) — vitest.
- `public/sw.js`'s push handler parses a payload and an empty push and calls
  `showNotification` — checked in Chromium; headless Chromium refuses the
  notification permission itself, so the OS banner was not seen.
- The morning job also writes the plan rows for today's month and tomorrow's
  month when a user has none (so the 1st is not empty, and the last day can warn
  about a bill due on the 1st). That write has not run either; `missingMonthRows`
  is the tested part.
- The Edge Function itself has not run: Deno is not installed here and it
  needs the deploy above. "ส่งทดสอบ" in Settings is the first end-to-end check.
