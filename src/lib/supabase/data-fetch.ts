/**
 * The app's data lives on its own server (the VPS); login is still Supabase Auth.
 *
 * supabase-js sends everything to NEXT_PUBLIC_SUPABASE_URL, so this fetch moves the data calls
 * (/rest/v1 and /functions/v1) to the database gateway and leaves /auth/v1 on Supabase. The gateway
 * checks the Supabase session itself, so RLS works as before. Without a data URL nothing is moved.
 */
type Fetch = typeof fetch;

export function dataFetch(dataUrl: string | undefined, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", base: Fetch = fetch): Fetch {
  const from = supabaseUrl.replace(/\/+$/, "");
  const to = dataUrl?.replace(/\/+$/, "");
  if (!to || !from) return base;
  const moved: Fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(`${from}/rest/v1/`) && !url.startsWith(`${from}/functions/v1/`)) return base(input, init);
    const target = to + url.slice(from.length);
    return base(input instanceof Request ? new Request(target, input) : target, init);
  };
  return moved;
}
