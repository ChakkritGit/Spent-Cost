import { expect, test } from "vitest";
import { calendarCells } from "@/components/calendar-grid";

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
