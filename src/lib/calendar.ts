import { daysInMonth } from "@/lib/month";
import type { Entry } from "@/lib/types";

export type EntryState = "paid" | "due" | "overdue";

/** Due today is still "due" — it turns overdue tomorrow. `today` is an ISO date. */
export function stateOf(e: Entry, today: string): EntryState {
  if (e.paid_at !== null) return "paid";
  return e.due_date < today ? "overdue" : "due";
}

/** Day numbers laid out in whole Sunday-first weeks, blanks as null. */
export function calendarCells(year: number, month: number): (number | null)[] {
  const lead = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const DAY = 86_400_000;

/** How an unpaid entry reads against today: "เกินกำหนด 4 วัน", "ครบวันนี้", "อีก 3 วัน". Null once paid. */
export function dueLabel(e: Entry, today: string): string | null {
  if (e.paid_at !== null) return null;
  const days = Math.round((Date.parse(e.due_date) - Date.parse(today)) / DAY);
  if (days < 0) return `เกินกำหนด ${-days} วัน`;
  if (days === 0) return "ครบวันนี้";
  if (days === 1) return "ครบพรุ่งนี้";
  return `อีก ${days} วัน`;
}
