import { expect, test } from "vitest";
import { readHeartbeat } from "./heartbeat";

test("reads only the reminder heartbeat with server authorization and a timeout", async () => {
  const at = "2026-10-12T01:00:00Z";
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe("https://db/rest/v1/heartbeats?name=eq.push-reminders&select=at&limit=1");
    expect(init?.headers).toEqual({ apikey: "test-key", Authorization: "Bearer test-key" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    return Response.json([{ at }]);
  };
  expect(await readHeartbeat("https://db", "test-key", request)).toBe(at);
});

test("a missing heartbeat remains missing; HTTP failures and malformed rows fail", async () => {
  expect(await readHeartbeat("https://db", "key", async () => Response.json([]))).toBeNull();
  for (const response of [
    Response.json([], { status: 503 }), Response.json({}), Response.json([{ at: "invalid" }]),
  ]) {
    await expect(readHeartbeat("https://db", "key", async () => response)).rejects.toThrow();
  }
});
