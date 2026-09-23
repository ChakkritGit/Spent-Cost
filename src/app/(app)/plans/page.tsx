import { PageHeader } from "@/components/page-header";
import { AddPlanButton, DebtCard, SubscriptionRow } from "@/components/plan-list";
import { getAllDebtEntries, getCategories, getPlans } from "@/lib/data";
import { baht, debtProgress } from "@/lib/money";

export default async function PlansPage() {
  const [plans, entries, categories] = await Promise.all([getPlans(), getAllDebtEntries(), getCategories()]);
  const paidCount = (id: string) => entries.filter((e) => e.plan_id === id && e.paid_at !== null).length;
  // Active first; a closed plan stays listed so it can be reopened.
  const ordered = [...plans].sort((a, b) => Number(b.active) - Number(a.active));

  const debts = ordered
    .filter((p) => p.total_amount !== null)
    .map((plan) => ({ plan, ...debtProgress(plan, entries), paidCount: paidCount(plan.id) }));
  const subs = ordered.filter((p) => p.total_amount === null);

  const left = debts.filter((d) => d.plan.active).reduce((t, d) => t + Math.max(0, d.total - d.paid), 0);
  const monthly = subs.filter((p) => p.active).reduce((t, p) => t + p.amount, 0);

  return (
    <>
      <PageHeader title="แผนและหนี้" action={<AddPlanButton categories={categories} />} />

      <Heading title={`หนี้ · ${debts.length}`} note={debts.length ? `เหลือรวม ${baht(Math.round(left * 100) / 100)}` : undefined} />
      {debts.length === 0 && <Empty>ยังไม่มีหนี้ — เพิ่มแผนแล้วเลือก “หนี้ / ผ่อน” เพื่อติดตามยอดคงเหลือ</Empty>}
      {debts.map((d) => (
        <DebtCard key={d.plan.id} debt={d} categories={categories} />
      ))}

      <Heading title={`รายการประจำ · ${subs.length}`} note={subs.length ? `${baht(Math.round(monthly * 100) / 100)} / เดือน` : undefined} />
      {subs.length === 0 && <Empty>ยังไม่มีรายการประจำ — เช่น ค่าเช่า Netflix ค่าเน็ต</Empty>}
      <ul>
        {subs.map((p) => (
          <SubscriptionRow key={p.id} plan={p} categories={categories} paidCount={paidCount(p.id)} />
        ))}
      </ul>
    </>
  );
}

function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-ink px-4 pb-2.5 pt-6">
      <h2 className="headline text-[22px] font-bold">{title}</h2>
      {note && <span className="label">{note}</span>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border-b border-hair px-4 py-5 text-sm text-muted">{children}</p>;
}
