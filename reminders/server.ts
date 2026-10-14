// Morning bill reminders as Web Push, on the VPS (Bun + Elysia). It reads every user's unpaid entries,
// which needs the service role, and the service role must never be in the Next.js app.
//
// It runs itself every ten minutes from 08:00 to 23:50 Bangkok until the day's run completes (what pg_cron
// did on Supabase), and answers three kinds of request, each authenticated here:
// - x-cron-secret → the morning run now (manual trigger);
// - x-status-secret → the last run, or an alert to one user (the status page; it can never start a run);
// - a signed-in user's Supabase session from Settings → a test push to their own devices.
// Data goes through the database gateway (Supabase-compatible /rest/v1) with a service_role token.
// Setup: docs/push-notifications.md.

import { Elysia } from "elysia";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { databaseFetch } from "./lib/database-fetch";
import { sendDaily, endpointHash, mapDevices, type Claim, type Outcome } from "./lib/daily-delivery";
import { deliver } from "./lib/delivery";
import { readHeartbeat } from "./lib/heartbeat";
import { parseAlert } from "./lib/alert";
import { bangkokToday, addDays, missingMonthRows, nextMonthStart, reminderFor, type Due } from "./lib/reminders";

const env = (name: string) => process.env[name] ?? "";
const PORT = Number(env("PORT") || 8792);
const DB_URL = env("DB_URL") || "http://apps-dbgw:8791";
const SUPABASE_URL = env("SUPABASE_URL").replace(/\/+$/, "");
const jwks = SUPABASE_URL ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)) : null;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** Constant-time, so the secret cannot be guessed a byte at a time from response timing. */
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0 && b.length > 0;
}

/** A short-lived service_role token for the database gateway, signed with PostgREST's secret. */
async function serviceKey() {
  return new SignJWT({ role: "service_role" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(env("PGRST_JWT_SECRET")));
}

async function createAdmin(): Promise<SupabaseClient> {
  return createClient(DB_URL, await serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: databaseFetch() as typeof fetch },
  });
}

type Message = { title: string; body: string; url?: string };

/** Sends each user's message to every device they subscribed; drops subscriptions the push service says are gone. */
async function send(admin: SupabaseClient, messages: Map<string, Message>, day?: string) {
  if (messages.size === 0) return { sent: 0, removed: 0, failed: 0, alreadySent: 0, uncertain: 0, pending: 0 };
  // The one query that filters by user: this service holds the service role, so RLS is not doing it here.
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", [...messages.keys()]);
  if (error) throw error;

  webpush.setVapidDetails(env("VAPID_SUBJECT") || "https://expenses.chakkritton.com", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  let sent = 0;
  let failed = 0;
  let alreadySent = 0;
  let uncertain = 0;
  let pending = 0;
  const gone: string[] = [];
  await mapDevices(subs, async (s) => {
    const m = messages.get(s.user_id)!;
    const push = () => webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ ...m, url: m.url ?? "/" }),
      { TTL: 12 * 60 * 60, timeout: 10_000, ...(day ? { topic: `bill-reminder-${day.replaceAll("-", "")}` } : {}) },
    );
    if (!day) {
      const outcome = await deliver(push);
      if (outcome === "sent") sent++;
      else if (outcome === "gone") gone.push(s.endpoint);
      else failed++;
      return;
    }
    try {
      const hash = await endpointHash(s.endpoint);
      const params = { p_day: day, p_user: s.user_id, p_endpoint_hash: hash };
      const result = await sendDaily({
        async claim(token) {
          const { data, error } = await admin.rpc("claim_reminder_delivery", { ...params, p_claim: token });
          if (error) throw error;
          if (!["claimed", "sent", "gone", "busy", "uncertain", "exhausted"].includes(data)) throw new Error("invalid receipt claim");
          return data as Claim;
        },
        async finish(token, outcome: Outcome) {
          const { data, error } = await admin.rpc("finish_reminder_delivery", { ...params, p_claim: token, p_outcome: outcome });
          if (error) throw error;
          return data === true;
        },
      }, push);
      if (result.sent) sent++;
      else if (result.outcome === "sent") alreadySent++;
      if (result.outcome === "gone") gone.push(s.endpoint);
      if (!result.resolved) {
        failed++;
        if (result.outcome === "uncertain") uncertain++;
        if (result.outcome === "busy") pending++;
      }
    } catch {
      // A failed claim never starts a push. A lost finish acknowledgement keeps
      // its receipt in flight; the next run must not repeat that delivery.
      failed++;
      pending++;
      console.error("daily delivery receipt failed");
    }
  });
  if (gone.length) {
    const { error } = await admin.from("push_subscriptions").delete().in("endpoint", gone);
    if (error) throw error;
  }
  return { sent, removed: gone.length, failed, alreadySent, uncertain, pending };
}

/**
 * Writes plan rows for today's and tomorrow's months when a user has none, so
 * the 1st is not empty and the last day can warn about a bill due on the 1st.
 * The explicit user_id/plan filters are by design: the service role skips RLS.
 */
async function ensureMonths(admin: SupabaseClient, today: string) {
  for (const day of new Set([today.slice(0, 7), addDays(today, 1).slice(0, 7)])) {
    const year = Number(day.slice(0, 4));
    const month = Number(day.slice(5, 7)) - 1;
    const [plans, existing] = await Promise.all([
      admin.from("plans").select("id, user_id, name, amount, category, day_of_month, active").eq("active", true),
      admin
        .from("entries")
        .select("user_id")
        .not("plan_id", "is", null)
        .gte("due_date", `${day}-01`)
        .lt("due_date", nextMonthStart(day)),
    ]);
    if (plans.error) throw plans.error;
    if (existing.error) throw existing.error;
    const rows = missingMonthRows(
      plans.data.map((p) => ({ ...p, amount: Number(p.amount) })),
      new Set(existing.data.map((r) => r.user_id as string)),
      year,
      month,
    );
    if (rows.length === 0) continue;
    const { error } = await admin.from("entries").upsert(rows, { onConflict: "plan_id,due_date", ignoreDuplicates: true });
    if (error) throw error;
  }
}

