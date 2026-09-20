"use client";

import { useRef, useState, useTransition } from "react";
import { deletePlan } from "@/app/actions";

const ARM_MS = 3000;

/**
 * entries.plan_id is `on delete set null` by design — deleting a plan does
 * not erase the money that already left the account, it detaches it. For a
 * plan with paid entries that detachment quietly breaks its payment history
 * (a debt's progress, or a subscription's past charges), so deleting one is
 * not a single tap: it arms first, the way clear-pin-button.tsx arms before
 * turning off the PIN, and says in words what will happen. A plan with no
 * paid entries has no history to lose, so it deletes on the first tap.
 */
export function PlanDeleteButton({ id, name, paidCount }: { id: string; name: string; paidCount: number }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guarded = paidCount > 0;

  function disarm() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setArmed(false);
  }

  function remove() {
    setError(null);
    start(async () => {
      try {
        await deletePlan(id);
      } catch {
        setError("ลบไม่สำเร็จ ลองอีกครั้ง");
      }
    });
  }

  function handleClick() {
    if (guarded && !armed) {
      setArmed(true);
      timer.current = setTimeout(disarm, ARM_MS);
      return;
    }
    disarm();
    remove();
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        onBlur={disarm}
        disabled={pending}
        aria-label={armed ? `ยืนยันการลบ ${name}` : `ลบ ${name}`}
        aria-live="polite"
        className="rounded-btn inline-flex min-h-11 min-w-11 items-center justify-center px-4 text-xs text-muted underline disabled:opacity-50"
      >
        {armed ? "แตะอีกครั้งเพื่อยืนยัน" : "ลบ"}
      </button>
      {armed && (
        <p role="alert" className="mt-1 text-xs text-overdue-fg">
          มีรายการจ่ายแล้ว {paidCount} รายการผูกกับ {name} — การลบจะตัดรายการเหล่านั้นออกจากที่นี่ (รายการยังอยู่ในระบบ แต่จะไม่นับกับรายการนี้อีก)
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-overdue-fg">{error}</p>
      )}
    </div>
  );
}
