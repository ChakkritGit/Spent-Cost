"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker?.register("/sw.js").catch(() => {
      // An unavailable service worker costs offline support and nothing else.
    });
  }, []);
  return null;
}
