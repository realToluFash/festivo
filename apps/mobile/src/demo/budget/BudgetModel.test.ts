import { describe, expect, it } from 'vitest';

import { SAMPLE_GUESTS } from '../events/GuestCounts.ts';
import { TO_FIGURES } from '../messages/MessagesSample.ts';
import { sampleOnEvent } from '../people/PeopleSample.ts';
import { BUDGET_BOARDS } from './BudgetBoards.ts';
import {
  AS_OF,
  BUDGET_DEMO_STATES,
  BUDGET_STATES,
  DUE_NOW_STATES,
  PAYERS_STATES,
  START_LEDGER,
  amountOf,
  budgetStateOf,
  canMark,
  categoryState,
  ceilingState,
  checkAmount,
  coverAmount,
  dateTooLate,
  days,
  dueNowSettled,
  ledgerFor,
  money,
  nextPayment,
  openedAt,
  owed,
  payerPaid,
  payersOf,
  perHeadOf,
  planOf,
  reduce,
  referenceTooLong,
  shareOf,
  startOf,
  stillToCome,
  totalsOf,
  whole,
  LIVE_CHANGE,
} from './BudgetModel.ts';
import {
  CEILINGS,
  GUESTS,
  HEADS_IF_ALL_COME,
  LEAD,
  LINES,
  PAYERS,
  PAYMENTS,
  REMOVED_PAYER,
  STILL_TO_ANSWER,
  VENDORS,
} from './BudgetSample.ts';
import { W, say } from './BudgetWords.ts';

const READER = 'Folake Adeyemi';

describe('the sample is the wedding Guests A and Messaging B count', () => {
  it('has 142 invited and 96 coming, as Messages’ To and Events’ counts say', () => {
    const invited = GUESTS.coming + GUESTS.notComing + STILL_TO_ANSWER;

    expect(invited).toBe(GUESTS.invited);
    expect(GUESTS.invited).toBe(TO_FIGURES.all.count);
    expect(GUESTS.coming).toBe(TO_FIGURES.coming.count);
    expect(SAMPLE_GUESTS['evt-wed-4']).toMatchObject({ invited: 142, coming: 96 });
  });

  it('has 37 still to answer, so 133 heads if all come', () => {
    expect(STILL_TO_ANSWER).toBe(37);
    expect(HEADS_IF_ALL_COME).toBe(133);
  });
});

describe('the costs add up exactly to the total', () => {
  it('the cost rows, in pence, sum to the range the card rounds', () => {
    const rows = LINES.map(amountOf).flatMap((amount) =>
      amount.kind === 'priced' ? [amount] : [],
    );
    const settled = rows.reduce((sum, row) => sum + row.settled, 0);
    const ifAll = rows.reduce((sum, row) => sum + row.ifAll, 0);

    expect(settled).toBe(1973000);
    expect(ifAll).toBe(2306000);
    expect(totalsOf()).toEqual({ settled, ifAll, notPriced: 2 });
    expect(settled % 1).toBe(0);
  });

  it('shows each row at the minor unit and only the card whole', () => {
    expect(money(652800)).toBe('£6,528.00');
    expect(money(84000)).toBe('£840.00');
    expect(whole(1973000)).toBe('£19,730');
    expect(whole(2306000)).toBe('£23,060');
  });

  it('keeps Not priced and Nothing yet apart and out of the total', () => {
    const kinds = Object.fromEntries(LINES.map((line) => [line.key, amountOf(line).kind]));

    expect(kinds).toMatchObject({ arch: 'notPriced', shuttle: 'notPriced', centre: 'nothingYet' });
  });

  it('works per head to the penny, the card whole', () => {
    const head = perHeadOf();

    expect(money(head.settled)).toBe('£205.52');
    expect(money(head.ifAll)).toBe('£173.38');
    expect(whole(head.settled)).toBe('£206');
    expect(whole(head.ifAll)).toBe('£173');
  });
});

