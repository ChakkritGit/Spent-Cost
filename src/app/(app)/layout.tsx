import { Nav } from "@/components/nav";
import { PinGate } from "@/components/pin-gate";
import { getCategories } from "@/lib/data";
import { todayIso } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [{ data, error }, categories] = await Promise.all([
    supabase.from("profiles").select("pin_hash").single(),
    getCategories(),
  ]);
  // Fails closed, as verifyPin does: a fetch error is not "no PIN set".
  const hasPin = error ? true : Boolean(data?.pin_hash);

  return (
    <PinGate hasPin={hasPin}>
      <Nav categories={categories} today={todayIso()} />
      <div className="lg:ps-56">
        <main className="mx-auto min-h-dvh max-w-2xl bg-paper pb-28 sm:border-x sm:border-ink lg:pb-10">{children}</main>
      </div>
    </PinGate>
  );
}
