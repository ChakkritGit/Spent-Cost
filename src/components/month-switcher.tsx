import Link from "next/link";
import { addMonths } from "@/lib/month";

const label = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });

export function MonthSwitcher({ year, month }: { year: number; month: number }) {
  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const href = (m: { year: number; month: number }) => `?y=${m.year}&m=${m.month}`;

  return (
    <div className="flex items-center justify-between">
      <Link
        href={href(prev)}
        aria-label="เดือนก่อนหน้า"
        className="flex size-11 shrink-0 items-center justify-center text-muted"
      >
        ←
      </Link>
      <h1 className="text-lg font-medium tracking-tight">{label.format(new Date(year, month, 1))}</h1>
      <Link
        href={href(next)}
        aria-label="เดือนถัดไป"
        className="flex size-11 shrink-0 items-center justify-center text-muted"
      >
        →
      </Link>
    </div>
  );
}
