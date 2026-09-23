/** Number of days in a month. `month` is 0-indexed, as `Date` uses it. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The ISO date a plan falls due in a given month. A plan billed on the 31st
 * lands on the last day of a shorter month rather than spilling into the next.
 */
export function dueDateFor(year: number, month: number, dayOfMonth: number): string {
  const day = Math.min(dayOfMonth, daysInMonth(year, month));
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** "2026-09" — the prefix every ISO date in that month shares. */
export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month + 1)}`;
}

export function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const d = new Date(year, month + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * Today's ISO date in Bangkok. The server runs in UTC, where 00:00–07:00 in
 * Bangkok is still yesterday — an entry due today would read as not yet due,
 * and the dashboard would open on last month on the 1st.
 */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(now);
}

/** The month a `?y=&m=` query names, or today's month when it names nothing valid (a stale bookmark, a hand-edited URL). */
export function monthFrom(y: string | undefined, m: string | undefined, today: string): { year: number; month: number } {
  const year = Number(y);
  const month = Number(m);
  if (Number.isInteger(year) && year >= 2000 && year <= 2100 && Number.isInteger(month) && month >= 0 && month <= 11) {
    return { year, month };
  }
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 };
}
