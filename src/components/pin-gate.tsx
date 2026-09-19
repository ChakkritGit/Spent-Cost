"use client";

import { useEffect, useState } from "react";
import { verifyPin } from "@/app/actions";

const KEY = "pin-ok";

export function PinGate({ hasPin, children }: { hasPin: boolean; children: React.ReactNode }) {
  // Starts locked and unlocks in an effect: sessionStorage does not exist during
  // the server render, and reading it in render would mismatch on hydration.
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    // sessionStorage only exists client-side, so this can't be computed during
    // render (would mismatch server/client on hydration) or via
    // useSyncExternalStore (nothing external notifies same-tab writes).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnlocked(!hasPin || sessionStorage.getItem(KEY) === "1");
    setReady(true);
  }, [hasPin]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await verifyPin(pin)) {
      sessionStorage.setItem(KEY, "1");
      setUnlocked(true);
    } else {
      setWrong(true);
      setPin("");
    }
  }

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-center text-lg font-medium">ใส่ PIN</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setWrong(false); }}
          className="rounded-lg border border-line bg-card px-3 py-3 text-center text-2xl tracking-[0.5em]"
          aria-label="PIN"
          aria-invalid={wrong}
        />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
          ปลดล็อก
        </button>
      </form>
      {wrong && <p role="alert" className="text-center text-sm text-red-600">PIN ไม่ถูกต้อง</p>}
    </div>
  );
}
