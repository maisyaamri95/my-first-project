import { describe, it, expect } from 'vitest';
import { parseAmount, fmtRM, sumSen, toSen } from './money';
import { dueLabel, dayHeading, shiftMonth, monthsBetween, monthRange, daysLeftInMonth } from './dates';
import { isHistoryLocked } from './premium';
import { toCsv } from './csv';
import { subscriptionIsActive, mergeSubscription, fromStripeSubscription, shouldApplySubscriptionEvent, type SubscriptionRow } from './subscription';
import { summarizeRelief, reliefYear, RELIEF_YEARS } from './taxRelief';

describe('money', () => {
  it('parses Malaysian-style input', () => {
    expect(parseAmount('12.50')).toBe(12.5);
    expect(parseAmount('RM 1,200')).toBe(1200);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('rm8')).toBe(8);
    expect(parseAmount('3.456')).toBe(3.46);
  });
  it('rejects bad input', () => {
    for (const v of ['', '0', '-5', 'abc', '1.2.3', '.', '10000000']) expect(parseAmount(v)).toBeNaN();
  });
  it('sums without float drift', () => {
    expect(sumSen([0.1, 0.2, 0.3])).toBe(60);
    expect(toSen(142.35)).toBe(14235);
    expect(fmtRM(1216.1)).toBe('1,216.10');
  });
});

describe('dates', () => {
  const today = '2026-11-09';
  it('labels due dates', () => {
    expect(dueLabel('2026-11-07', today)).toEqual({ text: 'Lewat 2 hari', tone: 'overdue' });
    expect(dueLabel('2026-11-08', today).text).toBe('Lewat semalam');
    expect(dueLabel('2026-11-09', today)).toEqual({ text: 'Hari ini', tone: 'today' });
    expect(dueLabel('2026-11-10', today).text).toBe('Esok');
    expect(dueLabel('2026-11-12', today).text).toBe('Khamis');
    expect(dueLabel('2026-12-25', today).text).toBe('25 Dis');
    expect(dueLabel('2027-01-05', today).text).toBe('5 Jan 2027');
  });
  it('heads days', () => {
    expect(dayHeading('2026-11-09', today)).toBe('Hari ini · Isnin, 9 Nov');
    expect(dayHeading('2026-11-08', today)).toBe('Semalam · Ahad, 8 Nov');
  });
  it('does month arithmetic across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
    expect(monthRange('2026-12')).toEqual(['2026-12-01', '2027-01-01']);
    expect(daysLeftInMonth('2026-11-09')).toBe(22);
    expect(daysLeftInMonth('2026-02-28')).toBe(1);
  });
});

describe('premium history lock', () => {
  it('free users see 3 months', () => {
    expect(isHistoryLocked('2026-11', '2026-11-09', false)).toBe(false);
    expect(isHistoryLocked('2026-09', '2026-11-09', false)).toBe(false);
    expect(isHistoryLocked('2026-08', '2026-11-09', false)).toBe(true);
    expect(isHistoryLocked('2020-01', '2026-11-09', true)).toBe(false);
  });
});

describe('csv', () => {
  it('escapes and neutralises formulas', () => {
    const out = toCsv([['a,b', 'say "hi"', '=SUM(A1)', 12.5, null]]);
    expect(out).toBe('﻿"a,b","say ""hi""",\'=SUM(A1),12.5,');
  });
});

describe('subscription', () => {
  const now = new Date('2026-11-09T00:00:00Z');
  const row = (p: Partial<SubscriptionRow>): SubscriptionRow => ({
    user_id: 'u', status: 'active', plan: 'monthly', lifetime: false, current_period_end: '2026-12-01T00:00:00Z',
    cancel_at_period_end: false, stripe_customer_id: 'cus', stripe_subscription_id: 'sub', ...p,
  });
  it('decides access', () => {
    expect(subscriptionIsActive(null, now)).toBe(false);
    expect(subscriptionIsActive(row({}), now)).toBe(true);
    expect(subscriptionIsActive(row({ status: 'canceled' }), now)).toBe(false);
    expect(subscriptionIsActive(row({ status: 'past_due' }), now)).toBe(true);
    expect(subscriptionIsActive(row({ current_period_end: '2026-11-07T00:00:00Z' }), now)).toBe(true); // grace
    expect(subscriptionIsActive(row({ current_period_end: '2026-11-01T00:00:00Z' }), now)).toBe(false);
    expect(subscriptionIsActive(row({ status: 'canceled', lifetime: true }), now)).toBe(true);
  });
  it('keeps lifetime when a subscription ends', () => {
    const life = mergeSubscription(null, 'u', { lifetime: true, stripe_customer_id: 'cus' });
    expect(life).toMatchObject({ lifetime: true, status: 'active', plan: 'lifetime' });
    const after = mergeSubscription(life, 'u', { status: 'canceled', plan: 'monthly', stripe_subscription_id: 'sub_old' });
    expect(after).toMatchObject({ lifetime: true, status: 'active', plan: 'lifetime', stripe_subscription_id: 'sub_old' });
  });
  it('ignores late events from an old subscription', () => {
    const cur = { stripe_subscription_id: 'sub_new' };
    expect(shouldApplySubscriptionEvent(cur, 'sub_new', 'canceled')).toBe(true);
    expect(shouldApplySubscriptionEvent(cur, 'sub_old', 'canceled')).toBe(false);
    expect(shouldApplySubscriptionEvent(cur, 'sub_other', 'active')).toBe(true);
    expect(shouldApplySubscriptionEvent(null, 'sub_x', 'incomplete')).toBe(true);
  });
  it('maps Stripe subscriptions (period end on items)', () => {
    const m = fromStripeSubscription({
      id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: true,
      items: { data: [{ current_period_end: 1796083200, price: { id: 'price_Y' } }] },
    }, id => (id === 'price_Y' ? 'yearly' : null));
    expect(m).toEqual({
      status: 'active', plan: 'yearly', current_period_end: '2026-12-01T00:00:00.000Z', cancel_at_period_end: true,
      stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1',
    });
  });
});

describe('tax relief', () => {
  it('caps each category at its limit', () => {
    const def = reliefYear(2026);
    const s = summarizeRelief([
      { category: 'gaya_hidup', amount: 2000 },
      { category: 'gaya_hidup', amount: 900.5 },
      { category: 'perkeso', amount: 120 },
      { category: 'tiada', amount: 50 },
    ], def);
    const gaya = s.rows.find(r => r.category.code === 'gaya_hidup')!;
    expect(gaya).toMatchObject({ claimedSen: 290050, countedSen: 250000, overSen: 40050, remainingSen: 0, count: 2 });
    expect(s.totalCountedSen).toBe(250000 + 12000);
    expect(s.unknownSen).toBe(5000);
  });
  it('has unique codes and falls back to the latest year', () => {
    for (const y of RELIEF_YEARS) expect(new Set(y.categories.map(c => c.code)).size).toBe(y.categories.length);
    expect(reliefYear(1999).year).toBe(2026);
  });
});
