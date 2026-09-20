import { CalendarGrid } from "@/components/calendar-grid";
import { MonthSwitcher } from "@/components/month-switcher";
import { getEntries } from "@/lib/data";
import { daysInMonth, dueDateFor, monthKey } from "@/lib/month";

const LEGEND = [
  { swatch: "rounded-full bg-paid-fg", label: "จ่ายแล้ว" },
  { swatch: "rounded-full border border-due-fg", label: "ค้างจ่าย" },
  { swatch: "rounded-none border border-overdue-fg", label: "เกินกำหนด" },
] as const;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const { y, m } = await searchParams;
  const now = new Date();
  // Same guard as the dashboard (page.tsx): a stale bookmark or a hand-edited
  // query string can send anything here, so fall back to the current month
  // rather than let a NaN or out-of-range value reach the date-range query.
  const yearNum = Number(y);
  const monthNum = Number(m);
  const validParams = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100
    && Number.isInteger(monthNum) && monthNum >= 0 && monthNum <= 11;
  const year = validParams ? yearNum : now.getFullYear();
  const month = validParams ? monthNum : now.getMonth();
  const key = monthKey(year, month);
  // Computed once, server-side, and passed down — a `new Date()` evaluated
  // again on the client risks a hydration mismatch (see entry-row.tsx).
  const today = dueDateFor(now.getFullYear(), now.getMonth(), now.getDate());

  const entries = await getEntries(`${key}-01`, `${key}-${String(daysInMonth(year, month)).padStart(2, "0")}`);

  return (
    <div className="flex flex-col gap-4">
      <MonthSwitcher year={year} month={month} />
      <CalendarGrid year={year} month={month} entries={entries} today={today} />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {LEGEND.map(({ swatch, label }) => (
          <li key={label} className="flex items-center gap-1.5">
            {/* size-1.5 matches the grid dots — same shape vocabulary, same scale. */}
            <span aria-hidden className={`size-1.5 shrink-0 ${swatch}`} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
