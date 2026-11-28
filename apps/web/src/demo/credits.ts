import type { DemoLink } from './settings.ts';

export type Lang = 'en' | 'fr';

export function langOf(raw: string | null): Lang {
  return raw === 'fr' ? 'fr' : 'en';
}

export type Channel = 'whatsapp' | 'sms' | 'assistant';

export type LedgerEntry = { id: string; at: string; credits: number } & (
  | { kind: 'bought' | 'included' | 'lapsed' | 'granted' }
  | { kind: 'used'; channel: Channel; units: number }
  | { kind: 'refunded'; of: 'usage' | 'pack' }
);

export interface Line {
  id: string;
  at: string;
  credits: number;
  words: (lang: Lang, locale: string) => string;
}

/** The sample organisation's time zone: days and dates are the organisation's, not the reader's. */
export const ORG_ZONE = 'Africa/Lagos';

const dayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: ORG_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function orgDay(at: string): string {
  return dayKey.format(new Date(at));
}

/** Newest first by when each entry was written; a day's use of a channel is one line, placed where that day's latest entry of the channel is. An entry of 0 credits makes no line. */
export function ledgerLines(entries: readonly LedgerEntry[]): Line[] {
  const lines: Line[] = [];
  const used = new Map<string, { line: Line; units: number }>();

  for (const entry of entries) {
    if (entry.credits === 0) continue;
    if (entry.kind !== 'used') {
      lines.push({ id: entry.id, at: entry.at, credits: entry.credits, words: wordsOf(entry) });
      continue;
    }
    const key = `${entry.channel}:${orgDay(entry.at)}`;
    const held = used.get(key);
    if (held == null) {
      const line: Line = {
        id: `used-${key}`,
        at: entry.at,
        credits: entry.credits,
        words: () => '',
      };
      const group = { line, units: entry.units };
      line.words = (lang, locale) => channelWords(entry.channel, group.units, lang, locale);
      used.set(key, group);
      lines.push(line);
      continue;
    }
    held.units += entry.units;
    held.line.credits += entry.credits;
    if (entry.at > held.line.at) held.line.at = entry.at;
  }

  return lines
    .filter((line) => line.credits !== 0)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

function wordsOf(entry: LedgerEntry): Line['words'] {
  return (lang) => {
    const w = CREDITS_WORDS[lang];
    switch (entry.kind) {
      case 'bought':
        return w.bought;
      case 'included':
        return w.included;
      case 'lapsed':
        return w.lapsed;
      case 'granted':
        return w.granted;
      case 'refunded':
        return entry.of === 'usage' ? w.returned : w.packRefunded;
      default:
        return '';
    }
  };
}

const UNITS: Readonly<Record<Lang, Readonly<Record<Channel, readonly [string, string, string]>>>> =
  {
    en: {
      whatsapp: ['WhatsApp', 'message', 'messages'],
      sms: ['SMS', 'part', 'parts'],
      assistant: ['Assistant', 'draft', 'drafts'],
    },
    fr: {
      whatsapp: ['WhatsApp', 'message', 'messages'],
      sms: ['SMS', 'segment', 'segments'],
      assistant: ['Assistant', 'brouillon', 'brouillons'],
    },
  };

export function channelWords(channel: Channel, units: number, lang: Lang, locale: string): string {
  const [name, one, other] = UNITS[lang][channel];

  return `${name} · ${count(units, locale)} ${plural(units, locale) === 'one' ? one : other}`;
}

function plural(n: number, locale: string): Intl.LDMLPluralRule {
  return new Intl.PluralRules(locale).select(n);
}

export function count(n: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(n);
}

export function signed(credits: number, locale: string): string {
  return `${credits < 0 ? '−' : '+'}${count(Math.abs(credits), locale)}`;
}

export function lineDate(at: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: ORG_ZONE,
  }).format(new Date(at));
}

export function balanceOf(entries: readonly LedgerEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.credits, 0);
}

