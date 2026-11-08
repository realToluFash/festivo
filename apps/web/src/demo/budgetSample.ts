import { COST_LINES, amounts, totals, whole } from './budget.ts';
import { type CeilingState } from './BudgetParts.tsx';
import { type Category } from './vendors.ts';

/** The rest of A's sample (spec §1): who is paying, the ceilings and the margin, in the minor unit. */
export type LinkState = 'notSent' | 'sent' | 'opened';

export interface Covered {
  lineId: string;
  how: 'all of it' | 'half';
  amount: readonly [number, number];
}

export interface Payer {
  id: string;
  name: string;
  note: string;
  share: readonly [number, number];
  paid: number;
  link: LinkState;
  covers: readonly Covered[];
}

const half = (id: string): readonly [number, number] => {
  const line = COST_LINES.find((one) => one.id === id);
  const each = line == null ? { settled: 0, ifAll: 0 } : amounts(line);

  return [each.settled / 2, each.ifAll / 2];
};

const all = (id: string): readonly [number, number] => {
  const line = COST_LINES.find((one) => one.id === id);
  const each = line == null ? { settled: 0, ifAll: 0 } : amounts(line);

  return [each.settled, each.ifAll];
};

const sumOf = (covers: readonly Covered[]): readonly [number, number] => [
  covers.reduce((sum, one) => sum + one.amount[0], 0),
  covers.reduce((sum, one) => sum + one.amount[1], 0),
];

function payer(
  id: string,
  name: string,
  note: string,
  paid: number,
  link: LinkState,
  covers: readonly Covered[],
): Payer {
  return { id, name, note, share: sumOf(covers), paid, link, covers };
}

export const PAYERS: readonly Payer[] = [
  payer('couple', 'Adaeze and Tunde', 'The couple', 116000, 'notSent', [
    { lineId: 'photo', how: 'all of it', amount: all('photo') },
    { lineId: 'bridal', how: 'all of it', amount: all('bridal') },
  ]),
  payer('obi', 'Mr and Mrs Obi', 'Adaeze’s parents', 315000, 'opened', [
    { lineId: 'room', how: 'all of it', amount: all('room') },
    { lineId: 'dinner', how: 'half', amount: half('dinner') },
    { lineId: 'drinks', how: 'half', amount: half('drinks') },
  ]),
  payer('bakare', 'Mr and Mrs Bakare', 'Tunde’s parents', 0, 'sent', [
    { lineId: 'dinner', how: 'half', amount: half('dinner') },
    { lineId: 'drinks', how: 'half', amount: half('drinks') },
  ]),
  payer('funmi', 'Aunt Funmi', 'Covering the cars', 0, 'notSent', [
    { lineId: 'cars', how: 'all of it', amount: all('cars') },
  ]),
];

export const LINK_WORDS: Record<LinkState, string> = {
  notSent: 'Not sent yet.',
  sent: 'Sent, not opened yet.',
  opened: 'Opened 3 times. Last on Monday, Nov 2 at 21:14.',
};

/** What no payer covers yet: the costs, and their settled amount (Has a payer plus this is the range). */
export function noPayer(payers: readonly Payer[] = PAYERS): { lineIds: string[]; amount: number } {
  const covered = new Set(payers.flatMap((one) => one.covers.map((cover) => cover.lineId)));
  const lines = COST_LINES.filter((line) => !covered.has(line.id));

  return {
    lineIds: lines.map((line) => line.id),
    amount: lines.reduce((sum, line) => sum + amounts(line).settled, 0),
  };
}

export function hasPayer(payers: readonly Payer[] = PAYERS): readonly [number, number] {
  return [
    payers.reduce((sum, one) => sum + one.share[0], 0),
    payers.reduce((sum, one) => sum + one.share[1], 0),
  ];
}

export function stillToCome(one: Payer): readonly [number, number] {
  return [Math.max(0, one.share[0] - one.paid), Math.max(0, one.share[1] - one.paid)];
}

export type CeilingKey = 'whole' | Category;

export const CEILINGS: Partial<Record<CeilingKey, number>> = {
  whole: 2200000,
  catering: 1300000,
  flowers: 150000,
};

/** sc-90's state from settled, if all come and the ceiling, first match: Over, Over if all come, Close (90% or more), Within. */
export function ceilingState(settled: number, ifAll: number, ceiling: number): CeilingState {
  if (settled > ceiling) return 'over';
  if (ifAll > ceiling) return 'overIfAll';
  if (ifAll >= ceiling * 0.9) return 'close';

  return 'within';
}

export function ceilingSentence(settled: number, ifAll: number, ceiling: number): string {
  if (ceiling === 0 && ifAll === 0) return 'Nothing is costed here; one amount puts it over.';
  switch (ceilingState(settled, ifAll, ceiling)) {
    case 'over':
      return `Settled, it is ${whole(settled)} against ${whole(ceiling)}.`;
    case 'overIfAll':
      return `Settled, it is ${whole(settled)}. If everyone comes, it would be ${whole(ifAll)} against ${whole(ceiling)}.`;
    default:
      return `If everyone comes, it would be ${whole(ifAll)} against ${whole(ceiling)}.`;
  }
}

export function categoryTotals(category: Category): { settled: number; ifAll: number } {
  return totals(COST_LINES.filter((line) => line.category === category));
}

/** sc-92 and sc-31468 (Enterprise): a 20% markup on the event, Photography 15%, Venue at cost, a £3,000 planning fee. */
export const MARGIN = {
  client: [2529600, 2929200],
  cost: [1973000, 2306000],
  margin: [556600, 623200],
  marginShare: ['22.0%', '21.3%'],
  after: [485600, 885200],
  afterShare: ['19.2%', '30.2%'],
} as const;

export type ViewerKey = 'folake' | 'julien' | 'ana' | 'kemi';

export interface Viewer {
  key: ViewerKey;
  name: string;
  role: 'Owner' | 'Admin' | 'Lead' | 'Can edit';
  manages: boolean;
  seesBudget: boolean;
}

const VIEWERS: Record<ViewerKey, Viewer> = {
  folake: { key: 'folake', name: 'Folake Adeyemi', role: 'Owner', manages: true, seesBudget: true },
  julien: { key: 'julien', name: 'Julien Moreau', role: 'Admin', manages: true, seesBudget: true },
  ana: { key: 'ana', name: 'Ana Souza', role: 'Lead', manages: false, seesBudget: true },
  kemi: { key: 'kemi', name: 'Kemi Okafor', role: 'Can edit', manages: false, seesBudget: false },
};

export function viewerOf(as: string | null): Viewer {
  return VIEWERS[(as ?? 'folake') as ViewerKey] ?? VIEWERS.folake;
}

export type OrgPlan = 'enterprise' | 'free' | 'downgraded';

export function planOf(plan: string | null): OrgPlan {
  return plan === 'free' || plan === 'downgraded' ? plan : 'enterprise';
}

export interface DemoLink {
  to: string;
  name: string;
}

export interface DemoGroup {
  name: string;
  states: readonly DemoLink[];
}

export function budgetAt(state?: string, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams({ area: 'budget', ...extra });
  if (state != null) query.set('state', state);

  return `/demo/events/evt-wed-4?${query.toString()}`;
}
