import type { Entry, Plan } from "@/lib/types";

/**
 * Sum in satang, return in baht. Adding baht as floats drifts by fractions of
 * a satang, which shows up as a wrong figure once rounded for display.
 */
function sum(amounts: number[]): number {
  return amounts.reduce((total, n) => total + Math.round(n * 100), 0) / 100;
}

const isPaid = (e: Entry) => e.paid_at !== null;

/**
 * How far a debt has been repaid. `ratio` is reported as it is — above 1 when
 * overpaid — and callers clamp it for the width of a bar, not for the number
 * they print.
 */
export function debtProgress(plan: Plan, entries: Entry[]): { paid: number; total: number; ratio: number } {
  const paid = sum(entries.filter((e) => e.plan_id === plan.id && isPaid(e)).map((e) => e.amount));
  const total = plan.total_amount ?? 0;
  return { paid, total, ratio: total > 0 ? Math.round((paid / total) * 1e6) / 1e6 : 0 };
}

/** The dashboard's five figures. `key` is a `monthKey`, e.g. "2026-09". */
export function summarise(plans: Plan[], entries: Entry[], key: string) {
  const thisMonth = entries.filter((e) => e.due_date.startsWith(key));
  const debts = plans.filter((p) => p.active && p.total_amount !== null);
  const debtIds = new Set(debts.map((p) => p.id));

  const debtTotal = sum(debts.map((p) => p.total_amount as number));
  const debtPaid = sum(entries.filter((e) => e.plan_id !== null && debtIds.has(e.plan_id) && isPaid(e)).map((e) => e.amount));

  return {
    spent: sum(thisMonth.filter(isPaid).map((e) => e.amount)),
    outstanding: sum(thisMonth.filter((e) => !isPaid(e)).map((e) => e.amount)),
    debtTotal,
    debtPaid,
    debtRemaining: Math.round((debtTotal - debtPaid) * 100) / 100,
  };
}

/** Spending per category, largest first. Counts unpaid entries too — the donut answers "where does the month go", not "what cleared". */
export function byCategory(entries: Entry[]): { category: string; amount: number }[] {
  const totals = new Map<string, number[]>();
  for (const e of entries) totals.set(e.category, [...(totals.get(e.category) ?? []), e.amount]);
  return [...totals]
    .map(([category, amounts]) => ({ category, amount: sum(amounts) }))
    .sort((a, b) => b.amount - a.amount);
}

/** One total per requested month, in the order given, zero-filled so the bar chart keeps its axis. */
export function monthlyTotals(entries: Entry[], keys: string[]): { key: string; amount: number }[] {
  return keys.map((key) => ({
    key,
    amount: sum(entries.filter((e) => e.due_date.startsWith(key)).map((e) => e.amount)),
  }));
}

const thb = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });

export function baht(n: number): string {
  return thb.format(n);
}
