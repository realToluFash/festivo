import { describe, expect, it } from 'vitest';

import { COST_LINES } from './budget.ts';
import { PAYERS as SAMPLE } from './budgetSample.ts';
import {
  PAYERS_PAGES,
  PAYERS_STATES,
  PAYER_CAP,
  SAMPLE_BOOK,
  addPayer,
  amountOf,
  apportion,
  applyChoice,
  budgetRange,
  canAddPayer,
  checkFixed,
  checkPercents,
  choicesFor,
  coveredBy,
  coversOf,
  flagWords,
  flaggedLines,
  hasPayer,
  nameProblem,
  noteProblem,
  percentProblem,
  nextNoPayer,
  noPayer,
  paidOf,
  partsOf,
  percentOf,
  rangeOf,
  replacesNote,
  shareOf,
  splitWords,
  startOf,
  stillToCome,
} from './payers.ts';
import { PAYERS_WORDS as W } from './payersWords.ts';

const line = (id: string) => {
  const found = SAMPLE_BOOK.lines.find((one) => one.id === id);
  if (found == null) throw new Error(id);

  return found;
};

describe('who is paying, worked from the costs (sc-91)', () => {
  it('gives each payer the share the spec’s sample has, and the paid', () => {
    const paid = paidOf(SAMPLE_BOOK);

    for (const payer of SAMPLE) {
      expect(shareOf(SAMPLE_BOOK, payer.id)).toEqual(payer.share);
      expect(paid.get(payer.id)).toBe(payer.paid);
    }
  });

  it('counts each cost with a payer at its own amount, so with No payer yet it is the range', () => {
    const none = noPayer(SAMPLE_BOOK);

    expect(hasPayer(SAMPLE_BOOK)).toEqual([1883000, 2216000]);
    expect(none.range).toEqual([90000, 90000]);
    expect(none.lines.map((one) => one.id)).toEqual(['centre', 'arch', 'dj', 'shuttle']);
    expect(hasPayer(SAMPLE_BOOK)[0] + none.range[0]).toBe(budgetRange(SAMPLE_BOOK)[0]);
    expect(hasPayer(SAMPLE_BOOK)[1] + none.range[1]).toBe(budgetRange(SAMPLE_BOOK)[1]);
  });

  it('names the DJ next: the first cost with no payer that costs something', () => {
    expect(nextNoPayer(SAMPLE_BOOK)?.name).toBe('DJ');
    const dj = applyChoice(SAMPLE_BOOK, ['dj'], { kind: 'one', payerId: 'couple' });
    expect(nextNoPayer(dj)?.name).toBe('Centrepieces');
  });

  it('adds up each cost’s parts to the cost exactly', () => {
    const odd = { ...line('drinks'), rate: 2201 };
    const thirds = {
      kind: 'percent' as const,
      shares: [
        { payerId: 'couple', value: 3333 },
        { payerId: 'obi', value: 3333 },
        { payerId: 'bakare', value: 3334 },
      ],
    };

    for (const [one, split] of [
      ...COST_LINES.map((each) => [each, SAMPLE_BOOK.splits[each.id]] as const),
      [odd, thirds] as const,
    ]) {
      if (split == null) continue;
      const parts = partsOf(one, split, SAMPLE_BOOK.payers);

      expect(parts.reduce((sum, part) => sum + part.part[0], 0)).toBe(rangeOf(one)[0]);
      expect(parts.reduce((sum, part) => sum + part.part[1], 0)).toBe(rangeOf(one)[1]);
    }
    expect(partsOf(odd, thirds, SAMPLE_BOOK.payers).map((one) => one.part[0])).toEqual([
      70424, 70424, 70448,
    ]);
  });

  it('rounds each part down and gives the cents left over to the largest, the first added between equals', () => {
    expect(apportion(10000, [3333, 3333, 3334])).toEqual([3333, 3333, 3334]);
    expect(apportion(1, [5000, 5000])).toEqual([1, 0]);
    expect(apportion(10, [3333, 3333, 3334])).toEqual([3, 3, 4]);
    expect(apportion(100, [5000, 4000], 10000)).toEqual([50, 40]);
  });

  it('never reads Still to come below 0', () => {
    expect(stillToCome([325000, 325000], 116000)).toEqual([209000, 209000]);
    expect(stillToCome([10000, 20000], 15000)).toEqual([0, 5000]);
    expect(stillToCome([10000, 10000], 15000)).toEqual([0, 0]);
  });

  it('says what each payer covers, the largest part first', () => {
    expect(
      coversOf(SAMPLE_BOOK, 'obi').map((one) => [one.name, one.how, one.part[0], one.part[1]]),
    ).toEqual([
      ['Room hire', 'all of it', 630000, 630000],
      ['Dinner', 'half', 326400, 452200],
      ['Drinks package', 'half', 105600, 146300],
    ]);
    expect(coversOf(SAMPLE_BOOK, 'couple').map((one) => one.name)).toEqual([
      'Photographer',
      'Bridal flowers',
    ]);
  });

  it('says who pays each cost in words', () => {
    expect(splitWords(SAMPLE_BOOK, line('dinner'))).toBe(
      'Mr and Mrs Obi and Mr and Mrs Bakare, half each',
    );
    expect(splitWords(SAMPLE_BOOK, line('cars'))).toBe('Aunt Funmi, all of it');
    expect(splitWords(SAMPLE_BOOK, line('dj'))).toBe('No payer yet');
    const fixed = applyChoice(SAMPLE_BOOK, ['cars'], {
      kind: 'fixed',
      amounts: [{ payerId: 'funmi', value: 40000 }],
      restId: 'obi',
    });
    expect(splitWords(fixed, line('cars'))).toBe(
      '£400.00 from Aunt Funmi, the rest from Mr and Mrs Obi',
    );
    expect(coversOf(fixed, 'obi').find((one) => one.lineId === 'cars')?.how).toBe(
      'what is left after Aunt Funmi’s £400.00',
    );
    expect(coversOf(fixed, 'obi').find((one) => one.lineId === 'cars')?.part).toEqual([
      24000, 24000,
    ]);
    const thirds = applyChoice(SAMPLE_BOOK, ['dj'], {
      kind: 'percent',
      shares: [
        { payerId: 'couple', value: 6000 },
        { payerId: 'funmi', value: 4000 },
      ],
    });
    expect(splitWords(thirds, line('dj'))).toBe(
      '60% from Adaeze and Tunde and 40% from Aunt Funmi',
    );
  });
});

