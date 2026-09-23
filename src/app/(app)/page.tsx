import { BarChart, CategoryBar } from "@/components/charts";
import { EntryList } from "@/components/entry-list";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { MonthSwitcher, PageHeader, monthTitle } from "@/components/page-header";
import { Summary } from "@/components/summary";
import { getAllDebtEntries, getCategories, getEntriesForMonths, getPlans } from "@/lib/data";
import { addMonths, monthFrom, monthKey, todayIso } from "@/lib/month";
import { byCategory, monthlyTotals, summarise } from "@/lib/money";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const { y, m } = await searchParams;
  const today = todayIso();
  const { year, month } = monthFrom(y, m, today);
  const key = monthKey(year, month);

  const [plans, windowEntries, debtEntries, categories] = await Promise.all([
    getPlans(),
    getEntriesForMonths(year, month, 6),
    getAllDebtEntries(),
    getCategories(),
  ]);

  // summarise wants the month for spending and every paid debt entry for the
  // lifetime figures: both sets, with the month's duplicates removed.
  const byId = new Map([...windowEntries, ...debtEntries].map((e) => [e.id, e]));
  const summary = summarise(plans, [...byId.values()], key);
  const monthEntries = windowEntries.filter((e) => e.due_date.startsWith(key));

  const chartKeys = Array.from({ length: 6 }, (_, i) => {
    const at = addMonths(year, month, i - 5);
    return monthKey(at.year, at.month);
  });

  return (
    <>
      <PageHeader
        title={monthTitle("ภาพรวม", year, month)}
        aside={<MonthSwitcher year={year} month={month} path="/" />}
      />
      <Summary
        {...summary}
        paidCount={monthEntries.filter((e) => e.paid_at !== null).length}
        entryCount={monthEntries.length}
      />

      <Section title="ใช้จ่าย 6 เดือน" note="รวมทุกรายการ บาท">
        <BarChart data={monthlyTotals(windowEntries, chartKeys)} />
      </Section>

      <Section title="ตามหมวดหมู่">
        <CategoryBar data={byCategory(monthEntries)} />
      </Section>

      <section className="px-4 pt-5">
        <div className="flex items-baseline justify-between border-b border-ink pb-2.5">
          <h2 className="headline text-xl font-bold">รายการเดือนนี้</h2>
          <span className="label">วัน · ชื่อ · บาท · จ่าย</span>
        </div>
        {monthEntries.length === 0 ? (
          <p className="py-6 text-sm text-muted">ยังไม่มีรายการ — กด + เพื่อเพิ่มรายการครั้งเดียว หรือสร้างจากแผนด้านล่าง</p>
        ) : (
          <EntryList entries={monthEntries} categories={categories} today={today} />
        )}
        <GenerateMonthButton year={year} month={month} />
      </section>
    </>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-ink px-4 py-5">
      <div className="flex items-baseline justify-between">
        <h2 className="headline text-xl font-bold">{title}</h2>
        {note && <span className="label">{note}</span>}
      </div>
      {children}
    </section>
  );
}
