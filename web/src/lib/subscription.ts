import type { PlanId } from './plans';

/** Satu baris jadual `subscriptions` (satu baris bagi setiap pengguna). Hanya pelayan (webhook Stripe) yang menulisnya. */
export interface SubscriptionRow {
  user_id: string;
  status: string; // status Stripe: active, trialing, past_due, canceled, ...; 'active' untuk seumur hidup
  plan: PlanId | null;
  lifetime: boolean;
  current_period_end: string | null; // ISO
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

/** Tempoh ihsan selepas tarikh tamat, untuk bayaran yang lambat diproses. Sama dengan fungsi SQL is_premium(). */
export const GRACE_DAYS = 3;
const ACTIVE = ['active', 'trialing', 'past_due'];

export function subscriptionIsActive(row: Pick<SubscriptionRow, 'status' | 'lifetime' | 'current_period_end'> | null | undefined, now: Date = new Date()): boolean {
  if (!row) return false;
  if (row.lifetime) return true;
  if (!ACTIVE.includes(row.status)) return false;
  if (row.current_period_end) {
    const end = new Date(row.current_period_end).getTime() + GRACE_DAYS * 86400000;
    if (end < now.getTime()) return false;
  }
  return true;
}

/** Bentuk minimum langganan Stripe yang kita perlukan (supaya fungsi ini boleh diuji tanpa Stripe). */
export interface StripeSubLike {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end: boolean;
  current_period_end?: number | null;
  items: { data: { current_period_end?: number | null; price: { id: string } }[] };
}

/** Tukar langganan Stripe kepada medan jadual kita. `priceToPlan` memetakan ID harga Stripe kepada pelan. */
export function fromStripeSubscription(sub: StripeSubLike, priceToPlan: (priceId: string) => PlanId | null): Omit<SubscriptionRow, 'user_id' | 'lifetime'> {
  const item = sub.items.data[0];
  const endSec = item?.current_period_end ?? sub.current_period_end ?? null;
  return {
    status: sub.status,
    plan: item ? priceToPlan(item.price.id) : null,
    current_period_end: endSec ? new Date(endSec * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
  };
}

/**
 * Gabungkan maklumat baharu ke baris sedia ada. Pembelian seumur hidup tidak boleh dibatalkan oleh
 * peristiwa langganan (contohnya pengguna yang dulu langgan bulanan, kemudian beli seumur hidup).
 */
export function mergeSubscription(existing: SubscriptionRow | null, userId: string, incoming: Partial<SubscriptionRow>): SubscriptionRow {
  const base: SubscriptionRow = existing ?? {
    user_id: userId, status: 'none', plan: null, lifetime: false, current_period_end: null,
    cancel_at_period_end: false, stripe_customer_id: null, stripe_subscription_id: null,
  };
  const next: SubscriptionRow = { ...base, ...incoming, user_id: userId };
  if (base.lifetime || incoming.lifetime) {
    return { ...next, lifetime: true, status: 'active', plan: 'lifetime', current_period_end: null, cancel_at_period_end: false };
  }
  return next;
}

/**
 * Peristiwa Stripe boleh tiba lewat atau tidak mengikut susunan. Peristiwa untuk langganan LAIN
 * (contohnya langganan lama yang baru dibatalkan) hanya boleh menggantikan baris semasa jika ia aktif.
 */
export function shouldApplySubscriptionEvent(existing: Pick<SubscriptionRow, 'stripe_subscription_id'> | null, subId: string, status: string): boolean {
  if (!existing?.stripe_subscription_id || existing.stripe_subscription_id === subId) return true;
  return ACTIVE.includes(status);
}

export function describeSubscription(row: SubscriptionRow | null, now: Date = new Date()): string {
  if (!row || !subscriptionIsActive(row, now)) return 'Percuma';
  if (row.lifetime) return 'Premium seumur hidup';
  const end = row.current_period_end ? new Date(row.current_period_end) : null;
  const date = end ? end.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const name = row.plan === 'yearly' ? 'Premium Tahunan' : 'Premium Bulanan';
  if (row.status === 'past_due') return `${name}: bayaran belum berjaya, sila kemas kini kad`;
  if (row.cancel_at_period_end) return `${name}: tamat pada ${date}`;
  return date ? `${name}: diperbaharui pada ${date}` : name;
}
