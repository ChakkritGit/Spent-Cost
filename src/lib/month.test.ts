import { expect, test } from "vitest";
import { addMonths, daysInMonth, dueDateFor, monthKey } from "@/lib/month";

test("daysInMonth knows leap years", () => {
  expect(daysInMonth(2026, 1)).toBe(28); // Feb 2026
  expect(daysInMonth(2028, 1)).toBe(29); // Feb 2028
  expect(daysInMonth(2026, 8)).toBe(30); // Sep
  expect(daysInMonth(2026, 0)).toBe(31); // Jan
});

test("dueDateFor pads to ISO", () => {
  expect(dueDateFor(2026, 8, 5)).toBe("2026-09-05");
  expect(dueDateFor(2026, 11, 25)).toBe("2026-12-25");
});

test("dueDateFor clamps a day the month does not have", () => {
  expect(dueDateFor(2026, 1, 31)).toBe("2026-02-28");
  expect(dueDateFor(2028, 1, 31)).toBe("2028-02-29");
  expect(dueDateFor(2026, 8, 31)).toBe("2026-09-30");
});

test("monthKey matches the prefix of an ISO date", () => {
  expect(monthKey(2026, 8)).toBe("2026-09");
  expect(dueDateFor(2026, 8, 5).startsWith(monthKey(2026, 8))).toBe(true);
});

test("addMonths rolls the year in both directions", () => {
  expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  expect(addMonths(2026, 8, 0)).toEqual({ year: 2026, month: 8 });
});
