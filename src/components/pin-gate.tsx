"use client";

import { useState, useSyncExternalStore } from "react";
import { verifyPin } from "@/app/actions";

const KEY = "pin-ok";

// Nothing external ever pushes a change here — sessionStorage only changes
// from this component's own submit handler, which already re-renders
// through its own state. The no-op subscribe is this hook's documented
// shape for "give me a synchronous, hydration-safe read of something the
// server can't see," with no effect and no post-mount flash required.
const subscribe = () => () => {};
const getSnapshot = () => sessionStorage.getItem(KEY) === "1";
const getServerSnapshot = () => false;

export function PinGate({ hasPin, children }: { hasPin: boolean; children: React.ReactNode }) {
  const storedUnlock = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [verified, setVerified] = useState(false);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  const unlocked = !hasPin || storedUnlock || verified;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await verifyPin(pin)) {
      sessionStorage.setItem(KEY, "1");
      setVerified(true);
    } else {
      setWrong(true);
      setPin("");
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-center text-lg font-medium">ใส่ PIN</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setWrong(false); }}
          className="rounded-btn border border-line bg-card px-3 py-3 text-center text-2xl tracking-[0.5em]"
          aria-label="PIN"
          aria-invalid={wrong}
        />
        <button type="submit" className="rounded-btn bg-accent px-3 py-3 text-sm font-medium text-accent-fg">
          ปลดล็อก
        </button>
      </form>
      {wrong && <p role="alert" className="text-center text-sm text-overdue-fg">PIN ไม่ถูกต้อง</p>}
    </div>
  );
}
