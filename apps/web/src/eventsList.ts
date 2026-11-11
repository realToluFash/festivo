import type { EventCover, ListedEvent } from '@soirely/api-client';
import {
  type CardStepAction,
  type EventPhase,
  type EventState,
  type Milestone,
  calledOff,
  eventDayWords,
  formatEventDate,
  formatEventMoment,
  milestoneDistance,
  nextStep,
  notThisYear,
  shownDays,
  wallDayNumber,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { type Mesh, meshFor } from './mesh.ts';

/** The event's photo, or `standIn` for the design demo's, which has no picture to load. */
export type CardPhoto = EventCover | 'standIn';

export interface ListEvent {
  id: string;
  name: string;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  status: EventState;
  concludedAt: string | null;
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

/** Its day or its first and last day, with their year unless it is this one; a called-off event's day it was called off, unless `keepDays`. */
export function daysWords(
  event: Parameters<typeof eventDayWords>[0],
  now: Date,
  locale: string,
  t: TFunction,
  keepDays = false,
): string {
  const days = eventDayWords(event, now, locale, keepDays);

  switch (days.kind) {
    case 'calledOffOn':
      return t('events.calledOffOn', { date: days.date });
    case 'oneDay':
      return days.day;
    case 'days':
      return t('events.days', { first: days.first, last: days.last });
  }
}

export function rowLine(
  event: Shown,
  now: Date,
  locale: string,
  t: TFunction,
  keepDays = false,
): string {
  return t('events.daysAndPlace', {
    dates: daysWords(event, now, locale, t, keepDays),
    place: event.place ?? t('eventPage.venueToBeConfirmed'),
  });
}

export type TagKind = 'waiting' | 'yes' | 'now' | 'paused' | 'ended';

export interface RowTag {
  kind: TagKind;
  word: string;
}

/** An event's phase as a list shows it: a Finished event that never started is Called off. */
export type ListPhase = EventPhase | 'calledOff';

export function listPhase(event: { phase: EventPhase; calledOff: boolean }): ListPhase {
  return event.phase !== 'happening_now' && event.phase !== 'paused' && event.calledOff
    ? 'calledOff'
    : event.phase;
}

const PHASE_TAG = {
  draft: { kind: 'waiting', word: 'events.draft' },
  live: { kind: 'yes', word: 'events.live' },
  happening_now: { kind: 'now', word: 'events.happeningNow' },
  paused: { kind: 'paused', word: 'events.paused' },
  finished: { kind: 'ended', word: 'events.finished' },
  calledOff: { kind: 'ended', word: 'events.calledOff' },
} as const satisfies Record<ListPhase, { kind: TagKind; word: string }>;

export function phaseTag(shown: ListPhase, t: TFunction): RowTag {
  return { kind: PHASE_TAG[shown].kind, word: t(PHASE_TAG[shown].word) };
}

/** A row's tag: what sets it apart in its tab, or its phase whatever it is where tabs are mixed. */
export function rowTag(event: Shown, everyPhase: boolean, t: TFunction): RowTag | null {
  const shown = listPhase(event);
  const apart = shown === 'happening_now' || shown === 'paused' || shown === 'calledOff';

  return apart || everyPhase ? phaseTag(shown, t) : null;
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

export function howSoon(event: Shown, now: Date, t: TFunction): string | null {
  if (event.phase === 'finished' || event.phase === 'happening_now') return null;
  if (Date.parse(event.startsAt) <= now.getTime()) return null;

  return distanceWords(event.startsAt, event.timeZone, now, t);
}

function dayCount(event: Shown): number {
  return (
    wallDayNumber(event.endsAt, event.timeZone) - wallDayNumber(event.startsAt, event.timeZone) + 1
  );
}

export type DayTile =
  | { kind: 'day'; key: string; weekday: string; day: string; today: boolean }
  | { kind: 'gap'; key: string; hidden: number; more: string };

const DAY = 86_400_000;

/** A tile a day up to a week; past that its first day, today while it is on, and its last, with the days between counted. */
export function dayTiles(event: Shown, now: Date, locale: string): DayTile[] {
  const count = dayCount(event);

  if (count < 2 || event.phase === 'finished') return [];

  const first = wallDayNumber(event.startsAt, event.timeZone);
  const today = wallDayNumber(now, event.timeZone);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const number = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });
  const plain = new Intl.NumberFormat(locale);
  const shown = shownDays({
    first,
    last: first + count - 1,
    today,
    on: event.phase === 'happening_now',
  });

  return shown.flatMap((dayAt, index): DayTile[] => {
    const date = new Date(dayAt * DAY + DAY / 2);
    const tile: DayTile = {
      kind: 'day',
      key: date.toISOString().slice(0, 10),
      weekday: weekday.format(date),
      day: number.format(date),
      today: dayAt === today,
    };
    const next = shown[index + 1];
    const hidden = next == null ? 0 : next - dayAt - 1;

    return hidden === 0
      ? [tile]
      : [tile, { kind: 'gap', key: `gap-${tile.key}`, hidden, more: `+${plain.format(hidden)}` }];
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
      const day =
        wallDayNumber(now, event.timeZone) - wallDayNumber(event.startsAt, event.timeZone) + 1;
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
          date: formatEventMoment(
            step.milestone.at,
            event.timeZone,
            locale,
            notThisYear(event.timeZone, now, step.milestone.at),
          ),
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
