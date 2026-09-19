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

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/,/g, ""));

export async function savePlan(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id");
  const total = String(formData.get("total_amount") ?? "").trim();
  const row = {
    user_id: await userId(),
    name: String(formData.get("name")),
    amount: num(formData.get("amount")),
    category: String(formData.get("category")),
    day_of_month: num(formData.get("day_of_month")),
    total_amount: total === "" ? null : num(total),
    active: formData.get("active") !== null,
  };
  const { error } = id
    ? await supabase.from("plans").update(row).eq("id", String(id))
    : await supabase.from("plans").insert(row);
  if (error) throw error;
  revalidatePath("/plans");
  revalidatePath("/");
}

export async function deletePlan(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/plans");
  revalidatePath("/");
}

export async function saveEntry(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id");
  const row = {
    user_id: await userId(),
    plan_id: (formData.get("plan_id") as string) || null,
    name: String(formData.get("name")),
    amount: num(formData.get("amount")),
    category: String(formData.get("category")),
    due_date: String(formData.get("due_date")),
  };
  const { error } = id
    ? await supabase.from("entries").update(row).eq("id", String(id))
    : await supabase.from("entries").insert(row);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function deleteEntry(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function togglePaid(id: string, paid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("entries")
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
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

/** Returns whether the PIN matched. Never returns the stored hash. */
export async function verifyPin(pin: string): Promise<boolean> {
  const supabase = await createClient();
  const id = await userId();
  const { data } = await supabase.from("profiles").select("pin_hash").eq("id", id).single();
  if (!data?.pin_hash) return true;
  return data.pin_hash === (await hashPin(id, pin));
}
