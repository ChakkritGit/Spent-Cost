"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "checking" | "unsupported" | "denied" | "off" | "on";

/** Base64url → bytes, the form pushManager.subscribe wants the VAPID key in. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const raw = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * The 08:00 reminder: a day before a bill, on the day, and every morning it
 * stays overdue. iOS delivers Web Push only to the app added to the Home
 * Screen (16.4+), so in Safari itself this says how to get there.
 */
export function NotificationSettings() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (live) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (live) setState("denied");
        return;
      }
      // getRegistration, not ready: ready never settles where no worker was
      // registered (dev, or a failed registration), and the section would hang.
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        if (live) setState("unsupported");
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      if (live) setState(sub ? "on" : "off");
    })();
    return () => {
      live = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      // Must run straight from the tap: iOS only asks inside a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) });
      const { keys } = sub.toJSON();
      const { error } = await savePushSubscription({ endpoint: sub.endpoint, p256dh: keys?.p256dh ?? "", auth: keys?.auth ?? "" });
      if (error) {
        await sub.unsubscribe();
        setMessage({ text: error, error: true });
        return;
      }
      setState("on");
      setMessage({ text: "เปิดการแจ้งเตือนแล้ว จะเตือนทุกเช้า 08:00" });
    } catch {
      setMessage({ text: "เปิดการแจ้งเตือนไม่สำเร็จ ลองอีกครั้ง", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    const { data, error } = await createClient().functions.invoke<{ sent: number }>("push-reminders", { body: {} });
    setBusy(false);
    if (error || !data) setMessage({ text: "ส่งทดสอบไม่สำเร็จ — ตรวจว่า deploy ฟังก์ชัน push-reminders แล้ว", error: true });
    else setMessage({ text: data.sent ? `ส่งแล้ว ${data.sent} เครื่อง` : "ไม่พบเครื่องที่เปิดการแจ้งเตือนไว้", error: !data.sent });
  }

  const button = "h-11 border border-ink px-4 font-mono text-xs font-bold disabled:opacity-60";

  return (
    <section className="flex flex-col gap-3 border-b border-ink px-4 py-5">
      <h2 className="headline text-[22px] font-bold">การแจ้งเตือน</h2>
      <p className="text-[13px] leading-relaxed text-muted">
        เตือนตอน 08:00 ก่อนครบกำหนด 1 วัน วันที่ครบ และทุกเช้าที่ยังเกินกำหนดอยู่ — รวมเป็นข้อความเดียวต่อวัน
      </p>

      {state === "unsupported" && (
        <p className="border border-hair bg-surface px-3 py-2.5 text-[13px] leading-relaxed">
          {KEY
            ? "เครื่องนี้ยังรับการแจ้งเตือนไม่ได้ บน iPhone: Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม แล้วเปิดแอปจากไอคอน (iOS 16.4 ขึ้นไป)"
            : "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_VAPID_PUBLIC_KEY"}
        </p>
      )}
      {state === "denied" && (
        <p className="border border-danger bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
          การแจ้งเตือนถูกปิดไว้ในเครื่อง เปิดได้ที่ การตั้งค่า → การแจ้งเตือน → Spent/Cost
        </p>
      )}
      {state === "off" && (
        <button type="button" onClick={turnOn} disabled={busy} className={`${button} self-start bg-brand text-on-brand`}>
          {busy ? "กำลังเปิด…" : "เปิดการแจ้งเตือน"}
        </button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={test} disabled={busy} className={`${button} bg-surface`}>
            ส่งทดสอบ
          </button>
          <button type="button" onClick={turnOff} disabled={busy} className={`${button} border-danger bg-surface text-danger`}>
            ปิดการแจ้งเตือน
          </button>
        </div>
      )}
      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-danger" : "text-brand"}`}>{message.text}</p>
      )}
    </section>
  );
}
