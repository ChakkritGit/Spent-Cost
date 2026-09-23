"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setPlanActive } from "@/app/actions";
import { DeletePlan, PlanSheet } from "@/components/plan-sheet";
import { amount, baht } from "@/lib/money";
import type { Plan } from "@/lib/types";

export function AddPlanButton({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="h-11 border border-ink bg-brand px-3.5 font-mono text-xs font-bold text-on-brand">
        + เพิ่มแผน
      </button>
      <PlanSheet open={open} onClose={() => setOpen(false)} categories={categories} />
    </>
  );
}

export type DebtView = { plan: Plan; paid: number; total: number; ratio: number; paidCount: number };

/** A debt: what is left as the figure, the ruled bar, and its three actions. */
export function DebtCard({ debt, categories }: { debt: DebtView; categories: string[] }) {
  const { plan, paid, total, ratio, paidCount } = debt;
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Reported as it is, past 100% when overpaid; only the bar is clamped.
  const percent = `${(ratio * 100).toFixed(1)}%`;

  return (
    <article className={`flex flex-col gap-2.5 border-b border-ink bg-surface p-4 ${plan.active ? "" : "opacity-60"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={`truncate text-[17px] font-semibold ${plan.active ? "" : "line-through"}`}>{plan.name}</h3>
        <span className="shrink-0 font-mono text-xs text-muted">{baht(plan.amount)}/ด. · วันที่ {plan.day_of_month}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="headline text-[34px] leading-none text-brand">เหลือ {baht(Math.max(0, total - paid))}</span>
        <span className="font-mono text-[13px] font-bold">{percent}</span>
      </div>
      <div className="flex h-3 border border-ink" role="img" aria-label={`จ่ายแล้ว ${percent}`}>
        <div className="bg-brand" style={{ width: `${Math.min(1, ratio) * 100}%` }} />
        <div className="ticks flex-1" />
      </div>
      <p className="font-mono text-xs text-muted">
        {amount(paid)} / {amount(total)} · จ่ายในแอป {paidCount} งวด
        {plan.paid_before > 0 && ` · ก่อนใช้แอป ${amount(plan.paid_before)}`}
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex border border-ink">
          <button type="button" onClick={() => setEditing(true)} className="h-10 border-e border-ink bg-surface px-3.5 font-mono text-xs">
            แก้ไข
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const { error } = await setPlanActive(plan.id, !plan.active);
                if (error) setError(error);
              })
            }
            className="h-10 bg-surface px-3.5 font-mono text-xs disabled:opacity-60"
          >
            {plan.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </button>
        </div>
        <DeletePlan plan={plan} paidCount={paidCount} />
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <PlanSheet key={String(editing)} open={editing} onClose={() => setEditing(false)} plan={plan} categories={categories} paidCount={paidCount} />
    </article>
  );
}

/** A subscription: one ruled row. The name opens it to edit or delete; the switch turns it off without losing its history. */
export function SubscriptionRow({ plan, categories, paidCount }: { plan: Plan; categories: string[]; paidCount: number }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [active, setActive] = useOptimistic(plan.active);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className={`border-b border-hair px-4 ${active ? "" : "opacity-60"}`}>
      <div className="flex min-h-15 items-center gap-3">
        <span className="w-6 shrink-0 font-mono text-sm text-muted">{String(plan.day_of_month).padStart(2, "0")}</span>
        <button type="button" onClick={() => setEditing(true)} className="flex min-w-0 flex-1 flex-col items-start py-2 text-start">
          <span className={`w-full truncate text-[15px] font-medium ${active ? "" : "line-through"}`}>{plan.name}</span>
          <span className="w-full truncate text-xs text-muted">{plan.category}{active ? "" : " · ปิดใช้งาน"}</span>
        </button>
        <span className="shrink-0 font-mono text-sm">{amount(plan.amount)}</span>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={`ใช้งาน ${plan.name}`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              setActive(!active);
              const { error } = await setPlanActive(plan.id, !active);
              if (error) setError(error);
            })
          }
          className="-me-1.5 grid size-11 shrink-0 place-items-center"
        >
          <span className={`flex h-[18px] w-[34px] border border-ink p-0.5 ${active ? "justify-end bg-brand" : "justify-start bg-surface"}`}>
            <span className={`size-3 ${active ? "bg-on-brand" : "bg-ink"}`} />
          </span>
        </button>
      </div>
      {error && <p role="alert" className="pb-2 text-xs text-danger">{error}</p>}
      <PlanSheet key={String(editing)} open={editing} onClose={() => setEditing(false)} plan={plan} categories={categories} paidCount={paidCount} />
    </li>
  );
}
