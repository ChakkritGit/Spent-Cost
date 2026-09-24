"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Add Google to an account that signed in by email, so either works and both
 * reach the same rows. linkIdentity needs "Manual linking" switched on in
 * Supabase (Authentication → Sign In / Providers); until then it errors, and
 * that is said here rather than swallowed.
 */
export function LinkedAccounts({ email, google, failed }: { email: string | null; google: string | null; failed: boolean }) {
  const [status, setStatus] = useState<"idle" | "going" | "error">(failed ? "error" : "idle");

  async function link() {
    setStatus("going");
    const { error } = await createClient().auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/settings` },
    });
    if (error) setStatus("error");
  }

  return (
    <section className="flex flex-col gap-3 border-b border-ink px-4 py-5">
      <h2 className="headline text-[22px] font-bold">บัญชีที่เชื่อม</h2>
      <ul className="border-y border-hair">
        <li className="flex min-h-13 items-center justify-between gap-3 border-b border-hair">
          <span className="text-sm">อีเมล</span>
          <span className="truncate font-mono text-xs text-muted">{email ?? "—"}</span>
        </li>
        <li className="flex min-h-13 items-center justify-between gap-3">
          <span className="text-sm">Google</span>
          {google ? (
            <span className="inline-flex items-center gap-1.5 bg-brand-soft px-2 py-0.5 font-mono text-[11px] font-bold text-brand">
              <span aria-hidden className="size-1.5 bg-brand" />
              {google}
            </span>
          ) : (
            <button
              type="button"
              onClick={link}
              disabled={status === "going"}
              className="h-10 border border-ink bg-surface px-3.5 font-mono text-xs font-bold disabled:opacity-60"
            >
              {status === "going" ? "กำลังไปที่ Google…" : "ผูกบัญชี Google"}
            </button>
          )}
        </li>
      </ul>
      <p className="text-[13px] leading-relaxed text-muted">ผูกแล้วเข้าสู่ระบบด้วย Google หรืออีเมลก็ได้ ข้อมูลชุดเดียวกัน</p>
      {status === "error" && (
        <p role="alert" className="border border-danger bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
          ผูกไม่สำเร็จ — บัญชี Google นี้อาจผูกกับผู้ใช้อื่นอยู่แล้ว หรือยังไม่ได้เปิด Google / Manual linking ใน Supabase
        </p>
      )}
    </section>
  );
}
