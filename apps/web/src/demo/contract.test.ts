import { describe, expect, it } from 'vitest';

import {
  CONTRACT,
  FILLED_FORM,
  bannerWords,
  checkContract,
  CONTRACT_STATES,
  contractStart,
  daysBetween,
  endsIn,
  endsTitle,
  longDay,
  poCounter,
  readOnlyDate,
  seenLength,
  standingOf,
  statusOf,
} from './contract.ts';

describe('the overdue banner (sc-613)', () => {
  it('reads the board’s sample: due 30 October, seen on 1 November', () => {
    const { invoices, today } = contractStart('overdue');

    expect(bannerWords(standingOf(invoices, today), CONTRACT, 'en-GB')).toBe(
      'Your invoice for US$2,490.00 is 2 days overdue. After Sunday 29 November, Ire Events becomes read-only. Live events will keep running.',
    );
  });

  it('writes the date in CLDR’s order for en-US', () => {
    expect(longDay('2026-11-29', 'en-US')).toBe('Sunday, November 29');
  });

  it('says 1 day overdue in the singular', () => {
    const { invoices, today } = contractStart('overdue_one');

    expect(bannerWords(standingOf(invoices, today), CONTRACT, 'en-GB')).toContain(
      'is 1 day overdue.',
    );
  });

  it('shows the oldest invoice past due, not a sum', () => {
    const { invoices, today } = contractStart('two_overdue');
    const words = bannerWords(standingOf(invoices, today), CONTRACT, 'en-GB');

    expect(words).toContain('US$2,490.00 is 17 days overdue');
    expect(words).toContain('After Sunday 29 November');
  });

  it('puts read-only after day 30, from day 31', () => {
    const due = '2026-10-30';

    expect(readOnlyDate(due)).toBe('2026-11-29');
    expect(daysBetween(due, '2026-11-29')).toBe(30);
    expect(standingOf(contractStart('overdue').invoices, '2026-11-29').kind).toBe('overdue');
    expect(standingOf(contractStart('overdue').invoices, '2026-11-30').kind).toBe('read_only');
  });

  it('shows nothing on the due date itself', () => {
    expect(standingOf(contractStart('overdue').invoices, '2026-10-30').kind).toBe('fine');
  });
});

describe('the end of the term', () => {
  it('draws the inset only in the ending state', () => {
    const shown = CONTRACT_STATES.filter((state) => {
      const { contract, today } = contractStart(state);

      return endsIn(contract, today) != null;
    });

    expect(shown).toEqual(['ending']);
  });

  it('bills each term once', () => {
    const { invoices } = contractStart('two_overdue');
    const terms = invoices.filter((invoice) => invoice.total === CONTRACT.pricePerYear);

    expect(terms.map((invoice) => invoice.issued)).toEqual(['2026-09-30', '2025-09-30']);
    expect(CONTRACT.start).toBe('2026-10-01');
  });

  it('counts the days left in its title', () => {
    expect(endsTitle(30)).toBe('Ends in 30 days');
    expect(endsTitle(1)).toBe('Ends in 1 day');
    expect(endsTitle(0)).toBe('Ends today');
  });
});

describe('an invoice’s status, a shape with a word', () => {
  it('names each', () => {
    const [due] = contractStart('due').invoices;
    const [late] = contractStart('overdue').invoices;
    const [paid] = contractStart('paid').invoices;

    expect(statusOf(due!, '2026-10-20')).toEqual({ shape: 'ring', word: 'Due in 10 days' });
    expect(statusOf(late!, '2026-11-01')).toEqual({ shape: 'pill', word: 'Past due · 2 days' });
    expect(statusOf(paid!, '2026-11-01')).toEqual({ shape: 'tick', word: 'Paid' });
  });
});

describe('the staff contract form’s checks', () => {
  it('passes the filled sample', () => {
    expect(checkContract(FILLED_FORM)).toEqual({});
  });

  it('refuses blanks, an end not after the start and no contact', () => {
    const errors = checkContract({
      ...FILLED_FORM,
      start: '2026-12-01',
      end: '2026-12-01',
      price: '0',
      contacts: [''],
      reason: ' ',
    });

    expect(Object.keys(errors).sort()).toEqual(['contact-0', 'end', 'price', 'reason']);
  });

  it('takes a discount strictly between 0 and 100, with its reason', () => {
    expect(checkContract({ ...FILLED_FORM, discount: '100' }).discount).toBeDefined();
    expect(checkContract({ ...FILLED_FORM, discount: '0' }).discount).toBeDefined();
    expect(checkContract({ ...FILLED_FORM, discount: '12.5' }).discountReason).toBeDefined();
    expect(checkContract({ ...FILLED_FORM, discount: '12.5', discountReason: 'Partner' })).toEqual(
      {},
    );
    expect(checkContract({ ...FILLED_FORM, discountReason: 'Ignored' })).toEqual({});
  });

  it('counts the PO as seen and refuses it over 100', () => {
    expect(seenLength('Ìrè')).toBe(3);
    expect(checkContract({ ...FILLED_FORM, purchaseOrder: 'P'.repeat(100) })).toEqual({});
    expect(checkContract({ ...FILLED_FORM, purchaseOrder: 'P'.repeat(101) }).purchaseOrder).toBe(
      'Shorten the purchase order number to 100 characters or fewer.',
    );
  });

  it('shows the counter from 80 characters', () => {
    expect(poCounter('P'.repeat(79))).toBeNull();
    expect(poCounter('P'.repeat(80))).toEqual({ words: '80 of 100 characters', over: false });
    expect(poCounter('P'.repeat(104))).toEqual({
      words: '104 of 100 characters · 4 too many',
      over: true,
    });
  });

  it('refuses a contact that is not an email address', () => {
    expect(
      checkContract({ ...FILLED_FORM, contacts: ['finance@ire.events', 'finance'] })['contact-1'],
    ).toBeDefined();
  });
});
