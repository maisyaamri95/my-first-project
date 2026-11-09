import type Stripe from 'stripe';
import { getConfig, getRow, json, priceToPlan, saveRow, type Config } from './_lib.js';
import { fromStripeSubscription, mergeSubscription, shouldApplySubscriptionEvent } from '../src/lib/subscription.js';

/** Cari pengguna untuk sesuatu langganan: metadata dahulu, kemudian ID pelanggan Stripe. */
async function userFor(cfg: Config, metaUserId: string | undefined, customer: string | { id: string } | null): Promise<string | null> {
  if (metaUserId) return metaUserId;
  const id = typeof customer === 'string' ? customer : customer?.id;
  if (!id) return null;
  const { data } = await cfg.admin.from('subscriptions').select('user_id').eq('stripe_customer_id', id).maybeSingle();
  return (data as { user_id: string } | null)?.user_id ?? null;
}

async function syncSubscription(cfg: Config, sub: Stripe.Subscription) {
  const userId = await userFor(cfg, sub.metadata?.user_id, sub.customer);
  if (!userId) { console.warn('No user for subscription', sub.id); return; }
  const existing = await getRow(cfg, userId);
  if (!shouldApplySubscriptionEvent(existing, sub.id, sub.status)) return;
  await saveRow(cfg, mergeSubscription(existing, userId, fromStripeSubscription(sub, p => priceToPlan(cfg, p))));
}

async function grantLifetime(cfg: Config, session: Stripe.Checkout.Session) {
  const userId = await userFor(cfg, session.metadata?.user_id ?? session.client_reference_id ?? undefined, session.customer);
  if (!userId) { console.warn('No user for session', session.id); return; }
  const existing = await getRow(cfg, userId);
  const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  await saveRow(cfg, mergeSubscription(existing, userId, { lifetime: true, stripe_customer_id: customer ?? existing?.stripe_customer_id ?? null }));
  // Pengguna yang beli seumur hidup tidak patut terus dicaj bulanan/tahunan.
  if (existing?.stripe_subscription_id && !existing.lifetime) {
    await cfg.stripe.subscriptions.update(existing.stripe_subscription_id, { cancel_at_period_end: true }).catch(e => console.warn('cancel old sub failed', e));
  }
}

/** POST /api/stripe-webhook: dipanggil oleh Stripe. Tandatangan disahkan sebelum apa-apa dibuat. */
export async function POST(req: Request) {
  const cfg = getConfig();
  if (!cfg) return json({ error: 'not_configured' }, 503);
  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await cfg.stripe.webhooks.constructEventAsync(raw, sig ?? '', cfg.webhookSecret);
  } catch {
    return json({ error: 'bad_signature' }, 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object;
        if (s.mode === 'payment' && s.metadata?.plan === 'lifetime' && s.payment_status === 'paid') await grantLifetime(cfg, s);
        if (s.mode === 'subscription' && s.subscription) {
          const id = typeof s.subscription === 'string' ? s.subscription : s.subscription.id;
          await syncSubscription(cfg, await cfg.stripe.subscriptions.retrieve(id));
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(cfg, event.data.object);
        break;
    }
  } catch (e) {
    console.error('Webhook handling failed', event.type, e);
    return json({ error: 'handler_failed' }, 500); // Stripe akan cuba semula
  }
  return json({ received: true });
}
