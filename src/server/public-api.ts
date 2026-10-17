import "server-only";
import { createPublicApi } from "@/lib/public-api";

export const publicApi = createPublicApi(() => ({
  authUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  dataUrl: process.env.DATA_URL,
  publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}));
