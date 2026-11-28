import { type DueNow, type DueNowRow, type ScheduledPayment } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { dueRowState, dueSettled, monthDay } from './dueNow.ts';

const owed: ScheduledPayment = {
  id: 'p1',
  description: 'Deposit',
  amount: '840.00',
  dueOn: '2026-11-04',
  overdue: false,
  addedAsPaid: false,
  paid: null,
  cancelled: null,
};
const paid = {
  ...owed,
  paid: {
    amount: '840.00',
    paidOn: '2026-11-02',
    reference: null,
    at: '2026-11-02T10:00:00+00:00',
    by: { id: 'u2', name: 'Julien Moreau' },
    difference: '0.00',
  },
};

function row(paymentId: string, payment: ScheduledPayment | null): DueNowRow {
  return {
    paymentId,
    eventId: 'e1',
    vendor: 'Savour Kitchen',
    description: 'Deposit',
    amount: '840.00',
    payment,
  };
}

function sheet(rows: DueNowRow[]): DueNow {
  return { sentOn: '2026-11-01', readOnly: false, events: [], rows };
}

describe('Due now rows', () => {
  it('reads each row as it is now, and one paid on this sheet as marked', () => {
    expect(dueRowState(row('p1', owed), new Set())).toBe('owed');
    expect(dueRowState(row('p1', paid), new Set())).toBe('paid');
    expect(dueRowState(row('p1', paid), new Set(['p1']))).toBe('marked');
    expect(
      dueRowState(row('p1', { ...owed, cancelled: { at: '', by: null, reason: null } }), new Set()),
    ).toBe('cancelled');
    expect(dueRowState(row('p1', null), new Set(['p1']))).toBe('removed');
  });

  it('an Undo that leaves the row owed is no longer marked', () => {
    expect(dueRowState(row('p1', owed), new Set(['p1']))).toBe('owed');
  });

  it('is settled once nothing is owed, the rows marked here counting as paid', () => {
    expect(dueSettled(sheet([row('p1', paid), row('p2', null)]), new Set(['p1']))).toBe(true);
    expect(dueSettled(sheet([row('p1', paid), row('p2', owed)]), new Set())).toBe(false);
  });

  it('gives a day as its month and day', () => {
    expect(monthDay('2026-11-01', 'en-US')).toBe('Nov 1');
  });
});
