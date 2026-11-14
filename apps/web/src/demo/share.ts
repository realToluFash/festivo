import { writtenTime } from './clock.ts';
import {
  BUDGET_EVENT,
  COST_LINES,
  type CostLine,
  DAYS,
  HEADS,
  NOW,
  PAYMENTS,
  type Payment,
  QUOTES,
  READER,
  TODAY,
  amounts,
  CURRENCY,
  lineState,
  owed,
  perHead,
  shortDay,
  totals,
  money as moneyIn,
  whole as wholeIn,
} from './budget.ts';
import { type Lang, readerTag } from './guest.ts';
import { READER_WORDS, type ReaderWords } from './shareLanguages.ts';
import {
  type DemoGroup,
  MARGIN,
  PAYERS,
  type Payer,
  budgetAt,
  stillToCome,
} from './budgetSample.ts';
import { ORGANISATION, sampleEvent } from './events.ts';
import { SHARE_WORDS as W } from './shareWords.ts';
import { type Category } from './vendors.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';

/** sc-94's links at a desk and the page they open, signed out (Budget-A-Share), on the wedding of spec §1. */
export const EVENT_NAME = sampleEvent(BUDGET_EVENT)?.name ?? '';
export const ZONE = 'Europe/London';

export const SHARE_STATES: readonly string[] = [
  'links',
  'no_links',
  'no_category',
  'past_date',
  'short_passphrase',
  'long_passphrase',
  'revoke',
  'created',
  'no_payer',
];

export const RECIPIENT_STATES = [
  'payer',
  'whole',
  'category',
  'marked_up',
  'passphrase',
  'wrong_passphrase',
  'too_many_attempts',
  'too_many_soon',
  'ended',
  'gone',
  'payer_no_payments',
  'whole_no_payments',
  'category_no_payments',
  'loading',
  'failed',
] as const;
export type RecipientState = (typeof RECIPIENT_STATES)[number];

/** The demo's right passphrase for the whole budget's link; the demo home's link says it. */
export const PASSPHRASE = 'marigold-lace';
/** sc-94: 10 wrong on one link within 15 minutes, then refused for 15 minutes, the right one too. */
export const MOST_WRONG = 10;
export const LOCKED_UNTIL = new Date('2026-11-03T14:47:00Z');
export const PASSPHRASE_FEWEST = 8;
export const PASSPHRASE_MOST = 64;

export type Scope = 'whole' | 'category' | 'payer';
export const SCOPES: readonly Scope[] = ['whole', 'category', 'payer'];

export function isScope(value: string | null | undefined): value is Scope {
  return value === 'whole' || value === 'category' || value === 'payer';
}

export interface ShareLink {
  id: string;
  scope: Scope;
  of: string | null;
  endsOn: string | null;
  passphrase: boolean;
  opens: number;
  lastOpened: string | null;
  by: string;
  revoked: boolean;
  url: string;
}

const TOKEN = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_';

/** A link's address: a token of 22 characters (132 bits); the demo's are made up. */
export function urlOf(id: string): string {
  let token = 'Q7v4';
  let next =
    Array.from(id).reduce((sum, one) => sum * 31 + (one.codePointAt(0) ?? 0), 7) % 2147483647;
  while (token.length < 22) {
    next = (next * 48271) % 2147483647;
    token += TOKEN[next % TOKEN.length];
  }

  return `https://soirely.com/s/${token}`;
}

const link = (id: string, scope: Scope, of: string | null, more: Partial<ShareLink> = {}) => ({
  id,
  scope,
  of,
  endsOn: null,
  passphrase: false,
  opens: 0,
  lastOpened: null,
  by: READER,
  revoked: false,
  url: urlOf(id),
  ...more,
});

export const LINKS: readonly ShareLink[] = [
  link('obi', 'payer', 'obi', { opens: 3, lastOpened: '2026-11-02' }),
  link('bakare', 'payer', 'bakare'),
  link('whole', 'whole', null, {
    endsOn: '2026-11-07',
    passphrase: true,
    opens: 1,
    lastOpened: '2026-10-30',
  }),
  link('flowers', 'category', 'flowers', { endsOn: '2026-10-31', opens: 2 }),
];

function payerOf(id: string | null): Payer | undefined {
  return PAYERS.find((one) => one.id === id);
}

export function titleOf(one: Pick<ShareLink, 'scope' | 'of'>): string {
  if (one.scope === 'whole') return W.scope.whole;
  if (one.scope === 'category') return CATEGORY_WORDS[one.of as Category] ?? '';

  return W.payersShare(payerOf(one.of)?.name ?? '');
}

