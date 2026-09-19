import { expect, test } from "vitest";
import { isPublicPath } from "@/lib/auth-paths";

test("login page is public", () => {
  expect(isPublicPath("/login")).toBe(true);
});

test("the auth callback is public", () => {
  expect(isPublicPath("/auth/callback")).toBe(true);
});

test("a path merely prefixed with /login is not public", () => {
  expect(isPublicPath("/login-audit")).toBe(false);
});

test("a path merely prefixed with /auth is not public", () => {
  expect(isPublicPath("/authorized-export")).toBe(false);
  expect(isPublicPath("/authors")).toBe(false);
});

test("the home page is not public", () => {
  expect(isPublicPath("/")).toBe(false);
});

test("app routes are not public", () => {
  expect(isPublicPath("/plans")).toBe(false);
});
