import { setPin } from "@/app/actions";
import { ClearPinButton } from "@/components/clear-pin-button";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("pin_hash").single();
  // Fails closed to match verifyPin: a fetch error is not "no PIN set", so
  // treat it as if a PIN exists rather than silently offering to set a new one.
  const hasPin = error ? true : Boolean(data?.pin_hash);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">ตั้งค่า</h1>
      <section className="rounded-xl border border-line bg-card p-4">
        <h2 className="font-medium">PIN</h2>
        <p className="mt-1 text-sm text-muted">
          บังหน้าจอตอนเปิดแอพ ไม่ใช่ระบบความปลอดภัย — ข้อมูลถูกกันด้วยบัญชีและ RLS อยู่แล้ว
        </p>
        <form action={async (fd: FormData) => { "use server"; await setPin(String(fd.get("pin"))); }} className="mt-3 flex gap-2">
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            required
            placeholder={hasPin ? "เปลี่ยน PIN" : "ตั้ง PIN 4–8 หลัก"}
            aria-label="PIN"
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2"
          />
          <button className="rounded-lg bg-accent px-3 py-3 text-sm font-medium text-white">บันทึก</button>
        </form>
        {hasPin && <ClearPinButton />}
      </section>
    </div>
  );
}
