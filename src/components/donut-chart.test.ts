import { expect, test } from "vitest";
import { arcs, withOther } from "@/components/donut-chart";

test("arcs split the circumference in proportion and start where the last ended", () => {
  expect(arcs([50, 50])).toEqual([
    { offset: 0, length: 50 },
    { offset: 50, length: 50 },
  ]);
});

test("arcs handle uneven shares", () => {
  const [a, b, c] = arcs([60, 30, 10]);
  expect(a).toEqual({ offset: 0, length: 60 });
  expect(b).toEqual({ offset: 60, length: 30 });
  expect(c).toEqual({ offset: 90, length: 10 });
});

test("arcs of nothing is empty rather than NaN", () => {
  expect(arcs([])).toEqual([]);
  expect(arcs([0, 0])).toEqual([{ offset: 0, length: 0 }, { offset: 0, length: 0 }]);
});

test("withOther passes through up to the cap unchanged", () => {
  const data = [
    { category: "a", amount: 40 },
    { category: "b", amount: 30 },
    { category: "c", amount: 30 },
  ];
  expect(withOther(data, 6)).toEqual(data);
});

// byCategory sorts largest-first, so slicing at the cap without folding the
// remainder would quietly understate the total against summarise()'s real
// figure — this is the arithmetic that would be wrong without looking wrong.
test("withOther folds everything past the cap into อื่นๆ and preserves the total", () => {
  const data = [
    { category: "a", amount: 50 },
    { category: "b", amount: 20 },
    { category: "c", amount: 10 },
    { category: "d", amount: 8 },
    { category: "e", amount: 7 },
    { category: "f", amount: 4 },
    { category: "g", amount: 1 },
  ];
  const result = withOther(data, 6);
  expect(result).toHaveLength(6);
  expect(result.slice(0, 5)).toEqual(data.slice(0, 5));
  expect(result[5]).toEqual({ category: "อื่นๆ", amount: 5 });
  const before = data.reduce((sum, d) => sum + d.amount, 0);
  const after = result.reduce((sum, d) => sum + d.amount, 0);
  expect(after).toBe(before);
});
