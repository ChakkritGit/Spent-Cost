import { describe, expect, it } from "vitest";
import { createPublicApi } from "./public-api";

const config = () => ({ authUrl: "https://auth.example.test", dataUrl: "http://data.example.test", publicKey: "public-test-key" });

describe("public health API", () => {
  it("probes the data gateway and auth separately without session cookies or writes", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const app = createPublicApi(config, async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response("[]");
    });
    const response = await app.fetch(new Request("http://localhost/api/health"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, db: { ok: true }, auth: { ok: true } });
    expect(calls.map((call) => call.url)).toEqual([
      "http://data.example.test/rest/v1/plans?select=id&limit=1",
      "https://auth.example.test/auth/v1/health",
    ]);
    expect(new Headers(calls[0].init?.headers).get("authorization")).toBe("Bearer public-test-key");
    expect(calls.every((call) => !call.init?.method && !call.init?.body && call.init?.signal instanceof AbortSignal)).toBe(true);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=15");
  });

  it("returns only boolean failures and timings when a dependency fails", async () => {
    const app = createPublicApi(config, async () => { throw new Error("private backend detail"); });
    const response = await app.fetch(new Request("http://localhost/api/health"));
    const body = await response.text();
    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toMatchObject({ ok: false, db: { ok: false }, auth: { ok: false } });
    expect(body).not.toContain("private");
  });

  it("keeps container liveness independent of auth, data and configuration", async () => {
    const app = createPublicApi(() => { throw new Error("must not read config"); });
    const response = await app.fetch(new Request("http://localhost/api/healthz"));
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const head = await app.fetch(new Request("http://localhost/api/healthz", { method: "HEAD" }));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
});
