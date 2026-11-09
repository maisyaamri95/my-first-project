import { getConfig, getRow, json, requireUser } from './_lib.js';

/** POST /api/portal -> { url } portal pelanggan Stripe (tukar kad, batal, resit). */
export async function POST(req: Request) {
  const cfg = getConfig();
  if (!cfg) return json({ error: 'not_configured' }, 503);
  const user = await requireUser(cfg, req);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const row = await getRow(cfg, user.id);
  if (!row?.stripe_customer_id) return json({ error: 'no_customer' }, 404);
  const session = await cfg.stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: `${cfg.appUrl}/akaun` });
  return json({ url: session.url });
}
