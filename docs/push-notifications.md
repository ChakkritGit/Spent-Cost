# Push notifications — setup

A reminder starting at 08:00 Bangkok: the day before a bill, on the day, and
every morning it stays unpaid. A failed run retries every ten minutes until
23:50 Bangkok. Accepted devices are recorded by user, day and endpoint hash.
A completed day is skipped by both the scheduler and the function.

```
pg_cron (Supabase, every ten minutes 01:00–16:50 UTC until completion)
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
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
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
- The morning job writes the plan rows for today's month and tomorrow's month
  when a user has none. `missingMonthRows` is unit-tested; a successful heartbeat
  records completion of the production morning run, not proof of an OS banner.
- Production deployment and health-check observations are recorded in
  `ops/billing-deployment.md`. Phone notification display still requires checking
  on the subscribed device.

## Reliability and diagnosis

The health read uses a REST request with a five-second total timeout. It does
not load the Supabase SDK or Web Push library and does not require VAPID keys.
The status worker retries a temporary health transport failure once, preserving
the total elapsed time and distinguishing HTTP errors from an old heartbeat.

Database requests retry only an explicit HTTP 401 with PostgREST code `PGRST303`
and message `JWT issued at future`, with one-second and two-second delays.
Authentication rejected those requests before SQL execution, so a database
write can safely retry. The request body, credentials and abort signal are
preserved; other auth failures, HTTP errors and network errors are not retried
by this wrapper. The health read keeps its original five-second abort deadline.
This mitigates transient JWT clock skew; it does not fix Supabase's underlying
clock issue. The 2026-10-12 08:00 run failed with this exact error in function logs.

Push sends use a ten-second socket timeout, retry one explicit HTTP 5xx
rejection, and report failed delivery counts. Network timeouts are not retried
because delivery might already have happened. A morning run with unresolved
delivery failures returns 503 and does not advance its successful heartbeat.
With migration `0006_daily_reminder_retries.sql`, morning sends use durable
per-device receipts and one provider attempt per scheduled run. An explicit
HTTP rejection can retry on a later cron; accepted devices never replay.
Status alerts and user tests retain their existing immediate push retry behavior.
Expired devices (404/410) are removed.

Apply migration `0005_reminder_cron_timeout.sql` to give the existing cron job
60 seconds for the Edge Function response. The pg_net default varies by version
and is too short for some cold starts and push requests. This migration changes
only the named job's command, retaining its schedule, and does not invoke it.

Read-only diagnosis in the SQL Editor (do not include cron command text or
request headers in logs: they may contain secrets):

```sql
select jobid, jobname, schedule, active from cron.job where jobname = 'push-reminders';
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'push-reminders')
order by start_time desc limit 10;
select id, status_code, timed_out, error_msg, created
from net._http_response order by created desc limit 20;
select name, at from public.heartbeats where name = 'push-reminders';
```

A successful pg_cron run only proves an HTTP request was queued. Inspect
`net._http_response` and the function invocation logs to confirm delivery.
The HTTP response table is short-lived; query it shortly after 08:00 Bangkok.

## Daily retry receipts (migration 0006)

Deploy the new function together with migration `0006_daily_reminder_retries.sql`.
The old 08:00 job becomes `*/10 1-16 * * *`: one attempt every ten minutes from
08:00 to 23:50 Bangkok, only until today's heartbeat is successful. There are
at most 96 scheduled attempts per day and 96 explicit rejections per device.
The function also skips a completed day, so an already queued request cannot
start another day's notifications. Up to eight devices run concurrently.

RPCs reserve a receipt atomically before a push, using a unique
`(reminder_day, user_id, endpoint_hash)` key and a row lock. The endpoint hash
stays stable even if the subscription record is deleted and re-created.
`sent` means the provider accepted the message; it does not prove phone display.
Only the service role can access the tables or execute receipt RPCs.

A lost provider response becomes `uncertain`, never an automatic retry. An
in-flight claim expires after five minutes into `uncertain` rather than granting
another sender. A late response from the original claim can resolve it. If a
receipt write commits but its response is lost, a subsequent cron sees `sent`
and skips that device. A failed receipt write keeps the day unhealthy. The
heartbeat advances only when all currently required devices are resolved.
An empty reminder set or no subscribed devices completes without a push.

There is no atomic transaction across PostgreSQL and an external push provider.
Ambiguous delivery is kept visible for operator reconciliation; claiming perfect
exactly-once phone delivery would be incorrect.

### Safe rollout

1. Record the existing cron job id and pause that named job. Download the
   currently deployed function for rollback before changing production.
2. Deploy the new `push-reminders` with `--no-verify-jwt` and unchanged secrets.
   With no receipt schema/config it fails closed before any morning pushes.
3. Apply migration 0006, then run `supabase/tests/reminder_delivery.sql` with
   privileged database access. Those synthetic SQL receipts are rolled back;
   no notifications are sent. Run
   `python3 supabase/tests/reminder_delivery_concurrency.py` for actual
   multi-connection receipt-lock checks; its uniquely tagged receipts are
   deleted afterwards. The script requires a paused cron and a linked CLI
   session. Use `--cli /path/to/supabase` if the CLI is not on PATH.
4. Verify the 10-minute schedule, RLS/permissions and function health, then
   re-enable the job. Migration 0006 retains the job's active/paused setting.
5. Observe a scheduled retry, its per-device results and the heartbeat. Confirm
   the next normal 08:00 notification on a subscribed device.

The migration starts tomorrow when applied after 08:00. An earlier version's
failed job may already have delivered some devices without durable receipts.
Enable today's date only after verifying no old pushes were accepted, or after
reconciling accepted devices into the ledger. Never rerun that untracked job
just to turn the status green. This protection covers the deployment boundary.

Read-only inspection (no endpoint tokens or keys):

```sql
select start_day from public.reminder_retry_config;
select reminder_day, state, count(*) as devices
from public.reminder_deliveries
where reminder_day = (now() at time zone 'Asia/Bangkok')::date
group by reminder_day, state;
select jobid, schedule, active from cron.job where jobname = 'push-reminders';
```

Do not automatically change an `uncertain` receipt to `failed`: doing so grants
permission to resend a push that might already have been accepted. Operator
resolution must be based on delivery evidence, and must preserve claim ownership.