export function titleInSentence(one: Pick<ShareLink, 'scope' | 'of'>): string {
  const title = titleOf(one);

  return one.scope === 'whole' ? title.replace(/^The /u, 'the ') : title;
}

export function ended(one: ShareLink, today = TODAY): boolean {
  return one.revoked || (one.endsOn != null && one.endsOn < today);
}

export function linkLine(one: ShareLink, today = TODAY): string {
  const day = (on: string | null) => shortDay(on ?? today);
  const parts = [
    one.scope === 'whole' ? null : W.scope[one.scope],
    one.endsOn == null
      ? W.noEnd
      : one.endsOn < today
        ? W.endedOn(day(one.endsOn))
        : W.ends(day(one.endsOn)),
    one.passphrase ? W.asksPassphrase : null,
    one.opens === 0
      ? W.notOpened
      : one.opens === 1
        ? W.openedOnce(day(one.lastOpened))
        : one.opens === 2
          ? W.openedTwice
          : W.opened(one.opens, day(one.lastOpened)),
    W.madeBy(one.by),
  ];

  return parts.filter((part) => part != null).join(' · ');
}

export interface Draft {
  scope: Scope;
  category: Category | '';
  payer: string;
  endsOn: string;
  passphrase: string;
}

export type DraftField = 'category' | 'payer' | 'endsOn' | 'passphrase';
export type DraftProblems = Partial<Record<DraftField, string>>;

export const BLANK_DRAFT: Draft = {
  scope: 'payer',
  category: '',
  payer: 'funmi',
  endsOn: '',
  passphrase: '',
};

export const SHORT_SAMPLE = 'tunde26';
export const LONG_SAMPLE =
  'for the Obi and Bakare families, the budget for Adaeze and Tunde at The Landmark';

export function lengthOf(typed: string): number {
  return Array.from(typed).length;
}

export function draftProblems(draft: Draft, today = TODAY): DraftProblems {
  const problems: DraftProblems = {};
  const length = lengthOf(draft.passphrase);

  if (draft.scope === 'category' && draft.category === '') problems.category = W.noCategory;
  if (draft.scope === 'payer' && draft.payer === '') problems.payer = W.noPayer;
  if (draft.endsOn !== '' && draft.endsOn <= today) problems.endsOn = W.pastDate;
  if (length > 0 && length < PASSPHRASE_FEWEST) problems.passphrase = W.shortPassphrase;
  if (length > PASSPHRASE_MOST) problems.passphrase = W.longPassphrase;

  return problems;
}

export function linkOf(draft: Draft, id: string, by: string): ShareLink {
  return link(id, draft.scope, draft.scope === 'whole' ? null : draft[draft.scope] || null, {
    endsOn: draft.endsOn === '' ? null : draft.endsOn,
    passphrase: draft.passphrase !== '',
    by,
  });
}

export interface Desk {
  links: readonly ShareLink[];
  draft: Draft;
  problems: DraftProblems;
  asking: string | null;
  created: string | null;
}

const CREATED = linkOf(BLANK_DRAFT, 'funmi', READER);

export function deskStart(state: string): Desk {
  const desk: Desk = {
    links: LINKS,
    draft: BLANK_DRAFT,
    problems: {},
    asking: null,
    created: null,
  };
  const tried = (draft: Partial<Draft>): Desk => {
    const typed = { ...BLANK_DRAFT, ...draft };

    return { ...desk, draft: typed, problems: draftProblems(typed) };
  };

  switch (state) {
    case 'no_links':
      return { ...desk, links: [] };
    case 'no_category':
      return tried({ scope: 'category' });
    case 'no_payer':
      return tried({ scope: 'payer', payer: '' });
    case 'past_date':
      return tried({ endsOn: '2026-11-02' });
    case 'short_passphrase':
      return tried({ passphrase: SHORT_SAMPLE });
    case 'long_passphrase':
      return tried({ passphrase: LONG_SAMPLE });
    case 'revoke':
      return { ...desk, asking: 'bakare' };
    case 'created':
      return { ...desk, links: [CREATED, ...LINKS], created: CREATED.id };
    default:
      return desk;
  }
}

export function shareCategories(lines: readonly CostLine[] = COST_LINES): Category[] {
  const order = Object.keys(CATEGORY_WORDS) as Category[];

  return order.filter((category) => lines.some((line) => line.category === category));
}

export interface Row {
  title: string;
  line: string | null;
  value: string;
}

export interface Block {
  head: string | null;
  rows: readonly Row[];
  loose?: boolean;
}

