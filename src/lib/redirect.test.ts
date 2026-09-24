import { expect, test } from "vitest";
import { sameSitePath } from "@/lib/redirect";

const base = "https://app.example/auth/callback?code=x";

test("sameSitePath keeps a path on this site", () => {
  expect(sameSitePath("/settings", base)).toBe("/settings");
  expect(sameSitePath("/settings?link=1", base)).toBe("/settings?link=1");
  expect(sameSitePath(null, base)).toBe("/");
});

test("sameSitePath refuses anything that leaves the site", () => {
  for (const next of ["//evil.com", "/\\evil.com", "/\t/evil.com", "https://evil.com", "\\\\evil.com", "javascript:alert(1)"]) {
    expect(sameSitePath(next, base)).toBe("/");
  }
});
