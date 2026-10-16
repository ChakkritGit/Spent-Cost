import { expect, test } from "bun:test";

process.env.STATUS_SECRET = "status-secret";
process.env.PUSH_CRON_SECRET = "cron-secret";
const { handle, nextRun, sameSecret } = await import("./server");

test("runs every ten minutes from 08:00 to 23:50 Bangkok (01:00–16:59 UTC), like the old pg_cron job", () => {
  const at = (iso: string) => new Date(nextRun(Date.parse(iso))).toISOString();
  expect(at("2026-10-15T00:58:00Z")).toBe("2026-10-15T01:00:00.000Z"); // 07:58 Bangkok → 08:00
  expect(at("2026-10-15T03:00:00Z")).toBe("2026-10-15T03:10:00.000Z");
  expect(at("2026-10-15T16:55:00Z")).toBe("2026-10-16T01:00:00.000Z"); // after 23:50 → next morning
});

test("secrets are compared exactly and never match empty", () => {
  expect(sameSecret("a", "a")).toBe(true);
  expect(sameSecret("a", "b")).toBe(false);
  expect(sameSecret("", "")).toBe(false);
});

test("refuses wrong secrets and requests without one", async () => {
  const req = (headers: Record<string, string>) => new Request("http://x/", { method: "POST", headers, body: "{}" });
  expect((await handle(req({ "x-status-secret": "nope" }))).status).toBe(403);
  expect((await handle(req({ "x-cron-secret": "nope" }))).status).toBe(403);
  expect((await handle(req({}))).status).toBe(401);
  expect((await handle(req({ authorization: "Bearer not-a-jwt" }))).status).toBe(401);
  expect((await handle(new Request("http://x/", { method: "OPTIONS" }))).status).toBe(200);
});
