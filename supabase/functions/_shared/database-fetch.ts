/** Retry only PostgREST's explicit rejection of a JWT issued in the future.
 * Authentication failed before SQL execution, so replaying a write is safe.
 * Network failures and other errors must not replay potentially completed writes. */
export function databaseFetch(
  request: typeof fetch = fetch,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): typeof fetch {
  return async (input, init) => {
    const original = new Request(input, init);
    for (let attempt = 0; ; attempt++) {
      original.signal.throwIfAborted();
      const response = await request(original.clone());
      if (attempt === 2 || response.status !== 401 || !new URL(original.url).pathname.startsWith("/rest/v1/")) {
        return response;
      }
      const error = await response.clone().json().catch(() => null);
      if (error?.code !== "PGRST303" || error?.message !== "JWT issued at future") return response;
      await response.body?.cancel();
      console.warn("database JWT clock skew; retrying", attempt + 1);
      await pause(1000 * (attempt + 1));
    }
  };
}
