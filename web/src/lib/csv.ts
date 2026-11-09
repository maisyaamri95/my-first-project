/** Bina CSV yang dibuka dengan betul dalam Excel (UTF-8 BOM) dan selamat daripada formula injection. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined): string => {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    let s = v;
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}
