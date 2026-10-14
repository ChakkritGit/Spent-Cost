export type Claim = "claimed" | "sent" | "gone" | "busy" | "uncertain" | "exhausted";
export type Outcome = "sent" | "gone" | "failed" | "uncertain";

export interface ReceiptStore {
  claim(token: string): Promise<Claim>;
  finish(token: string, outcome: Outcome): Promise<boolean>;
}

/** A receipt is committed before a push is attempted. A lost push response or
 * lost receipt acknowledgement must never cause automatic redelivery. */
export async function sendDaily(store: ReceiptStore, push: () => Promise<unknown>, token = crypto.randomUUID()) {
  const claim = await store.claim(token);
  if (claim === "sent" || claim === "gone") return { resolved: true, sent: false, outcome: claim };
  if (claim !== "claimed") return { resolved: false, sent: false, outcome: claim };
  let outcome: Outcome;
  try {
    await push();
    outcome = "sent";
  } catch (error) {
    const status = (error as { statusCode?: number } | null)?.statusCode;
    outcome = status === 404 || status === 410 ? "gone"
      : typeof status === "number" && status >= 400 && status <= 599 ? "failed" : "uncertain";
  }
  // If this fails, leave the receipt in flight. Its eventual expiration becomes
  // uncertain; a later successful finish from this token can still resolve it.
  if (!await store.finish(token, outcome)) throw new Error("daily receipt was not confirmed");
  return { resolved: outcome === "sent" || outcome === "gone", sent: outcome === "sent", outcome };
}

export async function endpointHash(endpoint: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Snapshot at most eight devices at once to bound push sockets/crypto work. */
export async function mapDevices<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> {
  const result: R[] = [];
  for (let offset = 0; offset < items.length; offset += 8) {
    result.push(...await Promise.all(items.slice(offset, offset + 8).map(task)));
  }
  return result;
}
