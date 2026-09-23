"use client";

import { useState, useTransition } from "react";
import { clearPin, setPin } from "@/app/actions";

export function PinSettings({ hasPin }: { hasPin: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [arming, setArming] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const pin = String(new FormData(form).get("pin"));
    start(async () => {
      const { error } = await setPin(pin);
      setMessage(error ? { text: error, error: true } : { text: hasPin ? "เปลี่ยน PIN แล้ว" : "ตั้ง PIN แล้ว" });
      if (!error) form.reset();
    });
  }

  function clear() {
    start(async () => {
      const { error } = await clearPin();
      setArming(false);
      setMessage(error ? { text: error, error: true } : { text: "ปิด PIN แล้ว" });
    });
  }

  return (
    <section className="flex flex-col gap-3 border-b border-ink bg-surface px-4 py-5">
      <div className="flex items-center justify-between">
        <h2 className="headline text-[22px] font-bold">PIN</h2>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[11px] font-bold ${
            hasPin ? "bg-brand-soft text-brand" : "bg-paper text-muted"
          }`}
        >
          <span aria-hidden className={`size-1.5 ${hasPin ? "bg-brand" : "bg-muted"}`} />
          {hasPin ? "ตั้งแล้ว" : "ยังไม่ได้ตั้ง"}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">
        บังหน้าจอตอนเปิดแอป ถามครั้งเดียวต่อการเปิดเบราว์เซอร์ ไม่ใช่ระบบความปลอดภัย — ข้อมูลถูกกันด้วยบัญชีของคุณอยู่แล้ว
      </p>
      <form onSubmit={submit} className="flex flex-col gap-1.5">
        <label htmlFor="pin" className="label">{hasPin ? "PIN ใหม่" : "PIN"} 4–8 หลัก</label>
        <div className="flex">
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{4,8}"
            required
            className="h-12 min-w-0 flex-1 border border-e-0 border-ink bg-paper px-3.5 font-mono text-xl tracking-[0.4em] outline-none"
          />
          <button disabled={pending} className="h-12 border border-ink bg-brand px-4.5 font-mono text-[13px] font-bold text-on-brand disabled:opacity-60">
            {hasPin ? "เปลี่ยน" : "ตั้ง PIN"}
          </button>
        </div>
      </form>
      {hasPin &&
        (arming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">ปิด PIN แล้วเปิดแอปจะเห็นตัวเลขทันที</span>
            <button type="button" disabled={pending} onClick={clear} className="h-10 border border-danger bg-danger px-3.5 font-mono text-xs font-bold text-surface">
              ยืนยันปิด PIN
            </button>
            <button type="button" onClick={() => setArming(false)} className="h-10 px-3 font-mono text-xs">ยกเลิก</button>
          </div>
        ) : (
          <button type="button" onClick={() => setArming(true)} className="h-11 self-start font-mono text-xs text-danger underline">
            ปิด PIN
          </button>
        ))}
      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-danger" : "text-brand"}`}>{message.text}</p>
      )}
    </section>
  );
}
