/**
 * Server Action input validation. A file with a top-level "use server"
 * directive may only export async functions (Next requires it, since every
 * export becomes a callable Server Action) — these stay in their own module
 * so they can be plain, synchronous, and unit-tested directly.
 */

// Form input is a trust boundary: an empty or malformed value must not reach
// PostgREST as NaN (-> null -> NOT NULL violation) or a negative number
// (-> a check constraint violation), both of which surface as a raw
// PostgREST error object instead of something a caller can show.
export const num = (v: FormDataEntryValue | null, field: string): number => {
  const raw = String(v ?? "").trim();
  if (raw === "") throw new Error(`กรุณาระบุ${field}`);
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) throw new Error(`${field}ไม่ถูกต้อง`);
  if (n < 0) throw new Error(`${field}ต้องไม่ติดลบ`);
  return n;
};

// total_amount, when provided, is what makes a plan a debt rather than a
// subscription. A total of exactly 0 is not a debt with anything to repay or
// a progress bar to draw, so — unlike a monthly amount — it is rejected the
// same as a negative one, matching the DB's check (total_amount > 0).
export const positiveNum = (v: FormDataEntryValue | null, field: string): number => {
  const n = num(v, field);
  if (n === 0) throw new Error(`${field}ต้องมากกว่า 0`);
  return n;
};

// day_of_month is a numeric field too, but the DB also requires it to be a
// whole number between 1 and 31 — catch that here with a Thai message
// instead of letting the check constraint reject it.
export const dayOfMonth = (v: FormDataEntryValue | null): number => {
  const n = num(v, "วันที่เรียกเก็บเงิน");
  if (!Number.isInteger(n) || n < 1 || n > 31) throw new Error("วันที่เรียกเก็บเงินต้องเป็นจำนวนเต็ม 1-31");
  return n;
};

export const text = (v: FormDataEntryValue | null, field: string): string => {
  const s = String(v ?? "").trim();
  if (s === "") throw new Error(`กรุณาระบุ${field}`);
  return s;
};

// The <input pattern> in the settings form is a UX hint, not a trust
// boundary — a raw POST can send anything. Enforce the same 4-8 digit shape
// here before it is hashed and stored.
export const pinFormat = (raw: string): string => {
  if (!/^[0-9]{4,8}$/.test(raw)) throw new Error("PIN ต้องเป็นตัวเลข 4-8 หลัก");
  return raw;
};