describe('a live change: Dinner from £68.00 to £70.00 a head (sc-93, 7 Nov)', () => {
  const changed = reduce(startOf('live_update', REMOVED_PAYER), { type: 'liveChange', words: 'x' });

  it('arrives after the page opens, and washes what it moved', () => {
    expect(startOf('live_update', REMOVED_PAYER).lines).toBe(LINES);
    expect(changed.lines.find((line) => line.key === LIVE_CHANGE.line)?.rate).toBe(7000);
    expect(changed).toMatchObject({ wash: true, liveLine: true, showLive: true });
    expect(reduce(changed, { type: 'washed' }).wash).toBe(false);
  });

  it('moves the range, per head and the rows, which still add up exactly', () => {
    const rows = changed.lines.map(amountOf).flatMap((a) => (a.kind === 'priced' ? [a] : []));
    const totals = totalsOf(changed.lines);
    const head = perHeadOf(totals);

    expect(rows.reduce((sum, row) => sum + row.settled, 0)).toBe(totals.settled);
    expect(rows.reduce((sum, row) => sum + row.ifAll, 0)).toBe(totals.ifAll);
    expect([whole(totals.settled), whole(totals.ifAll)]).toEqual(['£19,922', '£23,326']);
    expect([money(head.settled), money(head.ifAll)]).toEqual(['£207.52', '£175.38']);
    expect(money(totals.settled - totalsOf().settled)).toBe('£192.00');
    expect(say.rateChanged(LEAD, 'Dinner', '£70.00 a head', '£192.00', true)).toBe(
      'Priya Shah changed Dinner to £70.00 a head, so the settled total went up by £192.00.',
    );
    expect(sampleOnEvent().find((one) => one.role === 'Lead')?.name).toBe(LEAD);
    expect(categoryState('Catering', changed.lines)).toBe('close');
    const payers = payersOf(changed.lines);
    expect(payers.has.settled + payers.noPayer).toBe(totals.settled);
    expect(payers.has.ifAll + payers.noPayer).toBe(totals.ifAll);
  });
});

describe('the ceiling reads the first match: Over, Over if all come, Close, Within', () => {
  it('reads the sample’s three', () => {
    const totals = totalsOf();

    expect(ceilingState(CEILINGS.whole, totals.settled, totals.ifAll)).toBe('overIf');
    expect(categoryState('Catering')).toBe('close');
    expect(categoryState('Flowers')).toBe('within');
    expect(categoryState('Venue')).toBeNull();
  });

  it('follows sc-90’s worked example at £20,000', () => {
    expect(ceilingState(2000000, 1000000, 1799999)).toBe('within');
    expect(ceilingState(2000000, 1000000, 1800000)).toBe('close');
    expect(ceilingState(2000000, 1900000, 2000001)).toBe('overIf');
    expect(ceilingState(2000000, 2000001, 2100000)).toBe('over');
    expect(ceilingState(0, 0, 0)).toBe('close');
  });

  it('names each state in a word', () => {
    expect(['within', 'close', 'overIf', 'over'].map((state) => say.state(state as never))).toEqual(
      ['Within', 'Close', 'Over if all come', 'Over'],
    );
  });
});

