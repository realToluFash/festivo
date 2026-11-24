import { whenShown } from '@soirely/domain';

export type Kind = 'drafts' | 'storage';
export type Threshold = 80 | 100;
/** fr and pt are length stand-ins, about 30% longer, with values formatted in that language: l10n words them on the translation ticket. */
export type Lang = 'en' | 'fr' | 'pt';

export interface Warning {
  kind: Kind;
  at: Threshold;
  organisation: string;
  used: number;
  included: number;
}

const GB = 1_000_000_000;

export const DRAFT_COST = 13;

/** The first day of the next period: the day after Usage this period's range ends (sc-3934). */
export const RESETS_ON = new Date(2026, 11, 1);

export const NAMED = 'Ire Events';

export const WARNINGS: Readonly<Record<`${Kind}${Threshold}`, Warning>> = {
  drafts80: { kind: 'drafts', at: 80, organisation: NAMED, used: 80, included: 100 },
  drafts100: { kind: 'drafts', at: 100, organisation: NAMED, used: 100, included: 100 },
  storage80: { kind: 'storage', at: 80, organisation: NAMED, used: 1.64 * GB, included: 2 * GB },
  storage100: { kind: 'storage', at: 100, organisation: NAMED, used: 2.03 * GB, included: 2 * GB },
};

const LOCALE: Readonly<Record<Lang, string>> = { en: 'en-GB', fr: 'fr-FR', pt: 'pt-PT' };

export function localeOf(lang: Lang): string {
  return LOCALE[lang];
}

const UNITS = [
  { unit: 'terabyte', bytes: 1_000_000_000_000 },
  { unit: 'gigabyte', bytes: GB },
  { unit: 'megabyte', bytes: 1_000_000 },
] as const;

