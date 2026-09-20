import { BarChart } from "@/components/bar-chart";
import { DonutChart } from "@/components/donut-chart";
import { EntryForm } from "@/components/entry-form";
import { EntryRow } from "@/components/entry-row";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { MonthSwitcher } from "@/components/month-switcher";
import { SummaryCards } from "@/components/summary-cards";
import { getAllDebtEntries, getEntriesForMonths, getPlans } from "@/lib/data";
import { addMonths, daysInMonth, dueDateFor, monthKey } from "@/lib/month";
import { byCategory, monthlyTotals, summarise } from "@/lib/money";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const { y, m } = await searchParams;
  const now = new Date();
  // A stale bookmark or a hand-edited query string can send anything here —
  // fall back to the current month rather than letting a NaN or an
  // out-of-range value reach the date-range query below.
  const yearNum = Number(y);
  const monthNum = Number(m);
  const validParams = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100
    && Number.isInteger(monthNum) && monthNum >= 0 && monthNum <= 11;
  const year = validParams ? yearNum : now.getFullYear();
  const month = validParams ? monthNum : now.getMonth();
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

  const chartKeys = Array.from({ length: 6 }, (_, i) => {
    const at = addMonths(year, month, i - 5);
    return monthKey(at.year, at.month);
  });
  const bars = monthlyTotals(windowEntries, chartKeys);
  const categories = byCategory(monthEntries);

  return (
    <div className="flex flex-col gap-6">
      <MonthSwitcher year={year} month={month} />
      <SummaryCards {...summary} />
      <section>
        <h2 className="mb-2 text-lg font-semibold">6 เดือนย้อนหลัง</h2>
        <div className="rounded-3xl bg-card p-5 shadow-card">
          <BarChart data={bars} />
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">แยกตามหมวด</h2>
        <div className="rounded-3xl bg-card p-5 shadow-card">
          <DonutChart data={categories} />
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">รายการเดือนนี้</h2>
        {monthEntries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">เพิ่มรายการครั้งเดียวด้านล่างเพื่อเริ่มบันทึกเดือนนี้</p>
        ) : (
          <ul className="rounded-3xl bg-card px-5 shadow-card">
            {monthEntries.map((e) => <EntryRow key={e.id} entry={e} today={today} />)}
          </ul>
        )}
      </section>
      <section id="add-entry">
        <h2 className="mb-2 text-lg font-semibold">เพิ่มรายการครั้งเดียว</h2>
        <EntryForm defaultDate={dueDateFor(year, month, Math.min(now.getDate(), daysInMonth(year, month)))} />
      </section>
      <GenerateMonthButton year={year} month={month} />
    </div>
  );
}
