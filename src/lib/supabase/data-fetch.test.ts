import { expect, test, vi } from "vitest";
import { dataFetch } from "./data-fetch";

const SUPA = "https://ref.supabase.co";

test("data calls go to the gateway, login calls stay on Supabase", async () => {
  const base = vi.fn(async (_input: unknown, _init?: unknown) => new Response("ok"));
  const f = dataFetch("http://apps-dbgw:8791/", SUPA, base as never);
  await f(`${SUPA}/rest/v1/entries?select=*`, { method: "GET" });
  await f(new URL(`${SUPA}/functions/v1/push-reminders`), { method: "POST" });
  await f(`${SUPA}/auth/v1/user`);
  expect(base.mock.calls.map((c) => String(c[0]))).toEqual([
    "http://apps-dbgw:8791/rest/v1/entries?select=*",
    "http://apps-dbgw:8791/functions/v1/push-reminders",
    `${SUPA}/auth/v1/user`,
  ]);
});

test("a Request keeps its method, headers and body when moved", async () => {
  const base = vi.fn(async (input: Request) => new Response(await input.text()));
  const f = dataFetch("https://expenses.example/data", SUPA, base as never);
  const res = await f(new Request(`${SUPA}/rest/v1/plans`, { method: "POST", headers: { authorization: "Bearer t" }, body: "{}" }));
  const sent = base.mock.calls[0][0] as Request;
  expect(sent.url).toBe("https://expenses.example/data/rest/v1/plans");
  expect(sent.method).toBe("POST");
  expect(sent.headers.get("authorization")).toBe("Bearer t");
  expect(await res.text()).toBe("{}");
});

test("no data URL: nothing is moved", () => {
  const base = vi.fn();
  expect(dataFetch(undefined, SUPA, base as never)).toBe(base);
});
