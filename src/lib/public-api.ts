import { Elysia } from "elysia";
import { WebStandardAdapter } from "elysia/adapter/web-standard";

interface HealthConfig {
  authUrl?: string;
  dataUrl?: string;
  publicKey?: string;
}

/** Read-only probes: no session cookies, writes, reminder jobs or notifications. */
export function createPublicApi(config: () => HealthConfig, request: typeof fetch = fetch) {
  async function probe(url: string, init: RequestInit) {
    const started = performance.now();
    const ok = await request(url, { ...init, signal: AbortSignal.timeout(5000) })
      .then((response) => response.status === 200)
      .catch(() => false);
    return { ok, ms: Math.round(performance.now() - started) };
  }

  return new Elysia({ prefix: "/api", adapter: WebStandardAdapter })
    .get("/healthz", () => Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }))
    .get("/health", async () => {
      const { authUrl, dataUrl, publicKey } = config();
      const headers = { "Cache-Control": "public, s-maxage=15" };
      if (!authUrl || !publicKey) return Response.json({ ok: false }, { status: 503, headers });
      const [db, auth] = await Promise.all([
        probe(`${dataUrl ?? authUrl}/rest/v1/plans?select=id&limit=1`, {
          headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
        }),
        probe(`${authUrl}/auth/v1/health`, { headers: { apikey: publicKey } }),
      ]);
      const ok = db.ok && auth.ok;
      return Response.json({ ok, db, auth }, { status: ok ? 200 : 503, headers });
    });
}
