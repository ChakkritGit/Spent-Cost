import { baht } from "@/lib/money";

const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "short" });
const labelFor = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return monthLabel.format(new Date(y, m - 1, 1));
};

/**
 * Bar runway in px, not a percentage. The row is `h-32` (128px) and each
 * column also holds a `gap-1` (4px) and the month label (15px at
 * `text-[10px]`, measured against the real compiled CSS) below the bar —
 * 128 - 4 - 15 = 109px is what's actually left for the bar.
 *
 * A percentage height here breaks two separate ways, not one: it needs a
 * *definite* height on its containing block (the earlier bug — `items-end`
 * left the column auto-height, so every bar rendered at 0px), and even with
 * that fixed, the bar is still a shrinkable flex item — once
 * bar + gap + label would exceed the row height, flexbox quietly compresses
 * the bar to fit instead of letting it overflow, so every month from ~85%
 * of max upward renders at the same height and the chart stops showing
 * which month was actually bigger. Pixels against a fixed track need no
 * definite parent, and `shrink-0` (below) closes the second hole, so the
 * whole class of bug goes away instead of moving somewhere else.
 */
const TRACK = 109;

/**
 * CSS bars, not SVG — a bar is a rectangle and flexbox already stacks them.
 * No hover tooltip beyond the native `title`: six static bars in a
 * library-free, phone-first app don't earn a custom crosshair/tooltip layer.
 * The container carries the real text alternative since, unlike the donut,
 * nothing else on the page prints these six figures as visible text.
 */
export function BarChart({ data }: { data: { key: string; amount: number }[] }) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  const summary = data.map(({ key, amount }) => `${labelFor(key)} ${baht(amount)}`).join(", ");

  return (
    <div role="img" aria-label={`ยอดใช้จ่าย 6 เดือนย้อนหลัง: ${summary}`} className="flex h-32 gap-2">
      {data.map(({ key, amount }) => (
        <div key={key} aria-hidden className="flex flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full max-w-6 shrink-0 rounded-t bg-linear-to-t from-accent to-accent-bright"
            style={{ height: `${Math.max(Math.round((amount / max) * TRACK), 2)}px` }}
            title={`${labelFor(key)}: ${baht(amount)}`}
          />
          <span className="text-[10px] text-muted">{labelFor(key)}</span>
        </div>
      ))}
    </div>
  );
}