export interface Shared {
  title: string;
  name: string;
  label: string | null;
  figure: string;
  sentence: string;
  blocks: readonly Block[];
}

/** The wedding's vendors by the brief's ids (v3 to v6), as budget.test.ts names them until the directory's rework lands. */
const VENDOR_NAMES: Record<string, string> = {
  v3: 'Bloom & Co',
  v4: 'Savour Kitchen',
  v5: 'The Landmark',
  v6: 'Lens & Light',
};

const vendorName = (id: string): string => VENDOR_NAMES[id] ?? '';

/** Who reads the share: the words of the language they chose, and money and dates in their locale (CLDR). */
export interface Reading {
  w: ReaderWords;
  locale: string;
}

export function readingOf(lang: Lang = 'en', device?: string): Reading {
  return {
    w: READER_WORDS[lang],
    locale: readerTag(lang, device),
  };
}

const ENGLISH = readingOf('en');

const money = (minor: number, r: Reading): string => moneyIn(minor, CURRENCY, r.locale);
const whole = (minor: number, r: Reading): string => wholeIn(minor, CURRENCY, r.locale);
const moneyRange = (low: number, high: number, r: Reading): string =>
  low === high ? money(low, r) : r.w.range(money(low, r), money(high, r));
const wholeRange = (low: number, high: number, r: Reading): string =>
  low === high ? whole(low, r) : r.w.range(whole(low, r), whole(high, r));

