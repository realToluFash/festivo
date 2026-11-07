import { type Basis, COST_LINES, CURRENCY, LOCALE, rateWords, shortDay, whole } from './budget.ts';
import { type DemoGroup, budgetAt } from './budgetSample.ts';
import { TEMPLATES_WORDS as W } from './templatesWords.ts';
import { CATEGORY_WORDS, type Category } from './vendors.ts';

export const TEMPLATES_STATES: readonly string[] = [
  'start_from',
  'start_template',
  'start_actual',
  'start_not_over',
  'calibration',
  'calibration_three',
  'calibration_empty',
];

export const TEMPLATES_PAGES: readonly DemoGroup[] = [
  {
    name: 'Start from an earlier budget (sc-96)',
    states: [
      { to: budgetAt('start_from'), name: 'A wedding priced in euros, unpriced here (start_from)' },
      { to: budgetAt('start_template'), name: 'A template: rates, never counts (start_template)' },
      {
        to: budgetAt('start_actual'),
        name: 'An event that is over: what it came to (start_actual)',
      },
      { to: budgetAt('start_not_over'), name: 'Not over yet: planned rates (start_not_over)' },
    ],
  },
  {
    name: 'Save as template, opened on Budget',
    states: [
      { to: budgetAt('save_taken'), name: 'A name already taken, ignoring case (save_taken)' },
      { to: budgetAt('save_blank'), name: 'Saved with no name (save_blank)' },
      { to: budgetAt('save_long'), name: 'A name over 80 characters (save_long)' },
    ],
  },
  {
    name: 'Calibration',
    states: [
      { to: budgetAt('calibration'), name: 'From 2 events, not a pattern yet (calibration)' },
      { to: budgetAt('calibration_three'), name: 'From 3 events (calibration_three)' },
      { to: budgetAt('calibration_empty'), name: 'Nothing to learn from yet (calibration_empty)' },
    ],
  },
];

export type SourceId = 'london' | 'rafael' | 'chidi' | 'summer';

export interface Source {
  id: SourceId;
  name: string;
  template: boolean;
  wedding: boolean;
  on: string | null;
  city: string | null;
  costs: number;
  currency: 'GBP' | 'EUR';
}

/** What to start from: a template, then earlier events, the same type first (sc-96). */
export const SOURCES: readonly Source[] = [
  {
    id: 'london',
    name: 'Wedding, London',
    template: true,
    wedding: true,
    on: null,
    city: null,
    costs: 9,
    currency: 'GBP',
  },
  {
    id: 'rafael',
    name: 'Rafael & Inês’s wedding',
    template: false,
    wedding: true,
    on: '2026-10-17',
    city: 'Lisbon',
    costs: 11,
    currency: 'EUR',
  },
  {
    id: 'chidi',
    name: 'Chidi’s 30th',
    template: false,
    wedding: false,
    on: '2026-09-26',
    city: 'London',
    costs: 6,
    currency: 'GBP',
  },
  {
    id: 'summer',
    name: 'Ire Events summer party',
    template: false,
    wedding: false,
    on: '2026-08-22',
    city: 'London',
    costs: 8,
    currency: 'GBP',
  },
];

const IN_WORDS = { GBP: W.inPounds, EUR: W.inEuros } as const;

export function sourceLine(source: Source): string {
  const said = [
    source.template ? W.aTemplate : null,
    source.on == null ? null : shortDay(source.on),
    source.city,
    W.costs(source.costs),
    IN_WORDS[source.currency],
  ];

  return said.filter((one) => one != null).join(' · ');
}

export function sourceOf(state: string): SourceId {
  if (state === 'start_template') return 'london';
  if (state === 'start_actual') return 'chidi';
  if (state === 'start_not_over') return 'summer';

  return 'rafael';
}

export interface PreviewRow {
  name: string;
  line: string;
  value: string | null;
}

export interface Preview {
  line: string;
  rows: readonly PreviewRow[];
}

const rate = (basis: Basis, minor: number): string =>
  rateWords({ id: '', name: '', category: 'other', basis, rate: minor }) ?? '';

const named = (id: string): string => COST_LINES.find((line) => line.id === id)?.name ?? id;

/** What came to, in whole units, with its unit: "£66 a head" (sc-96: whole units in the "came to" line). */
function cameTo(basis: Basis, minor: number): string {
  const unit = rate(basis, 0).replace(/^\S+\s?/u, '');

  return unit === '' ? whole(minor) : `${whole(minor)} ${unit}`;
}

