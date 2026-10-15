"use client";

import { useEffect, useState } from "react";

/** never keep the app covered longer than this */
const MAX_MS = 4000;
/** short enough not to slow anyone down, long enough not to flash */
const MIN_MS = 450;
const FADE_MS = 320;

/**
 * The opening screen (like ฟ้าละเอียด's): the mark, the name and a thin progress line, painted with the
 * first HTML and lifted once the app is interactive and its fonts are in. The root layout keeps it
 * mounted, so it shows once per page load, never on a navigation.
 */
export function Splash() {
  const [state, setState] = useState<"shown" | "fading" | "gone">("shown");

  useEffect(() => {
    const started = performance.now();
    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      const wait = Math.max(0, MIN_MS - (performance.now() - started));
      window.setTimeout(() => setState("fading"), wait);
    };
    // mounted = hydrated; then wait for the fonts so the page underneath is final
    const fonts = document.fonts?.ready ?? Promise.resolve();
    fonts.then(hide, hide);
    const max = window.setTimeout(hide, MAX_MS);
    return () => window.clearTimeout(max);
  }, []);

  useEffect(() => {
    if (state !== "fading") return;
    const t = window.setTimeout(() => setState("gone"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [state]);

  if (state === "gone") return null;
  return (
    <div className="splash" data-state={state} role="status" aria-label="กำลังโหลด">
      <span aria-hidden className="splash-mark" />
      <span className="splash-name">SPENT/COST</span>
      <span className="splash-tag">รายจ่าย ผ่อน และหนี้ เดือนต่อเดือน</span>
      <span aria-hidden className="splash-bar" />
    </div>
  );
}
