import { expect, test } from "vitest";
import { num, pinFormat, positiveNum } from "@/lib/validate";

test("num allows an amount of exactly 0 (a zero monthly charge is odd but harmless)", () => {
  expect(num("0", "จำนวนเงิน")).toBe(0);
});

test("positiveNum rejects a total_amount of exactly 0 (a zero-baht debt is incoherent)", () => {
  expect(() => positiveNum("0", "ยอดรวมทั้งหมด")).toThrow("ยอดรวมทั้งหมดต้องมากกว่า 0");
});

test("positiveNum accepts a positive total_amount", () => {
  expect(positiveNum("50000", "ยอดรวมทั้งหมด")).toBe(50000);
});

test("pinFormat accepts 4 to 8 digits", () => {
  expect(pinFormat("1234")).toBe("1234");
  expect(pinFormat("12345678")).toBe("12345678");
});

test("pinFormat rejects too short, too long, and non-digit PINs", () => {
  expect(() => pinFormat("123")).toThrow("PIN ต้องเป็นตัวเลข 4-8 หลัก");
  expect(() => pinFormat("123456789")).toThrow("PIN ต้องเป็นตัวเลข 4-8 หลัก");
  expect(() => pinFormat("12ab")).toThrow("PIN ต้องเป็นตัวเลข 4-8 หลัก");
});
