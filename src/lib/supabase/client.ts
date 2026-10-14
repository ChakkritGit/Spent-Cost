import { createBrowserClient } from "@supabase/ssr";
import { dataFetch } from "./data-fetch";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // data on the VPS (through this site's /data), login on Supabase
    { global: { fetch: dataFetch(process.env.NEXT_PUBLIC_DATA_URL) } },
  );
}
