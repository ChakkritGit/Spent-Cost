import { baht } from "@/lib/money";

/**
 * Debt progress is the one figure the visual spec asks to carry weight, so it
 * gets its own full-width dark "hero" card — 36px/700 white figure on
 * `--hero` — with a thin repayment track beneath. The other two monthly
 * figures stay quiet in a plain 2-up grid below. `debtPaid` still reaches the
 * screen too, folded into the caption under the track rather than repeated as
 * a fifth stat card.
 */
export function SummaryCards({ spent, outstanding, debtRemaining, debtPaid, debtTotal }: {
  spent: number; outstanding: number; debtRemaining: number; debtPaid: number; debtTotal: number;
}) {
  const ratio = debtTotal > 0 ? Math.min(1, debtPaid / debtTotal) : 0;
  const stats = [
    { label: "จ่ายเดือนนี้", value: spent },
    { label: "ค้างจ่าย", value: outstanding },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-hero-border bg-hero p-5 shadow-card">
        <p className="text-[13px] font-medium text-hero-muted">หนี้คงเหลือ</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-hero-fg">{baht(debtRemaining)}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-hero-track" aria-hidden="true">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <p className="mt-2 text-[13px] text-hero-muted">
          ชำระไปแล้ว <span className="tabular-nums text-hero-fg">{baht(debtPaid)}</span> จาก{" "}
          <span className="tabular-nums text-hero-fg">{baht(debtTotal)}</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-3xl bg-card p-5 shadow-card">
            <p className="text-[13px] font-medium text-muted">{label}</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums">{baht(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
