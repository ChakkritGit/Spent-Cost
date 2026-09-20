import { baht } from "@/lib/money";
import { daysInMonth } from "@/lib/month";
import type { Entry } from "@/lib/types";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const STATE_LABEL = { paid: "จ่ายแล้ว", due: "ค้างจ่าย", overdue: "เกินกำหนด" } as const;

/** Same paid/overdue/due rule as the dashboard (entry-row.tsx) — kept in one
 * place would be nicer, but it's a one-line ternary, not worth a shared
 * import for. */
function stateOf(e: Entry, today: string): keyof typeof STATE_LABEL {
  if (e.paid_at !== null) return "paid";
  return e.due_date < today ? "overdue" : "due";
}

/**
 * Colour never carries a state alone: paid is a filled circle, due an
 * outlined circle, overdue an outlined square — shape distinguishes all
 * three even in greyscale — and each dot also gets a real text alternative
 * (`role="img"` + `aria-label`) naming the entry, amount and state, since
 * a `title` tooltip doesn't fire on touch and isn't reliably exposed to
 * screen readers.
 *
 * `rounded-none` rather than `rounded-sm`: at this dot's 6px size,
 * Tailwind's `--radius-sm` (4px) rounds every corner past the point a
 * square is still recognisable as one — checked in a zoomed screenshot,
 * where it read as just another circle. A square needs a true 0 radius to
 * read as a square at 6px.
 */
const DOT_CLASS = {
  paid: "rounded-full bg-paid-fg",
  due: "rounded-full border border-due-fg",
  overdue: "rounded-none border border-overdue-fg",
} as const;

/** Day numbers laid out in whole Sunday-first weeks, blanks as null. */
export function calendarCells(year: number, month: number): (number | null)[] {
  const lead = new Date(year, month, 1).getDay();
  const days = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarGrid({
  year,
  month,
  entries,
  today,
}: {
  year: number;
  month: number;
  entries: Entry[];
  today: string;
}) {
  const byDay = new Map<number, Entry[]>();
  for (const e of entries) {
    const day = Number(e.due_date.slice(8, 10));
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-xs text-muted" aria-hidden>
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {calendarCells(year, month).map((day, i) => {
          const dayEntries = day ? byDay.get(day) ?? [] : [];
          return (
            <div key={i} className="min-h-14 bg-card p-1">
              {day && <span className="text-xs tabular-nums text-muted">{day}</span>}
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {dayEntries.map((e) => {
                  const state = stateOf(e, today);
                  return (
                    <span
                      key={e.id}
                      role="img"
                      aria-label={`${e.name} ${baht(e.amount)} ${STATE_LABEL[state]}`}
                      className={`size-1.5 shrink-0 ${DOT_CLASS[state]}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
