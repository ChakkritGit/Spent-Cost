"use client";

import { useLayoutEffect, useRef } from "react";

/** the first number in "฿56,222.83", "6 / 6", "26.3%" */
const numberIn = (text: string) => Number(/-?\d[\d,]*(\.\d+)?/.exec(text)?.[0].replace(/,/g, "") ?? NaN);

/** A figure that slides in when it changes (another month, a payment): up when it grew, down when it shrank. */
export function Num({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useLayoutEffect(() => {
    const before = numberIn(prev.current);
    const after = numberIn(value);
    prev.current = value;
    const el = ref.current;
    if (!el || !Number.isFinite(before) || !Number.isFinite(after) || before === after) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [{ transform: `translateY(${after > before ? 0.3 : -0.3}em)`, opacity: 0.2 }, { transform: "none", opacity: 1 }],
      { duration: 340, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
  }, [value]);
  return (
    <span ref={ref} className="inline-block">
      {value}
    </span>
  );
}
