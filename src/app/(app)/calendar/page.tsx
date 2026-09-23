import Link from "next/link";
import { EntryList } from "@/components/entry-list";
import { MonthSwitcher, PageHeader, monthTitle } from "@/components/page-header";
import { calendarCells, stateOf, type EntryState } from "@/lib/calendar";
import { getCategories, getEntries } from "@/lib/data";
import { daysInMonth, dueDateFor, monthFrom, monthKey, todayIso } from "@/lib/month";
import type { Entry } from "@/lib/types";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const dayLong = new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long" });

// Shape carries the state as well as colour: filled, outlined, red.
const MARK: Record<EntryState, string> = {
  paid: "bg-brand border-brand",
  due: "border-ink",
  overdue: "bg-danger border-danger",
};
const STATE_WORD: Record<EntryState, string> = { paid: "จ่ายแล้ว", due: "รอจ่าย", overdue: "เกินกำหนด" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string; d?: string }> }) {
  const { y, m, d } = await searchParams;
  const today = todayIso();
  const { year, month } = monthFrom(y, m, today);
  const key = monthKey(year, month);
  const last = daysInMonth(year, month);

  const [entries, categories] = await Promise.all([
    getEntries(`${key}-01`, dueDateFor(year, month, 31)),
    getCategories(),
  ]);

  const byDay = new Map<number, Entry[]>();
  for (const e of entries) {
    const day = Number(e.due_date.slice(8, 10));
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }

  const todayDay = today.startsWith(`${key}-`) ? Number(today.slice(8, 10)) : null;
  const asked = Number(d);
  const picked = Number.isInteger(asked) && asked >= 1 && asked <= last ? asked : todayDay;
  const pickedEntries = picked ? byDay.get(picked) ?? [] : [];

  return (
    <>
      <PageHeader title={monthTitle("ปฏิทิน", year, month)} aside={<MonthSwitcher year={year} month={month} path="/calendar" />} />

      <div aria-hidden className="grid grid-cols-7 border-b border-ink bg-surface">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-2 text-center font-mono text-[11px] text-muted">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 bg-surface">
        {calendarCells(year, month).map((day, i) => {
          if (day === null) return <span key={`blank-${i}`} className="h-16 border-b border-e border-hair bg-paper" />;
          const list = byDay.get(day) ?? [];
          const states = [...new Set(list.map((e) => stateOf(e, today)))];
          const isToday = day === todayDay;
          const isPicked = day === picked;
          return (
            <Link
              key={day}
              href={`/calendar?y=${year}&m=${month}&d=${day}`}
              scroll={false}
              aria-current={isPicked ? "date" : undefined}
              aria-label={`${dayLong.format(new Date(year, month, day))}${isToday ? " วันนี้" : ""}${list.length ? ` · ${list.length} รายการ ${states.map((s) => STATE_WORD[s]).join(" ")}` : ""}`}
              className={`flex h-16 flex-col justify-between border-b border-e border-hair p-1.5 font-mono text-xs ${
                isToday ? "bg-ink text-paper" : ""
              } ${isPicked ? "font-bold outline-2 -outline-offset-2 outline-brand" : ""}`}
            >
              <span>{day}</span>
              <span className="flex gap-[3px]">
                {states.map((s) => (
                  <span key={s} className={`size-2 border-[1.5px] ${MARK[s]}`} />
                ))}
              </span>
            </Link>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-4 border-y border-ink px-4 py-3 text-xs text-muted">
        {(Object.keys(MARK) as EntryState[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2 border-[1.5px] ${MARK[s]}`} />
            {STATE_WORD[s]}
          </li>
        ))}
      </ul>

      {picked && (
        <section className="px-4 pt-4">
          <div className="flex items-baseline justify-between border-b border-ink pb-2.5">
            <h2 className="headline text-xl font-bold">{dayLong.format(new Date(year, month, picked))}</h2>
            <span className="label">{pickedEntries.length} รายการ</span>
          </div>
          {pickedEntries.length === 0 ? (
            <p className="py-5 text-sm text-muted">ไม่มีรายการวันนี้</p>
          ) : (
            <EntryList entries={pickedEntries} categories={categories} today={today} showDay={false} />
          )}
        </section>
      )}
      {!picked && <p className="px-4 py-5 text-sm text-muted">แตะวันที่เพื่อดูรายการของวันนั้น</p>}
    </>
  );
}
