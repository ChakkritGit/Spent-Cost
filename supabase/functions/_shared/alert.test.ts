import { expect, test } from "vitest";
import { parseAlert } from "./alert";

test("a valid alert passes through", () => {
  expect(parseAlert({ title: "Portfolio ล่ม", body: "ตรวจไม่ผ่าน" })).toEqual({ title: "Portfolio ล่ม", body: "ตรวจไม่ผ่าน" });
});

test("text is trimmed and capped at 80 and 200", () => {
  const r = parseAlert({ title: `  ${"a".repeat(100)}  `, body: ` ${"b".repeat(300)}` });
  expect(r?.title).toBe("a".repeat(80));
  expect(r?.body).toBe("b".repeat(200));
});

test("missing fields are rejected", () => {
  expect(parseAlert({ title: "x" })).toBeNull();
  expect(parseAlert({ body: "x" })).toBeNull();
  expect(parseAlert({})).toBeNull();
});

test("wrong types are rejected", () => {
  expect(parseAlert({ title: 1, body: "x" })).toBeNull();
  expect(parseAlert({ title: "x", body: ["y"] })).toBeNull();
  expect(parseAlert(null)).toBeNull();
  expect(parseAlert("alert")).toBeNull();
  expect(parseAlert(undefined)).toBeNull();
});

test("empty after trimming is rejected", () => {
  expect(parseAlert({ title: "   ", body: "x" })).toBeNull();
  expect(parseAlert({ title: "x", body: "" })).toBeNull();
});
