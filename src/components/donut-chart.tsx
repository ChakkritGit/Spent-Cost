import { baht } from "@/lib/money";

const MAX_SLICES = 6;

/** Slice positions on a circle normalised to a circumference of 100. */
export function arcs(values: number[]): { offset: number; length: number }[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return values.map(() => ({ offset: 0, length: 0 }));
  let offset = 0;
  return values.map((v) => {
    const length = Math.round((v / total) * 1000) / 10;
    const slice = { offset, length };
    offset = Math.round((offset + length) * 10) / 10;
    return slice;
  });
}

/**
 * Caps the legend at `max` rows, folding whatever falls past the cap into
 * "อื่นๆ" rather than dropping it. `byCategory` sorts largest-first, so a bare
 * `slice(0, max)` would quietly understate the total against the real
 * month's figure — the donut's legend and centre total both need to sum to
 * that figure, per the dashboard's own numbers beside them.
 */
export function withOther(
  data: { category: string; amount: number }[],
  max: number,
): { category: string; amount: number }[] {
  if (data.length <= max) return data;
  const kept = data.slice(0, max - 1);
  const rest = data.slice(max - 1).reduce((total, d) => total + d.amount, 0);
  return [...kept, { category: "อื่นๆ", amount: rest }];
}

// Slots 1-6 of the dataviz skill's validated categorical palette
// (references/palette.md), assigned in fixed order — never cycled, never
// re-ranked on filter. Defined as --chart-1..6 in globals.css and validated
// with scripts/validate_palette.js against this app's card surface in both
// themes (see task-8-report.md).
const SLICE_STROKE = ["stroke-chart-1", "stroke-chart-2", "stroke-chart-3", "stroke-chart-4", "stroke-chart-5", "stroke-chart-6"];
const SLICE_DOT = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"];
const R = 100 / (2 * Math.PI);

export function DonutChart({ data }: { data: { category: string; amount: number }[] }) {
  const top = withOther(data, MAX_SLICES);
  if (top.length === 0) return <p className="py-6 text-center text-sm text-muted">ยังไม่มีข้อมูล</p>;

  const total = top.reduce((sum, d) => sum + d.amount, 0);
  const slices = arcs(top.map((d) => d.amount));

  return (
    <div className="flex items-center gap-5">
      {/* role="img" names the graphic; the numbers themselves live in the
          <ul> legend below as ordinary visible text (not a hidden table) —
          every viewer, not just screen-reader users, already gets the
          figures the slices encode, so colour is never the only carrier. */}
      <div className="relative size-28 shrink-0">
        <svg viewBox="0 0 40 40" className="size-28 -rotate-90" role="img" aria-label="สัดส่วนค่าใช้จ่ายแยกตามหมวดหมู่เดือนนี้">
          {slices.map((s, i) => (
            <circle
              key={top[i].category}
              cx="20" cy="20" r={R}
              fill="none"
              className={SLICE_STROKE[i]}
              strokeWidth="6"
              strokeDasharray={`${s.length} ${100 - s.length}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted">รวม</span>
          <span className="text-sm font-semibold text-fg">{baht(total)}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 text-sm">
        {top.map((d, i) => (
          <li key={d.category} className="flex items-center gap-2 py-0.5">
            <span className={`size-2 shrink-0 rounded-full ${SLICE_DOT[i]}`} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-muted">{d.category}</span>
            <span className="shrink-0 tabular-nums">{baht(d.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
