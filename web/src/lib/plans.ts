export type PlanId = 'monthly' | 'yearly' | 'lifetime';

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // RM
  per: string;
  note: string;
  mode: 'subscription' | 'payment';
}

/** Harga di sini hanya untuk paparan. Harga sebenar ditetapkan dalam Stripe (STRIPE_PRICE_*). Pastikan sama. */
export const PLANS: Record<PlanId, Plan> = {
  monthly: { id: 'monthly', name: 'Bulanan', price: 4.9, per: 'sebulan', note: 'Batal bila-bila masa', mode: 'subscription' },
  yearly: { id: 'yearly', name: 'Tahunan', price: 39.9, per: 'setahun', note: 'Jimat 32% berbanding bulanan', mode: 'subscription' },
  lifetime: { id: 'lifetime', name: 'Seumur hidup', price: 79.9, per: 'sekali bayar', note: 'Bayar dengan FPX atau kad', mode: 'payment' },
};

export const PLAN_ORDER: PlanId[] = ['yearly', 'monthly', 'lifetime'];

export function isPlanId(x: unknown): x is PlanId {
  return x === 'monthly' || x === 'yearly' || x === 'lifetime';
}
