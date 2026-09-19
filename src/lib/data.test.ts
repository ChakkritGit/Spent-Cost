import { expect, test } from "vitest";
import { plannedRowsFor } from "@/lib/data";
import type { Plan } from "@/lib/types";

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: "p1",
  user_id: "u1",
  name: "Netflix",
  amount: 419,
  category: "สมาชิก",
  day_of_month: 15,
  total_amount: null,
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
