import { Nav } from "@/components/nav";
import { PinGate } from "@/components/pin-gate";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("pin_hash").single();

  return (
    <PinGate hasPin={Boolean(data?.pin_hash)}>
      <Nav />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:pb-10">{children}</main>
    </PinGate>
  );
}
