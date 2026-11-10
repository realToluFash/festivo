import type { EventCover, ListedEvent } from '@soirely/api-client';
import {
  type CardStepAction,
  type EventPhase,
  type EventState,
  type Milestone,
  calledOff,
  eventDays,
  formatEventDate,
  formatEventMoment,
  formatEventShortDay,
  formatEventWeekday,
  milestoneDistance,
  nextStep,
  wallDay,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { type Mesh, meshFor } from './mesh.ts';

/** The event's photo, or `standIn` for the design demo's, which has no picture to load. */
export type CardPhoto = EventCover | 'standIn';

/** An event as Events draws it, a real one or the demo's. */
export interface ListEvent {
  id: string;
  name: string;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  status: EventState;
  concludedAt: string | null;
  /** The list's place; null until there is a venue. */
  place: string | null;
  photo: CardPhoto | null;
  milestones: readonly Milestone[];
}

export interface Shown extends ListEvent {
  phase: EventPhase;
  calledOff: boolean;
  mesh: Mesh;
}

export function shownEvent(event: ListEvent, phase: EventPhase): Shown {
  return { ...event, phase, calledOff: calledOff(event), mesh: meshFor(event.id) };
}

/** A loaded event as Events draws it: its venue's name or address for the place, and its photo once it has one. */
export function listEventOf(event: ListedEvent): ListEvent {
  return {
    ...event,
    place: event.venue?.name ?? event.venue?.address?.formatted ?? null,
    photo: event.cover,
  };
}

/** Its day or its first and last day; a called-off event's day it was called off, unless `keepDays`. */
export function daysWords(event: Shown, locale: string, t: TFunction, keepDays = false): string {
  const days = eventDays(event);

  if (days.kind === 'calledOffOn' && !keepDays) {
    return t('events.calledOffOn', {
      date: formatEventShortDay(days.concludedAt, event.timeZone, locale),
    });
  }

  const first = formatEventWeekday(event.startsAt, event.timeZone, locale);

  return wallDay(event.startsAt, event.timeZone) === wallDay(event.endsAt, event.timeZone)
    ? first
    : t('events.days', { first, last: formatEventWeekday(event.endsAt, event.timeZone, locale) });
}

export function rowLine(event: Shown, locale: string, t: TFunction, keepDays = false): string {
  return t('events.daysAndPlace', {
    days: daysWords(event, locale, t, keepDays),
    place: event.place ?? t('eventPage.venueToBeConfirmed'),
  });
}

export type TagKind = 'waiting' | 'yes' | 'now' | 'paused' | 'ended';

export interface RowTag {
  kind: TagKind;
  word: string;
}

/** A row's tag: what sets it apart in its tab, or its phase whatever it is where tabs are mixed. */
export function rowTag(event: Shown, everyPhase: boolean, t: TFunction): RowTag | null {
  if (event.phase === 'happening_now') return { kind: 'now', word: t('events.happeningNow') };
  if (event.phase === 'paused') return { kind: 'paused', word: t('events.paused') };
  if (event.calledOff) return { kind: 'ended', word: t('events.calledOff') };
  if (!everyPhase) return null;
  if (event.phase === 'draft') return { kind: 'waiting', word: t('events.draft') };
  if (event.phase === 'live') return { kind: 'yes', word: t('events.live') };

  return { kind: 'ended', word: t('events.finished') };
}

function distanceWords(at: string, timeZone: string, now: Date, t: TFunction): string {
  const distance = milestoneDistance(at, timeZone, now);

  switch (distance.kind) {
    case 'inDays':
      return t('timeline.inDays', { count: distance.count });
    case 'daysAgo':
      return t('timeline.daysAgo', { count: distance.count });
    case 'today':
      return t('timeline.today');
    case 'now':
      return t('timeline.now');
  }
}

/** How soon it starts, until it does: "in 32 days", or "today". */
export function howSoon(event: Shown, now: Date, t: TFunction): string | null {
  if (event.phase === 'finished' || event.phase === 'happening_now') return null;
  if (Date.parse(event.startsAt) <= now.getTime()) return null;

  return distanceWords(event.startsAt, event.timeZone, now, t);
}

const DAY = 86_400_000;

function dayNumber(moment: string | Date, timeZone: string): number {
  return Date.parse(`${wallDay(moment, timeZone)}T00:00:00Z`) / DAY;
}

function dayCount(event: Shown): number {
  return dayNumber(event.endsAt, event.timeZone) - dayNumber(event.startsAt, event.timeZone) + 1;
}

export interface DayTile {
  weekday: string;
  day: string;
  today: boolean;
}

/** A tile for each of its days, while it has more than one and is not over. */
export function dayTiles(event: Shown, now: Date, locale: string): DayTile[] {
  const count = dayCount(event);

  if (count < 2 || event.phase === 'finished') return [];

  const first = dayNumber(event.startsAt, event.timeZone);
  const today = dayNumber(now, event.timeZone);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const number = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });

  return Array.from({ length: count }, (_, index) => {
    const day = new Date((first + index) * DAY + DAY / 2);

    return {
      weekday: weekday.format(day),
      day: number.format(day),
      today: first + index === today,
    };
  });
}

