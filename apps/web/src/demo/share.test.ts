import { describe, expect, it } from 'vitest';

import { totals } from './budget.ts';
import { MARGIN } from './budgetSample.ts';
import {
  BLANK_DRAFT,
  LINKS,
  LOCKED_UNTIL,
  LONG_SAMPLE,
  MOST_WRONG,
  PASSPHRASE,
  RECIPIENT_STATES,
  SHARE_PAGES,
  SHARE_STATES,
  SHORT_SAMPLE,
  UPDATED_LINE,
  answerTo,
  clientRows,
  clientTotals,
  deskStart,
  draftProblems,
  ended,
  linkLine,
  sharedView,
  timeOf,
  titleInSentence,
  titleOf,
  visitOf,
} from './share.ts';

const parse = (shown: string): number => Math.round(Number(shown.replace(/[£,]/gu, '')) * 100);
const words = (view: ReturnType<typeof sharedView>): string =>
  [
    view.title,
    view.name,
    view.label,
    view.figure,
    view.sentence,
    ...view.blocks.flatMap((block) => [
      block.head,
      ...block.rows.flatMap((row) => [row.title, row.line, row.value]),
    ]),
  ].join(' | ');

describe('the event’s share links (sc-94, Budget-A-Share)', () => {
  it('says each link’s scope, end, passphrase, opens and maker as the board does', () => {
    expect(LINKS.map((one) => [titleOf(one), linkLine(one), ended(one)])).toEqual([
      [
        'Mr and Mrs Obi’s share',
        'One payer’s share · No end date · Opened 3 times, last on Mon, Nov 2 · Made by Folake Adeyemi',
        false,
      ],
      [
        'Mr and Mrs Bakare’s share',
        'One payer’s share · No end date · Never opened · Made by Folake Adeyemi',
        false,
      ],
      [
        'The whole budget',
        'Ends Sat, Nov 7 · Asks for a passphrase · Opened once, on Fri, Oct 30 · Made by Folake Adeyemi',
        false,
      ],
      ['Flowers', 'One category · Ended Sat, Oct 31 · Opened twice · Made by Folake Adeyemi', true],
    ]);
  });

  it('ends a revoked link at once, and names it inside a sentence', () => {
    const obi = LINKS[0]!;

    expect(ended({ ...obi, revoked: true })).toBe(true);
    expect(titleInSentence(obi)).toBe('Mr and Mrs Obi’s share');
    expect(titleInSentence(LINKS[2]!)).toBe('the whole budget');
  });

  it('refuses at the field before sending: the scope’s choice, a date after today, 8 to 64', () => {
    expect(draftProblems(BLANK_DRAFT)).toEqual({});
    expect(draftProblems({ ...BLANK_DRAFT, scope: 'category' })).toEqual({
      category: 'Choose a category.',
    });
    expect(draftProblems({ ...BLANK_DRAFT, endsOn: '2026-11-03' }).endsOn).toBe(
      'Choose a date after today.',
    );
    expect(draftProblems({ ...BLANK_DRAFT, endsOn: '2026-11-04' })).toEqual({});
    expect(draftProblems({ ...BLANK_DRAFT, passphrase: SHORT_SAMPLE }).passphrase).toBe(
      'Make the passphrase at least 8 characters long, or leave it empty.',
    );
    expect(draftProblems({ ...BLANK_DRAFT, passphrase: LONG_SAMPLE }).passphrase).toBe(
      'Shorten the passphrase to 64 characters or fewer.',
    );
    expect(draftProblems({ ...BLANK_DRAFT, passphrase: '        ' })).toEqual({});
    expect(draftProblems({ ...BLANK_DRAFT, passphrase: 'x'.repeat(64) })).toEqual({});
    expect(draftProblems({ ...BLANK_DRAFT, passphrase: '🌼'.repeat(8) })).toEqual({});
  });

  it('opens each organiser state with what its board draws', () => {
    expect(deskStart('no_links').links).toHaveLength(0);
    expect(deskStart('no_category').problems).toEqual({ category: 'Choose a category.' });
    expect(deskStart('past_date').problems).toEqual({ endsOn: 'Choose a date after today.' });
    expect(Object.keys(deskStart('short_passphrase').problems)).toEqual(['passphrase']);
    expect(Object.keys(deskStart('long_passphrase').problems)).toEqual(['passphrase']);
    expect(deskStart('revoke').asking).toBe('bakare');

    const created = deskStart('created');
    expect(created.links.map(titleOf)[0]).toBe('Aunt Funmi’s share');
    expect(created.created).toBe(created.links[0]?.id);
  });
});

