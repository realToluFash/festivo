import {
  type EventPayers,
  type Payer,
  type PayerCover,
  type PayerLine,
  type PayerSplit,
  type SplitTyped,
} from '@soirely/api-client';
import type { TFunction } from 'i18next';

import { minorMoney } from '../routes/app/events/budgetArea.ts';
import { type PayersNotice, type PayersStart } from '../routes/app/events/PayersArea.tsx';
import {
  type ChooseStart,
  type PayersSource,
  WHOLE,
  apportion,
  coveredBy,
  fromMinor,
  nameProblem,
  noteProblem,
  toMinor,
} from '../routes/app/events/payersArea.ts';
import {
  COST_LINES,
  type CostLine,
  type EventQuote,
  PAYMENTS,
  type Payment,
  QUOTES,
  READER,
  TODAY,
  amounts,
  categoriesOf,
  lineState,
  totals,
} from './budget.ts';
import { type DemoGroup, type LinkState, PAYERS as SAMPLE, budgetAt } from './budgetSample.ts';

/** The demo's stand-in for the server's Who is paying (sc-91): its sample costs, payers and splits, read as the API reads them, so the demo draws the product's own screen. */

export type Range = readonly [number, number];

export interface PayerEntry {
  id: string;
  name: string;
  note: string;
  link: LinkState;
  passphrase?: boolean;
}

export interface Part {
  payerId: string;
  value: number;
}

/** sc-91's three choices; a percentage is held in hundredths, so 33.33% is 3333 and the whole is 10000. */
export type Split =
  | { kind: 'one'; payerId: string }
  | { kind: 'percent'; shares: readonly Part[] }
  | { kind: 'fixed'; amounts: readonly Part[]; restId: string };

export interface Book {
  lines: readonly CostLine[];
  payers: readonly PayerEntry[];
  splits: Readonly<Record<string, Split>>;
}

export const SEND_MS = 500;

const CURRENCY = 'GBP';

const sum = (values: readonly number[]): number => values.reduce((all, one) => all + one, 0);

const written = (minor: number): string => fromMinor(minor, CURRENCY);

const pair = ([low, high]: Range) => ({ confirmed: written(low), potential: written(high) });

export function rangeOf(line: CostLine): Range {
  const each = amounts(line);

  return [each.settled, each.ifAll];
}

