import { EntryForm } from "@/components/entry-form";
import { EntryRow } from "@/components/entry-row";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { MonthSwitcher } from "@/components/month-switcher";
import { SummaryCards } from "@/components/summary-cards";
import { getAllDebtEntries, getEntriesForMonths, getPlans } from "@/lib/data";
import { daysInMonth, dueDateFor, monthKey } from "@/lib/month";
import { summarise } from "@/lib/money";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const { y, m } = await searchParams;
  const now = new Date();
  const year = y ? Number(y) : now.getFullYear();
  const month = m ? Number(m) : now.getMonth();
  const key = monthKey(year, month);
  const today = dueDateFor(now.getFullYear(), now.getMonth(), now.getDate());

  const [plans, windowEntries, debtEntries] = await Promise.all([
    getPlans(),
    getEntriesForMonths(year, month, 6),
    getAllDebtEntries(),
  ]);

  // summarise needs the month for spending and every paid debt entry for the
  // lifetime figures, so it is given both sets with the month's duplicates removed.
  const byId = new Map([...windowEntries, ...debtEntries].map((e) => [e.id, e]));
  const summary = summarise(plans, [...byId.values()], key);
  const monthEntries = windowEntries.filter((e) => e.due_date.startsWith(key));

  return (
    <div className="flex flex-col gap-6">
      <MonthSwitcher year={year} month={month} />
      <SummaryCards {...summary} />
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">รายการเดือนนี้</h2>
        {monthEntries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">ยังไม่มีรายการในเดือนนี้</p>
        ) : (
          <ul className="rounded-2xl border border-line bg-card px-4">
            {monthEntries.map((e) => <EntryRow key={e.id} entry={e} today={today} />)}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">เพิ่มรายการครั้งเดียว</h2>
        <EntryForm defaultDate={dueDateFor(year, month, Math.min(now.getDate(), daysInMonth(year, month)))} />
      </section>
      <GenerateMonthButton year={year} month={month} />
    </div>
  );
}
