import { type EventPhase, type EventState, calledOff, shownPhase } from './eventStates.ts';
import { type LocaleCode, pluralLocale } from './locales.ts';
import { type Milestone, milestoneDistance, nextUp } from './timeline.ts';

export interface HomeEvent {
  id: string;
  name: string;
  status: EventState;
  phase: EventPhase;
  startsAt: string;
  endsAt: string;
  concludedAt: string | null;
}

export interface EventsHome<T> {
  happeningNow: T[];
  upcoming: T[];
  drafts: T[];
  past: T[];
  /** Every Finished event the organisation has, loaded or not, those the clock has finished since included. */
  pastCount: number;
}

/** Events Home's one rule on both clients (sc-3594): `past` is the Finished pages loaded so far, of `pastTotal`. */
export function eventsHome<T extends HomeEvent>(
  loaded: { unfinished: readonly T[]; past: readonly T[]; pastTotal: number; at: Date },
  now: Date,
  locale: string,
): EventsHome<T> {
  const collator = new Intl.Collator(locale);
  const byName = (a: T, b: T) => collator.compare(a.name, b.name);
  const soonest = (a: T, b: T) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || byName(a, b);
  const latest = (a: T, b: T) => finishedAt(b) - finishedAt(a) || byName(a, b);
  const pastIds = new Set(loaded.past.map((event) => event.id));
  const unfinished = loaded.unfinished.filter((event) => !pastIds.has(event.id));
  const phaseOf = (event: T) => shownPhase(event, loaded.at, now);
  const finishedSince = unfinished.filter((event) => phaseOf(event) === 'finished');
  const inPhase = (...phases: EventPhase[]) =>
    unfinished.filter((event) => phases.includes(phaseOf(event)));

  return {
    happeningNow: inPhase('happening_now').sort(soonest),
    upcoming: inPhase('live', 'paused').sort(soonest),
    drafts: inPhase('draft').sort(soonest),
    past: [...loaded.past, ...finishedSince].sort(latest),
    pastCount: loaded.pastTotal + finishedSince.length,
  };
}

/** Asked for by pages read, not by how many are loaded: an event finishing meanwhile moves the server's pages along. */
export function withPastPage<
  L extends { past: readonly HomeEvent[]; pastPages: number; pastTotal: number },
>(
  loaded: L,
  page: { events: readonly L['past'][number][]; total: number },
  perPage: number,
): { load: L; added: number } {
  const known = new Set(loaded.past.map(({ id }) => id));
  const added = page.events.filter(({ id }) => !known.has(id));
  const past = [...loaded.past, ...added];
  const pastPages = loaded.pastPages + 1;
  const pastTotal =
    pastPages * perPage >= page.total ? Math.min(loaded.pastTotal, past.length) : loaded.pastTotal;

  return { load: { ...loaded, past, pastPages, pastTotal }, added: added.length };
}

export const EVENTS_TABS = ['upcoming', 'drafts', 'past'] as const;

export type EventsTab = (typeof EVENTS_TABS)[number];

let chosen: { organisationId: string; tab: EventsTab } | null = null;

/** Kept while the person moves around the app and back; another organisation opens on Upcoming (sc-3594). */
export function rememberedEventsTab(organisationId: string): EventsTab {
  return chosen?.organisationId === organisationId ? chosen.tab : 'upcoming';
}

export function rememberEventsTab(organisationId: string, tab: EventsTab): void {
  chosen = { organisationId, tab };
}

export function forgetEventsTab(): void {
  chosen = null;
}

/** The tab an event is listed under, so Back from its page lands where it now is; Happening now is above every tab (sc-22103). */
export function tabHolding(phase: EventPhase): EventsTab | null {
  switch (phase) {
    case 'draft':
      return 'drafts';
    case 'live':
    case 'paused':
      return 'upcoming';
    case 'finished':
      return 'past';
    case 'happening_now':
      return null;
  }
}

/** An event's page sets the tab Events opens on to the one holding it, and leaves it be when none does. */
export function rememberTabHolding(organisationId: string, phase: EventPhase): void {
  const tab = tabHolding(phase);

  if (tab != null) rememberEventsTab(organisationId, tab);
}

export type CardDate =
  | { kind: 'startedToday'; startsAt: string }
  | { kind: 'startedOn'; startsAt: string }
  | { kind: 'calledOffOn'; concludedAt: string }
  | { kind: 'dateAway'; startsAt: string };

