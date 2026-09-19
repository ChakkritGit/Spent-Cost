"use client";

import { useRef, useState } from "react";
import { clearPin } from "@/app/actions";

const ARM_MS = 3000;

export function ClearPinButton() {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function disarm() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setArmed(false);
  }

  function handleClick() {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(disarm, ARM_MS);
      return;
    }
    disarm();
    clearPin();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onBlur={disarm}
      aria-live="polite"
      className="mt-2 rounded-lg px-3 py-3 text-sm text-muted underline"
    >
      {armed ? "แตะอีกครั้งเพื่อยืนยัน" : "ปิดการใช้ PIN"}
    </button>
  );
}