export const CARD_LINES = 10;
export const PAGE_LINES = 50;

/** The board's English, and the demo's French for the 320 px check until [l10n]'s lands; `[en]` owns the words. */
export const CREDITS_WORDS = {
  en: {
    title: 'Plan and billing',
    credits: 'Credits',
    included50: '50 credits included each month',
    addCredits: 'Add credits',
    credit: 'credit',
    creditsWord: 'credits',
    yourPlan: 'Your plan',
    free: 'Free',
    changePlan: 'Change plan',
    paymentMethod: 'Payment method',
    update: 'Update',
    updateName: 'Update the payment method',
    cardNote: 'Card details go to our payment provider, never to us.',
    recent: 'Recent credit entries',
    all: 'All credit entries',
    bought: 'Credits bought',
    included: 'Included credits',
    lapsed: 'Included credits not carried over',
    returned: 'Credits returned for failed messages',
    packRefunded: 'Credit pack refunded',
    granted: 'Added by Soirely support',
    pageLoading: 'Loading plan and billing…',
    cardFailed: 'Credits did not load.',
    tryAgain: 'Try again',
    loading: 'Loading credit entries…',
    failed: 'Credit entries did not load.',
    failedLine: 'Check your connection and try again. Nothing about your plan has changed.',
    none: 'No credit entries yet.',
    showMore: 'Show more',
    moreShown: ['more credit entry shown.', 'more credit entries shown.'],
    moreFailed: 'More credit entries did not load. Try again in a moment.',
  },
  fr: {
    title: 'Forfait et facturation',
    credits: 'Crédits',
    included50: '50 crédits inclus chaque mois',
    addCredits: 'Ajouter des crédits',
    credit: 'crédit',
    creditsWord: 'crédits',
    yourPlan: 'Votre forfait',
    free: 'Gratuit',
    changePlan: 'Changer de forfait',
    paymentMethod: 'Moyen de paiement',
    update: 'Modifier',
    updateName: 'Modifier le moyen de paiement',
    cardNote: 'Les données de carte vont à notre prestataire de paiement, jamais chez nous.',
    recent: 'Dernières opérations de crédits',
    all: 'Toutes les opérations de crédits',
    bought: 'Crédits achetés',
    included: 'Crédits inclus',
    lapsed: 'Crédits inclus non reportés',
    returned: 'Crédits restitués pour les messages en échec',
    packRefunded: 'Pack de crédits remboursé',
    granted: 'Ajoutés par l’assistance Soirely',
    pageLoading: 'Chargement du forfait et de la facturation…',
    cardFailed: 'Les crédits ne se sont pas chargés.',
    tryAgain: 'Réessayer',
    loading: 'Chargement des opérations de crédits…',
    failed: 'Les opérations de crédits ne se sont pas chargées.',
    failedLine: 'Vérifiez votre connexion et réessayez. Rien n’a changé dans votre forfait.',
    none: 'Aucune opération de crédits pour l’instant.',
    showMore: 'Afficher plus',
    moreShown: [
      'opération de crédits de plus affichée.',
      'opérations de crédits de plus affichées.',
    ],
    moreFailed:
      'Les autres opérations de crédits ne se sont pas chargées. Réessayez dans un instant.',
  },
} as const;

export type CreditsWords = (typeof CREDITS_WORDS)[Lang];

export function creditsIn(n: number, lang: Lang, locale: string): string {
  const w = CREDITS_WORDS[lang];

  return `${count(n, locale)} ${plural(n, locale) === 'one' ? w.credit : w.creditsWord}`;
}

export function moreShownSaid(n: number, lang: Lang, locale: string): string {
  const [one, other] = CREDITS_WORDS[lang].moreShown;

  return `${count(n, locale)} ${plural(n, locale) === 'one' ? one : other}`;
}

const at = (day: string, time: string) => `${day}T${time}:00Z`;

