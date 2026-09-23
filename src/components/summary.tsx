import Link from "next/link";
import { baht } from "@/lib/money";

/** The debt still owed as the page's one big figure, then the month in four ruled cells. */
export function Summary({
  spent,
  outstanding,
  debtTotal,
  debtPaid,
  debtRemaining,
  paidCount,
  entryCount,
}: {
  spent: number;
  outstanding: number;
  debtTotal: number;
  debtPaid: number;
  debtRemaining: number;
  paidCount: number;
  entryCount: number;
}) {
  const ratio = debtTotal > 0 ? debtPaid / debtTotal : 0;
  const percent = `${(ratio * 100).toFixed(1)}%`;

  return (
    <>
      <section className="flex flex-col gap-3.5 border-b border-ink bg-surface px-4 py-5">
        <span className="label">หนี้คงเหลือ — DEBT REMAINING</span>
        {debtTotal > 0 ? (
          <>
            <p className="headline text-[60px] leading-none text-brand">{baht(Math.max(0, debtRemaining))}</p>
            <div className="flex h-3.5 border border-ink" role="img" aria-label={`จ่ายหนี้แล้ว ${percent}`}>
              <div className="bg-brand" style={{ width: `${Math.min(1, ratio) * 100}%` }} />
              <div className="ticks flex-1" />
            </div>
            <div className="flex justify-between gap-3 font-mono text-xs">
              <span>จ่ายแล้ว {baht(debtPaid)} · {percent}</span>
              <span className="text-muted">จาก {baht(debtTotal)}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">
            ยังไม่มีหนี้ที่ติดตาม — <Link href="/plans" className="text-brand underline">เพิ่มหนี้ที่หน้าแผน</Link> แล้วจะเห็นยอดคงเหลือตรงนี้
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 border-b border-ink">
        <Cell label="ใช้ไปเดือนนี้" value={baht(spent)} className="border-e border-b border-ink" />
        <Cell label="ค้างจ่ายเดือนนี้" value={baht(outstanding)} className="border-b border-ink" warn={outstanding > 0} />
        <Cell label="จ่ายหนี้แล้วทั้งหมด" value={baht(debtPaid)} className="border-e border-ink" />
        <Cell label="รายการเดือนนี้" value={`${paidCount} / ${entryCount}`} unit="จ่ายแล้ว" />
      </section>
    </>
  );
}

function Cell({ label, value, unit, warn, className = "" }: { label: string; value: string; unit?: string; warn?: boolean; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 p-4 ${className}`}>
      <span className={`label ${warn ? "text-warn" : ""}`}>{warn && "● "}{label}</span>
      <span className="headline truncate text-[28px] font-bold">
        {value}
        {unit && <span className="ms-1.5 text-sm font-medium [font-stretch:100%]">{unit}</span>}
      </span>
    </div>
  );
}
