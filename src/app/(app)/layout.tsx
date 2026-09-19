import { Nav } from "@/components/nav";
import { PinGate } from "@/components/pin-gate";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("pin_hash").single();
  // Fails closed to match verifyPin: a fetch error is not "no PIN set", so
  // show the curtain rather than let a transient failure skip it.
  const hasPin = error ? true : Boolean(data?.pin_hash);

  return (
    <PinGate hasPin={hasPin}>
      <Nav />
      <div className="lg:pl-60">
        <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:pb-10">{children}</main>
      </div>
    </PinGate>
  );
}
