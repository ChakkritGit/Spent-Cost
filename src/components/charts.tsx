import { niceMax, withOther } from "@/lib/money";

const monthShort = new Intl.DateTimeFormat("th-TH", { month: "short" });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Six months as outlined columns, the viewed month filled blue. Drawn to one
 * scale: the axis top is `niceMax` of the tallest month, and every tick names
 * a value the chart reaches.
 */
export function BarChart({ data }: { data: { key: string; amount: number }[] }) {
  const W = 360, TOP = 16, BASE = 136, LEFT = 30;
  const max = niceMax(Math.max(...data.map((d) => d.amount)));
  const y = (v: number) => BASE - (v / max) * (BASE - TOP);
  const slot = (W - LEFT) / data.length;
  const bar = Math.min(36, slot - 16);

  return (
    <svg viewBox={`0 0 ${W} 160`} className="block w-full max-w-lg" role="img" aria-label={data.map((d) => `${label(d.key)} ${d.amount} บาท`).join(", ")}>
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <text x={0} y={y(t) + 4} className="fill-muted font-mono text-[10px]">{compact.format(t)}</text>
          <path d={`M${LEFT} ${y(t) + 0.5}H${W}`} className={t === 0 ? "stroke-ink" : "stroke-hair"} strokeDasharray={t === 0 ? undefined : "3 3"} fill="none" />
        </g>
      ))}
      {data.map((d, i) => {
        const current = i === data.length - 1;
        const cx = LEFT + slot * i + slot / 2;
        const top = y(d.amount);
        return (
          <g key={d.key}>
            {d.amount > 0 && (
              <rect
                x={cx - bar / 2 + 0.5}
                y={top + 0.5}
                width={bar - 1}
                height={Math.max(0, BASE - top - 1)}
                className={current ? "fill-brand stroke-brand" : "fill-surface stroke-ink"}
              />
            )}
            <text x={cx} y={top - 5} textAnchor="middle" className={`font-mono text-[10px] ${current ? "fill-brand font-bold" : "fill-ink"}`}>
              {compact.format(d.amount)}
            </text>
            <text x={cx} y={154} textAnchor="middle" className={`text-[12px] ${current ? "fill-ink font-bold" : "fill-muted"}`}>
              {label(d.key)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const label = (key: string) => monthShort.format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1));

const SWATCH = ["bg-brand", "bg-brand-2", "bg-brand-3", "hatch bg-surface"];

/** Where the month goes: one ruled bar split by category, three largest plus the rest. */
export function CategoryBar({ data }: { data: { category: string; amount: number }[] }) {
  const parts = withOther(data, SWATCH.length);
  const total = parts.reduce((t, d) => t + d.amount, 0);
  if (total === 0) return <p className="py-2 text-sm text-muted">ยังไม่มีรายการเดือนนี้</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-[22px] border border-ink" role="img" aria-label={parts.map((d) => `${d.category} ${Math.round((d.amount / total) * 100)}%`).join(", ")}>
        {parts.map((d, i) => (
          <div key={d.category} className={`${SWATCH[i]} ${i ? "border-s border-ink" : ""}`} style={{ width: `${(d.amount / total) * 100}%` }} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        {parts.map((d, i) => (
          <li key={d.category} className="flex min-w-0 items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden className={`size-2.5 shrink-0 border border-ink ${SWATCH[i]}`} />
              <span className="truncate">{d.category}</span>
            </span>
            <span className="font-mono">{Math.round(d.amount).toLocaleString("en-US")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