async function morning(admin: SupabaseClient) {
  const today = bangkokToday();
  await ensureMonths(admin, today);
  const { data, error } = await admin
    .from("entries")
    .select("user_id, name, amount, due_date")
    .is("paid_at", null)
    .lte("due_date", addDays(today, 1));
  if (error) throw error;

  const byUser = new Map<string, Due[]>();
  for (const r of data) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), { ...r, amount: Number(r.amount) }]);
  const messages = new Map<string, Message>();
  for (const [user, entries] of byUser) {
    const m = reminderFor(entries, today);
    if (m) messages.set(user, m);
  }
  return { users: messages.size, ...(await send(admin, messages, today)) };
}

/** The day's run, unless it is before the rollout day or already complete. 503-worthy when a push failed. */
async function run(): Promise<{ status: number; body: Record<string, unknown> }> {
  const admin = await createAdmin();
  const today = bangkokToday();
  const { data: config, error: configError } = await admin.from("reminder_retry_config").select("start_day").eq("singleton", true).single();
  if (configError) throw configError;
  if (typeof config?.start_day !== "string") throw new Error("missing retry configuration");
  if (today < config.start_day) return { status: 200, body: { skipped: "rollout", startDay: config.start_day } };
  const { data: heartbeat, error: heartbeatError } = await admin.from("heartbeats").select("at").eq("name", "push-reminders").maybeSingle();
  if (heartbeatError) throw heartbeatError;
  if (heartbeat?.at && bangkokToday(new Date(heartbeat.at)) === today) return { status: 200, body: { skipped: "already completed" } };
  const result = await morning(admin);
  if (result.failed > 0) return { status: 503, body: { error: "delivery failed", ...result } };
  const { error } = await admin.from("heartbeats").upsert({ name: "push-reminders", at: new Date().toISOString() });
  if (error) throw error;
  return { status: 200, body: result };
}

/** A signed-in user's Supabase session (ES256, the project's public keys) → their id. */
async function sessionUser(authorization: string | null): Promise<string | null> {
  const token = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || !jwks) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: `${SUPABASE_URL}/auth/v1`, audience: "authenticated" });
    return payload.role === "authenticated" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // Checked first: a status request must never fall into the morning run below.
    const status = req.headers.get("x-status-secret");
    if (status !== null) {
      if (!sameSecret(status, env("STATUS_SECRET"))) return json({ error: "forbidden" }, 403);
      const body = (await req.json().catch(() => null)) ?? {};
      if (body.health === true) {
        const lastRun = await readHeartbeat(DB_URL, await serviceKey(), databaseFetch());
        return json({ lastRun });
      }
      if (body.alert) {
        const alert = parseAlert(body.alert);
        if (!alert) return json({ error: "bad alert" }, 400);
        const user = env("ALERT_USER_ID");
        if (!user) return json({ error: "no alert user" }, 500);
        const result = await send(await createAdmin(), new Map([[user, { ...alert, url: "https://status.chakkritton.com" }]]));
        return json(result, result.failed ? 503 : 200);
      }
      return json({ error: "bad request" }, 400);
    }

    const cron = req.headers.get("x-cron-secret");
    if (cron !== null) {
      if (!sameSecret(cron, env("PUSH_CRON_SECRET"))) return json({ error: "forbidden" }, 403);
      const r = await run();
      return json(r.body, r.status);
    }

    // Anyone else must be a signed-in user, and can only reach their own devices.
    const user = await sessionUser(req.headers.get("Authorization"));
    if (!user) return json({ error: "unauthorized" }, 401);
    const result = await send(
      await createAdmin(),
      new Map([[user, { title: "ทดสอบการแจ้งเตือน", body: "ถ้าเห็นข้อความนี้ การแจ้งเตือนของ Spent/Cost ใช้ได้แล้ว" }]]),
    );
    return json(result, result.failed ? 503 : 200);
  } catch (e) {
    console.error(e);
    return json({ error: "failed" }, 500);
  }
}

/** Minutes of the hour aligned to 10, 01:00–16:59 UTC = 08:00–23:59 Bangkok (pg_cron's "*\/10 1-16 * * *"). */
export function nextRun(now: number): number {
  let t = Math.floor(now / 600_000) * 600_000 + 600_000;
  while (new Date(t).getUTCHours() < 1 || new Date(t).getUTCHours() > 16) t += 600_000;
  return t;
}

function schedule() {
  const at = nextRun(Date.now());
  setTimeout(async () => {
    try {
      const r = await run();
      if (r.status !== 200 || !("skipped" in r.body)) console.log("morning run", r.status, JSON.stringify(r.body));
    } catch (e) {
      console.error("morning run failed", e);
    }
    schedule();
  }, at - Date.now());
}

if (import.meta.main) {
  new Elysia()
    .get("/health", () => ({ ok: true }))
    .all("/", ({ request }) => handle(request))
    .listen({ port: PORT, hostname: "0.0.0.0" });
  console.log(`reminders listening on :${PORT}, next run ${new Date(nextRun(Date.now())).toISOString()}`);
  schedule();
}
