# Billing reliability deployment — 2026-10-12

## Current result: production deployment completed

The later daily-retry rollout is recorded in `daily-reminder-retries.md`:
production now uses function **version 6** and migration **0006**, with the
single retry cron active and eligible from **2026-10-13 08:00 Bangkok**.
The version 5 diagnosis and initial deployment observations below are retained
as history. The current Status Worker version is recorded in the follow-up
section below.

The unrestricted session can use the existing Supabase and Cloudflare logins.
The previously authorized production work has now been performed:

- `push-reminders` deployed to `yavhirzrepgpvvapohyz` with gateway JWT
  verification still disabled; the function validates its caller credentials.
  Verified version **5**, active, deployed at 2026-10-12 05:32:00.839 UTC.
  It includes bounded retries for the observed database auth failure.
- Migration `0005_reminder_cron_timeout.sql` executed via `supabase db query
  --linked --file`. A subsequent read confirmed job 1 remains active, has the
  original `0 1 * * *` schedule, and now uses `timeout_milliseconds := 60000`.
  This project has no recorded remote migration history; the SQL was applied
  directly, without marking earlier migrations as applied or replaying them.
- The saved status patch applied cleanly to the actual portfolio repository.
  Worker deployed version: `65c7fe08-e5b5-4d23-afd2-6e65fb179069`.
  The existing KV namespace, service bindings, domain, cron and secrets remain.
- Spent-Cost: 82 tests, TypeScript check and ESLint passed. Deno checked the
  complete Edge Function with `--node-modules-dir=none`. Status: 26 tests,
  TypeScript check and diff whitespace validation passed.
- Production smoke checks: invalid status credential returns 403; OPTIONS
  returns 200. No test notifications or extra morning run were triggered.
- The isolated Deno handler check verifies caller isolation, read-only health,
  recovery from an auth-rejected heartbeat write, and that a failed push returns
  503 without advancing the heartbeat. All transport is mocked; it grants no
  runtime network permission. Run it independently with:

  ```bash
  npx --yes deno run --no-lock --node-modules-dir=none --allow-env --allow-read supabase/functions/push-reminders/index.check.ts
  ```

### Production diagnosis

Read-only SQL showed the 2026-10-12 01:00 UTC cron run queued successfully, but
its HTTP response was 500 (`timed_out = false`). Function runtime logs at
01:00:02.962 UTC show `PGRST303`, `JWT issued at future`. This was an explicit
database authentication rejection, rather than evidence of a push timeout.
The last successful heartbeat was 2026-10-11 01:00:02.084 UTC.

The new database fetch wrapper retries only that exact 401/code/message,
at most twice, after 1 and 2 seconds. Other auth failures and ambiguous network
failures are not replayed. It preserves write bodies and abort signals and
does not retry the whole morning job. This is a bounded mitigation for a
transient upstream JWT validation issue, not a claim to repair upstream clocks.

After Worker deployment, the scheduled health probe at 05:30:36.614 UTC
reported `heartbeat-stale`, 2998 ms, and no HTTP error. The endpoint was reachable
and readable; the status correctly remains down until a morning run succeeds.
Two consecutive scheduled probes after final Edge Function version 5 read the
heartbeat successfully:

| Observed completion (UTC) | Probe latency | Verdict | HTTP error |
| --- | ---: | --- | --- |
| 2026-10-12 05:36:14.588 | 1737 ms | `heartbeat-stale` | none |
| 2026-10-12 05:41:15.016 | 743 ms | `heartbeat-stale` | none |

These times are probe completion times saved by the Worker, not promised cron
start times. Deployment and health-read verification are complete. The status
continues to report the missed morning job accurately; the phone delivery and
next successful morning heartbeat remain to be observed.

### Remaining production observation

Confirm the next scheduled delivery at **2026-10-13 08:00 Bangkok**:
query the cron result, `net._http_response`, function runtime logs and heartbeat
using `../push-notifications.md`. The daily receipt-based retry scheduler has
now been deployed; follow `daily-reminder-retries.md` for its validation and
per-device observations. Verify the notification on the subscribed phone.
Do not advance the heartbeat manually or replay the old untracked job to make
the status turn green: this could hide the failure or duplicate pushes.
No successful post-fix morning delivery or latency reduction is claimed yet.