/** Every kind on the newest lines, written in UTC; Lagos is an hour ahead. Credits per unit are sample numbers, not sc-3929's rates. */
const RECENT: readonly LedgerEntry[] = [
  {
    id: 'e-wa-1500',
    at: at('2026-11-26', '14:00'),
    kind: 'used',
    channel: 'whatsapp',
    units: 1,
    credits: -3,
  },
  { id: 'e-pack-1200', at: at('2026-11-26', '11:00'), kind: 'bought', credits: 5000 },
  {
    id: 'e-wa-0900',
    at: at('2026-11-26', '08:00'),
    kind: 'used',
    channel: 'whatsapp',
    units: 1,
    credits: -3,
  },
  {
    id: 'e-draft',
    at: at('2026-11-25', '17:30'),
    kind: 'used',
    channel: 'assistant',
    units: 1,
    credits: -2,
  },
  {
    id: 'e-wa-utility',
    at: at('2026-11-24', '09:00'),
    kind: 'used',
    channel: 'whatsapp',
    units: 80,
    credits: -240,
  },
  {
    id: 'e-sms-a',
    at: at('2026-11-24', '10:00'),
    kind: 'used',
    channel: 'sms',
    units: 30,
    credits: -270,
  },
  {
    id: 'e-wa-marketing',
    at: at('2026-11-24', '15:00'),
    kind: 'used',
    channel: 'whatsapp',
    units: 40,
    credits: -120,
  },
  {
    id: 'e-sms-b',
    at: at('2026-11-24', '16:00'),
    kind: 'used',
    channel: 'sms',
    units: 10,
    credits: -90,
  },
  { id: 'e-support', at: at('2026-11-20', '12:00'), kind: 'granted', credits: 200 },
  { id: 'e-returned', at: at('2026-11-18', '13:00'), kind: 'refunded', of: 'usage', credits: 18 },
  {
    id: 'e-pack-refund',
    at: at('2026-11-12', '09:00'),
    kind: 'refunded',
    of: 'pack',
    credits: -1000,
  },
  { id: 'e-pack-small', at: at('2026-11-10', '09:00'), kind: 'bought', credits: 1000 },
  { id: 'e-included-nov', at: at('2026-10-31', '23:00'), kind: 'included', credits: 50 },
  { id: 'e-lapsed-oct', at: at('2026-10-31', '23:00'), kind: 'lapsed', credits: 0 },
];

const CHANNEL_COST: Readonly<Record<Channel, number>> = { whatsapp: 3, sms: 9, assistant: 2 };

function older(): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const first = Date.UTC(2026, 5, 1);
  const last = Date.UTC(2026, 9, 30);
  for (let time = last, index = 0; time >= first; time -= 86_400_000, index++) {
    const day = new Date(time).toISOString().slice(0, 10);
    const used = (channel: Channel, units: number, hour: string) =>
      entries.push({
        id: `e-${channel}-${day}`,
        at: at(day, hour),
        kind: 'used',
        channel,
        units,
        credits: -units * CHANNEL_COST[channel],
      });
    if (index % 2 === 0) used('whatsapp', 4 + ((index * 7) % 37), '15:00');
    if (index % 3 === 0) used('sms', 2 + ((index * 5) % 19), '11:00');
    if (index % 5 === 0) used('assistant', 1 + (index % 4), '09:30');
    if (isMonthEnd(day)) {
      entries.push({
        id: `e-included-${day}`,
        at: at(day, '23:00'),
        kind: 'included',
        credits: 50,
      });
      entries.push({ id: `e-lapsed-${day}`, at: at(day, '22:59'), kind: 'lapsed', credits: -12 });
    }
  }

  return entries;
}

function isMonthEnd(day: string): boolean {
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);

  return next.getUTCDate() === 1;
}

