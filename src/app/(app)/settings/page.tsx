import { LinkedAccounts } from "@/components/linked-accounts";
import { NotificationSettings } from "@/components/notification-settings";
import { PageHeader } from "@/components/page-header";
import { PinSettings } from "@/components/pin-settings";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link } = await searchParams;
  const supabase = await createClient();
  const [{ data, error }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("pin_hash").single(),
    supabase.auth.getUser(),
  ]);
  const google = auth.user?.identities?.find((i) => i.provider === "google");
  // Fails closed, as verifyPin does: a fetch error is not "no PIN set".
  const hasPin = error ? true : Boolean(data?.pin_hash);

  return (
    <>
      <PageHeader title="ตั้งค่า" />
      <PinSettings hasPin={hasPin} />
      <NotificationSettings />
      <LinkedAccounts
        email={auth.user?.email ?? null}
        google={google ? String(google.identity_data?.email ?? "ผูกแล้ว") : null}
        failed={link === "failed"}
      />
      <section className="flex flex-col gap-3 border-b border-ink px-4 py-5">
        <h2 className="headline text-[22px] font-bold">สถานะระบบ</h2>
        <p className="text-[13px] leading-relaxed text-muted">
          ดูว่าแอป ฐานข้อมูล และการแจ้งเตือนบิลทำงานปกติไหม ตรวจทุก 5 นาที
        </p>
        <a
          href="https://status.chakkritton.com"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-10 w-fit items-center border border-ink bg-surface px-3.5 font-mono text-xs font-bold"
        >
          เปิดหน้าสถานะ ↗
        </a>
      </section>
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
