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