function inBudgetOrder(lines: readonly CostLine[]): CostLine[] {
  const order = categoriesOf(lines);

  return [...lines].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

const fixedSum = (split: Split): number =>
  split.kind === 'fixed' ? sum(split.amounts.map((one) => one.value)) : 0;

function isFlagged(line: CostLine, split: Split | undefined): boolean {
  return split?.kind === 'fixed' && rangeOf(line)[0] < fixedSum(split);
}

const inOrder = (parts: readonly Part[], payers: readonly PayerEntry[]): Part[] => {
  const at = (id: string): number => payers.findIndex((one) => one.id === id);

  return [...parts].sort((a, b) => at(a.payerId) - at(b.payerId));
};

/** Each payer's part of a cost, settled and if all come; while flagged, the payer who covers the rest has 0. */
function partsOf(
  line: CostLine,
  split: Split,
  payers: readonly PayerEntry[],
): { payerId: string; part: Range; rest: boolean }[] {
  const [low, high] = rangeOf(line);

  if (split.kind === 'one') return [{ payerId: split.payerId, part: [low, high], rest: false }];
  if (split.kind === 'percent') {
    const shares = inOrder(split.shares, payers);
    const weights = shares.map((one) => one.value);
    const lows = apportion(low, weights, WHOLE);
    const highs = apportion(high, weights, WHOLE);

    return shares.map((one, index) => ({
      payerId: one.payerId,
      part: [lows[index] ?? 0, highs[index] ?? 0],
      rest: false,
    }));
  }
  const fixed = fixedSum(split);

  return [
    ...inOrder(split.amounts, payers).map((one) => ({
      payerId: one.payerId,
      part: [one.value, one.value] as const,
      rest: false,
    })),
    {
      payerId: split.restId,
      part: low < fixed ? ([0, 0] as const) : ([low - fixed, high - fixed] as const),
      rest: true,
    },
  ];
}

const mine = (book: Book, line: CostLine, payerId: string) => {
  const split = book.splits[line.id];

  return split == null
    ? undefined
    : partsOf(line, split, book.payers).find((one) => one.payerId === payerId);
};

function shareOf(book: Book, payerId: string): Range {
  return book.lines.reduce<Range>(
    (all, line) => {
      const part = mine(book, line, payerId)?.part ?? [0, 0];

      return [all[0] + part[0], all[1] + part[1]];
    },
    [0, 0],
  );
}

/** Paid, credited in proportion to each payer's settled part of what the vendor's quote covers; the rest, and a payment that covers no cost, is No payer yet's. */
function paidOf(
  book: Book,
  payments: readonly Payment[],
  quotes: readonly EventQuote[] = QUOTES,
): { byPayer: Map<string, number>; noPayer: number } {
  const byPayer = new Map(book.payers.map((one) => [one.id, 0]));
  let noPayer = 0;

  for (const payment of payments) {
    if (payment.paid == null || payment.cancelled != null) continue;
    const quote = quotes.find((one) => one.vendorId === payment.vendorId);
    const lines = book.lines.filter((line) => quote?.lineIds.includes(line.id) === true);
    const weights = book.payers.map((payer) =>
      sum(lines.map((line) => mine(book, line, payer.id)?.part[0] ?? 0)),
    );
    const unclaimed = sum(
      lines.filter((line) => book.splits[line.id] == null).map((line) => rangeOf(line)[0]),
    );
    if (sum([...weights, unclaimed]) <= 0) {
      noPayer += payment.paid.amount;
      continue;
    }
    const parts = apportion(
      payment.paid.amount,
      [...weights, unclaimed],
      sum([...weights, unclaimed]),
    );

    book.payers.forEach((one, index) =>
      byPayer.set(one.id, (byPayer.get(one.id) ?? 0) + (parts[index] ?? 0)),
    );
    noPayer += parts[book.payers.length] ?? 0;
  }

  return { byPayer, noPayer };
}

const percentWritten = (hundredths: number): string => (hundredths / 100).toFixed(2);

function how(book: Book, split: Split, payerId: string, rest: boolean): PayerCover['how'] {
  if (split.kind === 'one') return { mode: 'one' };
  if (split.kind === 'percent')
    return {
      mode: 'percent',
      percent: percentWritten(split.shares.find((one) => one.payerId === payerId)?.value ?? 0),
    };
  if (!rest)
    return {
      mode: 'fixed',
      amount: written(split.amounts.find((one) => one.payerId === payerId)?.value ?? 0),
    };

  return {
    mode: 'rest',
    after: inOrder(split.amounts, book.payers).map((one) => ({
      payerId: one.payerId,
      amount: written(one.value),
    })),
  };
}

function covers(book: Book, payerId: string): PayerCover[] {
  return inBudgetOrder(book.lines)
    .flatMap((line) => {
      const split = book.splits[line.id];
      const part = mine(book, line, payerId);

      return split == null || part == null
        ? []
        : [
            {
              lineId: line.id,
              label: line.name,
              notPriced: lineState(line) === 'notPriced',
              part: pair(part.part),
              how: how(book, split, payerId, part.rest),
            },
          ];
    })
    .sort(
      (a, b) =>
        Number(a.notPriced) - Number(b.notPriced) ||
        Number(b.part.confirmed) - Number(a.part.confirmed),
    );
}

function sent(split: Split | undefined): PayerSplit | null {
  if (split == null) return null;
  if (split.kind === 'one') return { mode: 'one', payerId: split.payerId };
  if (split.kind === 'percent')
    return {
      mode: 'percent',
      shares: split.shares.map((one) => ({
        payerId: one.payerId,
        percent: percentWritten(one.value),
      })),
    };

  return {
    mode: 'fixed',
    amounts: split.amounts.map((one) => ({ payerId: one.payerId, amount: written(one.value) })),
    restId: split.restId,
  };
}

/** The book as the API reads it (sc-91's `GET …/budget/payers`). */
export function served(book: Book, payments: readonly Payment[], paidShown: boolean): EventPayers {
  const ordered = inBudgetOrder(book.lines);
  const without = ordered.filter((line) => book.splits[line.id] == null);
  const withPayer = ordered.filter((line) => book.splits[line.id] != null);
  const range = (lines: readonly CostLine[]): Range => {
    const all = totals(lines);

    return [all.settled, all.ifAll];
  };
  const paid = paidOf(book, payments);
  const next = without.find((line) => rangeOf(line)[1] > 0) ?? without[0] ?? null;

  return {
    currency: CURRENCY,
    paidShown,
    total: pair(range(book.lines)),
    hasPayer: pair(range(withPayer)),
    noPayer: { ...pair(range(without)), costs: without.length, paid: written(paid.noPayer) },
    next: next == null ? null : { id: next.id, label: next.name },
    payers: book.payers.map((one): Payer => {
      const share = shareOf(book, one.id);
      const theirs = covers(book, one.id);
      const paidMinor = paid.byPayer.get(one.id) ?? 0;

      return {
        id: one.id,
        name: one.name,
        note: one.note === '' ? null : one.note,
        share: pair(share),
        notPriced: theirs.filter((cover) => cover.notPriced).length,
        paid: paidShown ? written(paidMinor) : null,
        stillToCome: paidShown
          ? pair([Math.max(0, share[0] - paidMinor), Math.max(0, share[1] - paidMinor)])
          : null,
        covers: theirs,
      };
    }),
    lines: ordered.map((line): PayerLine => ({
      id: line.id,
      label: line.name,
      category: line.category,
      cost: pair(rangeOf(line)),
      notPriced: lineState(line) === 'notPriced',
      flagged: isFlagged(line, book.splits[line.id]),
      split: sent(book.splits[line.id]),
    })),
  };
}

function chosen(split: SplitTyped | null): Split | null {
  if (split == null) return null;
  if (split.mode === 'one') return { kind: 'one', payerId: split.payerId ?? '' };
  if (split.mode === 'percent')
    return {
      kind: 'percent',
      shares: split.shares.map((one) => ({
        payerId: one.payerId,
        value: Math.round(Number(one.percent) * 100),
      })),
    };

  return {
    kind: 'fixed',
    amounts: split.amounts.map((one) => ({
      payerId: one.payerId,
      value: toMinor(one.amount, CURRENCY),
    })),
    restId: split.restId ?? '',
  };
}

export function addPayer(book: Book, name: string, note: string): { book: Book; id: string } {
  let at = book.payers.length + 1;
  while (book.payers.some((one) => one.id === `payer-${at}`)) at += 1;
  const id = `payer-${at}`;
  const payer: PayerEntry = { id, name: name.trim(), note: note.trim(), link: 'notSent' };

  return { book: { ...book, payers: [...book.payers, payer] }, id };
}

export function editPayer(book: Book, id: string, name: string, note: string): Book {
  return {
    ...book,
    payers: book.payers.map((one) =>
      one.id === id ? { ...one, name: name.trim(), note: note.trim() } : one,
    ),
  };
}

export function withLink(book: Book, id: string, link: LinkState): Book {
  return { ...book, payers: book.payers.map((one) => (one.id === id ? { ...one, link } : one)) };
}

export function applyChoice(book: Book, ticked: readonly string[], split: Split | null): Book {
  const splits = { ...book.splits };
  for (const id of ticked) {
    if (split == null) delete splits[id];
    else splits[id] = split;
  }

  return { ...book, splits };
}

/** A source the demo's screen reads and writes as it would the API: it keeps the book in memory, sends nothing, and never answers while `loading`. */
export function bookSource(
  first: Book,
  payments: readonly Payment[],
  paidShown: boolean,
  removed: readonly { payer: PayerEntry; index: number }[] = [],
  loading = false,
): PayersSource {
  let book = first;
  let gone = [...removed];
  const read = (): EventPayers => served(book, payments, paidShown);
  const payerOf = (id: string): Payer => {
    const found = read().payers.find((one) => one.id === id);
    if (found == null) throw new Error(`no payer ${id}`);

    return found;
  };

  return {
    read: () => (loading ? new Promise<EventPayers>(() => undefined) : Promise.resolve(read())),
    add: (typed) => {
      const added = addPayer(book, typed.name, typed.note ?? '');
      book = added.book;

      return Promise.resolve(payerOf(added.id));
    },
    change: (id, typed) => {
      book = editPayer(book, id, typed.name, typed.note ?? '');

      return Promise.resolve(payerOf(id));
    },
    remove: (id) => {
      const index = book.payers.findIndex((one) => one.id === id);
      const payer = book.payers[index];
      if (payer != null) gone = [...gone, { payer, index }];
      book = { ...book, payers: book.payers.filter((one) => one.id !== id) };

      return Promise.resolve();
    },
    putBack: (id) => {
      const back = gone.find((one) => one.payer.id === id);
      if (back != null) {
        const payers = [...book.payers];
        payers.splice(back.index, 0, back.payer);
        book = { ...book, payers };
        gone = gone.filter((one) => one !== back);
      }

      return Promise.resolve();
    },
    choose: (lineIds, split) => {
      book = applyChoice(book, lineIds, chosen(split));

      return Promise.resolve(read());
    },
  };
}

const half = (a: string, b: string): Split => ({
  kind: 'percent',
  shares: [
    { payerId: a, value: WHOLE / 2 },
    { payerId: b, value: WHOLE / 2 },
  ],
});

export const SAMPLE_SPLITS: Readonly<Record<string, Split>> = {
  dinner: half('obi', 'bakare'),
  drinks: half('obi', 'bakare'),
  room: { kind: 'one', payerId: 'obi' },
  bridal: { kind: 'one', payerId: 'couple' },
  photo: { kind: 'one', payerId: 'couple' },
  cars: { kind: 'one', payerId: 'funmi' },
};

export const SAMPLE_PAYERS: readonly PayerEntry[] = SAMPLE.map(({ id, name, note, link }) => ({
  id,
  name,
  note,
  link,
}));

/** Mr and Mrs Obi as Edit renames them (Budget-A-Payers-More, frames 35 and 36). */
export const RENAMED = 'Chidi and Ngozi Obi';

export const KAYODE: PayerEntry = {
  id: 'kayode',
  name: 'Uncle Kayode',
  note: 'Covering the band',
  link: 'notSent',
};

const GUESTS = [
  'Inês Duarte',
  'Lucía Ortega',
  'Kwame Mensah',
  'Marta Silva',
  'Camille Dubois',
  'Tomás Ferreira',
  'Joaquín Ruiz',
  'Sophie Laurent',
  'Amaka Eze',
  'Priyanka Nair',
  'Chidi Okafor',
  'Emeka Obi',
  'Funke Bakare',
  'Ngozi Obi',
  'Segun Bakare',
];

export const SAMPLE_BOOK: Book = {
  lines: COST_LINES,
  payers: SAMPLE_PAYERS,
  splits: SAMPLE_SPLITS,
};

const FLAGGED: Book = {
  lines: COST_LINES.map((line) => (line.id === 'cars' ? { ...line, rate: 35000 } : line)),
  payers: SAMPLE_PAYERS,
  splits: {
    ...SAMPLE_SPLITS,
    cars: { kind: 'fixed', amounts: [{ payerId: 'funmi', value: 40000 }], restId: 'obi' },
  },
};

const NOT_PRICED: Book = {
  ...SAMPLE_BOOK,
  splits: { ...SAMPLE_SPLITS, arch: { kind: 'one', payerId: 'couple' } },
};

const paidAt =
  (id: string, amount: number, on: string) =>
  (payment: Payment): Payment =>
    payment.id === id ? { ...payment, paid: { amount, on, by: READER, reference: '' } } : payment;

/** Both venue payments, and Savour Kitchen's deposit and second instalment, the second at £7,500.00: Mr and Mrs Obi's half takes them past their share. */
const PAID_PAST: readonly Payment[] = PAYMENTS.map(paidAt('p2', 315000, TODAY))
  .map(paidAt('p7', 450000, TODAY))
  .map(paidAt('p8', 750000, TODAY));

const STATE_NAMES = [
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
] as const;

export type PayersState = (typeof STATE_NAMES)[number];

export const PAYERS_STATES: readonly string[] = STATE_NAMES;

export type SendKind = 'busy' | 'copied' | 'refused' | 'failed' | 'shared';

/** A demo state: the book the stand-in starts from, and where the product's screen opens on it. */
export interface PayersDemo {
  book: Book;
  payments: readonly Payment[];
  /** Paid and Still to come show only with `vendors` or a payment marked paid (sc-91). */
  paidShown: boolean;
  removed: readonly { payer: PayerEntry; index: number }[];
  loading: boolean;
  notLive: boolean;
  send: { payerId: string; kind: SendKind } | null;
  shares: boolean;
  start: PayersStart;
}

/** Which payer the pane opens on: the one asked for, else Mr and Mrs Obi as the board draws, else the first. */
function openFirst(payers: readonly PayerEntry[], asked: string | null): string | null {
  const found = (id: string | null) => payers.find((one) => one.id === id)?.id;

  return found(asked) ?? found('obi') ?? payers[0]?.id ?? null;
}

const CHOOSE: Partial<Record<PayersState, ChooseStart>> = {
  choose_one: { ticked: ['dj'], mode: 'one', payer: 'couple' },
  choose_percent: { ticked: ['dinner'], mode: 'percent', percents: { obi: '50', bakare: '50' } },
  choose_percent_bad: {
    ticked: ['dinner'],
    mode: 'percent',
    percents: { obi: '50', bakare: '40' },
    checked: true,
  },
  choose_fixed: { ticked: ['cars'], mode: 'fixed', amounts: { funmi: '400.00' }, rest: 'obi' },
  choose_several: { ticked: ['dj', 'cars', 'photo'], mode: 'one', payer: 'couple' },
  choose_no_payer: { ticked: ['dj'], mode: 'one', checked: true },
  choose_no_rest: { ticked: ['cars'], mode: 'fixed', amounts: { funmi: '400.00' }, checked: true },
  choose_percent_range: {
    ticked: ['dinner'],
    mode: 'percent',
    percents: { obi: '−5', bakare: '105' },
    checked: true,
  },
  choose_percent_decimals: {
    ticked: ['dinner'],
    mode: 'percent',
    percents: { obi: '33.333', bakare: '66.67' },
    checked: true,
  },
  choose_fixed_blank: { ticked: ['cars'], mode: 'fixed', rest: 'obi', checked: true },
  choose_fixed_decimals: {
    ticked: ['cars'],
    mode: 'fixed',
    amounts: { funmi: '400.505' },
    rest: 'obi',
    checked: true,
  },
  choose_fixed_over: {
    ticked: ['dinner'],
    mode: 'fixed',
    amounts: { funmi: '6,800.00' },
    rest: 'obi',
    checked: true,
  },
};

const LONG_NOTE =
  'Adaeze’s grandparents, who asked to cover the dinner and the drinks for the family table and the cars on both days, paid in two parts, the first before the end of the month and the rest after the event.';
const LONG_NAME = 'Mr and Mrs Adeyemi-Okonkwo, on behalf of the whole family in Lagos';

/** The server's refusal of a save naming a payer removed meanwhile (`payer_removed`), as the API words it. */
const removedMeanwhile = (name: string): string =>
  `${name} was removed by someone else while this was open, so nothing was saved. The costs are shown as they are now.`;

const SENT: Partial<Record<PayersState, SendKind>> = {
  send_busy: 'busy',
  link_copied: 'copied',
  copy_refused: 'refused',
  send_failed: 'failed',
  web_share: 'shared',
};

export function startOf(
  state: string,
  asked: string | null,
  t: TFunction,
  locale: string,
): PayersDemo {
  const name = (STATE_NAMES as readonly string[]).includes(state)
    ? (state as PayersState)
    : 'payers';
  const kind = SENT[name];
  let book = SAMPLE_BOOK;

  if (name === 'no_payers') book = { ...SAMPLE_BOOK, payers: [], splits: {} };
  if (name === 'no_costs') book = { lines: [], payers: SAMPLE_PAYERS, splits: {} };
  if (name === 'payers_neither') book = { lines: [], payers: [], splits: {} };
  if (name === 'payers_live')
    book = { ...SAMPLE_BOOK, splits: { ...SAMPLE_SPLITS, room: half('obi', 'bakare') } };
  if (name === 'link_passphrase')
    book = {
      ...SAMPLE_BOOK,
      payers: SAMPLE_PAYERS.map((one) => (one.id === 'obi' ? { ...one, passphrase: true } : one)),
    };
  if (name === 'link_all_revoked') book = withLink(SAMPLE_BOOK, 'bakare', 'revoked');
  if (name === 'payer_renamed') book = editPayer(SAMPLE_BOOK, 'obi', RENAMED, 'Adaeze’s parents');
  if (name === 'split_flag') book = FLAGGED;
  if (name === 'payer_not_priced') book = NOT_PRICED;
  if (name === 'payer_cap')
    book = {
      ...SAMPLE_BOOK,
      payers: [
        ...SAMPLE_PAYERS,
        KAYODE,
        ...GUESTS.map((guest, index) => ({
          id: `guest-${index + 1}`,
          name: guest,
          note: '',
          link: 'notSent' as const,
        })),
      ],
    };
  if (kind === 'copied' || kind === 'refused' || kind === 'shared')
    book = withLink(book, 'couple', 'sent');

  const payments = name === 'payer_paid_past' ? PAID_PAST : PAYMENTS;
  const paidShown = name !== 'payer_share_alone';
  const read = served(book, payments, paidShown);
  const problem = (typed: string) => nameProblem(t, typed, read.payers, null, locale);
  const covered = coveredBy(read, 'obi');
  const notice: PayersNotice | null =
    name === 'payer_cap'
      ? { kind: 'cap' }
      : name === 'remove_refused'
        ? { kind: 'refused', name: 'Mr and Mrs Obi', lineIds: covered, count: covered.length }
        : name === 'removed'
          ? { kind: 'removed', id: KAYODE.id, name: KAYODE.name }
          : null;
  const blank = { error: null, noteError: null };
  const form: PayersStart['form'] =
    name === 'add_payer'
      ? { id: null, name: KAYODE.name, note: KAYODE.note, ...blank }
      : name === 'payer_duplicate'
        ? { id: null, name: 'Aunt Funmi', note: '', ...blank, error: problem('Aunt Funmi') }
        : name === 'note_too_long'
          ? {
              id: null,
              name: 'Grandma Ada',
              note: LONG_NOTE,
              ...blank,
              noteError: noteProblem(t, LONG_NOTE),
            }
          : name === 'payer_blank'
            ? { id: null, name: '', note: '', ...blank, error: problem('') }
            : name === 'payer_long_name'
              ? { id: null, name: LONG_NAME, note: '', ...blank, error: problem(LONG_NAME) }
              : name === 'payer_edit'
                ? { id: 'obi', name: RENAMED, note: 'Adaeze’s parents', ...blank }
                : null;
  const pane = name === 'link_all_revoked' ? 'bakare' : name === 'web_share' ? 'couple' : null;
  const choosing: ChooseStart | null =
    name === 'payers_stale'
      ? { ticked: ['dj'], mode: 'one', stale: removedMeanwhile(KAYODE.name) }
      : (CHOOSE[name] ?? null);

  return {
    book,
    payments,
    paidShown,
    removed: name === 'removed' ? [{ payer: KAYODE, index: book.payers.length }] : [],
    loading: name === 'payers_loading',
    notLive: name === 'payers_not_live',
    send: kind == null ? null : { payerId: openFirst(book.payers, asked ?? 'couple') ?? '', kind },
    shares: name === 'web_share',
    start: {
      open: openFirst(
        book.payers,
        asked ?? pane ?? (kind != null || name === 'payer_not_priced' ? 'couple' : null),
      ),
      notice,
      form,
      choosing,
      live:
        name === 'payers_live'
          ? t('payers.liveDown', {
              name: 'Mr and Mrs Obi',
              amount: minorMoney(fromMinor(315000, CURRENCY), CURRENCY, locale),
            })
          : null,
    },
  };
}

const at = (state: PayersState, extra: Record<string, string> = {}): string =>
  budgetAt(state, extra);

export const PAYERS_PAGES: readonly DemoGroup[] = [
  {
    name: 'On the web, at a desk',
    states: [
      {
        to: at('payers'),
        name: 'Who is paying: the card, a row per payer, Mr and Mrs Obi in the pane',
      },
      {
        to: at('payers', { payer: 'couple' }),
        name: 'Adaeze and Tunde: a share replies do not change, never sent',
      },
      {
        to: at('payers', { payer: 'bakare' }),
        name: 'Mr and Mrs Bakare: sent, not opened yet, nothing paid',
      },
      { to: at('payers', { payer: 'funmi' }), name: 'Aunt Funmi: covering the cars' },
      { to: at('no_payers'), name: 'No payers yet (no_payers)' },
      { to: at('no_costs'), name: 'No costs yet (no_costs)' },
      { to: at('add_payer'), name: 'Add a payer (add_payer)' },
      { to: at('payer_duplicate'), name: 'The same name, refused at the field (payer_duplicate)' },
    ],
  },
  {
    name: 'Payers, removed, and choosing who pays',
    states: [
      { to: at('payer_cap'), name: '20 payers: Add a payer says so and opens nothing (payer_cap)' },
      {
        to: at('remove_refused'),
        name: 'Remove refused: Mr and Mrs Obi covers 3 costs (remove_refused)',
      },
      { to: at('removed'), name: 'Uncle Kayode removed, with Undo (removed)' },
      { to: at('split_flag'), name: 'Needs new amounts: the split on Cars (split_flag)' },
      { to: at('choose_one'), name: 'Choose who pays: the DJ, one payer (choose_one)' },
    ],
  },
  {
    name: 'Choosing, and sending',
    states: [
      {
        to: at('choose_percent'),
        name: 'By percentage, each amount and the total (choose_percent)',
      },
      { to: at('choose_percent_bad'), name: 'Not 100: refused (choose_percent_bad)' },
      { to: at('choose_fixed'), name: 'Fixed, and who covers what is left (choose_fixed)' },
      {
        to: at('choose_several'),
        name: 'Several costs: two choices and the note (choose_several)',
      },
      { to: at('send_busy'), name: 'Sending to Adaeze and Tunde (send_busy)' },
    ],
  },
  {
    name: 'Sending',
    states: [
      { to: at('link_copied'), name: 'Link copied, said as a status (link_copied)' },
      { to: at('copy_refused'), name: 'The copy refused: the link selected (copy_refused)' },
      { to: at('send_failed'), name: 'The link not created (send_failed)' },
      {
        to: at('link_passphrase'),
        name: 'A live link that asks for a passphrase (link_passphrase)',
      },
      {
        to: at('link_all_revoked'),
        name: 'Every link revoked or ended: Send to, no state line (link_all_revoked)',
      },
      {
        to: at('web_share'),
        name: 'A browser with a share sheet: Send opens it (web_share)',
      },
    ],
  },
  {
    name: 'Loading, live, and the refusals still to draw',
    states: [
      { to: at('payers_loading'), name: 'Loading (payers_loading)' },
      { to: at('payers_neither'), name: 'No costs and no payers (payers_neither)' },
      { to: at('note_too_long'), name: 'A note over 200 characters (note_too_long)' },
      { to: at('payers_stale'), name: 'Saved after a payer was removed elsewhere (payers_stale)' },
      { to: at('payers_live'), name: 'A split changed in another tab (payers_live)' },
      { to: at('payers_not_live'), name: 'Not live, with Try now (payers_not_live)' },
      { to: at('choose_no_payer'), name: 'One payer, none chosen (choose_no_payer)' },
      { to: at('choose_no_rest'), name: 'Fixed, no one covers what is left (choose_no_rest)' },
      { to: at('payer_blank'), name: 'A name left blank (payer_blank)' },
      { to: at('payer_long_name'), name: 'A name over 60 characters (payer_long_name)' },
      { to: at('payer_edit'), name: 'Edit Mr and Mrs Obi (payer_edit)' },
      { to: at('payer_renamed'), name: 'Renamed: Chidi and Ngozi Obi everywhere (payer_renamed)' },
      {
        to: at('choose_percent_range'),
        name: 'Percentages below 0 and above 100 (choose_percent_range)',
      },
      {
        to: at('choose_percent_decimals'),
        name: 'A percentage with three decimal places (choose_percent_decimals)',
      },
      { to: at('choose_fixed_blank'), name: 'Fixed, with no amount (choose_fixed_blank)' },
      {
        to: at('choose_fixed_decimals'),
        name: 'Fixed, an amount with too many decimal places (choose_fixed_decimals)',
      },
      {
        to: at('choose_fixed_over'),
        name: 'Fixed amounts over the least Dinner can cost (choose_fixed_over)',
      },
    ],
  },
  {
    name: 'A payer’s share',
    states: [
      {
        to: at('payer_not_priced'),
        name: '1 cost not priced yet on Adaeze and Tunde’s share (payer_not_priced)',
      },
      {
        to: at('payer_paid_past'),
        name: 'Paid past the share: Nothing still to come (payer_paid_past)',
      },
      {
        to: at('payer_share_alone'),
        name: 'No vendors and nothing paid: the share alone (payer_share_alone)',
      },
    ],
  },
];
