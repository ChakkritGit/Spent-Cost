"use client";

import { useState } from "react";

/** A labelled cell in a ruled form: the label is mono and small, the input borderless inside the rule. */
export function Field({
  label,
  className = "",
  ...input
}: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 px-4 py-3 ${className}`}>
      <span className="label">{label}</span>
      <input {...input} className="h-8 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted" />
    </label>
  );
}

/** Pick a category already in use, or type a new one — one input, the chips only fill it in. */
export function CategoryField({ categories, defaultValue = "" }: { categories: string[]; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue || categories[0] || "");
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <label htmlFor="category" className="label">หมวดหมู่ — เลือกที่เคยใช้ หรือพิมพ์ใหม่</label>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 10).map((c) => {
            const on = c === value;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setValue(c)}
                className={`h-11 border px-3 text-sm ${on ? "border-brand bg-brand text-on-brand" : "border-ink bg-surface"}`}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}
      <input
        id="category"
        name="category"
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="เช่น อาหาร"
        className="h-11 border border-dashed border-ink bg-surface px-3 text-base outline-none"
      />
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 border border-ink bg-brand font-mono text-sm font-bold text-on-brand disabled:opacity-60"
    >
      {pending ? "กำลังบันทึก…" : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">{message}</p>;
}
