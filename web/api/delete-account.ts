import { getConfig, getRow, json, requireUser } from './_lib.js';

/** POST /api/delete-account: batal langganan, padam gambar resit, kemudian padam pengguna (data lain dipadam secara cascade). */
export async function POST(req: Request) {
  const cfg = getConfig();
  if (!cfg) return json({ error: 'not_configured' }, 503);
  const user = await requireUser(cfg, req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const row = await getRow(cfg, user.id);
  if (row?.stripe_subscription_id && !row.lifetime && ['active', 'trialing', 'past_due'].includes(row.status)) {
    await cfg.stripe.subscriptions.cancel(row.stripe_subscription_id).catch(e => console.warn('cancel failed', e));
  }

  const bucket = cfg.admin.storage.from('receipts');
  for (;;) {
    const { data } = await bucket.list(user.id, { limit: 100 });
    if (!data?.length) break;
    const { error } = await bucket.remove(data.map(f => `${user.id}/${f.name}`));
    if (error) break;
  }

  const { error } = await cfg.admin.auth.admin.deleteUser(user.id);
  if (error) { console.error('deleteUser failed', error); return json({ error: 'delete_failed' }, 500); }
  return json({ deleted: true });
}