describe('the page a link opens, signed out (sc-94, sc-1300)', () => {
  it('says who shared it and when, on the 24-hour clock', () => {
    expect(UPDATED_LINE).toBe('Shared by Ire Events · Updated Tue, Nov 3 at 09:41');
    expect(timeOf(LOCKED_UNTIL)).toBe('14:47');
  });

  it('gives Mr and Mrs Obi their share, what is paid and still to come, and what it covers', () => {
    const view = sharedView('payer');

    expect([view.title, view.name, view.label, view.figure, view.sentence]).toEqual([
      'Your share of Adaeze & Tunde’s wedding',
      'Mr and Mrs Obi',
      'Your share',
      '£10,620 to £12,285',
      'Between £10,620 and £12,285, depending on how many of the 37 people still to reply say yes.',
    ]);
    expect(view.blocks.map((block) => block.head)).toEqual([null, 'What it covers']);
    expect(view.blocks[0]?.rows.map((row) => [row.title, row.value])).toEqual([
      ['Paid', '£3,150.00'],
      ['Still to come', '£7,470.00 to £9,135.00'],
    ]);
    expect(view.blocks[1]?.rows.map((row) => `${row.title} ${row.line} ${row.value}`)).toEqual([
      'Room hire all of it £6,300.00',
      'Dinner half £3,264.00 to £4,522.00',
      'Drinks package half £1,056.00 to £1,463.00',
    ]);
  });

  it('gives the whole budget per head, paid, the next payment and its costs in everyday words', () => {
    const view = sharedView('whole');
    const [first, made] = view.blocks;

    expect(view.figure).toBe('£19,730 to £23,060');
    expect(view.sentence).toBe(
      'Between £19,730 and £23,060, depending on how many of the 37 people still to reply say yes.',
    );
    expect(first?.rows.map((row) => [row.title, row.line, row.value])).toEqual([
      ['Per head, settled', '96 coming', '£205.52'],
      ['Per head, if all come', '133 coming', '£173.38'],
      ['Paid', null, '£4,310.00'],
      ['Still to pay', 'Next: £840.00 to Bloom & Co, due Fri, Oct 30', '£13,090.00'],
    ]);
    expect(made?.head).toBe('What it is made of');
    expect(made?.rows.slice(0, 6).map((row) => [row.title, row.line, row.value])).toEqual([
      ['Dinner', 'Catering · for each guest who says yes', '£6,528.00 to £9,044.00'],
      ['Drinks package', 'Catering · for each guest who says yes', '£2,112.00 to £2,926.00'],
      ['Room hire', 'Venue · for each of the 3 days', '£6,300.00'],
      ['Bridal flowers', 'Flowers', '£850.00'],
      ['Centrepieces', 'Flowers · no seating plan yet', 'Nothing yet'],
      ['Aisle arch', 'Flowers', 'Not priced yet'],
    ]);

    const low = (value: string) => (value.startsWith('£') ? parse(value.split(' to ')[0]!) : 0);
    expect(made?.rows.reduce((sum, row) => sum + low(row.value), 0)).toBe(totals().settled);
  });

  it('gives one category with its own payments', () => {
    const view = sharedView('category');

    expect([view.title, view.name, view.label, view.figure, view.sentence]).toEqual([
      'Flowers for Adaeze & Tunde’s wedding',
      'Flowers',
      'Flowers will cost',
      '£850',
      'Replies do not change this. 1 cost not priced yet.',
    ]);
    expect(view.blocks[1]?.rows.map((row) => [row.title, row.line, row.value])).toEqual([
      ['Paid', null, '£360.00'],
      ['Still to pay', 'Next: £840.00, due Fri, Oct 30', '£840.00'],
    ]);
  });

  it('shows client figures only once a line is marked up, and no payments at all', () => {
    const view = sharedView('whole', true);
    const all = words(view);

    expect(view.figure).toBe('£25,296 to £29,292');
    expect(all).toContain('£263.50');
    expect(all).toContain('£220.24');
    for (const absent of ['Paid', 'Still to pay', 'Next:', '£19,730', '£6,528.00', '£4,310.00'])
      expect(all).not.toContain(absent);
    expect(clientTotals()).toEqual([...MARGIN.client]);
    expect(clientRows().at(-1)).toEqual({
      title: 'Planning fee',
      line: null,
      value: '£3,000.00',
    });
  });

  it('opens each address as its state names, and answers a passphrase until it locks', () => {
    expect(visitOf('payer', null)).toEqual({ page: 'shown', scope: 'payer', marked: false });
    expect(visitOf('whole', 'marked_up')).toEqual({ page: 'shown', scope: 'whole', marked: true });
    expect(visitOf('whole', 'gone')).toEqual({ page: 'gone' });
    expect(visitOf('nothing', null)).toEqual({ page: 'gone' });
    expect(visitOf('whole', 'too_many_attempts')).toMatchObject({ page: 'gate', answer: 'locked' });

    expect(answerTo(PASSPHRASE, 0)).toBe('open');
    expect(answerTo('marigold', MOST_WRONG - 1)).toBe('wrong');
    expect(answerTo(PASSPHRASE, MOST_WRONG)).toBe('locked');
  });

  it('is linked from the demo home: every organiser state, every recipient state, the passphrase named', () => {
    const [desk, signedOut] = SHARE_PAGES;

    expect(
      desk?.states.map((one) => new URL(one.to, 'http://x').searchParams.get('state')),
    ).toEqual([...SHARE_STATES]);
    expect(
      signedOut?.states.map((one) => new URL(one.to, 'http://x').searchParams.get('state')),
    ).toEqual([...RECIPIENT_STATES]);
    expect(signedOut?.name).toContain('402');
    expect(signedOut?.states.find((one) => one.to.endsWith('=passphrase'))?.name).toContain(
      PASSPHRASE,
    );
  });
});
