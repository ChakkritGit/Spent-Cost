import { savePlan } from "@/app/actions";
import type { Plan } from "@/lib/types";

// One form for create and edit; total_amount left blank means a subscription
// rather than a debt. Fields carry aria-label (not just placeholder) so a
// screen reader has a real name for each one once the placeholder scrolls
// away on focus, matching entry-form.tsx's convention.
export function PlanForm({ plan }: { plan?: Plan }) {
  const field = "rounded-btn w-full border border-line bg-bg px-3 py-3 text-[15px]";
  return (
    <form action={savePlan} className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-card">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <input
        name="name"
        required
        defaultValue={plan?.name}
        placeholder="ชื่อรายการ เช่น Netflix"
        aria-label="ชื่อรายการ"
        className={field}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          name="amount"
          required
          type="number"
          step="0.01"
          min="0"
          defaultValue={plan?.amount}
          placeholder="ยอดต่อเดือน"
          aria-label="ยอดต่อเดือน"
          className={field}
        />
        <input
          name="day_of_month"
          required
          type="number"
          min="1"
          max="31"
          defaultValue={plan?.day_of_month}
          placeholder="วันที่ครบกำหนด"
          aria-label="วันที่ครบกำหนดชำระ"
          className={field}
        />
      </div>
      <input
        name="category"
        required
        defaultValue={plan?.category}
        placeholder="หมวด เช่น สมาชิก, หนี้"
        aria-label="หมวดหมู่"
        className={field}
      />
      <input
        name="total_amount"
        type="number"
        step="0.01"
        min="0"
        defaultValue={plan?.total_amount ?? ""}
        placeholder="ยอดหนี้รวม (เว้นว่างถ้าเป็นรายการประจำ)"
        aria-label="ยอดหนี้รวม เว้นว่างถ้าเป็นรายการประจำ"
        className={field}
      />
      <label className="flex min-h-11 items-center gap-2 text-[15px] text-muted">
        <input type="checkbox" name="active" defaultChecked={plan?.active ?? true} className="size-4" />
        ใช้งานอยู่
      </label>
      <button className="rounded-btn bg-accent px-3 py-3 text-[15px] font-medium text-accent-fg">
        {plan ? "บันทึก" : "เพิ่มรายการ"}
      </button>
    </form>
  );
}