export function previewOf(id: SourceId): Preview {
  const source = SOURCES.find((one) => one.id === id) ?? SOURCES[1];

  switch (id) {
    case 'london':
      return {
        line: W.templateLine(source?.costs ?? 0),
        rows: (
          [
            ['dinner', 'perHead', 6400],
            ['room', 'perDay', 190000],
            ['photo', 'fixed', 220000],
          ] as const
        ).map(([line, basis, minor]) => ({
          name: named(line),
          line: W.basis[basis],
          value: rate(basis, minor),
        })),
      };
    case 'chidi':
      return {
        line: W.overLine,
        rows: [
          {
            name: named('dinner'),
            line: W.cameTo(source?.name ?? '', cameTo('perHead', 6600), whole(6200)),
            value: rate('perHead', 6600),
          },
          { name: named('drinks'), line: W.severalCosts, value: rate('perHead', 2000) },
          { name: 'Cake', line: W.nothingPaid, value: rate('fixed', 28000) },
          { name: named('dj'), line: W.noQuote, value: rate('fixed', 85000) },
        ],
      };
    case 'summer':
      return {
        line: W.notOverLine,
        rows: [
          { name: named('dinner'), line: W.notOverYet, value: rate('perHead', 6200) },
          { name: named('dj'), line: W.notOverYet, value: rate('fixed', 85000) },
        ],
      };
    default:
      return {
        line: W.inEurosLine(source?.costs ?? 0),
        rows: ['dinner', 'room', 'photo'].map((line) => ({
          name: named(line),
          line: W.otherCurrency(source?.currency ?? '', source?.name ?? '', CURRENCY),
          value: null,
        })),
      };
  }
}

export type CalibrationKind = 'few' | 'three' | 'empty';

export function calibrationOf(state: string): CalibrationKind {
  if (state === 'calibration_three') return 'three';
  if (state === 'calibration_empty') return 'empty';

  return 'few';
}

interface Learned {
  category: Category;
  planned: number;
  paid: number;
  events: number;
}

interface VendorPaid {
  name: string;
  paid: readonly { minor: number; currency: string }[];
}

export interface CurrencyBlock {
  currency: 'GBP' | 'EUR';
  categories: readonly Learned[];
  vendors: readonly VendorPaid[];
}

/** Concluded events' paid quotes over a single cost, one set per currency (sc-96). */
export function calibrationBlocks(kind: CalibrationKind): CurrencyBlock[] {
  if (kind === 'empty') return [];
  const events = kind === 'three' ? 3 : 2;

  return [
    {
      currency: 'GBP',
      categories: [
        { category: 'catering', planned: 1420000, paid: 1505000, events },
        { category: 'flowers', planned: 210000, paid: 228000, events },
        { category: 'venue', planned: 1100000, paid: 1100000, events },
      ],
      vendors: [
        { name: 'Savour Kitchen', paid: [{ minor: 1840000, currency: 'GBP' }] },
        {
          name: 'Bloom & Co',
          paid: [
            { minor: 260000, currency: 'GBP' },
            { minor: 220000, currency: 'EUR' },
          ],
        },
      ],
    },
    {
      currency: 'EUR',
      categories: [{ category: 'catering', planned: 980000, paid: 1024000, events: 1 }],
      vendors: [],
    },
  ];
}

export const CURRENCY_HEADS = { GBP: W.inPoundsHead, EUR: W.inEurosHead } as const;

const SHARE = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** A category's row in whole units, naming how many events it rests on. */
export function learnedRow(
  learned: Learned,
  currency: string,
): { name: string; line: string; value: string } {
  const gap = learned.paid - learned.planned;
  const share = learned.planned === 0 ? '' : SHARE.format(Math.abs(gap) / learned.planned);
  const value =
    gap === 0
      ? W.matches
      : gap > 0
        ? W.over(whole(gap, currency), share)
        : W.under(whole(-gap, currency), share);

  return {
    name: CATEGORY_WORDS[learned.category],
    line: W.plannedPaid(
      whole(learned.planned, currency),
      whole(learned.paid, currency),
      W.fromEvents(learned.events),
    ),
    value,
  };
}

export function vendorPaid(vendor: VendorPaid): string {
  return vendor.paid
    .map((one) => whole(one.minor, one.currency))
    .reduce((said, one) => W.and(said, one));
}

/** The templates already saved in this organisation; a name is compared ignoring case. */
export const TEMPLATE_NAMES: readonly string[] = ['Wedding, London'];
export const NAME_MOST = 80;

export type NameProblem = 'blank' | 'long' | 'taken';

/** Refused at the field before anything is sent. */
export function nameProblem(name: string): NameProblem | null {
  const typed = name.trim();
  if (typed === '') return 'blank';
  if ([...typed].length > NAME_MOST) return 'long';

  return null;
}

/** The server's check, ignoring case: "wedding, london" is taken. */
export function nameTaken(name: string, taken: readonly string[] = TEMPLATE_NAMES): boolean {
  const typed = name.trim().toLocaleLowerCase(LOCALE);

  return taken.some((one) => one.toLocaleLowerCase(LOCALE) === typed);
}

export type SaveStart = 'taken' | 'blank' | 'long' | null;

export const LONG_NAME =
  'Wedding at The Landmark for about 130 guests over three days, with dinner, drinks, flowers and cars';

export function startName(start: SaveStart): string {
  if (start === 'taken') return 'wedding, london';
  if (start === 'long') return LONG_NAME;

  return '';
}

export const COSTS_KEPT = COST_LINES.length;
