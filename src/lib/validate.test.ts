import { expect, test } from "vitest";
import { num, positiveNum } from "@/lib/validate";

test("num allows an amount of exactly 0 (a zero monthly charge is odd but harmless)", () => {
  expect(num("0", "จำนวนเงิน")).toBe(0);
});

test("positiveNum rejects a total_amount of exactly 0 (a zero-baht debt is incoherent)", () => {
  expect(() => positiveNum("0", "ยอดรวมทั้งหมด")).toThrow("ยอดรวมทั้งหมดต้องมากกว่า 0");
});

test("positiveNum accepts a positive total_amount", () => {
  expect(positiveNum("50000", "ยอดรวมทั้งหมด")).toBe(50000);
});