describe('payments: Due next, Against plan and the card’s one step', () => {
  it('has the four figures the boards draw', () => {
    expect(planOf(START_LEDGER)).toEqual({
      planned: 1973000,
      committed: 1890000,
      paid: 431000,
      paidCount: 3,
      stillToPay: 1309000,
      scheduledCount: 5,
    });
  });

  it('schedules each quote in full but Savour Kitchen’s £1,500', () => {
    const scheduled = (vendor: keyof typeof VENDORS) =>
      PAYMENTS.filter((payment) => payment.vendor === vendor).reduce((sum, p) => sum + p.amount, 0);

    expect(VENDORS.savour.quote - scheduled('savour')).toBe(150000);
    expect(scheduled('landmark')).toBe(VENDORS.landmark.quote);
    expect(scheduled('lens')).toBe(VENDORS.lens.quote);
    expect(scheduled('bloom')).toBe(VENDORS.bloom.quote);
  });

  it('steps on the overdue balance first, then the soonest due', () => {
    expect(nextPayment(START_LEDGER)?.id).toBe('bloom-balance');
    expect(nextPayment(ledgerFor('marked_paid'))?.id).toBe('bloom-balance');
    const marked = startOf('marked_paid', REMOVED_PAYER);
    expect(nextPayment(marked.ledger)?.id).toBe('savour-deposit');
    expect(nextPayment(ledgerFor('nothing_due'))).toBeNull();
  });

  it('dates rows in the reader’s locale, en-US as the boards show', () => {
    expect(days.short('2026-10-30')).toBe('Fri, Oct 30');
    expect(days.long('2026-11-03')).toBe('Tuesday, November 3');
    expect(days.field('2026-11-03')).toBe('Tue, Nov 3, 2026');
    expect(openedAt('2026-11-02T21:14:00Z')).toEqual({ day: 'Monday, Nov 2', time: '21:14' });
    expect(say.asOf(AS_OF.time, AS_OF.minutes)).toBe(
      'No connection. Figures as of 09:32, 9 minutes ago.',
    );
  });
});

