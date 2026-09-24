"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { plannedRowsFor, getPlans, toEntry, toPlan } from "@/lib/data";
import { debtProgress, totalForRemaining } from "@/lib/money";
import { addMonths } from "@/lib/month";
import { hashPin } from "@/lib/pin";
import { dayOfMonth, num, pinFormat, positiveNum, text } from "@/lib/validate";

/**
 * Every action answers `{ error }` rather than throwing: in production a
 * thrown message reaches the client only as a generic digest, so the Thai
 * messages in validate.ts would never be seen.
 */
export type Result = { error?: string };

async function run(fn: () => Promise<void>): Promise<Result> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    // Our own messages are Error instances; a PostgREST error is a plain
    // object whose English detail is not for the screen.
    return { error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองอีกครั้ง" };
  }
}

async function userId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("ไม่ได้เข้าสู่ระบบ");
  return user.id;
}

/**
 * RLS filters a write to someone else's row, or a stale id, down to zero rows
 * without an error. Selecting the id back turns that silent no-op into one.
 */
function touched(res: { error: unknown; data: unknown[] | null }, missing: string) {
  if (res.error) throw res.error;
  if ((res.data?.length ?? 0) === 0) throw new Error(missing);
}

export async function savePlan(formData: FormData): Promise<Result> {
  return run(async () => {
    const supabase = await createClient();
    const id = formData.get("id");
    const total = String(formData.get("total_amount") ?? "").trim();
    const before = String(formData.get("paid_before") ?? "").trim();
    const row = {
      user_id: await userId(),
      name: text(formData.get("name"), "ชื่อ"),
      amount: num(formData.get("amount"), "ยอดต่อเดือน"),
      category: text(formData.get("category"), "หมวดหมู่"),
      day_of_month: dayOfMonth(formData.get("day_of_month")),
      total_amount: total === "" ? null : positiveNum(total, "ยอดหนี้รวม"),
      // Only a debt has progress to start from.
      paid_before: total === "" || before === "" ? 0 : num(before, "ยอดที่จ่ายไปก่อนหน้า"),
      active: formData.get("active") !== null,
    };
    if (id) touched(await supabase.from("plans").update(row).eq("id", String(id)).select("id"), "ไม่พบแผนที่จะแก้ไข");
    else {
      const { error } = await supabase.from("plans").insert(row);
      if (error) throw error;
    }
  });
}

/** Closing a finished plan without losing its history — generation skips inactive plans. */
export async function setPlanActive(id: string, active: boolean): Promise<Result> {
  return run(async () => {
    const supabase = await createClient();
    touched(await supabase.from("plans").update({ active }).eq("id", id).select("id"), "ไม่พบแผน");
  });
}

/**
 * Set what is still owed to the figure on the statement. The total moves to
 * `paid + remaining`; the paid history is left as it happened.
 */
export async function setDebtRemaining(id: string, remaining: string): Promise<Result> {
  return run(async () => {
    const left = num(remaining, "ยอดคงเหลือ");
    const supabase = await createClient();
    const [plan, entries] = await Promise.all([
      supabase.from("plans").select("*").eq("id", id).single(),
      supabase.from("entries").select("*").eq("plan_id", id).not("paid_at", "is", null),
    ]);
    if (plan.error) throw new Error("ไม่พบหนี้ก้อนนี้");
    if (entries.error) throw entries.error;
    const { paid } = debtProgress(toPlan(plan.data), entries.data.map(toEntry));
    const total = totalForRemaining(paid, left);
    if (total <= 0) throw new Error("ยังไม่มียอดที่จ่ายและยอดคงเหลือเป็น 0 — ถ้าหนี้หมดแล้ว ใช้ “ปิดใช้งาน”");
    touched(await supabase.from("plans").update({ total_amount: total }).eq("id", id).select("id"), "ไม่พบหนี้ก้อนนี้");
  });
}

