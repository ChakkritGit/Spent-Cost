import { PageHeader } from "@/components/page-header";
import { PinSettings } from "@/components/pin-settings";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("pin_hash").single();
  // Fails closed, as verifyPin does: a fetch error is not "no PIN set".
  const hasPin = error ? true : Boolean(data?.pin_hash);

  return (
    <>
      <PageHeader title="ตั้งค่า" />
      <PinSettings hasPin={hasPin} />
      <section className="flex flex-col gap-2.5 border-b border-ink px-4 py-5">
        <h2 className="headline text-[22px] font-bold">ติดตั้งเป็นแอป</h2>
        <p className="text-[13px] leading-relaxed text-muted">
          Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม (Chrome: เมนู → ติดตั้งแอป) เปิดได้เหมือนแอป และเปิดหน้าหลักได้แม้ไม่มีเน็ต
          โดยตัวเลขจะดึงใหม่ทุกครั้งที่ออนไลน์
        </p>
      </section>
    </>
  );
}
