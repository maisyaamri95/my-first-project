export type ErrorCode =
  | 'premium_required' | 'owner_not_premium' | 'invalid_code' | 'household_full' | 'too_many_households' | 'not_owner'
  | 'invalid_credentials' | 'email_taken' | 'weak_password' | 'email_not_confirmed' | 'rate_limited'
  | 'network' | 'not_configured' | 'not_signed_in' | 'storage_full' | 'unknown';

export class AppError extends Error {
  constructor(public code: ErrorCode, message?: string) { super(message ?? code); }
}

const KNOWN: ErrorCode[] = ['premium_required', 'owner_not_premium', 'invalid_code', 'household_full', 'too_many_households', 'not_owner', 'not_signed_in'];

/** Tukar apa-apa ralat (Supabase, fetch, dll.) kepada AppError dengan kod yang kita kenali. */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err = e as { message?: string; code?: string; status?: number; name?: string } | null;
  const msg = String(err?.message ?? '');
  for (const k of KNOWN) if (msg.includes(k)) return new AppError(k, msg);
  switch (err?.code) {
    case 'invalid_credentials': return new AppError('invalid_credentials', msg);
    case 'user_already_exists': case 'email_exists': return new AppError('email_taken', msg);
    case 'weak_password': return new AppError('weak_password', msg);
    case 'email_not_confirmed': return new AppError('email_not_confirmed', msg);
    case 'over_email_send_rate_limit': case 'over_request_rate_limit': return new AppError('rate_limited', msg);
  }
  if (err?.status === 429) return new AppError('rate_limited', msg);
  if (err?.name === 'TypeError' && /fetch|network|load failed/i.test(msg)) return new AppError('network', msg);
  if (/quota/i.test(msg)) return new AppError('storage_full', msg);
  return new AppError('unknown', msg);
}

const MESSAGES: Record<ErrorCode, string> = {
  premium_required: 'Ciri ini untuk pengguna Premium.',
  owner_not_premium: 'Pemilik ruang ini belum melanggan Premium, jadi kod ini tidak boleh digunakan sekarang.',
  invalid_code: 'Kod jemputan tidak sah. Semak semula 8 aksara itu.',
  household_full: 'Ruang ini sudah penuh. Maksimum 6 orang.',
  too_many_households: 'Anda sudah ada 3 ruang keluarga.',
  not_owner: 'Hanya pemilik ruang boleh buat perkara ini.',
  invalid_credentials: 'Emel atau kata laluan salah.',
  email_taken: 'Emel ini sudah didaftarkan. Cuba log masuk.',
  weak_password: 'Kata laluan terlalu lemah. Guna sekurang-kurangnya 8 aksara.',
  email_not_confirmed: 'Sahkan emel anda dahulu. Semak peti masuk dan folder spam.',
  rate_limited: 'Terlalu banyak cubaan. Tunggu sebentar dan cuba lagi.',
  network: 'Tiada sambungan internet. Semak sambungan dan cuba lagi.',
  not_configured: 'Pembayaran belum disediakan untuk laman ini.',
  not_signed_in: 'Sila log masuk dahulu.',
  storage_full: 'Storan pelayar penuh. Padam beberapa rekod dahulu.',
  unknown: 'Ada masalah. Cuba lagi sebentar.',
};

export const errorMessage = (e: unknown): string => MESSAGES[toAppError(e).code];