/** "Today · started 09:00", "Started Tuesday, Oct 27 · 11:13", "Called off on Sep 30", or "Saturday, Nov 14 · in 32 days". */
export function cardDate(
  event: { status: EventState; startsAt: string; timeZone: string; concludedAt: string | null },
  phase: EventPhase,
  now: Date,
): CardDate {
  if (phase === 'happening_now') {
    const startedEarlier =
      milestoneDistance(event.startsAt, event.timeZone, now).kind === 'daysAgo';

    return { kind: startedEarlier ? 'startedOn' : 'startedToday', startsAt: event.startsAt };
  }

  if (phase === 'finished' && calledOff(event) && event.concludedAt != null) {
    return { kind: 'calledOffOn', concludedAt: event.concludedAt };
  }

  return { kind: 'dateAway', startsAt: event.startsAt };
}

export type NextStep =
  | { kind: 'makeLive' }
  | { kind: 'changeDates' }
  | { kind: 'resume' }
  | { kind: 'nextUp'; milestone: Milestone };

/** An event's last line on Events Home: what its phase asks for next, else its next milestone (sc-22103). */
export function nextStep(
  event: { status: EventState; endsAt: string; milestones: readonly Milestone[] },
  phase: EventPhase,
  now: Date,
): NextStep | null {
  if (phase === 'draft') {
    return now.getTime() >= Date.parse(event.endsAt)
      ? { kind: 'changeDates' }
      : { kind: 'makeLive' };
  }

  if (phase === 'paused') return { kind: 'resume' };

  if (phase === 'finished') return null;

  const milestone = nextUp(event.milestones, now, event.status === 'ended');

  return milestone == null ? null : { kind: 'nextUp', milestone };
}

export type EventDays =
  | { kind: 'oneDay'; startsAt: string }
  | { kind: 'days'; startsAt: string; endsAt: string }
  | { kind: 'calledOffOn'; concludedAt: string };

/** "Saturday, Oct 31", or a first and last day, in the event's own zone (sc-22103). */
export function eventDays(event: {
  status: EventState;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  concludedAt: string | null;
}): EventDays {
  if (calledOff(event) && event.concludedAt != null) {
    return { kind: 'calledOffOn', concludedAt: event.concludedAt };
  }

  const day = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone: event.timeZone });

  return day.format(new Date(event.startsAt)) === day.format(new Date(event.endsAt))
    ? { kind: 'oneDay', startsAt: event.startsAt }
    : { kind: 'days', startsAt: event.startsAt, endsAt: event.endsAt };
}

export interface HowSoon {
  to: 'start' | 'end';
  count: number;
  unit: 'minute' | 'hour' | 'day';
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Time to its start, or once under way to its end, rounded down: minutes under an hour, hours under a day, else days by the dates in its zone (sc-25008). */
export function howSoon(
  event: { startsAt: string; endsAt: string; timeZone: string },
  phase: EventPhase,
  now: Date,
): HowSoon | null {
  if (phase === 'finished') return null;

  const to = now.getTime() < Date.parse(event.startsAt) ? 'start' : 'end';

  if (to === 'end' && phase === 'draft') return null;

  const at = to === 'start' ? event.startsAt : event.endsAt;
  const left = Date.parse(at) - now.getTime();

  if (left <= 0) return null;
  if (left < HOUR) return { to, count: Math.floor(left / MINUTE), unit: 'minute' };
  if (left < DAY) return { to, count: Math.floor(left / HOUR), unit: 'hour' };

  const distance = milestoneDistance(at, event.timeZone, now);

  return { to, count: distance.kind === 'inDays' ? distance.count : 1, unit: 'day' };
}

/** CLDR's long form with `auto` numbering, in the region the copy is written for: "tomorrow", "this minute", Portugal's "dentro de 32 dias". */
export function howSoonWords(soon: HowSoon, locale: LocaleCode): string {
  return new Intl.RelativeTimeFormat(pluralLocale(locale), {
    numeric: 'auto',
    style: 'long',
  }).format(soon.count, soon.unit);
}

/** "in 32 days", or `endsIn` around it once under way; null where the event has no phrase (sc-25008). */
export function howSoonPhrase(
  event: { startsAt: string; endsAt: string; timeZone: string },
  phase: EventPhase,
  now: Date,
  locale: LocaleCode,
  endsIn: (time: string) => string,
): string | null {
  const soon = howSoon(event, phase, now);

  if (soon == null) return null;

  const words = howSoonWords(soon, locale);

  return soon.to === 'end' ? endsIn(words) : words;
}

/** When it was ended or called off, or its end, for one the clock has finished since it was loaded. */
function finishedAt(event: HomeEvent): number {
  return Date.parse(event.concludedAt ?? event.endsAt);
}
