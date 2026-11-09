export const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
export const BLN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
export const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

const pad = (n: number) => String(n).padStart(2, '0');

export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const todayStr = (): string => ymd(new Date());
export const monthOf = (date: string): string => date.slice(0, 7);

/** Bilangan hari dari b ke a (a - b). */
export const dayDiff = (a: string, b: string): number => Math.round((parseYmd(a).getTime() - parseYmd(b).getTime()) / 86400000);

/** "2026-11" + 1 -> "2026-12" */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Berapa bulan dari `from` ke `to` ("2026-08" -> "2026-11" = 3). */
export function monthsBetween(from: string, to: string): number {
  const [y1, m1] = from.split('-').map(Number);
  const [y2, m2] = to.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Julat tarikh untuk satu bulan: [hari pertama, hari pertama bulan berikutnya). */
export function monthRange(month: string): [string, string] {
  return [`${month}-01`, `${shiftMonth(month, 1)}-01`];
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${BULAN[m - 1]} ${y}`;
}

export function longDate(d: Date): string {
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function shortDate(date: string): string {
  const d = parseYmd(date);
  return `${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
}

export interface DueLabel { text: string; tone: 'overdue' | 'today' | 'normal' }

export function dueLabel(due: string, today: string): DueLabel {
  const diff = dayDiff(due, today);
  if (diff < 0) return { text: diff === -1 ? 'Lewat semalam' : `Lewat ${-diff} hari`, tone: 'overdue' };
  if (diff === 0) return { text: 'Hari ini', tone: 'today' };
  if (diff === 1) return { text: 'Esok', tone: 'normal' };
  const d = parseYmd(due);
  if (diff < 7) return { text: HARI[d.getDay()], tone: 'normal' };
  const sameYear = d.getFullYear() === parseYmd(today).getFullYear();
  return { text: `${d.getDate()} ${BLN[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`, tone: 'normal' };
}

export function dayHeading(date: string, today: string): string {
  const diff = dayDiff(date, today);
  const d = parseYmd(date);
  const full = `${HARI[d.getDay()]}, ${d.getDate()} ${BLN[d.getMonth()]}`;
  if (diff === 0) return `Hari ini · ${full}`;
  if (diff === -1) return `Semalam · ${full}`;
  return full;
}

/** Hari yang tinggal dalam bulan, termasuk hari ini. */
export function daysLeftInMonth(today: string): number {
  const d = parseYmd(today);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return dim - d.getDate() + 1;
}
