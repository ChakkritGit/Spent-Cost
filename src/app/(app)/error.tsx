"use client";

import { useEffect } from "react";

// `retry` re-fetches the segment; `reset` would only re-render it with the same failed data.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-2 px-4 py-6">
      <h1 className="headline text-[32px]">โหลดข้อมูลไม่สำเร็จ</h1>
      <p className="text-sm text-muted">ลองอีกครั้ง หรือเช็กอินเทอร์เน็ต</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-3 h-12 border border-brand bg-surface font-mono text-xs font-bold tracking-[0.04em] text-brand"
      >
        ลองอีกครั้ง
      </button>
    </div>
  );
}
