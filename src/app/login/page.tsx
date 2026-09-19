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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">รายจ่าย</h1>
        <p className="mt-1 text-sm text-muted">เข้าสู่ระบบด้วยอีเมล</p>
      </div>
      <form onSubmit={send} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-lg border border-line bg-card px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === "sending" ? "กำลังส่ง…" : "ส่งลิงก์เข้าสู่ระบบ"}
        </button>
      </form>
      {status === "sent" && <p className="text-sm text-muted">ส่งลิงก์ไปที่ {email} แล้ว เปิดอีเมลเพื่อเข้าสู่ระบบ</p>}
      {status === "error" && <p role="alert" className="text-sm text-overdue-fg">ส่งไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
    </main>
  );
}
