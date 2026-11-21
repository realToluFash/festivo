import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../i18n/index.ts';
import { toMinor } from '../routes/app/events/payersArea.ts';
import { PAYMENTS } from './budget.ts';
import { PAYERS as SAMPLE } from './budgetSample.ts';
import {
  PAYERS_PAGES,
  PAYERS_STATES,
  SAMPLE_BOOK,
  applyChoice,
  bookSource,
  served,
  startOf,
} from './payers.ts';

const t = i18next.getFixedT('en');
const start = (state: string, asked: string | null = null) => startOf(state, asked, t, 'en-GB');
const minor = (amount: string): number => toMinor(amount, 'GBP');
const pair = (range: { confirmed: string; potential: string }) => [
  minor(range.confirmed),
  minor(range.potential),
];
const read = (state: string) => {
  const demo = start(state);

  return served(demo.book, demo.payments, demo.paidShown);
};
const payer = (payers: ReturnType<typeof read>, id: string) => {
  const found = payers.payers.find((one) => one.id === id);
  if (found == null) throw new Error(id);

  return found;
};

describe('the demo’s stand-in for the server’s Who is paying (sc-91)', () => {
  it('gives each payer the share the spec’s sample has, and the paid', () => {
    const payers = served(SAMPLE_BOOK, PAYMENTS, true);

    for (const one of SAMPLE) {
      expect(pair(payer(payers, one.id).share)).toEqual(one.share);
      expect(minor(payer(payers, one.id).paid ?? '')).toBe(one.paid);
    }
  });

  it('counts each cost with a payer at its own amount, so with No payer yet it is the range', () => {
    const payers = served(SAMPLE_BOOK, PAYMENTS, true);

    expect(pair(payers.hasPayer)).toEqual([1883000, 2216000]);
    expect(pair(payers.noPayer)).toEqual([90000, 90000]);
    expect(payers.noPayer.costs).toBe(4);
    expect(minor(payers.hasPayer.confirmed) + minor(payers.noPayer.confirmed)).toBe(
      minor(payers.total.confirmed),
    );
  });

  it('names the DJ next: the first cost with no payer that costs something', () => {
    expect(served(SAMPLE_BOOK, PAYMENTS, true).next?.label).toBe('DJ');
    const dj = applyChoice(SAMPLE_BOOK, ['dj'], { kind: 'one', payerId: 'couple' });
    expect(served(dj, PAYMENTS, true).next?.label).toBe('Centrepieces');
  });

  it('adds up each cost’s parts to the cost exactly, with the product’s rounding', () => {
    const thirds = applyChoice(SAMPLE_BOOK, ['drinks'], {
      kind: 'percent',
      shares: [
        { payerId: 'couple', value: 3333 },
        { payerId: 'obi', value: 3333 },
        { payerId: 'bakare', value: 3334 },
      ],
    });
    const payers = served(thirds, PAYMENTS, true);

    for (const line of payers.lines) {
      const parts = payers.payers.flatMap((one) =>
        one.covers.filter((cover) => cover.lineId === line.id).map((cover) => pair(cover.part)),
      );
      if (line.split == null) continue;
      expect(parts.reduce((all, part) => all + (part[0] ?? 0), 0)).toBe(minor(line.cost.confirmed));
      expect(parts.reduce((all, part) => all + (part[1] ?? 0), 0)).toBe(minor(line.cost.potential));
    }
  });

  it('flags Cars, keeps Aunt Funmi’s £400.00 and gives Mr and Mrs Obi £0.00', () => {
    const payers = read('split_flag');

    expect(payers.lines.filter((one) => one.flagged).map((one) => one.label)).toEqual(['Cars']);
    expect(pair(payer(payers, 'funmi').share)).toEqual([40000, 40000]);
    expect(pair(payer(payers, 'obi').share)).toEqual([1062000, 1228500]);
    expect(pair(payers.total)).toEqual([1944000, 2277000]);
    expect(pair(payers.hasPayer)).toEqual([1854000, 2187000]);
  });

  it('counts a Not priced cost on the share, adds nothing for it, and lists it last', () => {
    const payers = read('payer_not_priced');
    const couple = payer(payers, 'couple');

    expect(start('payer_not_priced').start.open).toBe('couple');
    expect(couple.notPriced).toBe(1);
    expect(couple.covers.at(-1)).toMatchObject({ label: 'Aisle arch', notPriced: true });
    expect(couple.share).toEqual(payer(served(SAMPLE_BOOK, PAYMENTS, true), 'couple').share);
  });

  it('takes Mr and Mrs Obi past their upper end, and Still to come stops at 0', () => {
    const obi = payer(read('payer_paid_past'), 'obi');

    expect(minor(obi.paid ?? '')).toBe(1230000);
    expect(minor(obi.paid ?? '')).toBeGreaterThan(minor(obi.share.potential));
    expect(obi.stillToCome).toEqual({ confirmed: '0.00', potential: '0.00' });
  });

  it('leaves out Paid and Still to come only on the share alone', () => {
    expect(read('payer_share_alone').paidShown).toBe(false);
    expect(payer(read('payer_share_alone'), 'obi').paid).toBeNull();
    expect(read('payers').paidShown).toBe(true);
  });

  it('keeps what the screen writes, and puts a removed payer back where they were', async () => {
    const source = bookSource(SAMPLE_BOOK, PAYMENTS, true);
    const added = await source.add({ name: ' Uncle Kayode ', note: null });
    await source.remove('funmi');
    await source.putBack('funmi');
    const payers = await source.choose(['dj'], { mode: 'one', payerId: added.id }, 'GBP');

    expect(payers.payers.map((one) => one.name)).toEqual([
      'Adaeze and Tunde',
      'Mr and Mrs Obi',
      'Mr and Mrs Bakare',
      'Aunt Funmi',
      'Uncle Kayode',
    ]);
    expect(payer(payers, added.id).covers.map((one) => one.label)).toEqual(['DJ']);
  });
});

