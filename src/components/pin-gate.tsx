"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { verifyPin } from "@/app/actions";
import { Mark } from "@/components/nav";

const KEY = "pin-ok";
const MAX = 8;

// sessionStorage only changes from this component's own unlock, which
// re-renders through its own state — so the subscribe is a no-op. The hook is
// here for a hydration-safe read of something the server cannot see.
const subscribe = () => () => {};
const getSnapshot = () => sessionStorage.getItem(KEY) === "1";
const getServerSnapshot = () => false;

/**
 * A curtain, not a lock (see lib/pin.ts): asked once per browser session so
 * the figures are not on screen the moment the app opens. Its own keypad, and
 * the keyboard works too.
 */
export function PinGate({ hasPin, children }: { hasPin: boolean; children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [verified, setVerified] = useState(false);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  const [checking, setChecking] = useState(false);
  const unlocked = !hasPin || stored || verified;

  async function submit() {
    if (pin.length < 4 || checking) return;
    setChecking(true);
    const ok = await verifyPin(pin);
    setChecking(false);
    if (ok) {
      sessionStorage.setItem(KEY, "1");
      setVerified(true);
    } else {
      setWrong(true);
      setPin("");
    }
  }

  function press(key: string) {
    setWrong(false);
    if (key === "del") setPin((p) => p.slice(0, -1));
    else if (key === "ok") void submit();
    else setPin((p) => (p.length < MAX ? p + key : p));
  }

  useEffect(() => {
    if (unlocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") press("ok");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (unlocked) return <>{children}</>;

  const slots = Math.max(4, pin.length);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"];

  return (
    <div className="flex min-h-dvh flex-col justify-between bg-brand text-on-brand">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-7 px-6 pt-[calc(64px+env(safe-area-inset-top))]">
        <Mark className="[&>span:first-child]:bg-on-brand" />
        <h1 className="headline text-[56px]">ใส่ PIN<br />เพื่อดูตัวเลข</h1>
        <div className="flex flex-wrap gap-2.5" role="status" aria-label={`ใส่แล้ว ${pin.length} หลัก`}>
          {Array.from({ length: slots }, (_, i) => (
            <span key={i} className={`h-11 w-9 border border-on-brand ${i < pin.length ? "bg-on-brand" : ""}`} />
          ))}
        </div>
        {wrong && <p role="alert" className="font-mono text-sm">PIN ไม่ถูกต้อง ลองอีกครั้ง</p>}
      </div>
      <div className="mx-auto grid w-full max-w-sm grid-cols-3 border-t border-on-brand/50 pb-[env(safe-area-inset-bottom)]">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            disabled={k === "ok" && (pin.length < 4 || checking)}
            aria-label={k === "del" ? "ลบตัวเลข" : k === "ok" ? "ปลดล็อก" : k}
            className={`h-[76px] border-b border-e border-on-brand/50 font-mono disabled:opacity-50 [&:nth-child(3n)]:border-e-0 ${
              k.length > 1 ? "text-[13px]" : "text-[26px]"
            }`}
          >
            {k === "del" ? "ลบ" : k === "ok" ? (checking ? "…" : "ปลดล็อก") : k}
          </button>
        ))}
      </div>
    </div>
  );
}