describe('Mark paid (sc-88): the form, sending, marked with Undo, refused', () => {
  const marked = (m: ReturnType<typeof startOf>) =>
    reduce(reduce(m, { type: 'sendMark', amount: 84000, on: '2026-11-03' }), {
      type: 'marked',
      amount: 84000,
      reader: READER,
      words: say.markedPaid('£840.00', 'Tuesday, November 3'),
    });

  it('marks the card’s payment and keeps its row with Undo', () => {
    const open = startOf('mark_paid_open', REMOVED_PAYER);
    const done = marked(open);

    expect(open.form).toMatchObject({ id: 'bloom-balance', phase: 'open' });
    expect(done.form).toBeNull();
    expect(done.marked).toEqual(['bloom-balance']);
    expect(planOf(done.ledger)).toMatchObject({ paid: 515000, stillToPay: 1225000 });
    expect(done.told?.words).toBe('Marked paid: £840.00 on Tuesday, November 3.');
  });

  it('puts it back as due, overdue again, on Undo', () => {
    const back = reduce(marked(startOf('mark_paid_open', REMOVED_PAYER)), {
      type: 'undo',
      id: 'bloom-balance',
      words: say.unmarked('Bloom & Co'),
    });

    expect(back.marked).toEqual([]);
    expect(nextPayment(back.ledger)?.id).toBe('bloom-balance');
    expect(planOf(back.ledger)).toEqual(planOf(START_LEDGER));
  });

  it('lets the row go once the tab is left', () => {
    const left = reduce(startOf('marked_paid', REMOVED_PAYER), { type: 'leave' });

    expect(left.marked).toEqual([]);
    expect(owed(left.ledger).map((p) => p.id)).not.toContain('bloom-balance');
  });

  it('shows the list as it now stands behind a refusal', () => {
    const paid = startOf('refused_paid', REMOVED_PAYER);
    const cancelled = startOf('refused_cancelled', REMOVED_PAYER);

    expect(paid.form).toMatchObject({ phase: 'refused', refusal: 'paid' });
    expect(owed(paid.ledger).map((p) => p.id)).not.toContain('bloom-balance');
    expect(planOf(paid.ledger).paid).toBe(515000);
    expect(cancelled.form?.refusal).toBe('cancelled');
    expect(planOf(cancelled.ledger)).toMatchObject({ paid: 431000, stillToPay: 1225000 });
  });

  it('dates the payment today, or an earlier day from the calendar, never later', () => {
    const earlier = startOf('mark_paid_earlier', REMOVED_PAYER);
    const done = reduce(reduce(earlier, { type: 'sendMark', amount: 84000, on: '2026-11-02' }), {
      type: 'marked',
      amount: 84000,
      reader: READER,
      words: 'x',
    });

    expect(startOf('mark_paid_open', REMOVED_PAYER).form?.on).toBe('2026-11-03');
    expect(earlier.form?.on).toBe('2026-11-02');
    expect(done.ledger.paid['bloom-balance']).toMatchObject({ on: '2026-11-02', amount: 84000 });
    expect(['2026-11-02', '2026-11-03', '2026-11-04'].map(dateTooLate)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('checks the amount and the reference before sending', () => {
    expect(checkAmount('840.00')).toEqual({ ok: true, pence: 84000 });
    expect(checkAmount('1,250.5')).toEqual({ ok: true, pence: 125050 });
    for (const wrong of ['', '0', '0.00', '-5', 'abc', '840.005'])
      expect(checkAmount(wrong).ok).toBe(false);
    expect(referenceTooLong('x'.repeat(100))).toBe(false);
    expect(referenceTooLong(` ${'x'.repeat(100)} `)).toBe(false);
    expect(referenceTooLong('x'.repeat(101))).toBe(true);
  });

  it('hides Mark paid offline, while reconnecting and after losing vendors', () => {
    expect(canMark(startOf('populated', REMOVED_PAYER))).toBe(true);
    for (const state of ['not_live', 'reconnecting', 'never_loaded', 'read_only'] as const)
      expect(canMark(startOf(state, REMOVED_PAYER))).toBe(false);
    expect(reduce(startOf('reconnecting', REMOVED_PAYER), { type: 'reconnected' }).link).toBe(
      'live',
    );
  });
});

describe('Due now (sc-1331): one tap each, no total', () => {
  it('marks a row with sc-88’s defaults and takes it back on Undo', () => {
    const open = startOf('due_now', REMOVED_PAYER);
    const paid = reduce(open, {
      type: 'duePaid',
      id: 'savour-deposit',
      reader: READER,
      words: 'x',
    });

    expect(paid.dueNow?.marked).toEqual(['savour-deposit']);
    expect(paid.ledger.paid['savour-deposit']).toMatchObject({ amount: 450000, on: '2026-11-03' });
    const undone = reduce(paid, { type: 'dueUndo', id: 'savour-deposit', words: 'y' });
    expect(undone.dueNow?.marked).toEqual([]);
    expect(undone.ledger).toEqual(open.ledger);
  });

  it('opens Paid a different amount in the same sheet and returns to it', () => {
    const form = reduce(startOf('due_now', REMOVED_PAYER), {
      type: 'openMark',
      id: 'bloom-balance',
      from: 'dueNow',
    });
    const done = reduce(reduce(form, { type: 'sendMark', amount: 90000, on: '2026-11-03' }), {
      type: 'marked',
      amount: 90000,
      reader: READER,
      words: 'z',
    });

    expect(done.dueNow?.marked).toEqual(['bloom-balance']);
    expect(done.marked).toEqual([]);
    expect(done.ledger.paid['bloom-balance']?.amount).toBe(90000);
  });

  it('opens from Everything due on what is still owed, with no reminder line', () => {
    const m = startOf('populated', REMOVED_PAYER);
    const sheet = reduce(m, { type: 'openDueNow', ids: owed(m.ledger).map((p) => p.id) }).dueNow;

    expect(sheet?.ids).toEqual([
      'bloom-balance',
      'savour-deposit',
      'landmark-balance',
      'savour-second',
      'lens-balance',
    ]);
    expect(sheet?.fromReminder).toBe(false);
  });

  it('heads a sheet whose every row changed with Nothing left to pay, the rows kept', () => {
    const changed = startOf('due_changed', REMOVED_PAYER);
    const open = startOf('due_now', REMOVED_PAYER);

    expect(changed.dueNow != null && dueNowSettled(changed.dueNow, changed.ledger)).toBe(true);
    expect(changed.dueNow?.ids).toEqual(['bloom-balance', 'savour-deposit']);
    expect(open.dueNow != null && dueNowSettled(open.dueNow, open.ledger)).toBe(false);
    const done = startOf('due_done', REMOVED_PAYER);
    expect(done.dueNow != null && dueNowSettled(done.dueNow, done.ledger)).toBe(true);
    expect(done.dueNow?.ids).toEqual(['bloom-balance', 'savour-deposit']);
    expect(W.nothingLeftHead).toBe('Nothing left to pay.');
  });

  it('reads the payments as they are now', () => {
    expect(ledgerFor('due_changed').paid['bloom-balance']?.by).toBe('Julien Moreau');
    expect(ledgerFor('due_changed').cancelled).toEqual(['savour-deposit']);
    expect(owed(ledgerFor('due_done')).map((p) => p.id)).not.toContain('savour-deposit');
    expect(startOf('due_refused', REMOVED_PAYER).dueNow?.refused).toEqual(['savour-deposit']);
    expect(startOf('due_read_only', REMOVED_PAYER).dueNow?.readOnly).toBe(true);
  });
});

describe('Who is paying (sc-30200): every share adds up', () => {
  it('splits the range between the payers and no payer yet', () => {
    const totals = totalsOf();
    const payers = payersOf();

    expect(payers.has).toEqual({ settled: 1883000, ifAll: 2216000 });
    expect(payers.noPayer).toBe(90000);
    expect(payers.noPayerCosts).toBe(4);
    expect(payers.has.settled + payers.noPayer).toBe(totals.settled);
    expect(payers.has.ifAll + payers.noPayer).toBe(totals.ifAll);
  });

  it('gives each payer the boards’ share, paid and still to come', () => {
    const rows = PAYERS.map((payer) => {
      const share = shareOf(payer);
      const paid = payerPaid(START_LEDGER, payer.key);
      return [payer.key, share.settled, share.ifAll, paid, stillToCome(share, paid).settled];
    });

    expect(rows).toEqual([
      ['couple', 325000, 325000, 116000, 209000],
      ['obi', 1062000, 1228500, 315000, 747000],
      ['bakare', 432000, 598500, 0, 432000],
      ['funmi', 64000, 64000, 0, 64000],
    ]);
    expect(coverAmount('dinner', 0.5)).toEqual({ settled: 326400, ifAll: 452200 });
  });

  it('sends: busy, then a link, and never sends offline', () => {
    const page = startOf('payer_never_sent', REMOVED_PAYER);
    const busy = reduce(page, { type: 'send', key: 'couple' });
    const sent = reduce(busy, { type: 'linkMade', key: 'couple' });

    expect(busy.sending).toBe('couple');
    expect(sent.links.couple).toBe('sent');
    expect(startOf('offline', REMOVED_PAYER).link).toBe('offline');
    expect(startOf('send_failed', REMOVED_PAYER).failed).toBe('couple');
    expect(startOf('payer_removed', REMOVED_PAYER).removed).toBe(REMOVED_PAYER);
  });
});

describe('every state the spec names has a link on the demo home', () => {
  it('lists the app’s states, and only those', () => {
    expect(BUDGET_DEMO_STATES).toHaveLength(
      BUDGET_STATES.length + PAYERS_STATES.length + DUE_NOW_STATES.length,
    );
    expect(BUDGET_BOARDS.map((board) => board.state)).toEqual([...BUDGET_DEMO_STATES]);
    for (const board of BUDGET_BOARDS) {
      expect(board.href).toContain(`/demo/events/evt-wed-4?area=budget&state=${board.state}`);
      expect(budgetStateOf(board.state)).toBe(board.state);
    }
    expect(budgetStateOf('populated ')).toBeNull();
  });

  it('writes no time on a 12-hour clock and no em dash', () => {
    const words = [
      ...Object.values(W).flatMap((word) => (typeof word === 'string' ? [word] : [])),
      ...BUDGET_BOARDS.flatMap((board) => [board.title, board.what]),
    ];

    for (const word of words) {
      expect(word).not.toMatch(/\b(AM|PM)\b|—/u);
    }
  });
});
