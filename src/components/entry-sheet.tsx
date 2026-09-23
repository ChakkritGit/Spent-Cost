"use client";

import { useState, useTransition } from "react";
import { deleteEntry, saveEntry } from "@/app/actions";
import { CategoryField, Field, FormError, SubmitButton } from "@/components/fields";
import { Sheet } from "@/components/sheet";
import type { Entry } from "@/lib/types";

/**
 * Add a one-off, or — given an entry — correct one: the credit-card bill whose
 * generated amount is fixed here before it is ticked paid. `plan_id` rides
 * along untouched, so an edited installment still counts toward its debt.
 */
export function EntrySheet({
  open,
  onClose,
  entry,
  categories,
  today,
}: {
  open: boolean;
  onClose: () => void;
  entry?: Entry;
  categories: string[];
  today: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const { error } = await saveEntry(form);
      if (error) setError(error);
      else onClose();
    });
  }

  function remove() {
    if (!entry) return;
    setError(null);
    start(async () => {
      const { error } = await deleteEntry(entry.id);
      if (error) setError(error);
      else onClose();
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title={entry ? "แก้ไขรายการ" : "เพิ่มรายการครั้งเดียว"}>
      <form onSubmit={submit} className="flex flex-col">
        {entry && <input type="hidden" name="id" value={entry.id} />}
        {entry?.plan_id && <input type="hidden" name="plan_id" value={entry.plan_id} />}

        <label className="flex flex-col gap-1 border-b border-hair px-4 pb-3 pt-4">
          <span className="label">จำนวนเงิน (บาท)</span>
          <span className="flex items-baseline gap-2 text-brand">
            <span className="headline text-4xl">฿</span>
            <input
              name="amount"
              required
              inputMode="decimal"
              autoComplete="off"
              defaultValue={entry?.amount}
              placeholder="0"
              autoFocus
              className="headline w-full min-w-0 bg-transparent text-5xl outline-none placeholder:text-hair"
            />
          </span>
        </label>

        <div className="grid grid-cols-2 border-b border-hair">
          <Field label="ชื่อรายการ" name="name" required defaultValue={entry?.name} placeholder="เช่น ข้าวเย็น" className="border-e border-hair" />
          <Field label="วันที่" name="due_date" type="date" required defaultValue={entry?.due_date ?? today} className="font-mono" />
        </div>

        <CategoryField categories={categories} defaultValue={entry?.category} />

        <div className="flex flex-col gap-3 px-4 pb-5 pt-2">
          <FormError message={error} />
          <SubmitButton pending={pending}>บันทึกรายการ</SubmitButton>
          {entry && (
            <button type="button" onClick={remove} disabled={pending} className="h-11 font-mono text-xs text-danger underline disabled:opacity-60">
              ลบรายการนี้
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
