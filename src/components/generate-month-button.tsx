"use client";

import { useState, useTransition } from "react";
import { generateMonth } from "@/app/actions";

export function GenerateMonthButton({ year, month }: { year: number; month: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => start(async () => {
          const { inserted } = await generateMonth(year, month);
          setResult(inserted === 0 ? "สร้างไว้แล้ว ไม่มีรายการใหม่" : `เพิ่ม ${inserted} รายการ`);
        })}
        disabled={pending}
        className="rounded-btn bg-card px-4 py-3 text-sm font-medium shadow-card disabled:opacity-50"
      >
        {pending ? "กำลังสร้าง…" : "สร้างรายการเดือนหน้า"}
      </button>
      {result && (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {result}
        </p>
      )}
    </div>
  );
}
