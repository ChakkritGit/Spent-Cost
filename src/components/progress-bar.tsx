/**
 * The one bold element in the visual spec: debt progress. The bar clamps to
 * its track — it cannot draw past full — but the caller prints the true
 * percentage beside it, which `debtProgress` deliberately reports above 100
 * when a debt is overpaid. `aria-valuenow` stays within `aria-valuemax` (a
 * screen reader shouldn't hear an out-of-range value); `aria-valuetext`
 * carries the true figure instead, same as the visible number.
 */
export function ProgressBar({ ratio }: { ratio: number }) {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const percent = Math.round(ratio * 100);
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-accent-soft"
      role="progressbar"
      aria-valuenow={Math.min(percent, 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${percent}%`}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
