import { savePlan } from "@/app/actions";
import { PlanDeleteButton } from "@/components/plan-delete-button";
import { PlanForm } from "@/components/plan-form";
import { ProgressBar } from "@/components/progress-bar";
import { getAllDebtEntries, getPlans } from "@/lib/data";
import { baht, debtProgress } from "@/lib/money";
import type { Plan } from "@/lib/types";

export default async function PlansPage() {
  const [plans, entries] = await Promise.all([getPlans(), getAllDebtEntries()]);
  const debts = plans.filter((p) => p.total_amount !== null);
  const subs = plans.filter((p) => p.total_amount === null);
  const paidCount = (planId: string) => entries.filter((e) => e.plan_id === planId && e.paid_at !== null).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold tracking-tight">รายการประจำ</h1>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">หนี้</h2>
        {debts.length === 0 && <p className="text-sm text-muted">เพิ่มหนี้ด้านล่างเพื่อเริ่มติดตามความคืบหน้า</p>}
        <ul className="flex flex-col gap-3">
          {debts.map((plan) => {
            const { paid, total, ratio } = debtProgress(plan, entries);
            // The bar (ProgressBar) clamps at full; this percentage does not —
            // it reads past 100% when the debt is overpaid, per debtProgress's
            // contract. "เหลือ" floors at ฿0 since owing a negative amount
            // isn't a sentence that means anything; the paid/total figures
            // right above it already show paid exceeding total.
            const percent = Math.round(ratio * 100);
            const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
            return (
              <li key={plan.id} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={`truncate font-medium ${plan.active ? "" : "text-muted line-through"}`}>{plan.name}</p>
                  <p className="shrink-0 text-sm tabular-nums text-muted">{percent}%</p>
                </div>
                <div className="my-2"><ProgressBar ratio={ratio} /></div>
                <p className="text-xs tabular-nums text-muted">
                  {baht(paid)} จาก {baht(total)} · เหลือ {baht(remaining)} · {baht(plan.amount)}/เดือน
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <ActiveToggle plan={plan} />
                  <PlanDeleteButton id={plan.id} name={plan.name} paidCount={paidCount(plan.id)} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">รายการประจำเดือน</h2>
        {subs.length === 0 && <p className="text-sm text-muted">เพิ่มรายการประจำด้านล่างเพื่อเริ่มบันทึก</p>}
        <ul className="flex flex-col gap-2">
          {subs.map((plan) => (
            <li key={plan.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-medium ${plan.active ? "" : "text-muted line-through"}`}>{plan.name}</p>
                  <p className="text-xs text-muted">ทุกวันที่ {plan.day_of_month} · {plan.category}</p>
                </div>
                <p className="shrink-0 text-sm tabular-nums">{baht(plan.amount)}</p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <ActiveToggle plan={plan} />
                <PlanDeleteButton id={plan.id} name={plan.name} paidCount={paidCount(plan.id)} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">เพิ่มรายการ</h2>
        <PlanForm />
      </section>
    </div>
  );
}

/**
 * Deactivating, not deleting, is the normal way to close a finished plan —
 * `active = false` is what plannedRowsFor already skips, and it keeps every
 * paid entry attributed. Offered for debts and subscriptions alike: the
 * delete guard beside it is symmetric across both, so the easy non-
 * destructive path should be too. This resubmits the plan's own fields
 * through savePlan with `active` flipped, so no new server action is needed.
 */
function ActiveToggle({ plan }: { plan: Plan }) {
  const label = plan.active ? "ปิดใช้งาน" : "เปิดใช้งาน";
  return (
    <form action={savePlan}>
      <input type="hidden" name="id" value={plan.id} />
      <input type="hidden" name="name" value={plan.name} />
      <input type="hidden" name="amount" value={plan.amount} />
      <input type="hidden" name="category" value={plan.category} />
      <input type="hidden" name="day_of_month" value={plan.day_of_month} />
      {plan.total_amount !== null && <input type="hidden" name="total_amount" value={plan.total_amount} />}
      {!plan.active && <input type="hidden" name="active" value="on" />}
      <button
        aria-label={`${label} ${plan.name}`}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-xs text-muted underline"
      >
        {label}
      </button>
    </form>
  );
}
