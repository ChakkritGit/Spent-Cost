import { baht } from "@/lib/money";

const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "short" });
const labelFor = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return monthLabel.format(new Date(y, m - 1, 1));
};

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
            className="w-full max-w-6 rounded-t bg-linear-to-t from-accent to-accent-bright"
            style={{ height: `${Math.max((amount / max) * 100, 2)}%` }}
            title={`${labelFor(key)}: ${baht(amount)}`}
          />
          <span className="text-[10px] text-muted">{labelFor(key)}</span>
        </div>
      ))}
    </div>
  );
}
