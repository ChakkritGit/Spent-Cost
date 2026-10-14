import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { dataFetch } from "./data-fetch";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // data on the VPS (internal address), login on Supabase
      global: { fetch: dataFetch(process.env.DATA_URL) },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy (src/proxy.ts) refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
