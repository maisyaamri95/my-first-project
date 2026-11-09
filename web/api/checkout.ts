import { getConfig, getRow, json, requireUser, saveRow } from './_lib.js';
import { isPlanId } from '../src/lib/plans.js';
import { mergeSubscription, subscriptionIsActive } from '../src/lib/subscription.js';

/** POST /api/checkout { plan } -> { url } halaman bayaran Stripe. */
export async function POST(req: Request) {
  const cfg = getConfig();
  if (!cfg) return json({ error: 'not_configured' }, 503);
  const user = await requireUser(cfg, req);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  const plan = (body as { plan?: unknown }).plan;
  if (!isPlanId(plan)) return json({ error: 'bad_plan' }, 400);

  const row = await getRow(cfg, user.id);
  if (row?.lifetime) return json({ error: 'already_premium' }, 409);
  if (plan !== 'lifetime' && subscriptionIsActive(row)) return json({ error: 'already_premium' }, 409);

  let customer = row?.stripe_customer_id ?? null;
  if (!customer) {
    const c = await cfg.stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
    customer = c.id;
    await saveRow(cfg, mergeSubscription(row, user.id, { stripe_customer_id: customer }));
  }

  const meta = { user_id: user.id, plan };
  const common = {
    customer,
    client_reference_id: user.id,
    line_items: [{ price: cfg.prices[plan], quantity: 1 }],
    success_url: `${cfg.appUrl}/akaun?bayar=berjaya`,
    cancel_url: `${cfg.appUrl}/premium`,
    locale: 'auto' as const,
    metadata: meta,
  };
  const session = plan === 'lifetime'
    ? await cfg.stripe.checkout.sessions.create({ ...common, mode: 'payment', payment_intent_data: { metadata: meta } })
    : await cfg.stripe.checkout.sessions.create({ ...common, mode: 'subscription', subscription_data: { metadata: meta }, allow_promotion_codes: true });
  return json({ url: session.url });
}
