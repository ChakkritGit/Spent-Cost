import { describe, expect, it } from "vitest";
import { hashPin, pinLengthOf, pinMatches, pinRecord } from "./pin";

const U = "user-1";

describe("pinRecord / pinMatches", () => {
  it.each(["1234", "123456"])("round-trips a %s PIN", async (pin) => {
    const rec = await pinRecord(U, pin);
    expect(rec.startsWith(`${pin.length}:`)).toBe(true);
    expect(await pinMatches(U, pin, rec)).toBe(true);
  });

  it("rejects a wrong PIN", async () => {
    expect(await pinMatches(U, "1235", await pinRecord(U, "1234"))).toBe(false);
  });

  it("still matches a legacy bare hash", async () => {
    expect(await pinMatches(U, "1234", await hashPin(U, "1234"))).toBe(true);
    expect(await pinMatches(U, "1235", await hashPin(U, "1234"))).toBe(false);
  });
});

describe("pinLengthOf", () => {
  it("reads the length prefix", async () => {
    expect(pinLengthOf(await pinRecord(U, "1234"))).toBe(4);
    expect(pinLengthOf(await pinRecord(U, "123456"))).toBe(6);
  });

  it("is null for no PIN, a legacy hash and a malformed prefix", async () => {
    const hash = await hashPin(U, "1234");
    expect(pinLengthOf(null)).toBeNull();
    expect(pinLengthOf(hash)).toBeNull();
    expect(pinLengthOf(`9:${hash}`)).toBeNull();
    expect(pinLengthOf(`x:${hash}`)).toBeNull();
  });
});
