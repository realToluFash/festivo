import { type EventPhase, type EventState, calledOff, shownPhase } from './eventStates.ts';
import { milestoneDistance } from './timeline.ts';

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

/** When it was ended or called off, or its end, for one the clock has finished since it was loaded. */
function finishedAt(event: HomeEvent): number {
  return Date.parse(event.concludedAt ?? event.endsAt);
}