describe('payers, added and removed (sc-91)', () => {
  it('refuses the same name, ignoring case and spaces at either end', () => {
    expect(nameProblem('  aunt FUNMI ', SAMPLE_BOOK.payers)).toBe(
      'Another payer on this event is already called Aunt Funmi.',
    );
    expect(nameProblem('Aunt Funmi', SAMPLE_BOOK.payers, 'funmi')).toBeNull();
    expect(nameProblem('Uncle Kayode', SAMPLE_BOOK.payers)).toBeNull();
  });

  it('holds at most 20 payers', () => {
    const cap = startOf('payer_cap').book;

    expect(cap.payers).toHaveLength(PAYER_CAP);
    expect(canAddPayer(cap.payers)).toBe(false);
    expect(canAddPayer(SAMPLE_BOOK.payers)).toBe(true);
    expect(new Set(cap.payers.map((one) => one.name.toLowerCase())).size).toBe(PAYER_CAP);
  });

  it('adds a payer last, trimmed, never sent', () => {
    const added = addPayer(SAMPLE_BOOK, '  Uncle Kayode ', ' Covering the band ');

    expect(added.book.payers.at(-1)).toEqual({
      id: added.id,
      name: 'Uncle Kayode',
      note: 'Covering the band',
      link: 'notSent',
    });
    expect(shareOf(added.book, added.id)).toEqual([0, 0]);
  });

  it('refuses to remove a payer who covers costs, and says how many', () => {
    expect(coveredBy(SAMPLE_BOOK, 'obi')).toEqual(['dinner', 'drinks', 'room']);
    expect(W.coversCosts('Mr and Mrs Obi', 3)).toBe(
      'Mr and Mrs Obi covers 3 costs. Choose who pays for them first.',
    );
    expect(W.coversCosts('Aunt Funmi', 1)).toBe(
      'Aunt Funmi covers 1 cost. Choose who pays for them first.',
    );
  });
});

