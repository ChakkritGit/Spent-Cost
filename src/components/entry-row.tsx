"use client";

import { useTransition } from "react";
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
  const paid = entry.paid_at !== null;
  const day = Number(entry.due_date.slice(8, 10));
  const state = paid ? "paid" : entry.due_date < today ? "overdue" : "due";

  return (
    <li className="flex items-center gap-1 border-b border-line last:border-0">
      {/* size-11 = 44px hit area; the visible dot stays size-5 */}
      <button
        onClick={() => start(() => { void togglePaid(entry.id, !paid); })}
        disabled={pending}
        aria-pressed={paid}
        aria-label={paid ? `ทำเครื่องหมายว่ายังไม่จ่าย ${entry.name}` : `ทำเครื่องหมายว่าจ่ายแล้ว ${entry.name}`}
        className="flex size-11 shrink-0 items-center justify-center disabled:opacity-50"
      >
        <span className={`size-5 rounded-full border-2 transition-colors ${paid ? "border-accent bg-accent" : "border-line"}`} />
      </button>
      <div className="min-w-0 flex-1 py-3">
        <p className={`truncate text-sm ${paid ? "text-muted line-through" : ""}`}>{entry.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-xs text-muted">วันที่ {day} · {entry.category}</p>
          <StatusPill state={state} />
        </div>
      </div>
      <p className="shrink-0 text-sm font-medium tabular-nums">{baht(entry.amount)}</p>
      <button
        onClick={() => start(() => { void deleteEntry(entry.id); })}
        disabled={pending}
        aria-label={`ลบ ${entry.name}`}
        className="flex size-11 shrink-0 items-center justify-center text-xs text-muted disabled:opacity-50"
      >
        ลบ
      </button>
    </li>
  );
}
