const STATES = {
  paid: { label: "จ่ายแล้ว", cls: "bg-paid text-paid-fg" },
  due: { label: "ค้างจ่าย", cls: "bg-due text-due-fg" },
  overdue: { label: "เกินกำหนด", cls: "bg-overdue text-overdue-fg" },
} as const;

export function StatusPill({ state }: { state: keyof typeof STATES }) {
  const { label, cls } = STATES[state];
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}