describe('the demo’s states (budget-a-spec.md §9)', () => {
  const names = [
    'payers',
    'no_payers',
    'no_costs',
    'add_payer',
    'payer_duplicate',
    'payer_cap',
    'remove_refused',
    'removed',
    'split_flag',
    'choose_one',
    'choose_percent',
    'choose_percent_bad',
    'choose_fixed',
    'choose_several',
    'send_busy',
    'link_copied',
    'copy_refused',
    'send_failed',
    'payer_not_priced',
    'payer_paid_past',
    'payer_share_alone',
    'payers_loading',
    'payers_neither',
    'note_too_long',
    'payers_stale',
    'payers_live',
    'payers_not_live',
    'choose_no_payer',
    'choose_no_rest',
    'link_passphrase',
    'link_all_revoked',
    'web_share',
    'payer_blank',
    'payer_long_name',
    'payer_edit',
    'payer_renamed',
    'choose_percent_range',
    'choose_percent_decimals',
    'choose_fixed_blank',
    'choose_fixed_decimals',
    'choose_fixed_over',
  ];

  it('has every name the spec gives, each linked from the demo’s home', () => {
    const linked = PAYERS_PAGES.flatMap((page) => page.states.map((state) => state.to));

    expect([...PAYERS_STATES]).toEqual(names);
    for (const name of names)
      expect(linked).toContain(`/demo/events/evt-wed-4?area=budget&state=${name}`);
  });

  it('opens Mr and Mrs Obi by default, Adaeze and Tunde while sending or with no costs, and the payer asked for', () => {
    expect(start('payers').start.open).toBe('obi');
    expect(start('send_busy').start.open).toBe('couple');
    expect(start('payers', 'funmi').start.open).toBe('funmi');
    expect(start('payers', 'nobody').start.open).toBe('obi');
    expect(start('no_costs').start.open).toBe('couple');
  });

  it('starts each refusal and result where the board draws it, in the product’s words', () => {
    expect(start('payer_duplicate').start.form?.error).toBe(
      'Another payer on this event is already called Aunt Funmi.',
    );
    expect(start('remove_refused').start.notice).toEqual({
      kind: 'refused',
      name: 'Mr and Mrs Obi',
      lineIds: ['dinner', 'drinks', 'room'],
      count: 3,
    });
    expect(start('removed').start.notice).toEqual({
      kind: 'removed',
      id: 'kayode',
      name: 'Uncle Kayode',
    });
    expect(start('removed').removed).toMatchObject([{ index: 4 }]);
    expect(start('link_copied').book.payers[0]?.link).toBe('sent');
    expect(start('send_failed').book.payers[0]?.link).toBe('notSent');
    expect(start('note_too_long').start.form?.noteError).toBe('Use 200 characters or fewer.');
    expect(start('payer_blank').start.form?.error).toBe('Enter a name.');
    expect(start('payer_long_name').start.form?.error).toBe('Use 60 characters or fewer.');
    expect(start('payer_edit').start.form).toMatchObject({
      id: 'obi',
      name: 'Chidi and Ngozi Obi',
    });
    expect(start('payers_stale').start.choosing).toMatchObject({
      ticked: ['dj'],
      stale:
        'Uncle Kayode was removed by someone else while this was open, so nothing was saved. The costs are shown as they are now.',
    });
    expect(start('choose_no_rest').start.choosing?.rest).toBeUndefined();
    expect(start('payers_neither').book).toEqual({ lines: [], payers: [], splits: {} });
    expect(start('payers_loading').loading).toBe(true);
    expect(start('payers_not_live').notLive).toBe(true);
    expect(start('web_share')).toMatchObject({
      shares: true,
      send: { payerId: 'couple', kind: 'shared' },
    });
  });

  it('moves Mr and Mrs Obi’s share down by the £3,150.00 the live line says', () => {
    const was = payer(served(SAMPLE_BOOK, PAYMENTS, true), 'obi');
    const now = payer(read('payers_live'), 'obi');

    expect(minor(was.share.confirmed) - minor(now.share.confirmed)).toBe(315000);
    expect(start('payers_live').start.live).toBe('Mr and Mrs Obi’s share went down by £3,150.00.');
  });
});
