// Morning bill reminders as Web Push. Runs on Supabase, not in the app: it
// reads every user's unpaid entries, which needs the service role — and the
// service role must never be in the Next.js app. Supabase injects it here.
//
// Two callers, each authenticated here (deployed with --no-verify-jwt):
// - pg_cron at 08:00 Bangkok, with the x-cron-secret header → everyone's reminders;
// - a signed-in user from Settings, with their session → a test to themselves.
// Setup: docs/push-notifications.md.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { bangkokToday, addDays, reminderFor, type Due } from "../_shared/reminders.ts";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "https://spent-cost.vercel.app",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** Constant-time, so the secret cannot be guessed a byte at a time from response timing. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0 && b.length > 0;
}

type Message = { title: string; body: string };

/** Sends each user's message to every device they subscribed; drops subscriptions the push service says are gone. */
async function send(admin: SupabaseClient, messages: Map<string, Message>) {
  if (messages.size === 0) return { sent: 0, removed: 0 };
  // The one query that filters by user: this function holds the service role,
  // so RLS is not doing it here.
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", [...messages.keys()]);
  if (error) throw error;

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      const m = messages.get(s.user_id)!;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...m, url: "/" }),
          { TTL: 12 * 60 * 60 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint);
        else console.error("push failed", status, (e as Error).message);
      }
    }),
  );
  if (gone.length) await admin.from("push_subscriptions").delete().in("endpoint", gone);
  return { sent, removed: gone.length };
}

async function morning(admin: SupabaseClient) {
  const today = bangkokToday();
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
  return { users: messages.size, ...(await send(admin, messages)) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    const cron = req.headers.get("x-cron-secret");
    if (cron !== null) {
      if (!sameSecret(cron, Deno.env.get("PUSH_CRON_SECRET") ?? "")) return json({ error: "forbidden" }, 403);
      return json(await morning(admin));
    }

    // Anyone else must be a signed-in user, and can only reach their own devices.
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "unauthorized" }, 401);
    const result = await send(
      admin,
      new Map([[user.id, { title: "ทดสอบการแจ้งเตือน", body: "ถ้าเห็นข้อความนี้ การแจ้งเตือนของ Spent/Cost ใช้ได้แล้ว" }]]),
    );
    return json(result);
  } catch (e) {
    console.error(e);
    return json({ error: "failed" }, 500);
  }
});
