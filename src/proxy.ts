import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/auth-paths";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getUser, not getSession: it revalidates the token with Supabase rather
  // than trusting a cookie the browser could have been handed.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  // robots.txt, sitemap.xml and llms.txt are for crawlers, who are never signed in; iOS asks for
  // /apple-touch-icon*.png on its own and must get the image, not a redirect to /login. /.well-known/
  // is asked for by tools (Lighthouse reads ai-catalog.json there): a 404, not the login page as "JSON".
  matcher: ["/((?!\\.well-known/|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-.*\\.png|apple-touch-icon.*\\.png|splash/|og\\.jpg|robots\\.txt|sitemap\\.xml|llms\\.txt|llms-full\\.txt).*)"],
};
