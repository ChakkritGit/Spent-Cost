"use client";

import { useOptimistic, useState, useTransition } from "react";
import { togglePaid } from "@/app/actions";
import { EntrySheet } from "@/components/entry-sheet";
import { Icon } from "@/components/icons";
import { dueLabel, stateOf } from "@/lib/calendar";
import { amount } from "@/lib/money";
import type { Entry } from "@/lib/types";

/**
 * Ledger rows: day · name · amount · paid box. The name opens the entry to
 * edit or delete; the box ticks it paid. `today` comes from the server so the
 * overdue reading cannot differ between server and browser at midnight.
 */
export function EntryList({ entries, categories, today, showDay = true }: { entries: Entry[]; categories: string[]; today: string; showDay?: boolean }) {
  const [editing, setEditing] = useState<Entry | null>(null);
  return (
    <>
      <ul>
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} today={today} showDay={showDay} onOpen={() => setEditing(e)} />
        ))}
      </ul>
      <EntrySheet
        key={editing?.id}
        open={editing !== null}
        onClose={() => setEditing(null)}
        entry={editing ?? undefined}
        categories={categories}
        today={today}
      />
    </>
  );
}

function EntryRow({ entry, today, showDay, onOpen }: { entry: Entry; today: string; showDay: boolean; onOpen: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useOptimistic(entry.paid_at !== null);
  const state = paid ? "paid" : stateOf(entry, today);
  const note = paid ? null : dueLabel(entry, today);

  function toggle() {
    setError(null);
    start(async () => {
      setPaid(!paid);
      const { error } = await togglePaid(entry.id, !paid);
      if (error) setError(error);
    });
  }

  return (
    <li className="border-b border-hair">
      <div className="flex min-h-15 items-center gap-3">
        {showDay && <span className="w-6 shrink-0 font-mono text-sm text-muted">{entry.due_date.slice(8, 10)}</span>}
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col items-start py-2 text-start">
          <span className="w-full truncate text-[15px] font-medium">{entry.name}</span>
          <span className={`w-full truncate text-xs ${state === "overdue" ? "text-danger" : state === "due" ? "text-warn" : "text-muted"}`}>
            {entry.category} · {entry.plan_id ? "จากแผน" : "ครั้งเดียว"}
            {note && ` · ${note}`}
          </span>
        </button>
        <span className="shrink-0 font-mono text-sm font-medium">{amount(entry.amount)}</span>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={paid}
          aria-label={paid ? `ยกเลิกจ่ายแล้ว ${entry.name}` : `ทำเครื่องหมายว่าจ่ายแล้ว ${entry.name}`}
          className="-me-2.5 grid size-11 shrink-0 place-items-center"
        >
          <span
            className={`grid size-[22px] place-items-center border ${
              paid ? "border-brand bg-brand text-on-brand" : state === "overdue" ? "border-danger" : "border-ink"
            }`}
          >
            {paid && <Icon name="check" size={14} stroke={3} />}
          </span>
        </button>
      </div>
      {error && <p role="alert" className="pb-2 text-xs text-danger">{error}</p>}
    </li>
  );
}
