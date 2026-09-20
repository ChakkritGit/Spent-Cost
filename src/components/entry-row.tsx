"use client";

import { useState, useTransition } from "react";
import { deleteEntry, togglePaid } from "@/app/actions";
import { StatusPill } from "@/components/status-pill";
import { baht } from "@/lib/money";
import type { Entry } from "@/lib/types";

/**
 * `today` comes from the server render (see page.tsx) rather than a client
 * `new Date()` — this is a client component for the toggle/delete
 * transitions, and computing "today" here risks a hydration mismatch if the
 * server and browser clocks straddle midnight.
 */
export function EntryRow({ entry, today }: { entry: Entry; today: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const paid = entry.paid_at !== null;
  const day = Number(entry.due_date.slice(8, 10));
  const state = paid ? "paid" : entry.due_date < today ? "overdue" : "due";

  // The transition's callback must be async and awaited — a fire-and-forget
  // `void` call resolves the transition (and re-enables the button) before
  // the server round trip lands, so a fast double tap can toggle twice and
  // cancel itself out. Same pattern as generate-month-button.tsx.
  function toggle() {
    setError(null);
    start(async () => {
      try {
        await togglePaid(entry.id, !paid);
      } catch {
        setError("บันทึกไม่สำเร็จ ลองอีกครั้ง");
      }
    });
  }

  function remove() {
    setError(null);
    start(async () => {
      try {
        await deleteEntry(entry.id);
      } catch {
        setError("ลบไม่สำเร็จ ลองอีกครั้ง");
      }
    });
  }

  return (
    <li className="border-b border-line last:border-0">
      <div className="flex items-center gap-1">
        {/* size-11 = 44px hit area; the visible dot stays size-5 */}
        <button
          onClick={toggle}
          disabled={pending}
          aria-pressed={paid}
          aria-label={paid ? `ทำเครื่องหมายว่ายังไม่จ่าย ${entry.name}` : `ทำเครื่องหมายว่าจ่ายแล้ว ${entry.name}`}
          className="flex size-11 shrink-0 items-center justify-center disabled:opacity-50"
        >
          <span className={`size-5 rounded-full border-2 transition-colors ${paid ? "border-accent bg-accent" : "border-line"}`} />
        </button>
        <div className="min-w-0 flex-1 py-3">
          <p className={`truncate text-[15px] ${paid ? "text-muted line-through" : ""}`}>{entry.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[13px] text-muted">วันที่ {day} · {entry.category}</p>
            <StatusPill state={state} />
          </div>
        </div>
        <p className="shrink-0 text-[15px] font-medium tabular-nums">{baht(entry.amount)}</p>
        <button
          onClick={remove}
          disabled={pending}
          aria-label={`ลบ ${entry.name}`}
          className="flex size-11 shrink-0 items-center justify-center text-xs text-muted disabled:opacity-50"
        >
          ลบ
        </button>
      </div>
      {error && (
        <p role="alert" className="pb-2 text-xs text-overdue-fg">{error}</p>
      )}
    </li>
  );
}
