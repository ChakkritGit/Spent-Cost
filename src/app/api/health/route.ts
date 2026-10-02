// Public by design: the status worker polls it. Plain fetches to Supabase, no client and no
// cookies; the anon key is already public. Booleans and timings only, never error text.
const headers = { "Cache-Control": "public, s-maxage=15" };

async function probe(url: string, init: RequestInit) {
  const t0 = performance.now();
  const ok = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) })
    .then((r) => r.status === 200)
    .catch(() => false);
  return { ok, ms: Math.round(performance.now() - t0) };
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const [db, auth] = await Promise.all([
    // RLS answers [] to anon: a 200 still proves PostgREST and Postgres are up.
    probe(`${base}/rest/v1/plans?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    probe(`${base}/auth/v1/health`, { headers: { apikey: key } }),
  ]);
  const ok = db.ok && auth.ok;
  return Response.json({ ok, db, auth }, { status: ok ? 200 : 503, headers });
}
