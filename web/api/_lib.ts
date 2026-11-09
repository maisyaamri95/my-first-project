/** Kod bersama untuk fungsi pelayan Vercel. Fail bermula dengan "_" tidak menjadi endpoint. */
import Stripe from 'stripe';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { PlanId } from '../src/lib/plans.js';
import type { SubscriptionRow } from '../src/lib/subscription.js';

export interface Config {
  stripe: Stripe;
  admin: SupabaseClient;
  webhookSecret: string;
  appUrl: string;
  prices: Record<PlanId, string>;
}

let cached: Config | null | undefined;

/** null jika mana-mana pemboleh ubah persekitaran belum diisi (endpoint akan balas 503). */
export function getConfig(): Config | null {
  if (cached !== undefined) return cached;
  const e = process.env;
  const need = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_YEARLY', 'STRIPE_PRICE_LIFETIME', 'APP_URL'];
  const missing = need.filter(k => !e[k]);
  if (missing.length) { console.error('Missing env:', missing.join(', ')); cached = null; return null; }
  cached = {
    stripe: new Stripe(e.STRIPE_SECRET_KEY!),
    admin: createClient(e.SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }),
    webhookSecret: e.STRIPE_WEBHOOK_SECRET!,
    appUrl: e.APP_URL!.replace(/\/$/, ''),
    prices: { monthly: e.STRIPE_PRICE_MONTHLY!, yearly: e.STRIPE_PRICE_YEARLY!, lifetime: e.STRIPE_PRICE_LIFETIME! },
  };
  return cached;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Sahkan token log masuk Supabase daripada header Authorization. */
export async function requireUser(cfg: Config, req: Request): Promise<User | null> {
  const h = req.headers.get('authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const { data, error } = await cfg.admin.auth.getUser(token);
  return error ? null : data.user;
}

export async function getRow(cfg: Config, userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await cfg.admin.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as SubscriptionRow | null;
}

export async function saveRow(cfg: Config, row: SubscriptionRow) {
  const { error } = await cfg.admin.from('subscriptions').upsert({ ...row, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export function priceToPlan(cfg: Config, priceId: string): PlanId | null {
  const hit = (Object.entries(cfg.prices) as [PlanId, string][]).find(([, p]) => p === priceId);
  return hit ? hit[0] : null;
}
