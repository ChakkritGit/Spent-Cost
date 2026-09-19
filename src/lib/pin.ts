/**
 * A PIN is a curtain over the screen, not a security boundary — the real one
 * is Supabase Auth plus RLS. Salting with the user id defeats rainbow tables,
 * which is as far as hashing a four-digit secret can usefully go.
 *
 * ponytail: single-round SHA-256. If the PIN ever gates anything beyond the
 * screen, move to a slow KDF (scrypt/argon2) and rate-limit verifyPin.
 */
export async function hashPin(userId: string, pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${userId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