/** Decimal, in the largest of MB, GB and TB in which it is at least 1 (MB below 1 MB), one decimal at most, rounded down: so a size never reads as the included amount before it is reached. */
export function sizeOf(bytes: number, lang: Lang): string {
  const { unit, bytes: per } = UNITS.find((one) => bytes >= one.bytes) ?? UNITS[2];
  const tenths = Math.floor((Math.round(bytes) * 10) / per);

  return new Intl.NumberFormat(localeOf(lang), {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(tenths / 10);
}

export function percentOf(at: Threshold, lang: Lang): string {
  return new Intl.NumberFormat(localeOf(lang), { style: 'percent' }).format(at / 100);
}

export function dayOf(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(localeOf(lang), { day: 'numeric', month: 'long' }).format(date);
}

function counted(n: number, lang: Lang): string {
  return new Intl.NumberFormat(localeOf(lang)).format(n);
}

function plural(n: number, lang: Lang): 'one' | 'other' {
  return new Intl.PluralRules(localeOf(lang)).select(n) === 'one' ? 'one' : 'other';
}

interface Words {
  heading: (w: Warning, percent: string) => string;
  draftsRow: (used: string, included: string, form: 'one' | 'other') => string;
  storageRow: (used: string, included: string) => string;
  next80: (count: string, form: 'one' | 'other') => string;
  next100: (count: string, form: 'one' | 'other') => string;
  storageNext: string;
  reset: (date: string) => string;
}

/** The English is l10n's (#24417, #24043, #24501) with pm's noun (#24303); the drafts and storage rows are Plan and billing's row strings. */
const EN: Words = {
  heading: (w, percent) =>
    w.kind === 'drafts'
      ? w.at === 80
        ? `${w.organisation} has used ${percent} of its included assistant drafts`
        : `${w.organisation} has used all its included assistant drafts`
      : w.at === 80
        ? `${w.organisation} has used ${percent} of its included storage`
        : `${w.organisation} has used all its included storage`,
  draftsRow: (used, included, form) =>
    `${used} of ${included} assistant ${form === 'one' ? 'draft' : 'drafts'}`,
  storageRow: (used, included) => `${used} of ${included} storage`,
  next80: (count, form) =>
    `After your included assistant drafts, each draft costs ${count} ${form === 'one' ? 'credit' : 'credits'}.`,
  next100: (count, form) =>
    `Each assistant draft now costs ${count} ${form === 'one' ? 'credit' : 'credits'} until your included drafts reset.`,
  storageNext: 'Uploads keep working, and nothing is charged.',
  reset: (date) => `Your included assistant drafts reset on ${date}.`,
};

const FR: Words = {
  heading: (w, percent) =>
    w.kind === 'drafts'
      ? w.at === 80
        ? `${w.organisation} a déjà utilisé ${percent} de ses brouillons d’assistant inclus`
        : `${w.organisation} a déjà utilisé tous ses brouillons d’assistant inclus`
      : w.at === 80
        ? `${w.organisation} a déjà utilisé ${percent} de son espace de stockage inclus`
        : `${w.organisation} a déjà utilisé tout son espace de stockage inclus`,
  draftsRow: (used, included) => `${used} brouillons d’assistant utilisés sur ${included}`,
  storageRow: (used, included) => `${used} utilisés sur ${included} d’espace de stockage`,
  next80: (count) =>
    `Au-delà de vos brouillons d’assistant inclus, chaque brouillon vous coûtera ${count} crédits.`,
  next100: (count) =>
    `Chaque brouillon d’assistant coûte désormais ${count} crédits jusqu’à la remise à zéro de vos brouillons inclus.`,
  storageNext: 'Les téléversements continuent de fonctionner, et rien ne vous est facturé.',
  reset: (date) => `Vos brouillons d’assistant inclus seront remis à zéro le ${date}.`,
};

const PT: Words = {
  heading: (w, percent) =>
    w.kind === 'drafts'
      ? w.at === 80
        ? `${w.organisation} já utilizou ${percent} dos rascunhos do assistente incluídos`
        : `${w.organisation} já utilizou todos os rascunhos do assistente incluídos`
      : w.at === 80
        ? `${w.organisation} já utilizou ${percent} do espaço de armazenamento incluído`
        : `${w.organisation} já utilizou todo o espaço de armazenamento incluído`,
  draftsRow: (used, included) => `${used} de ${included} rascunhos do assistente utilizados`,
  storageRow: (used, included) => `${used} de ${included} de espaço de armazenamento`,
  next80: (count) =>
    `Depois dos rascunhos do assistente incluídos, cada rascunho passa a custar ${count} créditos.`,
  next100: (count) =>
    `Cada rascunho do assistente custa agora ${count} créditos até os rascunhos incluídos serem repostos.`,
  storageNext: 'Os carregamentos de ficheiros continuam a funcionar e não lhe é cobrado nada.',
  reset: (date) => `Os rascunhos do assistente incluídos são repostos a ${date}.`,
};

const WORDS: Readonly<Record<Lang, Words>> = { en: EN, fr: FR, pt: PT };

export interface Said {
  heading: string;
  /** One per row in this order: used of included, what happens next, then the reset line for assistant drafts only. */
  lines: readonly string[];
}

/** What the server sends for one warning, in the recipient's language: the client never splits, joins or formats these. */
export function said(warning: Warning, lang: Lang): Said {
  const w = WORDS[lang];
  const heading = w.heading(warning, percentOf(warning.at, lang));
  if (warning.kind === 'storage')
    return {
      heading,
      lines: [
        w.storageRow(sizeOf(warning.used, lang), sizeOf(warning.included, lang)),
        w.storageNext,
      ],
    };

  const cost = counted(DRAFT_COST, lang);
  const costForm = plural(DRAFT_COST, lang);

  return {
    heading,
    lines: [
      w.draftsRow(
        counted(warning.used, lang),
        counted(warning.included, lang),
        plural(warning.included, lang),
      ),
      warning.at === 80 ? w.next80(cost, costForm) : w.next100(cost, costForm),
      w.reset(dayOf(RESETS_ON, lang)),
    ],
  };
}

export const USAGE_STATES = [
  'eighty',
  'read',
  'all',
  'feed',
  'live',
  'opened',
  'fr',
  'pt',
] as const;

export type UsageState = (typeof USAGE_STATES)[number];

export function usageStateOf(raw: string | null | undefined): UsageState {
  return USAGE_STATES.find((state) => state === raw) ?? 'eighty';
}

export function langOf(state: UsageState): Lang {
  return state === 'fr' || state === 'pt' ? state : 'en';
}

export interface FeedItem {
  id: string;
  warning: Warning | null;
  category: 'money' | 'event_changes';
  createdAt: string;
  read: boolean;
}

/** The demo's now, so today's items read as a time and Friday's as a date in every run. */
export const DEMO_NOW = new Date(2026, 10, 25, 16, 0);

function today(hours: number, minutes: number): string {
  return new Date(2026, 10, 25, hours, minutes).toISOString();
}

const FRIDAY = new Date(2026, 10, 20, 17, 40).toISOString();

/** "at 14:05" today and the locale's date before today, as the built bell shows it (whenShown), in the shown language. */
export function whenOf(createdAt: string, lang: Lang, atTime: (time: string) => string): string {
  const shown = whenShown(createdAt, DEMO_NOW, localeOf(lang));

  return shown.today ? atTime(shown.time) : shown.date;
}

const EVENT_ITEM: FeedItem = {
  id: 'event',
  warning: null,
  category: 'event_changes',
  createdAt: today(11, 20),
  read: false,
};

export function feedOf(state: UsageState): readonly FeedItem[] {
  const usage = (key: keyof typeof WARNINGS, createdAt: string, read = false): FeedItem => ({
    id: key,
    warning: WARNINGS[key],
    category: 'money',
    createdAt,
    read,
  });

  switch (state) {
    case 'read':
      return [usage('drafts80', today(14, 5), true), usage('storage80', today(9, 12), true)];
    case 'all':
      return [usage('drafts100', today(14, 5)), usage('storage100', today(9, 12))];
    case 'feed':
      return [usage('drafts100', today(14, 5)), EVENT_ITEM, usage('drafts80', FRIDAY)];
    case 'live':
      return [EVENT_ITEM, usage('drafts80', FRIDAY)];
    default:
      return [usage('drafts80', today(14, 5)), usage('storage80', today(9, 12))];
  }
}

export const ARRIVAL: FeedItem = {
  id: 'drafts100',
  warning: WARNINGS.drafts100,
  category: 'money',
  createdAt: today(14, 5),
  read: false,
};

export const EVENT_SAMPLE = {
  title: 'Ana Souza changed the event',
  lines: ['Starts at 19:30, was 19:00'],
  event: 'Adaeze & Tunde’s wedding',
};
