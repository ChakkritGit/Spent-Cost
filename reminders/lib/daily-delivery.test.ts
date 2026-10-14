import { expect, test, vi } from "vitest";
import { sendDaily, endpointHash, mapDevices, type Claim, type Outcome, type ReceiptStore } from "./daily-delivery";

function receipt(): ReceiptStore {
  let state: Claim | Outcome | undefined;
  return {
    async claim() {
      if (!state || state === "failed") { state = "busy"; return "claimed"; }
      return state as Claim;
    },
    async finish(_token, outcome) { state = outcome; return true; },
  };
}

test("a later run retries only the device whose push was explicitly rejected", async () => {
  const a = receipt();
  const b = receipt();
  const pushA = vi.fn().mockResolvedValue(undefined);
  const pushB = vi.fn().mockRejectedValueOnce({ statusCode: 503 }).mockResolvedValue(undefined);
  const first = await Promise.all([sendDaily(a, pushA), sendDaily(b, pushB)]);
  expect(first.map((result) => result.resolved)).toEqual([true, false]);
  const second = await Promise.all([sendDaily(a, pushA), sendDaily(b, pushB)]);
  expect(second.every((result) => result.resolved)).toBe(true);
  expect(pushA).toHaveBeenCalledTimes(1);
  expect(pushB).toHaveBeenCalledTimes(2);
});

test("an ambiguous push timeout is retained and never replayed automatically", async () => {
  const store = receipt();
  const push = vi.fn().mockRejectedValue(new Error("connection closed after request"));
  expect((await sendDaily(store, push)).outcome).toBe("uncertain");
  expect((await sendDaily(store, push)).resolved).toBe(false);
  expect(push).toHaveBeenCalledTimes(1);
});

test("overlapping runs cannot both send the same device", async () => {
  const store = receipt();
  let release!: () => void;
  const push = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
  const first = sendDaily(store, push);
  await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  expect((await sendDaily(store, push)).outcome).toBe("busy");
  release();
  expect((await first).resolved).toBe(true);
  expect(push).toHaveBeenCalledTimes(1);
});

test("a lost receipt response after commit cannot repeat an accepted push", async () => {
  const store = receipt();
  const finish = store.finish;
  store.finish = async (token, outcome) => { await finish(token, outcome); throw new Error("lost response"); };
  const push = vi.fn().mockResolvedValue(undefined);
  await expect(sendDaily(store, push)).rejects.toThrow("lost response");
  expect((await sendDaily(store, push)).resolved).toBe(true);
  expect(push).toHaveBeenCalledTimes(1);
});

test("a failed receipt commit remains busy; failed claims never start a push", async () => {
  const store = receipt();
  store.finish = async () => false;
  const push = vi.fn().mockResolvedValue(undefined);
  await expect(sendDaily(store, push)).rejects.toThrow("receipt was not confirmed");
  expect((await sendDaily(store, push)).outcome).toBe("busy");
  expect(push).toHaveBeenCalledTimes(1);
  store.claim = async () => { throw new Error("database unavailable"); };
  await expect(sendDaily(store, push)).rejects.toThrow("database unavailable");
  expect(push).toHaveBeenCalledTimes(1);
});

test("expired devices resolve, and blocked/exhausted claims never send", async () => {
  const store = receipt();
  const push = vi.fn().mockRejectedValue({ statusCode: 410 });
  expect((await sendDaily(store, push)).resolved).toBe(true);
  expect((await sendDaily(store, push)).outcome).toBe("gone");
  expect(push).toHaveBeenCalledTimes(1);
  for (const state of ["busy", "uncertain", "exhausted"] as const) {
    store.claim = async () => state;
    expect((await sendDaily(store, push)).resolved).toBe(false);
  }
  expect(push).toHaveBeenCalledTimes(1);
});

test("receipt keys are stable across subscription re-creation and hide the endpoint", async () => {
  const endpoint = "https://push.example/device-token";
  const hash = await endpointHash(endpoint);
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
  expect(hash).toBe(await endpointHash(endpoint));
  expect(hash).not.toBe(await endpointHash(endpoint + "-other"));
});

test("device work is bounded to eight concurrent requests and preserves order", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapDevices(Array.from({ length: 20 }, (_, index) => index), async (index) => {
    peak = Math.max(peak, ++active);
    await Promise.resolve();
    active--;
    return index;
  });
  expect(peak).toBe(8);
  expect(result).toEqual(Array.from({ length: 20 }, (_, index) => index));
});