export type PhaseMark = 'draft' | 'live' | 'now' | 'paused' | 'finished' | 'calledOff';

export interface CardTag {
  word: string;
  mark: PhaseMark | null;
}

/** The phase on the card's glass, then how soon it starts, or which of its days it is on. */
export function cardTags(event: Shown, now: Date, t: TFunction): CardTag[] {
  const soon = howSoon(event, now, t);
  const soonTag = soon == null ? [] : [{ word: soon, mark: null }];

  switch (event.phase) {
    case 'draft':
      return [{ word: t('events.draft'), mark: 'draft' }, ...soonTag];
    case 'live':
      return [{ word: t('events.live'), mark: 'live' }, ...soonTag];
    case 'paused':
      return [{ word: t('events.paused'), mark: 'paused' }, ...soonTag];
    case 'happening_now': {
      const day = dayNumber(now, event.timeZone) - dayNumber(event.startsAt, event.timeZone) + 1;
      const count = dayCount(event);
      const tag = { word: t('events.happeningNow'), mark: 'now' } as const;

      return count > 1
        ? [tag, { word: t('events.dayOf', { day, total: count }), mark: null }]
        : [tag];
    }
    case 'finished':
      return event.calledOff
        ? [{ word: t('events.calledOff'), mark: 'calledOff' }]
        : [{ word: t('events.finished'), mark: 'finished' }];
  }
}

export type CardStep =
  | { kind: 'button'; line: string; label: string; action: CardStepAction }
  | { kind: 'next'; title: string; line: string };

/** The card's one step, by the domain's nextStep: what the phase asks for, else the next thing that happens; Duplicate once it is over. */
export function cardStep(event: Shown, now: Date, locale: string, t: TFunction): CardStep {
  const step = nextStep(event, event.phase, now);

  switch (step?.kind) {
    case 'makeLive':
      return {
        kind: 'button',
        line: t('events.nextMakeLive'),
        label: t('eventLive.makeLive'),
        action: 'makeLive',
      };
    case 'changeDates':
      return {
        kind: 'button',
        line: t('events.nextChangeDates'),
        label: t('eventLive.changeDates'),
        action: 'changeDates',
      };
    case 'resume':
      return {
        kind: 'button',
        line: t('events.nextResume'),
        label: t('eventPause.resume'),
        action: 'resume',
      };
    case 'nextUp':
      return {
        kind: 'next',
        title: t('events.nextUp', { title: step.milestone.title }),
        line: t('events.dateAway', {
          date: formatEventMoment(step.milestone.at, event.timeZone, locale),
          distance: distanceWords(step.milestone.at, event.timeZone, now, t),
        }),
      };
    case undefined: {
      const line =
        event.calledOff && event.concludedAt != null
          ? t('eventEnd.calledOffNotice', {
              date: formatEventDate(event.concludedAt, event.timeZone, locale),
            })
          : t('timeline.finished');

      return { kind: 'button', line, label: t('eventDuplicate.open'), action: 'duplicate' };
    }
  }
}

/** The line under Events' title: only the counts that are not 0, none at all when every count is (sc-22103). */
export function summaryWords(
  counts: { happeningNow: number; upcoming: number; drafts: number },
  t: TFunction,
): string | null {
  const parts = [
    counts.happeningNow > 0 && t('events.summaryHappeningNow', { count: counts.happeningNow }),
    counts.upcoming > 0 && t('events.summaryUpcoming', { count: counts.upcoming }),
    counts.drafts > 0 && t('events.summaryDrafts', { count: counts.drafts }),
  ].filter((part) => part !== false);

  return parts.length === 0
    ? null
    : parts.reduceRight((rest, first) => t('events.summaryJoin', { first, rest }));
}
