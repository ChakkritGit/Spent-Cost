// Lucide's paths, squared off to match the ledger. A handful of icons does not
// earn the lucide-react dependency.
const PATHS = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  plans: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  calendar: "M3 4h18v17H3zM16 2v4M8 2v4M3 10h18",
  settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  plus: "M12 5v14M5 12h14",
  close: "M18 6 6 18M6 6l12 12",
  prev: "m15 18-6-6 6-6",
  next: "m9 18 6-6-6-6",
  check: "M20 6 9 17l-5-5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, stroke = 1.6, className }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}
