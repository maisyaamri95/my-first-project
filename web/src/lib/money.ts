/** Tukar teks pengguna (cth "12.50", "RM 1,200", "12,5") kepada ringgit. NaN jika tidak sah. */
export function parseAmount(input: string): number {
  let v = String(input ?? '').trim().replace(/^rm\s*/i, '').replace(/\s/g, '');
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, '');
  else v = v.replace(',', '.');
  if (v === '' || v === '.' || !/^\d*\.?\d*$/.test(v)) return NaN;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n >= 1e7) return NaN;
  return Math.round(n * 100) / 100;
}

/** Ringgit -> sen (integer) supaya jumlah tidak lari kerana nombor perpuluhan. */
export const toSen = (rm: number): number => Math.round((Number(rm) || 0) * 100);

export const sumSen = (amounts: number[]): number => amounts.reduce((s, a) => s + toSen(a), 0);

/** 1234.5 -> "1,234.50" */
export function fmtRM(rm: number): string {
  return (Math.round(rm * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const fmtSen = (sen: number): string => fmtRM(sen / 100);
