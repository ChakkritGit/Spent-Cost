// Isolated Deno handler verification. Every transport below is mocked.
import webpush from "npm:web-push@3.6.7";
import { bangkokToday, addDays } from "../_shared/reminders.ts";
const today = bangkokToday();
const yesterday = `${addDays(today, -1)}T01:00:00Z`;
const keys = webpush.generateVAPIDKeys();
for (const [name, value] of Object.entries({
  SUPABASE_URL: "https://mock-database.example",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  PUSH_CRON_SECRET: "test-cron", STATUS_SECRET: "test-status",
  VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey,
})) Deno.env.set(name, value);

let handler: (request: Request) => Promise<Response>;
Object.defineProperty(Deno, "serve", { value: (fn: typeof handler) => { handler = fn; } });
type Receipt = { state: string; token: string; attempts: number };
const receipts = new Map<string, Receipt>();
const pushes = new Map<string, number>();
let mode = "empty";
let heartbeat = yesterday;
let startDay = today;
let writes = 0;
let databaseCalls = 0;
let authRejections = 0;
let finishLost = false;
const receiptKey = (body: Record<string, string>) => `${body.p_day}/${body.p_user}/${body.p_endpoint_hash}`;

// This models the RPC contract for handler tests. It does not test PostgreSQL
// locking; database integration tests must exercise the actual migration.
globalThis.fetch = async (input, init) => {
  databaseCalls++;
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (url.hostname !== "mock-database.example") throw new Error("unexpected network request");
  if (url.pathname === "/rest/v1/reminder_retry_config") return Response.json({ start_day: startDay });
  if (url.pathname === "/rest/v1/heartbeats") {
    if (req.method === "GET") return Response.json([{ at: heartbeat }]);
    if (mode === "empty" && authRejections++ === 0) {
      return Response.json({ code: "PGRST303", message: "JWT issued at future" }, { status: 401 });
    }
    heartbeat = (await req.json()).at;
    writes++;
    return new Response(null, { status: 201 });
  }
  if (url.pathname === "/rest/v1/plans") return Response.json([]);
  if (url.pathname === "/rest/v1/entries") return Response.json(mode !== "empty" && url.searchParams.has("paid_at")
    ? [{ user_id: "test-user", name: "bill", amount: 1, due_date: "2000-01-01" }] : []);
  if (url.pathname === "/rest/v1/push_subscriptions") {
    if (req.method === "DELETE") return new Response(null, { status: 204 });
    return Response.json(["a", "b"].map((device) => ({ user_id: "test-user", endpoint: `https://mock-push.example/${device}`, p256dh: "test", auth: "test" })));
  }
  if (url.pathname === "/rest/v1/rpc/claim_reminder_delivery") {
    const body = await req.json();
    const key = receiptKey(body);
    const receipt = receipts.get(key);
    if (!receipt || receipt.state === "failed" && receipt.attempts < 96) {
      receipts.set(key, { state: "sending", token: body.p_claim, attempts: (receipt?.attempts ?? 0) + 1 });
      return Response.json("claimed");
    }
    return Response.json(receipt.state === "sending" ? "busy" : receipt.state === "failed" ? "exhausted" : receipt.state);
  }
  if (url.pathname === "/rest/v1/rpc/finish_reminder_delivery") {
    const body = await req.json();
    const receipt = receipts.get(receiptKey(body));
    if (!receipt || receipt.token !== body.p_claim) return Response.json(false);
    receipt.state = body.p_outcome;
    if (mode === "lost-finish" && !finishLost) { finishLost = true; throw new Error("response lost after commit"); }
    return Response.json(true);
  }
  throw new Error(`unexpected database path: ${url.pathname}`);
};
webpush.sendNotification = async (subscription: { endpoint: string }) => {
  const device = subscription.endpoint.split("/").at(-1)!;
  const calls = (pushes.get(device) ?? 0) + 1;
  pushes.set(device, calls);
  if (mode === "partial" && device === "b" && calls === 1) throw { statusCode: 503 };
  if (mode === "uncertain" && device === "a") throw new Error("push response lost");
  if (mode === "gone" && device === "a") throw { statusCode: 410 };
  return { statusCode: 201, body: "", headers: {} };
};
await import("./index.ts");
function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }
const cron = () => handler!(new Request("https://function.example", { method: "POST", headers: { "x-cron-secret": "test-cron" } }));
function reset(nextMode: string) {
  mode = nextMode; heartbeat = yesterday; startDay = today; writes = 0;
  receipts.clear(); pushes.clear(); finishLost = false;
}

const forbidden = await handler!(new Request("https://function.example", {
  method: "POST", headers: { "x-status-secret": "wrong", "x-cron-secret": "test-cron" }, body: '{"health":true}',
}));
assert(forbidden.status === 403 && databaseCalls === 0, "status credential must not fall through to cron");
const health = await handler!(new Request("https://function.example", {
  method: "POST", headers: { "x-status-secret": "test-status" }, body: '{"health":true}',
}));
assert(health.status === 200 && (await health.json()).lastRun === yesterday && writes === 0, "health must only read");
assert((await cron()).status === 200 && writes === 1 && authRejections === 2, "heartbeat auth retry must execute only one write");
assert((await (await cron()).json()).skipped === "already completed" && writes === 1, "completed day must skip");

reset("partial");
let response = await cron();
assert(response.status === 503 && (await response.json()).failed === 1 && writes === 0, "partial delivery must stay unhealthy");
response = await cron();
let body = await response.json();
assert(response.status === 200 && body.sent === 1 && body.alreadySent === 1 && writes === 1, "retry must complete only unsent device");
assert(pushes.get("a") === 1 && pushes.get("b") === 2, "successful device must not be resent");
assert((await (await cron()).json()).skipped === "already completed" && pushes.get("a") === 1 && pushes.get("b") === 2, "later cron must not send again");

reset("concurrent");
const overlapping = await Promise.all([cron(), cron()]);
assert(overlapping.some((r) => r.status === 200) && writes === 1, "one overlapping owner must complete");
assert(pushes.get("a") === 1 && pushes.get("b") === 1, "overlapping runs must not duplicate pushes");

reset("uncertain");
assert((await cron()).status === 503 && writes === 0, "ambiguous delivery must stay unhealthy");
response = await cron();
body = await response.json();
assert(response.status === 503 && body.uncertain === 1 && pushes.get("a") === 1 && pushes.get("b") === 1 && writes === 0, "ambiguous delivery must not replay");

reset("lost-finish");
assert((await cron()).status === 503 && writes === 0, "lost receipt acknowledgement must not advance heartbeat");
response = await cron();
assert(response.status === 200 && writes === 1 && pushes.get("a") === 1 && pushes.get("b") === 1, "committed receipt must recover without resending");

reset("gone");
response = await cron();
body = await response.json();
assert(response.status === 200 && body.removed === 1 && writes === 1, "expired device must not block completion");

reset("rollout");
startDay = addDays(today, 1);
response = await cron();
assert(response.status === 200 && (await response.json()).skipped === "rollout" && writes === 0 && pushes.size === 0, "legacy rollout must not resend untracked devices");
console.log("PASS: caller isolation, health, heartbeat retry, partial recovery, overlapping jobs, uncertain delivery, lost receipt, expired devices and safe rollout; all transport mocked");
