/** Validates an alert sent by the status worker; trims and caps it so a bad caller cannot flood a lock screen. */
export function parseAlert(v: unknown): { title: string; body: string } | null {
  if (typeof v !== "object" || v === null) return null;
  const { title, body } = v as { title?: unknown; body?: unknown };
  if (typeof title !== "string" || typeof body !== "string") return null;
  const t = title.trim().slice(0, 80);
  const b = body.trim().slice(0, 200);
  return t && b ? { title: t, body: b } : null;
}
