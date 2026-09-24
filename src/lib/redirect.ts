/**
 * The path to land on after the auth callback, or "/" if `next` would leave
 * the site. Resolved with the URL parser rather than checked as text: the
 * parser reads "/\evil.com" and "/\t/evil.com" as "//evil.com", which a
 * prefix check lets through.
 */
export function sameSitePath(next: string | null, base: string): string {
  if (!next) return "/";
  try {
    const url = new URL(next, base);
    return url.origin === new URL(base).origin ? url.pathname + url.search : "/";
  } catch {
    return "/";
  }
}
