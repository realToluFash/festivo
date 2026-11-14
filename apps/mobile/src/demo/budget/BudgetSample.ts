/** The boards' sample (budget-a-spec.md §1), not spec: the wedding as Guests A and Messaging B count it, every amount in pence. */
export const WEDDING = 'evt-wed-4';
export const EVENT_NAME = 'Adaeze & Tunde’s wedding';
export const CURRENCY = 'GBP';
export const ZONE = 'Europe/London';
export const TODAY = '2026-11-03';
export const NOW_TIME = '09:41';
export const AS_OF_TIME = '09:32';
export const COLLEAGUE = 'Julien Moreau';
export const LEAD = 'Priya Shah';

export const GUESTS = {
  invited: 142,
  coming: 96,
  notComing: 9,
  notSureYet: 10,
  noReply: 21,
  held: 6,
} as const;

export const STILL_TO_ANSWER = GUESTS.notSureYet + GUESTS.noReply + GUESTS.held;
export const HEADS_IF_ALL_COME = GUESTS.coming + STILL_TO_ANSWER;
export const EVENT_DAYS = 3;

export const CATEGORIES = [
  'Catering',
  'Venue',
  'Flowers',
  'Photography',
  'Music',
  'Transport',
  'Staffing',
  'Hire',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Basis = 'perHead' | 'perDay' | 'perTable' | 'fixed';

export interface Line {
  key: string;
  name: string;
  category: Category;
  basis: Basis;
  rate: number | null;
  /** The count it is multiplied by, settled and if all come; a table count of 0 is Nothing yet. */
  settled: number;
  ifAll: number;
  source: string;
}

export const LINES: readonly Line[] = [
  {
    key: 'dinner',
    name: 'Dinner',
    category: 'Catering',
    basis: 'perHead',
    rate: 6800,
    settled: GUESTS.coming,
    ifAll: HEADS_IF_ALL_COME,
    source: 'said yes, from the guest list',
  },
  {
    key: 'drinks',
    name: 'Drinks package',
    category: 'Catering',
    basis: 'perHead',
    rate: 2200,
    settled: GUESTS.coming,
    ifAll: HEADS_IF_ALL_COME,
    source: 'said yes, from the guest list',
  },
  {
    key: 'room',
    name: 'Room hire',
    category: 'Venue',
    basis: 'perDay',
    rate: 210000,
    settled: EVENT_DAYS,
    ifAll: EVENT_DAYS,
    source: 'days the event runs',
  },
  fixed('bridal', 'Bridal flowers', 'Flowers', 85000),
  {
    key: 'centre',
    name: 'Centrepieces',
    category: 'Flowers',
    basis: 'perTable',
    rate: 4500,
    settled: 0,
    ifAll: 0,
    source: 'No seating plan yet',
  },
  fixed('arch', 'Aisle arch', 'Flowers', null),
  fixed('photo', 'Photographer', 'Photography', 240000),
  fixed('dj', 'DJ', 'Music', 90000),
  fixed('cars', 'Cars', 'Transport', 64000),
  fixed('shuttle', 'Guest shuttle', 'Transport', null),
];

function fixed(key: string, name: string, category: Category, rate: number | null): Line {
  return { key, name, category, basis: 'fixed', rate, settled: 1, ifAll: 1, source: '' };
}

/** sc-90's ceilings: the whole event's, and the categories that have one. */
export const CEILINGS: { whole: number; categories: Partial<Record<Category, number>> } = {
  whole: 2200000,
  categories: { Catering: 1300000, Flowers: 150000 },
};

export type VendorKey = 'savour' | 'landmark' | 'lens' | 'bloom';

export const VENDORS: Record<VendorKey, { name: string; quote: number }> = {
  savour: { name: 'Savour Kitchen', quote: 900000 },
  landmark: { name: 'The Landmark', quote: 630000 },
  lens: { name: 'Lens & Light', quote: 240000 },
  bloom: { name: 'Bloom & Co', quote: 120000 },
};

export interface Payment {
  id: string;
  vendor: VendorKey;
  what: string;
  amount: number;
  due: string;
}

export const PAYMENTS: readonly Payment[] = [
  {
    id: 'landmark-deposit',
    vendor: 'landmark',
    what: 'Deposit',
    amount: 315000,
    due: '2026-09-01',
  },
  { id: 'lens-deposit', vendor: 'lens', what: 'Deposit', amount: 80000, due: '2026-10-01' },
  { id: 'bloom-deposit', vendor: 'bloom', what: 'Deposit', amount: 36000, due: '2026-10-06' },
  { id: 'bloom-balance', vendor: 'bloom', what: 'Balance', amount: 84000, due: '2026-10-30' },
  { id: 'savour-deposit', vendor: 'savour', what: 'Deposit', amount: 450000, due: '2026-11-04' },
  {
    id: 'landmark-balance',
    vendor: 'landmark',
    what: 'Balance',
    amount: 315000,
    due: '2026-11-05',
  },
  {
    id: 'savour-second',
    vendor: 'savour',
    what: 'Second instalment',
    amount: 300000,
    due: '2026-11-09',
  },
  { id: 'lens-balance', vendor: 'lens', what: 'Balance', amount: 160000, due: '2026-11-30' },
];

export const PAID_BEFORE: Readonly<Record<string, { on: string; by: string }>> = {
  'landmark-deposit': { on: '2026-09-01', by: 'Folake Adeyemi' },
  'lens-deposit': { on: '2026-10-01', by: 'Folake Adeyemi' },
  'bloom-deposit': { on: '2026-10-06', by: 'Folake Adeyemi' },
};

export type PayerKey = 'couple' | 'obi' | 'bakare' | 'funmi';
export type LinkState = 'notSent' | 'sent' | 'opened' | 'revoked';

/** A part of a cost: a fraction of it, a fixed amount in pence, or what is left after the fixed amounts (sc-91). */
export interface Cover {
  line: string;
  share: 1 | 0.5;
  fixed?: number;
  rest?: boolean;
}

export interface Payer {
  key: PayerKey;
  name: string;
  note: string;
  covers: readonly Cover[];
  link: LinkState;
}

export const PAYERS: readonly Payer[] = [
  {
    key: 'couple',
    name: 'Adaeze and Tunde',
    note: 'The couple',
    covers: [
      { line: 'photo', share: 1 },
      { line: 'bridal', share: 1 },
    ],
    link: 'notSent',
  },
  {
    key: 'obi',
    name: 'Mr and Mrs Obi',
    note: 'Adaeze’s parents',
    covers: [
      { line: 'room', share: 1 },
      { line: 'dinner', share: 0.5 },
      { line: 'drinks', share: 0.5 },
    ],
    link: 'opened',
  },
  {
    key: 'bakare',
    name: 'Mr and Mrs Bakare',
    note: 'Tunde’s parents',
    covers: [
      { line: 'dinner', share: 0.5 },
      { line: 'drinks', share: 0.5 },
    ],
    link: 'sent',
  },
  {
    key: 'funmi',
    name: 'Aunt Funmi',
    note: 'Covering the cars',
    covers: [{ line: 'cars', share: 1 }],
    link: 'notSent',
  },
];

/** Paid credited in proportion (sc-91): each vendor's payments to whoever covers its lines. */
export const VENDOR_PAYERS: Record<VendorKey, Partial<Record<PayerKey, number>>> = {
  savour: { obi: 0.5, bakare: 0.5 },
  landmark: { obi: 1 },
  lens: { couple: 1 },
  bloom: { couple: 1 },
};

export const OPENED = { times: 3, last: '2026-11-02T21:14:00Z' };

/** A payer who covered nothing, removed on the web while the list was open (the web board's own). */
export const REMOVED_PAYER = 'Uncle Kayode';

export const REMINDER = { sent: '2026-11-01', payments: ['bloom-balance', 'savour-deposit'] };

/** sc-95's two reminders as they arrive today: the overdue one alone, and one with what falls due in the next 3 days. */
export const REMINDERS = {
  overdue: { sent: TODAY, payments: ['bloom-balance'] },
  mixed: { sent: TODAY, payments: ['bloom-balance', 'savour-deposit', 'landmark-balance'] },
} as const;
export const REMINDER_DAYS = 3;

/** sc-90's ceilings as another person changes them on the web (the web demo's words and figures). */
export const CEILING_CHANGE = { set: 2200000, changed: 2400000 } as const;

/** Mr and Mrs Obi, renamed on the web while the app reads (sc-30200). */
export const RENAMED = 'Chidi and Ngozi Obi';
export const CHANGED_SINCE = { paidOn: '2026-11-02' };

/** The iPhone SE frame (sc-30200, sc-1300): Mr and Mrs Obi's share under a 100-character name and a long note, in Portuguese. */
export const LONG_NAME = {
  name: 'Maria Fernanda de Albuquerque Cavalcanti e Joaquim Henrique de Vasconcelos Bragança, família da noiva',
  note: 'Cobrem o jantar e as bebidas de metade dos convidados, e também o aluguer da sala nos três dias, como combinado com a família na reunião de outubro. Pagam por transferência.',
  share: 'A parte deles',
  shareLine: 'O valor menor está confirmado.',
  locale: 'pt-PT',
  range: (low: string, high: string) => `${low} a ${high}`,
  send: 'Enviar a',
};
