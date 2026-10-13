# Daily reminder retries — deployed 2026-10-12

Applied the prepared patch to the actual Spent-Cost repository. Production
`push-reminders` is now **version 6**, active, deployed at
**2026-10-12 09:17:08.104 UTC**, with gateway JWT verification still disabled
and caller authentication handled inside the function. Existing secrets remain.

Migration `0006_daily_reminder_retries.sql` was applied directly through the
linked Supabase database query API, following the project's previous rollout
without replaying older migrations or inventing remote migration history.
The single cron job **1** is active on `*/10 1-16 * * *`, with a 60-second
HTTP timeout. The configured start day is **2026-10-13**: first eligible run
at **08:00 Bangkok**, then every ten minutes until completion or 23:50.

## Behavior

- One named cron now attempts the morning job every ten minutes, 08:00–23:50
  Bangkok, only until today's heartbeat is successful.
- The function independently skips a completed day, protecting against already
  queued requests after completion.
- A daily/user/endpoint-hash receipt prevents accepted devices being redelivered.
  Explicit provider rejections can retry on subsequent attempts. Expired devices
  are removed. The daily limit is 96 attempts per device.
- Claims are atomic, with an insert/row lock and unique key. Active claims cannot
  be taken by a second invocation or replayed with the same claim token.
- A network error after the push may have delivered it. That outcome stays
  `uncertain` and is not automatically resent. Abandoned in-flight claims also
  become uncertain, while a late completion from their original owner can resolve
  them. A failed receipt acknowledgement never advances the heartbeat.
- Successful receipt writes survive a lost acknowledgement or a failed heartbeat
  write: the next cron skips those devices and can complete the heartbeat.
- Up to eight devices are processed concurrently.

## Validation

- Vitest: 90 tests passed, including partial success, concurrent runs, ambiguous
  delivery, lost receipt acknowledgement, failed receipt writes, gone devices,
  stable receipt keys and bounded concurrency.
- TypeScript application check and ESLint passed.
- Deno checked the complete handler and the handler verification script using
  cached dependencies, without network access.
- The isolated Deno handler verification passed with the actual Supabase client
  and all database/push transport mocked. It covers health/caller isolation,
  heartbeat auth retry, partial recovery, concurrent jobs, completed-day skips,
  uncertain delivery, receipt acknowledgement loss, expiration and safe rollout.
- Real PostgreSQL state-machine, RLS and role-permission assertions passed with
  `supabase/tests/reminder_delivery.sql`; its synthetic receipts were rolled back.
- `supabase/tests/reminder_delivery_concurrency.py` passed three real
  multi-connection cases while the cron was paused: an uncommitted first claim,
  retry after an explicit rejection, and finalizing an accepted delivery.
  Contenders waited for row locks for 9.59, 6.65 and 9.62 seconds respectively.
  They returned `busy`, `busy` and `sent`, preserving ownership and attempt counts.
  All synthetic concurrency receipts were deleted; a separate read confirmed
  zero receipts remained before re-enabling the scheduler.
- Production smoke checks passed: OPTIONS 200, invalid cron credential 403,
  invalid status caller still 403 when a valid cron credential is also supplied,
  and a valid cron request returns `skipped: rollout` with start day 2026-10-13.
  The guard skipped all morning work; no test notification was sent and the
  heartbeat remained **2026-10-11 01:00:02.084 UTC**.
- A scheduled status probe after version 6 completed at
  **2026-10-12 09:21:25.252 UTC** (16:21:25.252 Bangkok), reading the heartbeat
  in **1,578 ms** with no HTTP error. Its verdict remained `heartbeat-stale`,
  accurately reflecting the missed morning run rather than a failed health read.

## Rollout record

Downloaded deployed version 5 into the separate private rollback directory
`/private/tmp/reminder-retries-rollback-20261012-v5` before changing production.
The original cron configuration is saved privately there as `cron-before.json`;
do not copy its command or any credentials into logs or git. Preserve this
directory if rollback is needed; it is a temporary local artifact.

Paused the existing named job, deployed version 6, applied migration 0006,
ran the real SQL and concurrency checks, verified the rollout gate and then
re-enabled the same job. No second cron job was created. Tomorrow's start date
protects devices possibly sent today by the earlier implementation without
receipts; today's date was not enabled.

To repeat database validation, pause the named cron first and run:

```bash
supabase db query --linked --file supabase/tests/reminder_delivery.sql
python3 supabase/tests/reminder_delivery_concurrency.py --cli /opt/homebrew/bin/supabase
```

The Python test refuses to run with an active cron. It uses uniquely tagged
synthetic receipts dated 1900 and deletes them afterwards; no pushes occur.

## Remaining observation

Observe the first eligible scheduled run on **2026-10-13 08:00 Bangkok**,
its HTTP response, receipt outcomes and successful heartbeat. If a provider
explicitly rejects a device, verify a later scheduled attempt resolves only
that device. An `uncertain` outcome requires delivery evidence before any
operator reconciliation. Confirm the notification on the subscribed phone.
Deployment and receipt concurrency validation are complete; successful
post-rollout morning delivery and OS notification display remain unobserved.
