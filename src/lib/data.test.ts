import { expect, test } from "vitest";
import { plannedRowsFor, toEntry, toPlan } from "@/lib/data";
import type { Plan } from "@/lib/types";

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: "p1",
  user_id: "u1",
  name: "Netflix",
  amount: 419,
  category: "สมาชิก",
  day_of_month: 15,
  total_amount: null,
  paid_before: 0,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

test("plannedRowsFor copies each active plan into the month", () => {
  const rows = plannedRowsFor([plan(), plan({ id: "p2", name: "หนี้รถ", amount: 12000, day_of_month: 5 })], 2026, 9);
  expect(rows).toEqual([
    { user_id: "u1", plan_id: "p1", name: "Netflix", amount: 419, category: "สมาชิก", due_date: "2026-10-15", paid_at: null },
    { user_id: "u1", plan_id: "p2", name: "หนี้รถ", amount: 12000, category: "สมาชิก", due_date: "2026-10-05", paid_at: null },
  ]);
});

test("plannedRowsFor skips inactive plans", () => {
  expect(plannedRowsFor([plan({ active: false })], 2026, 9)).toEqual([]);
});

test("plannedRowsFor clamps a plan billed past the end of a short month", () => {
  const rows = plannedRowsFor([plan({ day_of_month: 31 })], 2026, 1);
  expect(rows[0].due_date).toBe("2026-02-28");
});

// toPlan / toEntry guard against PostgREST serializing numeric(12,2) as a
// JSON string. These rows are shaped the way PostgREST might actually send
// them over the wire, not the way the app's own types claim.
const planRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "p1",
  user_id: "u1",
  name: "หนี้รถ",
  amount: "12000.00",
  category: "หนี้",
  day_of_month: 5,
  total_amount: "50000.00",
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

test("toPlan coerces string amounts into numbers", () => {
  const result = toPlan(planRow());
  expect(result.amount).toBe(12000);
  expect(result.total_amount).toBe(50000);
  expect(typeof result.amount).toBe("number");
  expect(typeof result.total_amount).toBe("number");
});

test("toPlan keeps a null total_amount null rather than coercing it to 0", () => {
  const result = toPlan(planRow({ amount: "0.00", total_amount: null }));
  expect(result.amount).toBe(0);
  expect(result.total_amount).toBeNull();
});

test("toPlan passes numeric amounts through unchanged", () => {
  const result = toPlan(planRow({ amount: 419, total_amount: 1000 }));
  expect(result.amount).toBe(419);
  expect(result.total_amount).toBe(1000);
});

const entryRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "e1",
  user_id: "u1",
  plan_id: null,
  name: "Netflix",
  amount: "419.00",
  category: "สมาชิก",
  due_date: "2026-09-15",
  paid_at: null,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
});

test("toEntry coerces string amounts into numbers, including zero", () => {
  expect(toEntry(entryRow()).amount).toBe(419);
  expect(toEntry(entryRow({ amount: "0.00" })).amount).toBe(0);
});

test("toEntry passes a numeric amount through unchanged", () => {
  expect(toEntry(entryRow({ amount: 419 })).amount).toBe(419);
});

test("toPlan reads a missing paid_before as 0, before migration 0002 has run", () => {
  const { paid_before, ...row } = plan();
  void paid_before;
  expect(toPlan(row).paid_before).toBe(0);
  expect(toPlan({ ...row, paid_before: "1500.50" }).paid_before).toBe(1500.5);
});
