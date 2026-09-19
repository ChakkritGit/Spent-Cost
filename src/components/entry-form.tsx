import { saveEntry } from "@/app/actions";

// plan_id is deliberately absent: saveEntry reads it from the form and gets
// null when the field is missing, which is exactly what a one-off needs.
export function EntryForm({ defaultDate }: { defaultDate: string }) {
  const field = "w-full rounded-lg border border-line bg-bg px-3 py-3 text-sm";
  return (
    <form action={saveEntry} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <input name="name" required placeholder="ชื่อรายการ เช่น ค่าอาหาร" aria-label="ชื่อรายการ" className={field} />
      <div className="grid grid-cols-2 gap-3">
        <input name="amount" required type="number" step="0.01" min="0" placeholder="จำนวนเงิน" aria-label="จำนวนเงิน" className={field} />
        <input name="due_date" required type="date" defaultValue={defaultDate} aria-label="วันที่" className={field} />
      </div>
      <input name="category" required placeholder="หมวด เช่น อาหาร" aria-label="หมวดหมู่" className={field} />
      <button className="rounded-lg bg-accent px-3 py-3 text-sm font-medium text-accent-fg">
        เพิ่มรายการครั้งเดียว
      </button>
    </form>
  );
}
