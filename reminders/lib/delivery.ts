export type Delivery = "sent" | "gone" | "failed";

/** Retry an explicit temporary rejection once. Network timeouts can have
 * delivered the message already, so they are reported instead of retried. */
export async function deliver(
  send: () => Promise<unknown>,
  pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 500)),
): Promise<Delivery> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await send();
      return "sent";
    } catch (error) {
      const status = (error as { statusCode?: number } | null)?.statusCode;
      if (status === 404 || status === 410) return "gone";
      if (attempt === 0 && status !== undefined && status >= 500 && status <= 599) {
        await pause();
        continue;
      }
      // Do not log endpoints, subscription keys or push response bodies.
      console.error("push delivery failed", status ?? "network");
      return "failed";
    }
  }
  return "failed";
}
