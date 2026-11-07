import {
  BUDGET_EVENT,
  COST_LINES,
  type CostLine,
  DAYS,
  HEADS,
  LOCALE,
  NOW,
  PAYMENTS,
  type Payment,
  QUOTES,
  READER,
  TODAY,
  amounts,
  lineState,
  money,
  moneyRange,
  owed,
  perHead,
  shortDay,
  totals,
  whole,
  wholeRange,
} from './budget.ts';
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
import { CATEGORY_WORDS, type Category } from './vendors.ts';

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
];

export const RECIPIENT_STATES = [
  'payer',
  'whole',
  'category',
  'marked_up',
  'passphrase',
  'wrong_passphrase',
  'too_many_attempts',
  'gone',
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

export type DraftField = 'category' | 'endsOn' | 'passphrase';
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

export function everyday(line: CostLine): Row {
  const state = lineState(line);
  const how =
    state === 'nothingYet'
      ? W.noSeatingPlan
      : line.basis === 'perHead'
        ? W.forEachGuest
        : line.basis === 'perDay'
          ? W.forEachDay(DAYS)
          : null;
  const each = amounts(line);

  return {
    title: line.name,
    line: [CATEGORY_WORDS[line.category], how].filter(Boolean).join(' · '),
    value:
      state === 'notPriced'
        ? W.notPriced
        : state === 'nothingYet'
          ? W.nothingYet
          : moneyRange(each.settled, each.ifAll),
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

export function clientRows(lines: readonly CostLine[] = COST_LINES): Row[] {
  return [
    ...lines.map((line) => {
      const row = everyday(line);
      if (lineState(line) !== 'priced') return row;
      const each = amounts(line);

      return {
        ...row,
        value: moneyRange(charged(each.settled, line.category), charged(each.ifAll, line.category)),
      };
    }),
    { title: W.planningFee, line: null, value: money(PLANNING_FEE) },
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

function rangeSentence(low: number, high: number): string {
  return low === high ? W.repliesDoNot : W.between(whole(low), whole(high), HEADS.stillToAnswer);
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

function payments(category: Category | null): Row[] {
  const these = paymentsOf(category);
  const paid = these.reduce((sum, one) => sum + (one.paid?.amount ?? 0), 0);
  const still = these.filter(owed).reduce((sum, one) => sum + one.amount, 0);
  const next = soonest(these);
  const line =
    next == null
      ? null
      : category == null
        ? W.nextTo(money(next.amount), vendorName(next.vendorId), shortDay(next.dueOn))
        : W.next(money(next.amount), shortDay(next.dueOn));

  return [
    { title: W.paid, line: null, value: money(paid) },
    { title: W.stillToPay, line, value: money(still) },
  ];
}

const UPDATED = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONE,
});

export function timeOf(at: Date): string {
  return UPDATED.format(at);
}

export const UPDATED_LINE = W.sharedBy(ORGANISATION, shortDay(TODAY), timeOf(NOW));

/** What a scope shows, top to bottom; with a client price on any line, client figures and no payments at all (sc-94, sc-92). */
export function sharedView(scope: Scope, marked = false): Shared {
  if (scope === 'payer') {
    const one = payerOf('obi') as Payer;
    const [low, high] = one.share;

    return {
      title: W.yourShareOf(EVENT_NAME),
      name: one.name,
      label: W.yourShare,
      figure: wholeRange(low, high),
      sentence: rangeSentence(low, high),
      blocks: [
        {
          head: null,
          rows: [
            { title: W.paid, line: null, value: money(one.paid) },
            { title: W.stillToCome, line: null, value: moneyRange(...stillToCome(one)) },
          ],
        },
        {
          head: W.whatItCovers,
          rows: one.covers.map((cover) => ({
            title: COST_LINES.find((line) => line.id === cover.lineId)?.name ?? '',
            line: cover.how,
            value: moneyRange(...cover.amount),
          })),
        },
      ],
    };
  }

  if (scope === 'category') {
    const category: Category = 'flowers';
    const lines = COST_LINES.filter((line) => line.category === category);
    const sum = totals(lines);
    const word = CATEGORY_WORDS[category];
    const sentence = [
      rangeSentence(sum.settled, sum.ifAll),
      sum.notPriced === 0 ? null : W.notPricedYet(sum.notPriced),
    ];

    return {
      title: W.categoryFor(word, EVENT_NAME),
      name: word,
      label: W.willCost(word),
      figure: wholeRange(sum.settled, sum.ifAll),
      sentence: sentence.filter(Boolean).join(' '),
      blocks: [
        { head: null, rows: lines.map(everyday), loose: true },
        { head: null, rows: payments(category) },
      ],
    };
  }

  const [low, high] = marked ? MARGIN.client : [totals().settled, totals().ifAll];
  const each = marked
    ? { settled: Math.round(low / HEADS.coming), ifAll: Math.round(high / HEADS.ifAllCome) }
    : perHead();
  const heads: Row[] = [
    { title: W.perHeadSettled, line: W.coming(HEADS.coming), value: money(each.settled ?? 0) },
    { title: W.perHeadIfAll, line: W.coming(HEADS.ifAllCome), value: money(each.ifAll ?? 0) },
  ];

  return {
    title: W.budgetFor(EVENT_NAME),
    name: W.thisEventWillCost,
    label: null,
    figure: wholeRange(low, high),
    sentence: rangeSentence(low, high),
    blocks: [
      { head: null, rows: marked ? heads : [...heads, ...payments(null)] },
      { head: W.whatItIsMadeOf, rows: marked ? clientRows() : COST_LINES.map(everyday) },
    ],
  };
}

export type Answer = 'open' | 'wrong' | 'locked';

export type Visit =
  | { page: 'shown'; scope: Scope; marked: boolean }
  | { page: 'gate'; scope: Scope; wrong: number; answer: Answer | null; tried: string }
  | { page: 'gone' };

export function visitOf(path: string | undefined, state: string | null): Visit {
  const scope = isScope(state) ? state : isScope(path) ? path : null;

  if (scope == null || state === 'gone') return { page: 'gone' };
  if (state === 'marked_up') return { page: 'shown', scope: 'whole', marked: true };
  if (state === 'passphrase') return { page: 'gate', scope, wrong: 0, answer: null, tried: '' };
  if (state === 'wrong_passphrase')
    return { page: 'gate', scope, wrong: 1, answer: 'wrong', tried: 'marigold' };
  if (state === 'too_many_attempts')
    return { page: 'gate', scope, wrong: MOST_WRONG, answer: 'locked', tried: 'marigold' };

  return { page: 'shown', scope, marked: false };
}

/** The server's answer to a passphrase: locked after 10 wrong, the right one refused too. */
export function answerTo(typed: string, wrong: number): Answer {
  if (wrong >= MOST_WRONG) return 'locked';

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
  gone: { scope: 'whole', name: 'Revoked, ended or never made: one answer' },
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
