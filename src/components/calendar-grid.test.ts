import { expect, test } from "vitest";
import { calendarCells, stateOf } from "@/components/calendar-grid";
import type { Entry } from "@/lib/types";

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: "e1",
  user_id: "u1",
  plan_id: null,
  name: "Netflix",
  amount: 419,
  category: "สมาชิก",
  due_date: "2026-09-15",
  paid_at: null,
  created_at: "2026-09-01T00:00:00Z",
  ...over,
});

test("cells pad the start of the month with nulls to the right weekday", () => {
  // 1 Sep 2026 is a Tuesday; the week starts Sunday, so two leading blanks.
  const cells = calendarCells(2026, 8);
  expect(cells.slice(0, 3)).toEqual([null, null, 1]);
  expect(cells.filter((c) => c !== null)).toHaveLength(30);
});

test("a month starting on Sunday needs no padding", () => {
  // 1 Feb 2026 is a Sunday.
  expect(calendarCells(2026, 1)[0]).toBe(1);
});

test("cells fill whole weeks", () => {
  expect(calendarCells(2026, 8).length % 7).toBe(0);
  expect(calendarCells(2026, 1).length % 7).toBe(0);
});

test("stateOf: a paid entry is paid regardless of its date", () => {
  expect(stateOf(entry({ due_date: "2026-01-01", paid_at: "2026-01-01T00:00:00Z" }), "2026-09-20")).toBe("paid");
});

test("stateOf: an unpaid entry before today is overdue", () => {
  expect(stateOf(entry({ due_date: "2026-09-19" }), "2026-09-20")).toBe("overdue");
});

test("stateOf: an unpaid entry after today is due", () => {
  expect(stateOf(entry({ due_date: "2026-09-21" }), "2026-09-20")).toBe("due");
});

test("stateOf: an unpaid entry due exactly today is due, not overdue", () => {
  expect(stateOf(entry({ due_date: "2026-09-20" }), "2026-09-20")).toBe("due");
});