export async function deletePlan(id: string): Promise<Result> {
  return run(async () => {
    const supabase = await createClient();
    touched(await supabase.from("plans").delete().eq("id", id).select("id"), "ไม่พบแผนที่จะลบ");
  });
}

export async function saveEntry(formData: FormData): Promise<Result> {
  return run(async () => {
    const supabase = await createClient();
    const id = formData.get("id");
    const dueDate = String(formData.get("due_date") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("กรุณาระบุวันที่");
    const row = {
      user_id: await userId(),
      plan_id: (formData.get("plan_id") as string) || null,
      name: text(formData.get("name"), "ชื่อ"),
      amount: num(formData.get("amount"), "จำนวนเงิน"),
      category: text(formData.get("category"), "หมวดหมู่"),
      due_date: dueDate,
    };
    if (id) touched(await supabase.from("entries").update(row).eq("id", String(id)).select("id"), "ไม่พบรายการที่จะแก้ไข");
    else {
      const { error } = await supabase.from("entries").insert(row);
      if (error) throw error;
    }
  });
}

export async function deleteEntry(id: string): Promise<Result> {
  return run(async () => {
    const supabase = await createClient();
    touched(await supabase.from("entries").delete().eq("id", id).select("id"), "ไม่พบรายการที่จะลบ");
  });
}

export async function togglePaid(id: string, paid: boolean): Promise<Result> {
  return run(async () => {
    const supabase = await createClient();
    touched(
      await supabase.from("entries").update({ paid_at: paid ? new Date().toISOString() : null }).eq("id", id).select("id"),
      "ไม่พบรายการ",
    );
  });
}

/**
 * Copy every active plan into the month after (year, month). Safe to press
 * twice: unique (plan_id, due_date) turns a repeat into a no-op for rows that
 * already exist, so only plans added since the last press appear.
 */
export async function generateMonth(year: number, month: number): Promise<Result & { inserted?: number }> {
  let inserted = 0;
  const result = await run(async () => {
    const supabase = await createClient();
    const next = addMonths(year, month, 1);
    const rows = plannedRowsFor(await getPlans(), next.year, next.month);
    if (rows.length === 0) return;
    const { data, error } = await supabase
      .from("entries")
      .upsert(rows, { onConflict: "plan_id,due_date", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    inserted = data?.length ?? 0;
  });
  return { ...result, inserted };
}

export async function setPin(pin: string): Promise<Result> {
  return run(async () => {
    const supabase = await createClient();
    const id = await userId();
    const { error } = await supabase.from("profiles").update({ pin_hash: await hashPin(id, pinFormat(pin)) }).eq("id", id);
    if (error) throw error;
  });
}

export async function clearPin(): Promise<Result> {
  return run(async () => {
    const supabase = await createClient();
    const id = await userId();
    const { error } = await supabase.from("profiles").update({ pin_hash: null }).eq("id", id);
    if (error) throw error;
  });
}

/**
 * Remember this device for the morning reminder. Upsert on the endpoint, so
 * re-subscribing the same browser replaces its keys rather than piling up.
 * ponytail: a browser another account already subscribed is refused by RLS;
 * turn it off in that account first.
 */
export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }): Promise<Result> {
  return run(async () => {
    if (!/^https:\/\//.test(sub.endpoint) || !sub.p256dh || !sub.auth) throw new Error("ข้อมูลการแจ้งเตือนไม่ถูกต้อง");
    const supabase = await createClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({ user_id: await userId(), ...sub }, { onConflict: "endpoint" });
    if (error) throw error;
  });
}

export async function deletePushSubscription(endpoint: string): Promise<Result> {
  return run(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw error;
  });
}

/** Whether the PIN matched. Never returns the stored hash. Fails closed: a fetch error is not "no PIN set". */
export async function verifyPin(pin: string): Promise<boolean> {
  const supabase = await createClient();
  const id = await userId();
  const { data, error } = await supabase.from("profiles").select("pin_hash").eq("id", id).single();
  if (error) return false;
  if (!data?.pin_hash) return true;
  return data.pin_hash === (await hashPin(id, pin));
}
