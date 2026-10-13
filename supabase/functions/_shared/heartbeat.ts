/** A lightweight health read: no Supabase SDK or Web Push initialization. */
export async function readHeartbeat(base: string, serviceKey: string, request: typeof fetch = fetch) {
  const response = await request(`${base}/rest/v1/heartbeats?name=eq.push-reminders&select=at&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`heartbeat HTTP ${response.status}`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("invalid heartbeat response");
  if (rows.length === 0) return null;
  const at = rows[0]?.at;
  if (typeof at !== "string" || !Number.isFinite(Date.parse(at))) {
    throw new Error("invalid heartbeat timestamp");
  }
  return at;
}