### Status page follow-up — 2026-10-12

Applied `remove-ms-explanation.patch` to the portfolio repository, removing
the explanatory sentence about milliseconds while retaining measured latency
and failure details. The Status Worker passed all 26 tests, TypeScript checks
and diff whitespace validation before deployment.

Cloudflare deployment completed with version
`a32df1c4-daa2-4ae7-86f7-6702b2d2ea73`. A subsequent read of the production
HTML confirmed the explanatory sentence is absent.

A read of `/api/status` reported the scheduled check completed at
**2026-10-12 09:06:37.849 UTC** (16:06:37.849 Bangkok). The reminders probe
took **777 ms**, with reason `heartbeat-stale` and no HTTP error; all other
listed services reported `up`. This observation confirms the health read is
working, but does not prove a successful post-fix morning run or phone delivery.
The next scheduled delivery remains 2026-10-13 08:00 Bangkok.

## Historical attempts in the restricted session

At that time production deployment had not succeeded and the SQL migration
had not been applied. The following notes explain the previous blocker;
the current result above supersedes them.

## Verified

- Spent-Cost: 78 tests, TypeScript check, ESLint and `git diff --check` passed.
- Status Worker: 26 tests and TypeScript check passed from an isolated staging
  copy in `/private/tmp/billing-status-deploy/status`.
- Wrangler dry-run built the status bundle and resolved its configured bindings.
- The status source repository is outside this session's writable workspace.
  Its source changes are preserved in `status-reliability.patch` in this folder.

## Deployment attempts

- Supabase function deployment returned `AccessTokenRequiredError`. This was
  confirmed using the existing default CLI state directory; no access token was
  supplied in the environment.
- Wrangler deployment returned an expired-token error: it could not reach the
  Cloudflare auth server to refresh the token. The CLI reports that the stored
  credentials were left unchanged.
- Requests to the production status domain failed hostname resolution in the
  restricted session. No browser was connected.

A Supabase integration was found and suggested, but has not been confirmed
installed or connected. Once connected, use it to inspect the existing function,
its recent invocation logs, cron responses and the heartbeat before deployment.
Chrome connected to a signed-in Cloudflare account can provide the remaining
deployment path if CLI network access is still unavailable.

## Remaining authorized work

1. Inspect production function configuration and read-only cron/heartbeat data
   with the queries in `../push-notifications.md`.
2. Deploy `push-reminders` to `yavhirzrepgpvvapohyz` with gateway JWT verification
   disabled. The function verifies its own caller credentials. Preserve existing
   secrets, including VAPID and status/cron credentials.
3. Apply `supabase/migrations/0005_reminder_cron_timeout.sql` after confirming
   that the existing named job, pg_cron and pg_net are present. The migration
   changes the command timeout while retaining the existing schedule.
4. Apply `status-reliability.patch` from the portfolio repository root once it is
   writable, or deploy the verified staging bundle with Wrangler. Preserve all
   current Worker bindings and secrets. Record the deployed version.
5. Observe at least two five-minute health checks and measure real probe latency.
   Confirm the next scheduled 08:00 Bangkok delivery. Do not trigger the whole
   morning job for testing because it can duplicate successful notifications.

No production latency reduction is claimed yet. Any deployment or migration
completion must be verified independently before reporting success.

## Recheck after user reported successful login

The user reported completing Supabase and Cloudflare login. The new Homebrew
Supabase CLI at `/opt/homebrew/bin/supabase` (2.120.0) was detected and used for
the recheck. It still returned `AccessTokenRequiredError` from this restricted
session. No token values were printed. A read-only lookup of the Supabase CLI
Keychain metadata also failed; successful terminal login remains the user's
reported state, not a verified login available to this execution environment.

Wrangler `whoami` still could not refresh its expired credentials because it
could not contact the Cloudflare auth server. The default Wrangler config visible
to the session was last modified on 2026-10-09. The production status hostname
still failed to resolve. Browser discovery still returned no connected browser.

The execution environment explicitly retains a restricted network policy with
sandbox escalation unavailable. Repeating login does not address that policy.
The next required change is an execution permission profile that allows network
access and the deployment credentials, or a confirmed connected integration.
No deployment or SQL mutation was performed during this recheck.
