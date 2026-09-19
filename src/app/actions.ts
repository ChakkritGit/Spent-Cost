"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { plannedRowsFor, getPlans } from "@/lib/data";
import { addMonths } from "@/lib/month";
import { hashPin } from "@/lib/pin";

async function userId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ไม่ได้เข้าสู่ระบบ");
  return user.id;
}

// Form input is a trust boundary: an empty or malformed value must not reach
// PostgREST as NaN (-> null -> NOT NULL violation) or a negative number
// (-> a check constraint violation), both of which surface as a raw
// PostgREST error object instead of something a caller can show.
const num = (v: FormDataEntryValue | null, field: string): number => {
  const raw = String(v ?? "").trim();
  if (raw === "") throw new Error(`กรุณาระบุ${field}`);
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new Error(`${field}ไม่ถูกต้อง`);
  if (n < 0) throw new Error(`${field}ต้องไม่ติดลบ`);
  return n;
};

// day_of_month is a numeric field too, but the DB also requires it to be a
// whole number between 1 and 31 — catch that here with a Thai message
// instead of letting the check constraint reject it.
const dayOfMonth = (v: FormDataEntryValue | null): number => {
  const n = num(v, "วันที่เรียกเก็บเงิน");
  if (!Number.isInteger(n) || n < 1 || n > 31) throw new Error("วันที่เรียกเก็บเงินต้องเป็นจำนวนเต็ม 1-31");
  return n;
};

const text = (v: FormDataEntryValue | null, field: string): string => {
  const s = String(v ?? "").trim();
  if (s === "") throw new Error(`กรุณาระบุ${field}`);
  return s;
};

export async function savePlan(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id");
  const total = String(formData.get("total_amount") ?? "").trim();
  const row = {
    user_id: await userId(),
    name: text(formData.get("name"), "ชื่อ"),
    amount: num(formData.get("amount"), "จำนวนเงิน"),
    category: text(formData.get("category"), "หมวดหมู่"),
    day_of_month: dayOfMonth(formData.get("day_of_month")),
    total_amount: total === "" ? null : num(total, "ยอดรวมทั้งหมด"),
    active: formData.get("active") !== null,
  };
  const { error, data } = id
    ? await supabase.from("plans").update(row).eq("id", String(id)).select("id")
    : await supabase.from("plans").insert(row);
  if (error) throw error;
  // RLS filters the update to zero rows for a stale id or someone else's
  // row without erroring — treat that as a failure, not a silent no-op.
  if (id && (data?.length ?? 0) === 0) throw new Error("ไม่พบแผนที่จะแก้ไข");
  revalidatePath("/plans");
  revalidatePath("/");
}

export async function deletePlan(id: string) {
  const supabase = await createClient();
  const { error, data } = await supabase.from("plans").delete().eq("id", id).select("id");
  if (error) throw error;
  if ((data?.length ?? 0) === 0) throw new Error("ไม่พบแผนที่จะลบ");
  revalidatePath("/plans");
  revalidatePath("/");
}

export async function saveEntry(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id");
  const row = {
    user_id: await userId(),
    plan_id: (formData.get("plan_id") as string) || null,
    name: text(formData.get("name"), "ชื่อ"),
    amount: num(formData.get("amount"), "จำนวนเงิน"),
    category: text(formData.get("category"), "หมวดหมู่"),
    due_date: String(formData.get("due_date")),
  };
  const { error, data } = id
    ? await supabase.from("entries").update(row).eq("id", String(id)).select("id")
    : await supabase.from("entries").insert(row);
  if (error) throw error;
  if (id && (data?.length ?? 0) === 0) throw new Error("ไม่พบรายการที่จะแก้ไข");
  revalidatePath("/", "layout");
}

export async function deleteEntry(id: string) {
  const supabase = await createClient();
  const { error, data } = await supabase.from("entries").delete().eq("id", id).select("id");
  if (error) throw error;
  if ((data?.length ?? 0) === 0) throw new Error("ไม่พบรายการที่จะลบ");
  revalidatePath("/", "layout");
}

export async function togglePaid(id: string, paid: boolean) {
  const supabase = await createClient();
  const { error, data } = await supabase
    .from("entries")
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if ((data?.length ?? 0) === 0) throw new Error("ไม่พบรายการที่จะทำเครื่องหมาย");
  revalidatePath("/", "layout");
}

/**
 * Copy every active plan into the month after (year, month).
 * Safe to press twice: unique (plan_id, due_date) turns a repeat into a no-op
 * for rows that already exist, so only plans added since the last press appear.
 */
export async function generateMonth(year: number, month: number) {
  const supabase = await createClient();
  const next = addMonths(year, month, 1);
  const rows = plannedRowsFor(await getPlans(), next.year, next.month);
  if (rows.length === 0) return { inserted: 0 };
  const { data, error } = await supabase
    .from("entries")
    .upsert(rows, { onConflict: "plan_id,due_date", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  revalidatePath("/", "layout");
  return { inserted: data?.length ?? 0 };
}

export async function setPin(pin: string) {
  const supabase = await createClient();
  const id = await userId();
  const { error } = await supabase.from("profiles").update({ pin_hash: await hashPin(id, pin) }).eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function clearPin() {
  const supabase = await createClient();
  const id = await userId();
  const { error } = await supabase.from("profiles").update({ pin_hash: null }).eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

/** Returns whether the PIN matched. Never returns the stored hash. Fails closed: a fetch error is not "no PIN set". */
export async function verifyPin(pin: string): Promise<boolean> {
  const supabase = await createClient();
  const id = await userId();
  const { data, error } = await supabase.from("profiles").select("pin_hash").eq("id", id).single();
  if (error) return false;
  if (!data?.pin_hash) return true;
  return data.pin_hash === (await hashPin(id, pin));
}
