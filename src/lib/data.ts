import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { addMonths, dueDateFor, monthKey } from "@/lib/month";
import type { Entry, Plan } from "@/lib/types";

/** PostgREST sends numeric(12,2) as a JSON number, but coerce at the boundary so a driver change cannot turn amounts into strings downstream. Exported so the coercion itself is tested, not just inferred from callers. */
export const toPlan = (r: Record<string, unknown>): Plan => ({
  ...(r as Plan),
  amount: Number(r.amount),
  total_amount: r.total_amount === null ? null : Number(r.total_amount),
  // `?? 0` until migration 0002 has run: select("*") simply omits the column.
  paid_before: Number(r.paid_before ?? 0),
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

/**
 * Categories already in use, most recently used first — the chips in the
 * entry sheet, so "อาหาร" is picked rather than retyped as "ค่าอาหาร" and
 * split the category bar in two.
 *
 * ponytail: reads the latest 300 entries, not all of them; a category unused
 * across 300 entries can be typed again.
 */
// cache(): the layout and the page both ask within one request.
export const getCategories = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const [entries, plans] = await Promise.all([
    supabase.from("entries").select("category").order("created_at", { ascending: false }).limit(300),
    supabase.from("plans").select("category"),
  ]);
  if (entries.error) throw entries.error;
  if (plans.error) throw plans.error;
  return [...new Set([...entries.data, ...plans.data].map((r) => r.category as string))];
});
