import { NextResponse, type NextRequest } from "next/server";
import { sameSitePath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  // Where to land after: "/settings" when a Google account was just linked.
  const safeNext = sameSitePath(request.nextUrl.searchParams.get("next"), request.url);
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, request.url));
  }
  // A failed link lands on settings with the error; a failed sign-in on /login.
  return NextResponse.redirect(new URL(safeNext === "/settings" ? "/settings?link=failed" : "/login?error=1", request.url));
}
