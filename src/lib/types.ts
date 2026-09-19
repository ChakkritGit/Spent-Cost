/** A recurring commitment. `total_amount` set means it is a debt with progress. */
export type Plan = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  day_of_month: number;
  total_amount: number | null;
  active: boolean;
  created_at: string;
};

/** A dated charge. `plan_id` null means a one-off. `paid_at` null means unpaid. */
export type Entry = {
  id: string;
  user_id: string;
  plan_id: string | null;
  name: string;
  amount: number;
  category: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
};