export function dayOf(day: string, r: Reading = ENGLISH): string {
  return new Intl.DateTimeFormat(r.locale, { ...r.w.day, timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

export function everyday(line: CostLine, r: Reading = ENGLISH): Row {
  const state = lineState(line);
  const how =
    state === 'nothingYet'
      ? r.w.noSeatingPlan
      : line.basis === 'perHead'
        ? r.w.forEachGuest
        : line.basis === 'perDay'
          ? r.w.forEachDay(DAYS)
          : null;
  const each = amounts(line);

  return {
    title: line.name,
    line: [r.w.categories[line.category], how].filter(Boolean).join(' · '),
    value:
      state === 'notPriced'
        ? r.w.notPriced
        : state === 'nothingYet'
          ? r.w.nothingYet
          : moneyRange(each.settled, each.ifAll, r),
  };
}

/** sc-92's sample markups (spec §1): 20% on the event, Photography 15%, Venue at cost, and a planning fee at its own price. */
export const MARKUP: Partial<Record<Category, number>> & { event: number } = {
  event: 20,
  photography: 15,
  venue: 0,
};
export const PLANNING_FEE = 300000;

const charged = (minor: number, category: Category): number =>
  Math.round((minor * (100 + (MARKUP[category] ?? MARKUP.event))) / 100);

export function clientRows(lines: readonly CostLine[] = COST_LINES, r: Reading = ENGLISH): Row[] {
  return [
    ...lines.map((line) => {
      const row = everyday(line, r);
      if (lineState(line) !== 'priced') return row;
      const each = amounts(line);

      return {
        ...row,
        value: moneyRange(
          charged(each.settled, line.category),
          charged(each.ifAll, line.category),
          r,
        ),
      };
    }),
    { title: r.w.planningFee, line: null, value: money(PLANNING_FEE, r) },
  ];
}

export function clientTotals(lines: readonly CostLine[] = COST_LINES): [number, number] {
  return lines.reduce<[number, number]>(
    (sum, line) => {
      const each = amounts(line);

      return [
        sum[0] + charged(each.settled, line.category),
        sum[1] + charged(each.ifAll, line.category),
      ];
    },
    [PLANNING_FEE, PLANNING_FEE],
  );
}

function rangeSentence(low: number, high: number, r: Reading): string {
  return low === high
    ? r.w.repliesDoNot
    : r.w.between(whole(low, r), whole(high, r), HEADS.stillToAnswer);
}

function soonest(payments: readonly Payment[]): Payment | undefined {
  return payments
    .filter(owed)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.id.localeCompare(b.id))[0];
}

function paymentsOf(category: Category | null): Payment[] {
  if (category == null) return [...PAYMENTS];
  const ids = new Set(
    COST_LINES.filter((line) => line.category === category).map((line) => line.id),
  );
  const vendors = new Set(
    QUOTES.filter((quote) => quote.lineIds.some((id) => ids.has(id))).map(
      (quote) => quote.vendorId,
    ),
  );

  return PAYMENTS.filter((one) => vendors.has(one.vendorId));
}

/** Paid and still to pay; with no payment recorded or scheduled yet, one row that says so, never £0 (sc-94's "without payments"). */
function payments(category: Category | null, r: Reading, none: boolean): Row[] {
  if (none) return [{ title: r.w.paid, line: r.w.noneScheduled, value: r.w.nothingYet }];
  const these = paymentsOf(category);
  const paid = these.reduce((sum, one) => sum + (one.paid?.amount ?? 0), 0);
  const still = these.filter(owed).reduce((sum, one) => sum + one.amount, 0);
  const next = soonest(these);
  const line =
    next == null
      ? null
      : category == null
        ? r.w.nextTo(money(next.amount, r), vendorName(next.vendorId), dayOf(next.dueOn, r))
        : r.w.next(money(next.amount, r), dayOf(next.dueOn, r));

  return [
    { title: r.w.paid, line: null, value: money(paid, r) },
    { title: r.w.stillToPay, line, value: money(still, r) },
  ];
}

export function timeOf(at: Date, r: Reading = ENGLISH): string {
  return writtenTime(at, r.locale, ZONE);
}

export function updatedLine(r: Reading = ENGLISH): string {
  return r.w.sharedBy(ORGANISATION, dayOf(TODAY, r), timeOf(NOW, r));
}

export const UPDATED_LINE = updatedLine();

export interface ViewOptions {
  marked?: boolean;
  none?: boolean;
  reading?: Reading;
}

/** What a scope shows, top to bottom; with a client price on any line, client figures and no payments at all (sc-94, sc-92). */
export function sharedView(
  scope: Scope,
  { marked = false, none = false, reading: r = ENGLISH }: ViewOptions = {},
): Shared {
  if (scope === 'payer') {
    const one = payerOf('obi') as Payer;
    const [low, high] = one.share;
    const [stillLow, stillHigh] = none ? one.share : stillToCome(one);

    return {
      title: r.w.yourShareOf(EVENT_NAME),
      name: one.name,
      label: r.w.yourShare,
      figure: wholeRange(low, high, r),
      sentence: rangeSentence(low, high, r),
      blocks: [
        {
          head: null,
          rows: [
            {
              title: r.w.paid,
              line: null,
              value: none ? r.w.nothingYet : money(one.paid, r),
            },
            { title: r.w.stillToCome, line: null, value: moneyRange(stillLow, stillHigh, r) },
          ],
        },
        {
          head: r.w.whatItCovers,
          rows: one.covers.map((cover) => ({
            title: COST_LINES.find((line) => line.id === cover.lineId)?.name ?? '',
            line: r.w.covers[cover.how],
            value: moneyRange(...cover.amount, r),
          })),
        },
      ],
    };
  }

  if (scope === 'category') {
    const category: Category = 'flowers';
    const lines = COST_LINES.filter((line) => line.category === category);
    const sum = totals(lines);
    const word = r.w.categories[category];
    const sentence = [
      rangeSentence(sum.settled, sum.ifAll, r),
      sum.notPriced === 0 ? null : r.w.notPricedYet(sum.notPriced),
    ];

    return {
      title: r.w.categoryFor(word, EVENT_NAME),
      name: word,
      label: r.w.willCost(word),
      figure: wholeRange(sum.settled, sum.ifAll, r),
      sentence: sentence.filter(Boolean).join(' '),
      blocks: [
        { head: null, rows: lines.map((line) => everyday(line, r)), loose: true },
        { head: null, rows: payments(category, r, none) },
      ],
    };
  }

  const [low, high] = marked ? MARGIN.client : [totals().settled, totals().ifAll];
  const each = marked
    ? { settled: Math.round(low / HEADS.coming), ifAll: Math.round(high / HEADS.ifAllCome) }
    : perHead();
  const heads: Row[] = [
    {
      title: r.w.perHeadSettled,
      line: r.w.coming(HEADS.coming),
      value: money(each.settled ?? 0, r),
    },
    {
      title: r.w.perHeadIfAll,
      line: r.w.coming(HEADS.ifAllCome),
      value: money(each.ifAll ?? 0, r),
    },
  ];

  return {
    title: r.w.budgetFor(EVENT_NAME),
    name: r.w.thisEventWillCost,
    label: null,
    figure: wholeRange(low, high, r),
    sentence: rangeSentence(low, high, r),
    blocks: [
      { head: null, rows: marked ? heads : [...heads, ...payments(null, r, none)] },
      {
        head: r.w.whatItIsMadeOf,
        rows: marked ? clientRows(COST_LINES, r) : COST_LINES.map((line) => everyday(line, r)),
      },
    ],
  };
}

/** `locked` came with a usable Retry-After; `lockedSoon` did not (sc-94's two 429 lines). */
export type Answer = 'open' | 'wrong' | 'locked' | 'lockedSoon';

export type Visit =
  | { page: 'shown'; scope: Scope; marked: boolean; none: boolean }
  | { page: 'loading'; scope: Scope }
  | { page: 'failed'; scope: Scope }
  | { page: 'gate'; scope: Scope; wrong: number; answer: Answer | null; tried: string }
  | { page: 'ended'; by: string }
  | { page: 'gone' };

export function visitOf(path: string | undefined, state: string | null): Visit {
  const scope = isScope(state) ? state : isScope(path) ? path : null;

  if (scope != null && state === 'ended') return { page: 'ended', by: READER };
  if (scope == null || state === 'gone') return { page: 'gone' };
  if (state === 'marked_up') return { page: 'shown', scope: 'whole', marked: true, none: false };
  if (state === 'loading' || state === 'failed') return { page: state, scope };
  if (state?.endsWith('_no_payments') === true)
    return { page: 'shown', scope, marked: false, none: true };
  if (state === 'passphrase') return { page: 'gate', scope, wrong: 0, answer: null, tried: '' };
  if (state === 'wrong_passphrase')
    return { page: 'gate', scope, wrong: 1, answer: 'wrong', tried: 'marigold' };
  if (state === 'too_many_attempts' || state === 'too_many_soon')
    return {
      page: 'gate',
      scope,
      wrong: MOST_WRONG,
      answer: state === 'too_many_soon' ? 'lockedSoon' : 'locked',
      tried: 'marigold',
    };

  return { page: 'shown', scope, marked: false, none: false };
}

/** The server's answer to a passphrase: locked after 10 wrong, the right one refused too. */
export function answerTo(typed: string, wrong: number, retry = true): Answer {
  if (wrong >= MOST_WRONG) return retry ? 'locked' : 'lockedSoon';

  return typed === PASSPHRASE ? 'open' : 'wrong';
}

const ORGANISER: Record<string, string> = {
  links: 'The event’s links, Create a link beside them',
  no_links: 'No links yet',
  no_category: 'One category, with none chosen',
  past_date: 'An end date that is not after today',
  short_passphrase: 'A passphrase under 8 characters',
  long_passphrase: 'A passphrase over 64 characters',
  revoke: 'Revoke, asked once in the row',
  created: 'Link created, with Copy the link',
  no_payer: 'One payer’s share, with none chosen',
};

const RECIPIENT: Record<RecipientState, { scope: Scope; name: string }> = {
  payer: { scope: 'payer', name: 'Mr and Mrs Obi’s share' },
  whole: { scope: 'whole', name: 'The whole budget' },
  category: { scope: 'category', name: 'One category, Flowers' },
  marked_up: { scope: 'whole', name: 'The whole budget, with client prices: no payments' },
  passphrase: {
    scope: 'whole',
    name: `Asks for a passphrase (the right one is ${PASSPHRASE})`,
  },
  wrong_passphrase: { scope: 'whole', name: 'A wrong passphrase' },
  too_many_attempts: { scope: 'whole', name: 'Too many wrong passphrases' },
  too_many_soon: { scope: 'whole', name: 'Too many wrong passphrases, with no time to wait for' },
  ended: { scope: 'whole', name: 'Revoked or ended: who to ask for a new one' },
  gone: { scope: 'whole', name: 'Never made, or a removed payer’s: one answer' },
  payer_no_payments: { scope: 'payer', name: 'Mr and Mrs Obi’s share, nothing paid yet' },
  whole_no_payments: { scope: 'whole', name: 'The whole budget, no payments yet' },
  category_no_payments: { scope: 'category', name: 'One category, Flowers, no payments yet' },
  loading: { scope: 'payer', name: 'Loading' },
  failed: { scope: 'payer', name: 'Could not load: Try again' },
};

export function recipientAt(state: RecipientState): string {
  return `/demo/share/${RECIPIENT[state].scope}?state=${state}`;
}

export const SHARE_PAGES: readonly DemoGroup[] = [
  {
    name: 'Share, at a desk',
    states: SHARE_STATES.map((state) => ({ to: budgetAt(state), name: ORGANISER[state] ?? state })),
  },
  {
    name: 'What a link opens, signed out · open each at a phone width (402), then try 834, 1194 and 1280',
    states: RECIPIENT_STATES.map((state) => ({
      to: recipientAt(state),
      name: RECIPIENT[state].name,
    })),
  },
];
