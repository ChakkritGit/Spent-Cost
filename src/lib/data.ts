import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addMonths, dueDateFor, monthKey } from "@/lib/month";
import type { Entry, Plan } from "@/lib/types";

/** PostgREST sends numeric(12,2) as a JSON number, but coerce at the boundary so a driver change cannot turn amounts into strings downstream. Exported so the coercion itself is tested, not just inferred from callers. */
export const toPlan = (r: Record<string, unknown>): Plan => ({
  ...(r as Plan),
  amount: Number(r.amount),
  total_amount: r.total_amount === null ? null : Number(r.total_amount),
});

export const toEntry = (r: Record<string, unknown>): Entry => ({ ...(r as Entry), amount: Number(r.amount) });

export async function getPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map(toPlan);
}

export async function getEntries(fromDate: string, toDate: string): Promise<Entry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .gte("due_date", fromDate)
    .lte("due_date", toDate)
    .order("due_date");
  if (error) throw error;
  return (data ?? []).map(toEntry);
}

/** `count` months of entries ending with the given month — the bar chart's window. */
export async function getEntriesForMonths(year: number, month: number, count: number): Promise<Entry[]> {
  const start = addMonths(year, month, -(count - 1));
  const from = `${monthKey(start.year, start.month)}-01`;
  const to = dueDateFor(year, month, 31);
  return getEntries(from, to);
}

/** Every entry attached to a plan, paid or not — callers filter `paid_at` themselves (lifetime debt progress wants only the paid ones; an unpaid-debt view would want the rest). */
export async function getAllDebtEntries(): Promise<Entry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("entries").select("*").not("plan_id", "is", null);
  if (error) throw error;
  return (data ?? []).map(toEntry);
}

/** The rows a generation would insert, for exactly the month given. Pure, so it is tested directly. */
export function plannedRowsFor(plans: Plan[], year: number, month: number) {
  return plans
    .filter((p) => p.active)
    .map((p) => ({
      user_id: p.user_id,
      plan_id: p.id,
      name: p.name,
      amount: p.amount,
      category: p.category,
      due_date: dueDateFor(year, month, p.day_of_month),
      paid_at: null,
    }));
}
