import { expect, test, vi } from "vitest";
import { databaseFetch } from "./database-fetch";

const rejected = () => Response.json({ code: "PGRST303", message: "JWT issued at future" }, { status: 401 });

test("replays an auth-rejected database write with its body and authorization intact", async () => {
  const bodies: string[] = [];
  const request = vi.fn(async (input: string | URL | Request) => {
    const req = input as Request;
    expect(req.method).toBe("POST");
    expect(req.headers.get("Authorization")).toBe("Bearer test-key");
    bodies.push(await req.text());
    return bodies.length < 3 ? rejected() : Response.json({ ok: true });
  });
  const pause = vi.fn(async () => {});
  const response = await databaseFetch(request, pause)(new Request("https://db/rest/v1/entries", {
    method: "POST", headers: { Authorization: "Bearer test-key" }, body: '{"amount":1}',
  }));
  expect(response.ok).toBe(true);
  expect(bodies).toEqual(Array(3).fill('{"amount":1}'));
  expect(pause.mock.calls).toEqual([[1000], [2000]]);
});

test("persistent clock skew stops after two retries with the last error body readable", async () => {
  const request = vi.fn(async () => rejected());
  const response = await databaseFetch(request, async () => {})("https://db/rest/v1/heartbeats");
  expect(request).toHaveBeenCalledTimes(3);
  expect((await response.json()).code).toBe("PGRST303");
});

test("other auth errors, HTTP failures and non-database requests are not retried", async () => {
  for (const [url, response] of [
    ["https://db/rest/v1/entries", Response.json({ code: "PGRST303", message: "JWT expired" }, { status: 401 })],
    ["https://db/rest/v1/entries", Response.json({}, { status: 500 })],
    ["https://db/rest/v1/entries", new Response("invalid", { status: 401 })],
    ["https://db/auth/v1/user", rejected()],
  ] as const) {
    const request = vi.fn(async () => response);
    expect(await databaseFetch(request)(url)).toBe(response);
    expect(request).toHaveBeenCalledTimes(1);
  }
});

test("network errors and an aborted request never replay a write", async () => {
  const request = vi.fn(async () => { throw new Error("network"); });
  await expect(databaseFetch(request)("https://db/rest/v1/entries", { method: "POST", body: "{}" })).rejects.toThrow("network");
  expect(request).toHaveBeenCalledTimes(1);
  request.mockClear();
  await expect(databaseFetch(request)("https://db/rest/v1/entries", { signal: AbortSignal.abort() })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
