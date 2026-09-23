"use client";

import { useState, useTransition } from "react";
import { deletePlan, savePlan, setPlanActive } from "@/app/actions";
import { CategoryField, Field, FormError, SubmitButton } from "@/components/fields";
import { Sheet } from "@/components/sheet";
import type { Plan } from "@/lib/types";

/** Create or edit a plan. A debt is a plan that knows its total — the toggle only shows those two fields. */
export function PlanSheet({ open, onClose, plan, categories, paidCount = 0 }: { open: boolean; onClose: () => void; plan?: Plan; categories: string[]; paidCount?: number }) {
  const [debt, setDebt] = useState(plan ? plan.total_amount !== null : false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const { error } = await savePlan(form);
      if (error) setError(error);
      else onClose();
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title={plan ? "แก้ไขแผน" : "เพิ่มแผน"}>
      <form onSubmit={submit} className="flex flex-col">
        {plan && <input type="hidden" name="id" value={plan.id} />}
        {(plan?.active ?? true) && <input type="hidden" name="active" value="on" />}

        <div role="radiogroup" aria-label="ประเภท" className="grid grid-cols-2 border-b border-ink">
          {[
            { on: false, label: "รายการประจำ" },
            { on: true, label: "หนี้ / ผ่อน" },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              role="radio"
              aria-checked={debt === t.on}
              onClick={() => setDebt(t.on)}
              className={`h-12 font-mono text-xs font-bold ${t.on ? "border-s border-ink" : ""} ${debt === t.on ? "bg-brand text-on-brand" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Field label="ชื่อ" name="name" required defaultValue={plan?.name} placeholder={debt ? "เช่น ผ่อนรถ" : "เช่น Netflix"} className="border-b border-hair" />
        <div className="grid grid-cols-2 border-b border-hair">
          <Field label="ยอดต่อเดือน (บาท)" name="amount" required inputMode="decimal" defaultValue={plan?.amount} className="border-e border-hair font-mono" />
          <Field label="ครบทุกวันที่" name="day_of_month" required inputMode="numeric" defaultValue={plan?.day_of_month} placeholder="1–31" className="font-mono" />
        </div>
        {debt && (
          <div className="grid grid-cols-2 border-b border-hair">
            <Field label="ยอดหนี้รวม (บาท)" name="total_amount" required inputMode="decimal" defaultValue={plan?.total_amount ?? undefined} className="border-e border-hair font-mono" />
            <Field label="จ่ายไปก่อนใช้แอป" name="paid_before" inputMode="decimal" defaultValue={plan?.paid_before || undefined} placeholder="0" className="font-mono" />
          </div>
        )}
        <CategoryField categories={categories} defaultValue={plan?.category} />

        <div className="flex flex-col gap-3 px-4 pb-5 pt-2">
          <FormError message={error} />
          <SubmitButton pending={pending}>{plan ? "บันทึก" : "เพิ่มแผน"}</SubmitButton>
        </div>
      </form>
      {plan && (
        <div className="border-t border-hair px-4 pb-5 pt-3">
          <DeletePlan plan={plan} paidCount={paidCount} onDone={onClose} />
        </div>
      )}
    </Sheet>
  );
}

/**
 * entries.plan_id is `on delete set null`: deleting a plan keeps the money
 * that left the account but detaches it, so a debt's progress and a
 * subscription's past charges stop counting. A plan with paid history asks
 * first and offers deactivating instead; one without deletes at once.
 */
export function DeletePlan({ plan, paidCount, onDone }: { plan: Plan; paidCount: number; onDone?: () => void }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const { error } = await action();
      if (error) setError(error);
      else onDone?.();
    });
  }

  const remove = () => run(() => deletePlan(plan.id));

  if (!asking) {
    return (
      <>
        <button
          type="button"
          disabled={pending}
          onClick={() => (paidCount > 0 ? setAsking(true) : remove())}
          className="h-10 px-3.5 font-mono text-xs text-danger disabled:opacity-60"
        >
          ลบ
        </button>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </>
    );
  }

  return (
    <div role="alertdialog" aria-label={`ลบ ${plan.name}?`} className="flex w-full flex-col gap-2 border border-danger bg-danger-soft p-3">
      <p className="text-sm font-semibold text-danger">ลบ “{plan.name}”?</p>
      <p className="text-xs">
        มีรายการจ่ายแล้ว {paidCount} รายการผูกอยู่ ลบแล้วรายการยังอยู่ แต่จะไม่นับเข้า{plan.total_amount !== null ? "หนี้ก้อนนี้" : "แผนนี้"}อีก
        {plan.active && " — ถ้าจ่ายครบแล้ว ใช้ “ปิดใช้งาน” แทน"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={remove} className="h-10 border border-danger bg-danger px-3.5 font-mono text-xs font-bold text-surface disabled:opacity-60">
          ลบถาวร
        </button>
        {plan.active && (
          <button type="button" disabled={pending} onClick={() => run(() => setPlanActive(plan.id, false))} className="h-10 border border-ink bg-surface px-3.5 font-mono text-xs disabled:opacity-60">
            ปิดใช้งานแทน
          </button>
        )}
        <button type="button" onClick={() => setAsking(false)} className="h-10 px-3.5 font-mono text-xs">
          ยกเลิก
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
