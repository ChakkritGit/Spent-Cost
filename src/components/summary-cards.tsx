import { baht } from "@/lib/money";

/**
 * Debt progress is the one figure the visual spec asks to carry weight, so it
 * gets its own full-width card with a large number and a thin repayment
 * track. The other two monthly figures stay quiet in a plain 2-up grid below.
 * `debtPaid` still reaches the screen too, folded into the caption under the
 * track rather than repeated as a fifth stat card.
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
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm text-muted">หนี้คงเหลือ</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums">{baht(debtRemaining)}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-accent-soft" aria-hidden="true">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          ชำระไปแล้ว <span className="tabular-nums text-fg">{baht(debtPaid)}</span> จาก{" "}
          <span className="tabular-nums text-fg">{baht(debtTotal)}</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{baht(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
