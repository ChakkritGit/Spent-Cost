import { expect, test } from "vitest";
import { byCategory, debtProgress, monthlyTotals, niceMax, summarise, totalForRemaining, withOther } from "@/lib/money";
import type { Entry, Plan } from "@/lib/types";

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: "p1",
  user_id: "u1",
  name: "หนี้รถ",
  amount: 12000,
  category: "หนี้",
  day_of_month: 5,
  total_amount: 500000,
  paid_before: 0,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: crypto.randomUUID(),
  user_id: "u1",
  plan_id: "p1",
  name: "หนี้รถ",
  amount: 12000,
  category: "หนี้",
  due_date: "2026-09-05",
  paid_at: "2026-09-05T00:00:00Z",
  created_at: "2026-09-01T00:00:00Z",
  ...over,
});

test("debtProgress counts only paid entries of that plan", () => {
  const entries = [
    entry({ id: "a" }),
    entry({ id: "b" }),
    entry({ id: "c", paid_at: null }),
    entry({ id: "d", plan_id: "other" }),
    entry({ id: "e", plan_id: null }),
  ];
  expect(debtProgress(plan(), entries)).toEqual({ paid: 24000, total: 500000, ratio: 0.048 });
});

test("debtProgress reports overpayment above 1 rather than clamping", () => {
  const p = plan({ total_amount: 10000 });
  expect(debtProgress(p, [entry({ amount: 12000 })]).ratio).toBe(1.2);
});

test("debtProgress on a plan with no total is ratio 0", () => {
  const p = plan({ total_amount: null });
  expect(debtProgress(p, [entry()])).toEqual({ paid: 12000, total: 0, ratio: 0 });
});

test("debtProgress rounds away float drift", () => {
  const p = plan({ total_amount: 100 });
  const entries = [entry({ amount: 0.1 }), entry({ amount: 0.2 })];
  expect(debtProgress(p, entries).paid).toBe(0.3);
});

test("summarise separates this month from the debt lifetime", () => {
  const plans = [plan(), plan({ id: "p2", total_amount: 20000 }), plan({ id: "p3", total_amount: null })];
  const entries = [
    entry({ id: "a", amount: 12000 }),                                  // paid, this month
    entry({ id: "b", amount: 3000, paid_at: null }),                    // unpaid, this month
    entry({ id: "c", amount: 500, plan_id: null, category: "อาหาร" }),   // paid one-off, this month
    entry({ id: "d", amount: 12000, due_date: "2026-08-05" }),          // paid, last month
  ];
  expect(summarise(plans, entries, "2026-09")).toEqual({
    spent: 12500,
    outstanding: 3000,
    debtTotal: 520000,
    debtPaid: 24000,
    debtRemaining: 496000,
  });
});

test("summarise ignores inactive plans in the debt total", () => {
  const plans = [plan(), plan({ id: "p2", total_amount: 20000, active: false })];
  expect(summarise(plans, [], "2026-09").debtTotal).toBe(500000);
});

test("byCategory sums paid and unpaid, largest first", () => {
  const entries = [
    entry({ id: "a", amount: 300, category: "อาหาร" }),
    entry({ id: "b", amount: 12000, category: "หนี้" }),
    entry({ id: "c", amount: 200, category: "อาหาร", paid_at: null }),
  ];
  expect(byCategory(entries)).toEqual([
    { category: "หนี้", amount: 12000 },
    { category: "อาหาร", amount: 500 },
  ]);
});

test("monthlyTotals keeps requested months that have no entries", () => {
  const entries = [entry({ id: "a", amount: 100, due_date: "2026-09-05" })];
  expect(monthlyTotals(entries, ["2026-08", "2026-09"])).toEqual([
    { key: "2026-08", amount: 0 },
    { key: "2026-09", amount: 100 },
  ]);
});

test("debtProgress starts from paid_before", () => {
  const p = plan({ total_amount: 100000, paid_before: 40000 });
  expect(debtProgress(p, [entry({ amount: 10000 })])).toEqual({ paid: 50000, total: 100000, ratio: 0.5 });
});

test("summarise counts paid_before of active debts only", () => {
  const plans = [plan({ paid_before: 1000 }), plan({ id: "p2", paid_before: 500, active: false })];
  expect(summarise(plans, [], "2026-09").debtPaid).toBe(1000);
});

test("withOther passes through up to the cap unchanged", () => {
  const data = [
    { category: "a", amount: 40 },
    { category: "b", amount: 30 },
    { category: "c", amount: 30 },
  ];
  expect(withOther(data, 6)).toEqual(data);
});

// byCategory sorts largest-first, so slicing at the cap without folding the
// remainder would quietly understate the total against summarise()'s real
// figure — this is the arithmetic that would be wrong without looking wrong.
test("withOther folds everything past the cap into อื่นๆ and preserves the total", () => {
  const data = [
    { category: "a", amount: 50 },
    { category: "b", amount: 20 },
    { category: "c", amount: 10 },
    { category: "d", amount: 8 },
    { category: "e", amount: 7 },
    { category: "f", amount: 4 },
    { category: "g", amount: 1 },
  ];
  const result = withOther(data, 6);
  expect(result).toHaveLength(6);
  expect(result.slice(0, 5)).toEqual(data.slice(0, 5));
  expect(result[5]).toEqual({ category: "อื่น ๆ", amount: 5 });
  const before = data.reduce((sum, d) => sum + d.amount, 0);
  const after = result.reduce((sum, d) => sum + d.amount, 0);
  expect(after).toBe(before);
});

test("niceMax rounds up to a readable axis top", () => {
  expect(niceMax(34650)).toBe(50000);
  expect(niceMax(18000)).toBe(20000);
  expect(niceMax(20000)).toBe(20000);
  expect(niceMax(2100)).toBe(2500);
  expect(niceMax(0)).toBe(1000);
});

test("totalForRemaining keeps what was paid and makes the remainder the statement's", () => {
  const p = plan({ total_amount: 500000, paid_before: 10000 });
  const paid = debtProgress(p, [entry({ amount: 12000 })]).paid; // 22,000
  const total = totalForRemaining(paid, 490123.45); // interest added: owes more than 478,000
  expect(total).toBe(512123.45);
  const after = debtProgress({ ...p, total_amount: total }, [entry({ amount: 12000 })]);
  expect(Math.round((after.total - after.paid) * 100) / 100).toBe(490123.45);
});
