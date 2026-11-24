import { describe, expect, it } from 'vitest';

import {
  PACKS,
  SAMPLE_LEDGER,
  WAIT_MS,
  billingStateOf,
  boughtSaid,
  buyingLine,
  expiry,
  methodLine,
  money,
  slowIn,
  waitLook,
  withBought,
} from './billing.ts';

describe('Plan and billing checkout rules (sc-3933)', () => {
  it('prices each pack in the billing account’s currency through Intl', () => {
    const first = PACKS[0];
    expect(first?.credits).toBe(1000);
    expect(money(first?.price.USD ?? 0, 'USD', 'en-GB')).toBe('US$10');
    expect(money(first?.price.EUR ?? 0, 'EUR', 'en-GB')).toBe('€11');
    expect(money(first?.price.GBP ?? 0, 'GBP', 'en-GB')).toBe('£9');
  });

  it('turns a wait into the 2-minute line 2 minutes after the payment, not after a reload', () => {
    const paidAt = 0;
    const reloadedAt = 90_000;

    expect(waitLook(paidAt, reloadedAt)).toBe('waiting');
    expect(slowIn(paidAt, reloadedAt)).toBe(30_000);
    expect(waitLook(paidAt, reloadedAt + 30_000)).toBe('slow');
    expect(waitLook(paidAt, WAIT_MS - 1)).toBe('waiting');
  });

  it('shows only what the provider returns of a payment method', () => {
    expect(methodLine({ kind: 'card', brand: 'visa', last4: '5556', month: 3, year: 2030 })).toBe(
      'Visa ending 5556 · Expires 03/2030',
    );
    expect(
      methodLine({ kind: 'card', brand: 'unknown', last4: '4242', month: 8, year: 2028 }),
    ).toBe('Card ending 4242 · Expires 08/2028');
    expect(methodLine({ kind: 'paypal' })).toBe('PayPal');
    expect(methodLine({ kind: 'apple_pay' })).toBe('Apple Pay');
    expect(methodLine({ kind: 'google_pay' })).toBe('Google Pay');
    expect(methodLine({ kind: 'other' })).toBeNull();
  });

  it('writes the expiry as two-digit month and four-digit year in every language', () => {
    expect(expiry(3, 2030)).toBe('03/2030');
    expect(expiry(11, 2029)).toBe('11/2029');
  });

  it('puts a bought pack on top and keeps the newest 10', () => {
    const after = withBought(SAMPLE_LEDGER, {
      id: 'new',
      day: '2026-11-24',
      words: 'Credits bought',
      credits: 1000,
    });

    expect(after).toHaveLength(10);
    expect(after[0]?.id).toBe('new');
    expect(after[1]?.id).toBe(SAMPLE_LEDGER[0]?.id);
  });

  it('says the buying line and the bought line in the board’s words', () => {
    expect(buyingLine(1000, 'en')).toBe('Buying 1,000 credits…');
    expect(buyingLine(1, 'en')).toBe('Buying 1 credit…');
    expect(boughtSaid(1000, 6920, 'en')).toBe('Credits bought +1,000. 6,920 credits.');
  });

  it('opens at rest for a state it does not know', () => {
    expect(billingStateOf('buying_two')).toBe('buying_two');
    expect(billingStateOf('nonsense')).toBe('none');
    expect(billingStateOf(null)).toBe('none');
  });
});
