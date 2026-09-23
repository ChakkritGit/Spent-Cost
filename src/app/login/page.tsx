"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col sm:border-x sm:border-ink">
      <div
        className="flex flex-1 flex-col justify-end gap-2.5 border-b border-ink p-6 pt-[calc(24px+env(safe-area-inset-top))]"
        style={{
          backgroundImage: "linear-gradient(var(--hair) 1px, transparent 1px), linear-gradient(90deg, var(--hair) 1px, transparent 1px)",
          backgroundSize: "39px 39px",
        }}
      >
        <span aria-hidden className="size-11 bg-brand" />
        <h1 className="text-[64px] font-extrabold leading-[0.95] [font-stretch:62.5%]">
          SPENT
          <br />
          /COST
        </h1>
        <p className="font-mono text-xs text-muted">บันทึกรายจ่าย ผ่อน และหนี้ — เดือนต่อเดือน</p>
      </div>
      <form onSubmit={send} className="flex flex-col gap-3 bg-surface p-6 pb-[calc(40px+env(safe-area-inset-bottom))]">
        <label htmlFor="email" className="label">อีเมล</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-13 border border-ink bg-paper px-3.5 font-mono text-base outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="h-13 border border-ink bg-brand font-mono text-sm font-bold text-on-brand disabled:opacity-60"
        >
          {status === "sending" ? "กำลังส่ง…" : "ส่งลิงก์เข้าสู่ระบบ →"}
        </button>
        {status === "sent" && (
          <p role="status" className="border border-brand bg-brand-soft px-3 py-2.5 text-[13px] text-brand">
            ส่งลิงก์ไปที่ {email} แล้ว เปิดอีเมลบนเครื่องนี้เพื่อเข้าสู่ระบบ
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="border border-danger bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            ส่งไม่สำเร็จ ลองใหม่อีกครั้ง
          </p>
        )}
      </form>
    </main>
  );
}