/** The oldest entries are the packs that paid for it all, so the balance is the ledger's sum. */
function withOpening(entries: LedgerEntry[], balance: number): LedgerEntry[] {
  const rest = balanceOf(entries);
  const packs = Math.ceil((balance - rest) / 20_000);
  const over = balance - rest - packs * 20_000;
  const opening: LedgerEntry[] = [
    {
      id: 'e-opening-use',
      at: at('2026-05-31', '15:00'),
      kind: 'used',
      channel: 'whatsapp',
      units: Math.ceil(-over / 3),
      credits: over,
    },
    ...Array.from({ length: packs }, (_, index): LedgerEntry => ({
      id: `e-opening-${index}`,
      at: at('2026-05-30', `${String(9 + index).padStart(2, '0')}:00`),
      kind: 'bought',
      credits: 20_000,
    })),
  ];

  return [...entries, ...opening];
}

export const SAMPLE_BALANCE = 5920;

export const SAMPLE_ENTRIES: readonly LedgerEntry[] = withOpening(
  [...RECENT, ...older()],
  SAMPLE_BALANCE,
);

/** Fewer than 10 lines: the card has no All credit entries, and the page no Show more. */
export const FEW_ENTRIES: readonly LedgerEntry[] = [
  { id: 'f-pack', at: at('2026-11-22', '10:00'), kind: 'bought', credits: 1000 },
  {
    id: 'f-wa',
    at: at('2026-11-20', '15:00'),
    kind: 'used',
    channel: 'whatsapp',
    units: 12,
    credits: -36,
  },
  { id: 'f-included', at: at('2026-10-31', '23:00'), kind: 'included', credits: 50 },
];

export function boughtNow(id: number, credits: number): LedgerEntry {
  return { id: `bought-${id}`, at: at('2026-11-27', '09:00'), kind: 'bought', credits };
}

export const CREDITS_PAGE_STATES = [
  'none',
  'few',
  'empty',
  'loading',
  'failed',
  'more_fails',
] as const;

export type CreditsPageState = (typeof CREDITS_PAGE_STATES)[number];

export function creditsPageStateOf(raw: string | null): CreditsPageState {
  return CREDITS_PAGE_STATES.find((state) => state === raw) ?? 'none';
}

export const BILLING_PATH = '/demo/settings/plan-and-billing';
export const CREDITS_PATH = `${BILLING_PATH}/credits`;

export const CREDITS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The Credits card',
    states: [
      {
        to: `${BILLING_PATH}?state=none`,
        name: 'The last 10 lines, newest first, and All credit entries',
      },
      { to: `${BILLING_PATH}?state=few`, name: '10 lines or fewer: no All credit entries' },
      { to: `${BILLING_PATH}?state=empty`, name: 'No ledger entry: the balance alone' },
      { to: `${BILLING_PATH}?state=loading`, name: 'Loading plan and billing…' },
      { to: `${BILLING_PATH}?state=credits_failed`, name: 'Credits did not load, then Try again' },
      { to: `${BILLING_PATH}?state=reread_fails`, name: 'A pack confirmed and the re-read fails' },
      { to: `${BILLING_PATH}?state=none&lang=fr`, name: 'In French (check at 320 px)' },
    ],
  },
  {
    name: 'All credit entries',
    states: [
      { to: `${CREDITS_PATH}?state=none`, name: '50 lines, Show more' },
      { to: `${CREDITS_PATH}?state=more_fails`, name: 'More credit entries did not load' },
      { to: `${CREDITS_PATH}?state=few`, name: 'Opened by its address with 10 lines or fewer' },
      { to: `${CREDITS_PATH}?state=empty`, name: 'No credit entries yet' },
      { to: `${CREDITS_PATH}?state=loading`, name: 'Loading credit entries…' },
      { to: `${CREDITS_PATH}?state=failed`, name: 'Credit entries did not load' },
      { to: `${CREDITS_PATH}?state=none&lang=fr`, name: 'In French (check at 320 px)' },
    ],
  },
];
