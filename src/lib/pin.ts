/**
 * A PIN is a curtain over the screen, not a security boundary — the real one
 * is Supabase Auth plus RLS. Salting with the user id defeats rainbow tables,
 * which is as far as hashing a four-digit secret can usefully go.
 *
 * ponytail: single-round SHA-256. If the PIN ever gates anything beyond the
 * screen, move to a slow KDF (scrypt/argon2) and rate-limit verifyPin. The
 * stored value is "<len>:<hex>" so the gate can draw the right number of
 * slots; the length is visible in the row, which is fine for a curtain.
 */
export async function hashPin(userId: string, pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${userId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** What `pin_hash` stores: the length for the gate's slots, then the hash. */
export async function pinRecord(userId: string, pin: string): Promise<string> {
  return `${pin.length}:${await hashPin(userId, pin)}`;
}

/** The PIN's length from a stored record, or null for no PIN or a legacy bare hash. */
export function pinLengthOf(stored: string | null): number | null {
  const m = /^([4-8]):[0-9a-f]{64}$/.exec(stored ?? "");
  return m ? Number(m[1]) : null;
}

/** Accepts the new record and a legacy bare hash, so a PIN set before the length was stored keeps working. */
export async function pinMatches(userId: string, pin: string, stored: string): Promise<boolean> {
  return stored === (await pinRecord(userId, pin)) || stored === (await hashPin(userId, pin));
}
