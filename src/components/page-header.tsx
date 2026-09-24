import Link from "next/link";
import { Icon } from "@/components/icons";
import { Mark } from "@/components/nav";
import { addMonths } from "@/lib/month";

const monthName = new Intl.DateTimeFormat("th-TH", { month: "long" });

/** The page's name in the condensed cut, the mark above it on a phone (the sidebar carries it from lg). */
export function PageHeader({ title, aside, action }: { title: string; aside?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-3.5 border-b border-ink px-4 pb-4 pt-[calc(18px+env(safe-area-inset-top))] lg:pt-6">
      {/* Only the mark sits here without an aside, and the sidebar carries it from lg. */}
      <div className={`flex min-h-11 items-center justify-between gap-3 ${aside ? "" : "lg:hidden"}`}>
        <Mark className="lg:hidden" />
        {aside}
      </div>
      <div className="flex items-end justify-between gap-3">
        <h1 className="headline text-[40px]">{title}</h1>
        {action}
      </div>
    </header>
  );
}

/** Title for a month view: "ภาพรวม กันยายน". */
export function monthTitle(prefix: string, year: number, month: number) {
  return `${prefix} ${monthName.format(new Date(year, month, 1))}`;
}

/** ‹ 09 / 2569 › — Buddhist year, as the rest of the app speaks it. Plain links: no script needed to change month. */
export function MonthSwitcher({ year, month, path }: { year: number; month: number; path: string }) {
  const href = (n: number) => {
    const at = addMonths(year, month, n);
    return `${path}?y=${at.year}&m=${at.month}`;
  };
  const cell = "grid size-11 place-items-center bg-surface";
  return (
    <div className="flex border border-ink">
      <Link href={href(-1)} aria-label="เดือนก่อน" className={`${cell} border-e border-ink`}>
        <Icon name="prev" size={16} stroke={1.8} />
      </Link>
      <span className="flex items-center bg-surface px-3 font-mono text-[13px] font-medium">
        {String(month + 1).padStart(2, "0")} / {year + 543}
      </span>
      <Link href={href(1)} aria-label="เดือนถัดไป" className={`${cell} border-s border-ink`}>
        <Icon name="next" size={16} stroke={1.8} />
      </Link>
    </div>
  );
}
