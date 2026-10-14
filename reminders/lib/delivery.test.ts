import { expect, test, vi } from "vitest";
import { deliver } from "./delivery";

test("retries one explicit temporary push rejection and can recover", async () => {
  const send = vi.fn().mockRejectedValueOnce({ statusCode: 503 }).mockResolvedValueOnce(undefined);
  const pause = vi.fn().mockResolvedValue(undefined);
  expect(await deliver(send, pause)).toBe("sent");
  expect(send).toHaveBeenCalledTimes(2);
  expect(pause).toHaveBeenCalledTimes(1);
});

test("expired devices are gone, while auth/rate-limit/network failures are retained", async () => {
  for (const [error, expected] of [
    [{ statusCode: 404 }, "gone"], [{ statusCode: 410 }, "gone"],
    [{ statusCode: 401 }, "failed"], [{ statusCode: 429 }, "failed"], [new Error("timeout"), "failed"],
  ] as const) {
    const send = vi.fn().mockRejectedValue(error);
    expect(await deliver(send)).toBe(expected);
    expect(send).toHaveBeenCalledTimes(1);
  }
});

test("temporary failures stop after one retry and count as failed", async () => {
  const send = vi.fn().mockRejectedValue({ statusCode: 502 });
  expect(await deliver(send, async () => {})).toBe("failed");
  expect(send).toHaveBeenCalledTimes(2);
});
