import { expect, test } from "vitest";
import { addDays, bangkokToday, reminderFor } from "./reminders";

const e = (name: string, amount: number, due_date: string) => ({ name, amount, due_date });

test("bangkokToday turns over at midnight Bangkok, not UTC", () => {
  expect(bangkokToday(new Date("2026-09-23T17:30:00Z"))).toBe("2026-09-24");
  expect(bangkokToday(new Date("2026-09-23T16:30:00Z"))).toBe("2026-09-23");
});

test("addDays crosses month ends", () => {
  expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
});

test("nothing due, nothing sent", () => {
  expect(reminderFor([], "2026-09-24")).toBeNull();
  expect(reminderFor([e("Netflix", 419, "2026-09-30")], "2026-09-24")).toBeNull();
});

test("the title names the most urgent group; the body lists every group", () => {
  const r = reminderFor(
    [e("ผ่อน iPhone", 1833, "2026-09-25"), e("AIS Fibre", 599, "2026-09-20"), e("ค่าไฟ", 1204.5, "2026-09-24")],
    "2026-09-24",
  );
  expect(r).toEqual({
    title: "เกินกำหนด 1 รายการ",
    body: "เกินกำหนด: AIS Fibre ฿599\nครบวันนี้: ค่าไฟ ฿1,204.5\nพรุ่งนี้: ผ่อน iPhone ฿1,833",
  });
});

test("only tomorrow", () => {
  expect(reminderFor([e("ผ่อนรถ", 12000, "2026-10-01")], "2026-09-30")?.title).toBe("พรุ่งนี้ครบกำหนด 1 รายการ");
});

test("a long list is cut at three names", () => {
  const many = ["a", "b", "c", "d", "f"].map((n, i) => e(n, 10, `2026-09-0${i + 1}`));
  expect(reminderFor(many, "2026-09-24")?.body).toBe("เกินกำหนด: a ฿10, b ฿10, c ฿10 และอีก 2 รายการ");
});
