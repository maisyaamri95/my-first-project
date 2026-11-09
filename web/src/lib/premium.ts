import { FREE_HISTORY_MONTHS } from '../config';
import { monthOf, monthsBetween } from './dates';

/** Pengguna percuma hanya boleh buka FREE_HISTORY_MONTHS bulan terkini. */
export function isHistoryLocked(month: string, today: string, premium: boolean): boolean {
  if (premium) return false;
  return monthsBetween(month, monthOf(today)) >= FREE_HISTORY_MONTHS;
}
