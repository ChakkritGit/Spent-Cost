"use client";

import { useState, useTransition } from "react";
import { generateMonth } from "@/app/actions";
import { addMonths } from "@/lib/month";

const monthShort = new Intl.DateTimeFormat("th-TH", { month: "short" });

/** Writes next month's rows from the active plans. Safe to press twice — see generateMonth. */
export function GenerateMonthButton({ year, month }: { year: number; month: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ text: string; error?: boolean } | null>(null);
  const next = addMonths(year, month, 1);

  return (
    <div className="flex flex-col gap-2 py-5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const { error, inserted } = await generateMonth(year, month);
            if (error) setResult({ text: error, error: true });
            else setResult({ text: inserted ? `เพิ่ม ${inserted} รายการในเดือนถัดไปแล้ว` : "สร้างไว้ครบแล้ว ไม่มีรายการใหม่" });
          })
        }
        className="h-12 border border-brand bg-surface font-mono text-xs font-bold tracking-[0.04em] text-brand disabled:opacity-60"
      >
        {pending ? "กำลังสร้าง…" : `+ สร้างรายการเดือน ${monthShort.format(new Date(next.year, next.month, 1))} จากแผน`}
      </button>
      {result && (
        <p role="status" className={`text-sm ${result.error ? "text-danger" : "text-muted"}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}
