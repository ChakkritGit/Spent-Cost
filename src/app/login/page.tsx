"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary on a statically rendered page.
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "google">("idle");
  // /auth/callback sends a failed sign-in (magic link or Google) back here with ?error=1.
  const callbackFailed = useSearchParams().has("error");

  // Supabase links a Google sign-in to the existing account when the Gmail
  // address is the one the magic link was sent to — same user, same rows.
  async function google() {
    setStatus("google");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setStatus("error");
  }

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
        {callbackFailed && status === "idle" && (
          <p role="alert" className="border border-danger bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            เข้าสู่ระบบไม่สำเร็จ ลิงก์อาจหมดอายุ ลองใหม่อีกครั้ง
          </p>
        )}
        <button
          type="button"
          onClick={google}
          disabled={status === "google"}
          className="flex h-13 items-center justify-center gap-3 border border-ink bg-surface text-[15px] font-medium disabled:opacity-60"
        >
          <svg aria-hidden width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {status === "google" ? "กำลังไปที่ Google…" : "เข้าสู่ระบบด้วย Google"}
        </button>
        <div aria-hidden className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-hair" />
          <span className="label">หรือใช้อีเมล</span>
          <span className="h-px flex-1 bg-hair" />
        </div>
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