describe('choosing who pays (sc-91)', () => {
  it('offers three choices for one cost and two for several', () => {
    expect(choicesFor(1)).toEqual(['one', 'percent', 'fixed']);
    expect(choicesFor(3)).toEqual(['one', 'percent']);
  });

  it('takes percentages only when they come to exactly 100.00', () => {
    const half = checkPercents(SAMPLE_BOOK, ['dinner'], { obi: '50', bakare: '50' });
    expect(half.error).toBeNull();
    expect(half.parts.get('obi')).toEqual([326400, 452200]);

    const short = checkPercents(SAMPLE_BOOK, ['dinner'], { obi: '50', bakare: '40' });
    expect(short.total).toBe(9000);
    expect(short.error).toBe('The percentages come to 90.00. Make them add up to exactly 100.');
    expect(short.parts.get('bakare')).toEqual([261120, 361760]);
    expect(short.split).toBeNull();

    const thirds = checkPercents(SAMPLE_BOOK, ['dj'], {
      couple: '33.33',
      obi: '33.33',
      bakare: '33.34',
      funmi: '0',
    });
    expect(thirds.error).toBeNull();
    expect(thirds.split).toEqual({
      kind: 'percent',
      shares: [
        { payerId: 'couple', value: 3333 },
        { payerId: 'obi', value: 3333 },
        { payerId: 'bakare', value: 3334 },
      ],
    });
  });

  it('reads a percentage to two decimals and an amount in the minor unit', () => {
    expect(percentOf('33.33')).toBe(3333);
    expect(percentOf('')).toBe(0);
    expect(percentOf('33.333')).toBeNull();
    expect(amountOf('400')).toBe(40000);
    expect(amountOf('400.5')).toBe(40050);
    expect(amountOf('1,200.00')).toBe(120000);
    expect(amountOf('0')).toBeNull();
    expect(amountOf('400.505')).toBeNull();
    expect(amountOf('four')).toBeNull();
  });

  it('takes fixed amounts no more than the cost, and gives the rest to who covers it', () => {
    const fine = checkFixed(SAMPLE_BOOK, 'cars', { funmi: '400.00' }, 'obi');
    expect(fine.errors).toEqual({});
    expect(fine.rest).toEqual([24000, 24000]);

    expect(checkFixed(SAMPLE_BOOK, 'cars', { funmi: '700' }, 'obi').errors).toEqual({
      funmi:
        'The fixed amounts come to £700.00, more than £640.00, the least this can cost. Lower them so they fit.',
    });
    expect(checkFixed(SAMPLE_BOOK, 'cars', { funmi: '640' }, 'obi').errors).toEqual({});
    expect(checkFixed(SAMPLE_BOOK, 'cars', {}, 'obi').errors).toEqual({
      couple: 'Enter an amount in pounds, like 400 or 400.50.',
    });
    expect(checkFixed(SAMPLE_BOOK, 'cars', { bakare: 'lots' }, 'obi').errors).toEqual({
      bakare: 'Enter an amount in pounds, like 400 or 400.50.',
    });
    expect(checkFixed(SAMPLE_BOOK, 'dinner', { couple: '6600' }, 'obi').errors.couple).toBe(
      'The fixed amounts come to £6,600.00, more than £6,528.00, the least this can cost. Lower them so they fit.',
    );
  });

  it('notes which splits saving several costs replaces', () => {
    expect(replacesNote(SAMPLE_BOOK, ['dj', 'cars', 'photo'])).toBe(
      '2 of these costs already have a payer. Saving replaces their split.',
    );
    expect(replacesNote(SAMPLE_BOOK, ['dj', 'centre'])).toBeNull();
    expect(replacesNote(SAMPLE_BOOK, ['dj'])).toBeNull();
    expect(replacesNote(startOf('split_flag').book, ['cars', 'dj'])).toBe(
      '1 of these costs already has a payer. Saving replaces its split, including the fixed amounts on Cars.',
    );
  });

  it('leaves ticked costs with no payer', () => {
    const left = applyChoice(SAMPLE_BOOK, ['cars'], null);

    expect(splitWords(left, line('cars'))).toBe('No payer yet');
    expect(shareOf(left, 'funmi')).toEqual([0, 0]);
  });
});

