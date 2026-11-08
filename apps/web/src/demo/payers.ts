import { parsedAmount } from './quotes.ts';
import {
  COST_LINES,
  type CostLine,
  type EventQuote,
  PAYMENTS,
  type Payment,
  QUOTES,
  amounts,
  categoriesOf,
  money,
  totals,
} from './budget.ts';
import { type DemoGroup, type LinkState, PAYERS as SAMPLE, budgetAt } from './budgetSample.ts';
import { PAYERS_WORDS as W, listOf } from './payersWords.ts';

export type Range = readonly [number, number];

export interface PayerEntry {
  id: string;
  name: string;
  note: string;
  link: LinkState;
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

export type Mode = Split['kind'];

export interface Book {
  lines: readonly CostLine[];
  payers: readonly PayerEntry[];
  splits: Readonly<Record<string, Split>>;
}

export const PAYER_CAP = 20;
export const NAME_MAX = 60;
export const NOTE_MAX = 200;
export const WHOLE = 10000;
export const SEND_MS = 500;

const sum = (values: readonly number[]): number => values.reduce((all, one) => all + one, 0);

/** Each part rounded down, the cents left over to the largest part (between equal parts, the first added): the parts add up exactly. */
export function apportion(
  amount: number,
  weights: readonly number[],
  whole = sum(weights),
): number[] {
  if (whole <= 0) return weights.map(() => 0);
  const parts = weights.map((weight) => Math.floor((amount * weight) / whole));
  const left = amount - sum(parts);
  if (left === 0 || whole !== sum(weights)) return parts;
  const largest = weights.reduce(
    (at, weight, index) => (weight > (weights[at] ?? 0) ? index : at),
    0,
  );
  parts[largest] = (parts[largest] ?? 0) + left;

  return parts;
}

export function rangeOf(line: CostLine): Range {
  const each = amounts(line);

  return [each.settled, each.ifAll];
}

export function inBudgetOrder(lines: readonly CostLine[]): CostLine[] {
  const order = categoriesOf(lines);

  return [...lines].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

const fixedSum = (split: Split): number =>
  split.kind === 'fixed' ? sum(split.amounts.map((one) => one.value)) : 0;

export function isFlagged(line: CostLine, split: Split | undefined): boolean {
  return split?.kind === 'fixed' && rangeOf(line)[0] < fixedSum(split);
}

const inOrder = (parts: readonly Part[], payers: readonly PayerEntry[]): Part[] => {
  const at = (id: string): number => payers.findIndex((one) => one.id === id);

  return [...parts].sort((a, b) => at(a.payerId) - at(b.payerId));
};

/** Each payer's part of a cost, settled and if all come; while flagged, the payer who covers the rest has 0. */
export function partsOf(
  line: CostLine,
  split: Split,
  payers: readonly PayerEntry[],
): { payerId: string; part: Range }[] {
  const [low, high] = rangeOf(line);

  if (split.kind === 'one') return [{ payerId: split.payerId, part: [low, high] }];
  if (split.kind === 'percent') {
    const shares = inOrder(split.shares, payers);
    const lows = apportion(
      low,
      shares.map((one) => one.value),
      WHOLE,
    );
    const highs = apportion(
      high,
      shares.map((one) => one.value),
      WHOLE,
    );

    return shares.map((one, index) => ({
      payerId: one.payerId,
      part: [lows[index] ?? 0, highs[index] ?? 0],
    }));
  }
  const fixed = fixedSum(split);
  const rest: Range = low < fixed ? [0, 0] : [low - fixed, high - fixed];

  return [
    ...inOrder(split.amounts, payers).map((one) => ({
      payerId: one.payerId,
      part: [one.value, one.value] as const,
    })),
    { payerId: split.restId, part: rest },
  ];
}

const splitOf = (book: Book, line: CostLine): Split | undefined => book.splits[line.id];

const named = (split: Split): string[] =>
  split.kind === 'one'
    ? [split.payerId]
    : split.kind === 'percent'
      ? split.shares.map((one) => one.payerId)
      : [...split.amounts.map((one) => one.payerId), split.restId];

export function shareOf(book: Book, payerId: string): Range {
  return book.lines.reduce<Range>(
    (all, line) => {
      const split = splitOf(book, line);
      const mine = split == null ? undefined : partsOf(line, split, book.payers);
      const part = mine?.find((one) => one.payerId === payerId)?.part ?? [0, 0];

      return [all[0] + part[0], all[1] + part[1]];
    },
    [0, 0],
  );
}

/** Has a payer counts each cost with a payer at its own amount, so with No payer yet it is the budget's range exactly. */
export function hasPayer(book: Book): Range {
  const lines = book.lines.filter((line) => splitOf(book, line) != null);
  const sumOf = totals(lines);

  return [sumOf.settled, sumOf.ifAll];
}

export function noPayer(book: Book): { lines: CostLine[]; range: Range } {
  const lines = inBudgetOrder(book.lines.filter((line) => splitOf(book, line) == null));
  const sumOf = totals(lines);

  return { lines, range: [sumOf.settled, sumOf.ifAll] };
}

export function budgetRange(book: Book): Range {
  const sumOf = totals(book.lines);

  return [sumOf.settled, sumOf.ifAll];
}

/** The card's next cost with no payer: the first in the budget's order that costs something, else the first. */
export function nextNoPayer(book: Book): CostLine | null {
  const { lines } = noPayer(book);

  return lines.find((line) => rangeOf(line)[1] > 0) ?? lines[0] ?? null;
}

/** Paid, credited in proportion to each payer's settled part of what the vendor's quote covers; the rest is No payer yet's. */
export function paidOf(
  book: Book,
  payments: readonly Payment[] = PAYMENTS,
  quotes: readonly EventQuote[] = QUOTES,
): Map<string, number> {
  const paid = new Map(book.payers.map((one) => [one.id, 0]));

  for (const payment of payments) {
    if (payment.paid == null || payment.cancelled != null) continue;
    const quote = quotes.find((one) => one.vendorId === payment.vendorId);
    const lines = book.lines.filter((line) => quote?.lineIds.includes(line.id) === true);
    const weights = book.payers.map((payer) =>
      sum(
        lines.map((line) => {
          const split = splitOf(book, line);
          const mine = split == null ? undefined : partsOf(line, split, book.payers);

          return mine?.find((one) => one.payerId === payer.id)?.part[0] ?? 0;
        }),
      ),
    );
    const unclaimed = sum(
      lines.filter((line) => splitOf(book, line) == null).map((line) => rangeOf(line)[0]),
    );
    const parts = apportion(payment.paid.amount, [...weights, unclaimed]);

    book.payers.forEach((one, index) =>
      paid.set(one.id, (paid.get(one.id) ?? 0) + (parts[index] ?? 0)),
    );
  }

  return paid;
}

export function stillToCome(share: Range, paid: number): Range {
  return [Math.max(0, share[0] - paid), Math.max(0, share[1] - paid)];
}

export const percentText = (hundredths: number): string => (hundredths / 100).toFixed(2);

const shortPercent = (hundredths: number): string => String(Number(percentText(hundredths)));

const nameOf = (book: Book, id: string): string =>
  book.payers.find((one) => one.id === id)?.name ?? '';

export interface Cover {
  lineId: string;
  name: string;
  how: string;
  part: Range;
}

function howWords(book: Book, split: Split, payerId: string): string {
  if (split.kind === 'one') return W.allOfIt;
  if (split.kind === 'percent') {
    const value = split.shares.find((one) => one.payerId === payerId)?.value ?? 0;

    return value === WHOLE / 2 ? W.half : W.percentOf(shortPercent(value));
  }
  const fixed = split.amounts.find((one) => one.payerId === payerId);
  if (fixed != null) return W.fixedPart(money(fixed.value));

  return W.whatIsLeft(
    inOrder(split.amounts, book.payers).map((one) =>
      W.theirs(nameOf(book, one.payerId), money(one.value)),
    ),
  );
}

export function coversOf(book: Book, payerId: string): Cover[] {
  return inBudgetOrder(book.lines)
    .flatMap((line) => {
      const split = splitOf(book, line);
      const mine = split == null ? undefined : partsOf(line, split, book.payers);
      const part = mine?.find((one) => one.payerId === payerId)?.part;

      return split == null || part == null
        ? []
        : [{ lineId: line.id, name: line.name, how: howWords(book, split, payerId), part }];
    })
    .sort((a, b) => b.part[0] - a.part[0]);
}

export function splitWords(book: Book, line: CostLine): string {
  const split = splitOf(book, line);

  if (split == null) return W.noPayerYet;
  if (isFlagged(line, split)) return W.needsNewAmounts;
  if (split.kind === 'one') return W.splitAll(nameOf(book, split.payerId));
  if (split.kind === 'percent') {
    const shares = inOrder(split.shares, book.payers);

    return shares.length === 2 && shares.every((one) => one.value === WHOLE / 2)
      ? W.splitHalves(shares.map((one) => nameOf(book, one.payerId)))
      : W.splitPercents(
          shares.map((one) =>
            W.fromPayer(W.percentOf(shortPercent(one.value)), nameOf(book, one.payerId)),
          ),
        );
  }

  return W.splitFixed(
    inOrder(split.amounts, book.payers).map((one) =>
      W.fromPayer(money(one.value), nameOf(book, one.payerId)),
    ),
    nameOf(book, split.restId),
  );
}

export function flaggedLines(book: Book): CostLine[] {
  return inBudgetOrder(book.lines).filter((line) => isFlagged(line, splitOf(book, line)));
}

export function flagWords(book: Book, line: CostLine): { title: string; line: string } {
  const split = splitOf(book, line);
  const fixed = split?.kind === 'fixed' ? inOrder(split.amounts, book.payers) : [];
  const by = listOf(fixed.map((one) => nameOf(book, one.payerId)));
  const rest = split?.kind === 'fixed' ? nameOf(book, split.restId) : '';
  const sumOf = money(sum(fixed.map((one) => one.value)));

  return {
    title: W.flagTitle(line.name),
    line: W.flagLine(line.name, money(rangeOf(line)[0]), sumOf, by, rest, money(0)),
  };
}

export function coveredBy(book: Book, payerId: string): string[] {
  return inBudgetOrder(book.lines)
    .filter((line) => {
      const split = splitOf(book, line);

      return split != null && named(split).includes(payerId);
    })
    .map((line) => line.id);
}

export const canAddPayer = (payers: readonly PayerEntry[]): boolean => payers.length < PAYER_CAP;

export function nameProblem(
  name: string,
  payers: readonly PayerEntry[],
  exceptId: string | null = null,
): string | null {
  if (name.trim() === '') return W.nameBlank;
  if ([...name.trim()].length > NAME_MAX) return W.nameLong;
  const typed = name.trim().toLocaleLowerCase('en');
  const same = payers.find(
    (one) => one.id !== exceptId && one.name.trim().toLocaleLowerCase('en') === typed,
  );

  return same == null ? null : W.sameName(same.name);
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

export function withoutPayer(book: Book, id: string): Book {
  return { ...book, payers: book.payers.filter((one) => one.id !== id) };
}

export function withPayer(book: Book, payer: PayerEntry, index: number): Book {
  const payers = [...book.payers];
  payers.splice(index, 0, payer);

  return { ...book, payers };
}

export function withLink(book: Book, id: string, link: LinkState): Book {
  return { ...book, payers: book.payers.map((one) => (one.id === id ? { ...one, link } : one)) };
}

export function percentOf(text: string): number | null {
  const typed = text.trim();
  if (typed === '') return 0;
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(typed)) return null;
  const [whole = '', part = ''] = typed.split('.');

  return Number(whole === '' ? '0' : whole) * 100 + Number(`${part}00`.slice(0, 2));
}

export const PERCENT_TYPED = /^-?\d{0,4}(\.\d{0,2})?$/;

export function percentProblem(text: string): string | null {
  const typed = text.trim();
  if (typed === '') return null;
  const value = percentOf(typed);

  return value == null || value > WHOLE ? W.percentRange : null;
}

/** An amount typed in the event's currency: the demo's one parser, above 0. */
export function amountOf(text: string): number | null {
  return parsedAmount(text);
}

export function choicesFor(ticked: number): Mode[] {
  return ticked >= 2 ? ['one', 'percent'] : ['one', 'percent', 'fixed'];
}

export function replacesNote(book: Book, ticked: readonly string[]): string | null {
  if (ticked.length < 2) return null;
  const lines = inBudgetOrder(book.lines.filter((line) => ticked.includes(line.id)));
  const taken = lines.filter((line) => splitOf(book, line) != null);
  const fixedOn = taken.filter((line) => splitOf(book, line)?.kind === 'fixed');

  return taken.length === 0
    ? null
    : W.replaces(
        taken.length,
        fixedOn.map((line) => line.name),
      );
}

export interface PercentCheck {
  total: number;
  parts: Map<string, Range>;
  error: string | null;
  fields: Readonly<Record<string, string>>;
  split: Split | null;
}

export function checkPercents(
  book: Book,
  ticked: readonly string[],
  typed: Readonly<Record<string, string>>,
): PercentCheck {
  const values = book.payers.map((one) => percentOf(typed[one.id] ?? '') ?? 0);
  const total = sum(values);
  const parts = new Map<string, Range>();

  for (const line of book.lines.filter((one) => ticked.includes(one.id))) {
    const [low, high] = rangeOf(line);
    const lows = apportion(low, values, WHOLE);
    const highs = apportion(high, values, WHOLE);
    book.payers.forEach((one, index) => {
      const now = parts.get(one.id) ?? [0, 0];
      parts.set(one.id, [now[0] + (lows[index] ?? 0), now[1] + (highs[index] ?? 0)]);
    });
  }
  const fields = Object.fromEntries(
    book.payers
      .map((one) => [one.id, percentProblem(typed[one.id] ?? '')] as const)
      .filter(([, problem]) => problem != null),
  ) as Record<string, string>;
  const error = total === WHOLE ? null : W.notHundred(percentText(total));
  const shares = book.payers
    .map((one, index) => ({ payerId: one.id, value: values[index] ?? 0 }))
    .filter((one) => one.value > 0);

  const right = error == null && Object.keys(fields).length === 0;

  return { total, parts, error, fields, split: right ? { kind: 'percent', shares } : null };
}

export interface FixedCheck {
  errors: Record<string, string>;
  rest: Range;
  split: Split | null;
}

export function checkFixed(
  book: Book,
  lineId: string,
  typed: Readonly<Record<string, string>>,
  restId: string,
): FixedCheck {
  const line = book.lines.find((one) => one.id === lineId);
  const [low, high] = line == null ? [0, 0] : rangeOf(line);
  const fields = book.payers.filter((one) => one.id !== restId);
  const filled = fields.filter((one) => (typed[one.id] ?? '').trim() !== '');
  const errors: Record<string, string> = {};
  const amountsTyped: Part[] = [];

  for (const one of filled) {
    const value = amountOf(typed[one.id] ?? '');
    if (value == null) errors[one.id] = W.amountWrong;
    else amountsTyped.push({ payerId: one.id, value });
  }
  const first = fields[0];
  if (filled.length === 0 && first != null) errors[first.id] = W.amountWrong;
  const together = sum(amountsTyped.map((one) => one.value));
  const firstFilled = filled[0];
  if (Object.keys(errors).length === 0 && together > low && firstFilled != null)
    errors[firstFilled.id] = W.tooMuch(money(together), money(low));
  const rest: Range = together > low ? [0, 0] : [low - together, high - together];
  const fine = Object.keys(errors).length === 0;

  return { errors, rest, split: fine ? { kind: 'fixed', amounts: amountsTyped, restId } : null };
}

export function applyChoice(book: Book, ticked: readonly string[], split: Split | null): Book {
  const splits = { ...book.splits };
  for (const id of ticked) {
    if (split == null) delete splits[id];
    else splits[id] = split;
  }

  return { ...book, splits };
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
] as const;

export type PayersState = (typeof STATE_NAMES)[number];

export const PAYERS_STATES: readonly string[] = STATE_NAMES;

export interface ChooseStart {
  ticked: readonly string[];
  mode: Mode;
  payer?: string;
  percents?: Readonly<Record<string, string>>;
  amounts?: Readonly<Record<string, string>>;
  rest?: string;
  checked?: boolean;
}

export type Notice =
  | { kind: 'cap' }
  | { kind: 'refused'; payerId: string; count: number }
  | { kind: 'removed'; payer: PayerEntry; index: number };

export type SendKind = 'busy' | 'copied' | 'refused' | 'failed';

export interface FormStart {
  id: string | null;
  name: string;
  note: string;
  error: string | null;
}

export interface PayersStart {
  book: Book;
  open: string | null;
  notice: Notice | null;
  form: FormStart | null;
  send: { payerId: string; kind: SendKind } | null;
  choose: ChooseStart | null;
}

/** Which payer the pane opens on: the one asked for, else Mr and Mrs Obi as the board draws, else the first. */
export function openFirst(
  payers: readonly PayerEntry[],
  asked: string | null = null,
): string | null {
  const found = (id: string | null) => payers.find((one) => one.id === id)?.id;

  return found(asked) ?? found('obi') ?? payers[0]?.id ?? null;
}

export function fixedForm(split: Split | undefined): Pick<ChooseStart, 'amounts' | 'rest'> {
  if (split?.kind !== 'fixed') return {};

  return {
    amounts: Object.fromEntries(
      split.amounts.map((one) => [one.payerId, (one.value / 100).toFixed(2)]),
    ),
    rest: split.restId,
  };
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
};

const SENT: Partial<Record<PayersState, SendKind>> = {
  send_busy: 'busy',
  link_copied: 'copied',
  copy_refused: 'refused',
  send_failed: 'failed',
};

export function startOf(state: string, asked: string | null = null): PayersStart {
  const name = (STATE_NAMES as readonly string[]).includes(state)
    ? (state as PayersState)
    : 'payers';
  const sent = SENT[name];
  let book = SAMPLE_BOOK;

  if (name === 'no_payers') book = { ...SAMPLE_BOOK, payers: [], splits: {} };
  if (name === 'no_costs') book = { lines: [], payers: [], splits: {} };
  if (name === 'split_flag') book = FLAGGED;
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
  if (sent === 'copied' || sent === 'refused') book = withLink(book, 'couple', 'sent');

  const notice: Notice | null =
    name === 'payer_cap'
      ? { kind: 'cap' }
      : name === 'remove_refused'
        ? { kind: 'refused', payerId: 'obi', count: coveredBy(book, 'obi').length }
        : name === 'removed'
          ? { kind: 'removed', payer: KAYODE, index: book.payers.length }
          : null;
  const form: FormStart | null =
    name === 'add_payer'
      ? { id: null, name: KAYODE.name, note: KAYODE.note, error: null }
      : name === 'payer_duplicate'
        ? { id: null, name: 'Aunt Funmi', note: '', error: nameProblem('Aunt Funmi', book.payers) }
        : null;

  return {
    book,
    open: openFirst(book.payers, asked ?? (sent == null ? null : 'couple')),
    notice,
    form,
    send:
      sent == null
        ? null
        : { payerId: openFirst(book.payers, asked ?? 'couple') ?? '', kind: sent },
    choose: CHOOSE[name] ?? null,
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
    ],
  },
];
