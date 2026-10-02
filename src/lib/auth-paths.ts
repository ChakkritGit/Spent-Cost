// Bare "/auth" is deliberately excluded: no page is ever served there
// (the only route is /auth/callback), so leaving it gated just redirects
// it to /login like any other nonexistent protected path — no reason to
// widen the public surface for a path nothing renders.
// /api/health is exact for the same reason: the status worker polls it, nothing else under /api is public.
export function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/api/health" || pathname.startsWith("/auth/");
}
