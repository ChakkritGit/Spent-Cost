// Bare "/auth" is deliberately excluded: no page is ever served there
// (the only route is /auth/callback), so leaving it gated just redirects
// it to /login like any other nonexistent protected path — no reason to
// widen the public surface for a path nothing renders.
export function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/auth/");
}
