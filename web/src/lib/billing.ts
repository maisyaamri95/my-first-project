import { AppError, toAppError } from './errors';
import type { PlanId } from './plans';
import type { Repo } from '../data/types';

async function post(repo: Repo, path: string, body: unknown): Promise<string> {
  const token = await repo.accessToken();
  if (!token) throw new AppError('not_signed_in');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).catch(e => { throw toAppError(e); });
  if (res.status === 503) throw new AppError('not_configured');
  if (!res.ok) throw new AppError('unknown', await res.text().catch(() => ''));
  const { url } = await res.json();
  if (typeof url !== 'string') throw new AppError('unknown', 'no url');
  return url;
}

/** Bawa pengguna ke halaman bayaran Stripe. */
export async function startCheckout(repo: Repo, plan: PlanId) {
  window.location.assign(await post(repo, '/api/checkout', { plan }));
}

/** Portal Stripe: tukar kad, batal langganan, muat turun resit. */
export async function openPortal(repo: Repo) {
  window.location.assign(await post(repo, '/api/portal', {}));
}