describe('a fixed split that no longer adds up (sc-91)', () => {
  const book = startOf('split_flag').book;
  const cars = book.lines.find((one) => one.id === 'cars');

  it('flags Cars, keeps Aunt Funmi’s £400.00 and gives Mr and Mrs Obi £0.00', () => {
    expect(flaggedLines(book).map((one) => one.name)).toEqual(['Cars']);
    expect(shareOf(book, 'funmi')).toEqual([40000, 40000]);
    expect(shareOf(book, 'obi')).toEqual([1062000, 1228500]);
    if (cars == null) throw new Error('cars');
    expect(splitWords(book, cars)).toBe('Needs new amounts');
    expect(flagWords(book, cars)).toEqual({
      title: 'The split on Cars no longer adds up. Nothing was changed.',
      line: 'Cars now costs £350.00, less than the £400.00 fixed for Aunt Funmi. Aunt Funmi keeps £400.00 and Mr and Mrs Obi have £0.00 until the amounts change.',
    });
  });

  it('still counts Cars at its own amount in Has a payer', () => {
    expect(budgetRange(book)).toEqual([1944000, 2277000]);
    expect(hasPayer(book)).toEqual([1854000, 2187000]);
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

  it('opens Mr and Mrs Obi by default, Adaeze and Tunde while sending, and the payer asked for', () => {
    expect(startOf('payers').open).toBe('obi');
    expect(startOf('send_busy').open).toBe('couple');
    expect(startOf('payers', 'funmi').open).toBe('funmi');
    expect(startOf('payers', 'nobody').open).toBe('obi');
  });

  it('starts each refusal and result where the board draws it', () => {
    expect(startOf('payer_duplicate').form?.error).toBe(
      'Another payer on this event is already called Aunt Funmi.',
    );
    expect(startOf('remove_refused').notice).toEqual({ kind: 'refused', payerId: 'obi', count: 3 });
    expect(startOf('removed').notice).toMatchObject({ kind: 'removed', index: 4 });
    expect(startOf('link_copied').book.payers[0]?.link).toBe('sent');
    expect(startOf('send_failed').book.payers[0]?.link).toBe('notSent');
    expect(startOf('no_costs').book.lines).toHaveLength(0);
    expect(startOf('no_payers').book.payers).toHaveLength(0);
  });

  it('refuses a blank or long payer name and a percentage outside 0 to 100, in the settled words', () => {
    expect(nameProblem('  ', [])).toBe('Enter a name.');
    expect(nameProblem('a'.repeat(61), [])).toBe('Use 60 characters or fewer.');
    expect(nameProblem('a'.repeat(60), [])).toBeNull();
    expect(percentProblem('-5')).toBe('Use a number from 0 to 100.');
    expect(percentProblem('100.01')).toBe('Use a number from 0 to 100.');
    expect(percentProblem('100')).toBeNull();
    expect(percentProblem('')).toBeNull();
    expect(percentProblem('33.333')).toBe(
      'Use a number from 0 to 100, with up to two decimal places.',
    );
    expect(noteProblem('a'.repeat(201))).toBe('Use 200 characters or fewer.');
    expect(noteProblem(` ${'a'.repeat(200)} `)).toBeNull();
  });

  it('starts the gaps’ states where the boards draw them (sc-91, sc-1300)', () => {
    expect(startOf('note_too_long').form?.noteError).toBe('Use 200 characters or fewer.');
    expect([...(startOf('note_too_long').form?.note ?? '')]).toHaveLength(202);
    expect(startOf('payers_neither').book).toEqual({ lines: [], payers: [], splits: {} });
    expect(startOf('no_costs').book.payers).toHaveLength(4);
    expect(startOf('payers_stale').choose).toMatchObject({ ticked: ['dj'], stale: 'Uncle Kayode' });
    expect(W.stale('Uncle Kayode')).toBe(
      'Uncle Kayode was removed by someone else while this was open, so nothing was saved. The costs are shown as they are now.',
    );
    expect(startOf('payers_stale').book.splits.dj).toBeUndefined();
    expect(startOf('payers_stale').choose?.payer).toBeUndefined();
    expect(startOf('payer_blank').form?.error).toBe('Enter a name.');
    expect(startOf('payer_long_name').form?.error).toBe('Use 60 characters or fewer.');
    expect(startOf('payer_edit').form).toMatchObject({ id: 'obi', name: 'Chidi and Ngozi Obi' });
    expect(startOf('payer_renamed').book.payers.find((one) => one.id === 'obi')?.name).toBe(
      'Chidi and Ngozi Obi',
    );
    expect(percentProblem('.333')).toBe(
      'Use a number from 0 to 100, with up to two decimal places.',
    );
    expect(startOf('choose_no_payer').choose).toMatchObject({ ticked: ['dj'], checked: true });
    expect(startOf('choose_no_payer').choose?.payer).toBeUndefined();
    expect(startOf('choose_no_rest').choose).toMatchObject({ mode: 'fixed', checked: true });
    expect(startOf('choose_no_rest').choose?.rest).toBeUndefined();
    const live = startOf('payers_live').book;
    expect(shareOf(SAMPLE_BOOK, 'obi')[0] - shareOf(live, 'obi')[0]).toBe(315000);
    expect(startOf('link_passphrase').book.payers.find((one) => one.id === 'obi')?.passphrase).toBe(
      true,
    );
    expect(startOf('link_all_revoked')).toMatchObject({ open: 'bakare' });
    expect(startOf('link_all_revoked').book.payers.find((one) => one.id === 'bakare')?.link).toBe(
      'revoked',
    );
    expect(startOf('web_share')).toMatchObject({ open: 'couple', shares: true });
    expect(startOf('web_share').send).toEqual({ payerId: 'couple', kind: 'shared' });
  });
});
