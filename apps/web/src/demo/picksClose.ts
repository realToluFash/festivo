import type { Lang } from './menuLibrary.ts';

/** sc-3905's one rule for when a course's picks close (boards Menu and MealStep, page e32): its own choose-by date, else the reply-by date, else the event's start. */
export type CloseSource = 'own' | 'replyBy' | 'start';

export interface PicksDates {
  today: string;
  /** The time now on `today`, in the event's zone; the event's start closes at its time, not its day. */
  now: string;
  replyBy: string | null;
  start: string;
  startTime: string;
  zone: string;
  /** sc-1362's choose-by dates, by course id; none exist until it is built. */
  own: Readonly<Record<string, string>>;
}

export interface Close {
  on: string;
  source: CloseSource;
  closed: boolean;
}

export const PCW = {
  pill: (date: string) => `Picks close ${date}`,
  pillClosed: (date: string) => `Picks closed on ${date}`,
  line: (date: string) => sentence(`Picks close ${date}`),
  lineClosed: (date: string) => sentence(`Picks closed on ${date}`),
  header: (date: string) => `picks close ${date}`,
  headerFrom: (date: string) => `picks close from ${date}`,
  headerClosed: (date: string) => `picks closed on ${date}`,
  source: (course: string, source: CloseSource, time: string, zone: string, closed: boolean) => {
    const by = {
      own: `${course}’s own choose-by date`,
      replyBy: 'the event’s reply-by date',
      start: 'the event’s start',
    }[source];

    return `[Set by ${by}. ${closed ? 'Closed' : 'Closes'} at ${time}, ${zone} time.]`;
  },
  closedCourse: (course: string) =>
    `[Guests can no longer change their ${course.toLocaleLowerCase('en')} pick.`,
  canStillChoose: 'You still can choose for any guest.]',
  whoHasnt: 'Who hasn’t picked',
  whoHasntAria: (course: string) => `Who hasn’t picked ${course.toLocaleLowerCase('en')}`,
  whoHasntSaid: (course: string) =>
    `Who hasn’t picked opens sc-3909’s panel for ${course}, which is built with that story.`,
  moved: (date: string, was: string) =>
    `[Picks now close ${date}. The event’s reply-by date moved from ${was}.]`,
} as const;

export const CLOSES_AT = '23:59';

export const MOVE_MS = 2000;

/** A sentence ending in a date that already ends in a full stop, as French "oct." does, keeps one. */
export function sentence(words: string): string {
  return words.endsWith('.') ? words : `${words}.`;
}

/** Long weekday, day and short month, as the viewer's locale writes them: "Monday, Oct 19", "lundi 19 oct.". */
export function dayWords(date: string, lang: Lang): string {
  const locale = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR' }[lang];

  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/** The close of a course that asks guests something; a date closes at the end of its day, the event's start at its time. */
export function closeOf(courseId: string, dates: PicksDates): Close {
  const own = dates.own[courseId] ?? null;
  if (own != null) return { on: own, source: 'own', closed: dates.today > own };
  if (dates.replyBy != null)
    return { on: dates.replyBy, source: 'replyBy', closed: dates.today > dates.replyBy };

  const started =
    dates.today > dates.start || (dates.today === dates.start && dates.now >= dates.startTime);

  return { on: dates.start, source: 'start', closed: started };
}

export const closeTime = (close: Close, dates: PicksDates): string =>
  close.source === 'start' ? dates.startTime : CLOSES_AT;

/** The Menu header: the earliest close still ahead, "from" when the open ones differ, or the last close once all have passed. */
export function headerClose(closes: readonly Close[], lang: Lang): string | null {
  if (closes.length === 0) return null;
  const open = closes.filter((one) => !one.closed).map((one) => one.on);
  if (open.length === 0) {
    const last = closes
      .map((one) => one.on)
      .sort()
      .at(-1) as string;

    return PCW.headerClosed(dayWords(last, lang));
  }
  const sorted = [...open].sort();
  const first = sorted[0] as string;

  return new Set(sorted).size === 1
    ? PCW.header(dayWords(first, lang))
    : PCW.headerFrom(dayWords(first, lang));
}

export function pillWords(close: Close, lang: Lang): string {
  const day = dayWords(close.on, lang);

  return close.closed ? PCW.pillClosed(day) : PCW.pill(day);
}

export const SAMPLE_PICKS: PicksDates = {
  today: '2026-10-14',
  now: '10:00',
  replyBy: '2026-10-19',
  start: '2026-11-14',
  startTime: '16:00',
  zone: 'Lagos',
  own: {},
};
