import type { EventCover, OrganisationEvent } from '@soirely/api-client';
import {
  type CardStepAction,
  type EventPhase,
  type EventState,
  type EventType,
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

import type { RowTag } from '../components/SummaryRows.tsx';
import { type MeshKey, meshFor } from './today.ts';

export type ListTab = 'upcoming' | 'drafts' | 'past';

export const LIST_TABS: readonly ListTab[] = ['upcoming', 'drafts', 'past'];

export const TAB_WORD: Record<ListTab, string> = {
  upcoming: 'eventsScreen.tabUpcoming',
  drafts: 'eventsScreen.tabDrafts',
  past: 'eventsScreen.tabPast',
};

/** The event's photo, or `standIn` for the design demo's, which has no picture to load. */
export type CardPhoto = { cover: EventCover; type: EventType } | 'standIn';

/** An event as Events draws it, a real one or the demo's. */
export interface ListEvent {
  id: string;
  name: string;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  status: EventState;
  concludedAt: string | null;
  /** The list's place: the venue's name, or its address; null until there is a venue. */
  place: string | null;
  photo: CardPhoto | null;
  /** Null while they are still being read: an event's page reads them apart from the event. */
  milestones: readonly Milestone[] | null;
}

export interface Shown extends ListEvent {
  phase: EventPhase;
  calledOff: boolean;
  mesh: MeshKey;
}

export function shownEvent(event: ListEvent, phase: EventPhase): Shown {
  return { ...event, phase, calledOff: calledOff(event), mesh: meshFor(event.id) };
}

/** A loaded event as Events draws it: its venue's name or address for the place, and its photo once it has one. */
export function listEventOf(
  event: OrganisationEvent & Pick<ListEvent, 'milestones'>,
): ListEvent {
  return {
    ...event,
    place: event.venue?.name ?? event.venue?.address?.formatted ?? null,
    photo: event.cover == null ? null : { cover: event.cover, type: event.type },
  };
}

export function daysWords(
  event: Pick<ListEvent, 'status' | 'startsAt' | 'endsAt' | 'timeZone' | 'concludedAt'>,
  locale: string,
  list: boolean,
  t: TFunction,
): string {
  const days = eventDays(event);

  if (days.kind === 'calledOffOn') {
    if (list) {
      return t('eventsScreen.calledOffOn', {
        date: formatEventShortDay(days.concludedAt, event.timeZone, locale),
      });
    }

    return t('eventsScreen.days', {
      first: formatEventWeekday(event.startsAt, event.timeZone, locale),
      last: formatEventWeekday(event.endsAt, event.timeZone, locale),
    });
  }

  const first = formatEventWeekday(days.startsAt, event.timeZone, locale);

  return days.kind === 'oneDay'
    ? first
    : t('eventsScreen.days', {
        first,
        last: formatEventWeekday(days.endsAt, event.timeZone, locale),
      });
}

export function rowLine(event: Shown, locale: string, t: TFunction, list = true): string {
  return t('todayScreen.dayAndPlace', {
    day: daysWords(event, locale, list, t),
    place: event.place ?? t('eventPage.venueToBeConfirmed'),
  });
}

/** A row's tag: what sets it apart in its tab, or its phase whatever it is where tabs are mixed. */
export function rowTag(event: Shown, everyPhase: boolean, t: TFunction): RowTag | null {
  if (event.phase === 'happening_now') return { kind: 'now', word: t('eventsScreen.happeningNow') };
  if (event.phase === 'paused') return { kind: 'paused', word: t('eventsScreen.paused') };
  if (event.calledOff) return { kind: 'ended', word: t('eventsScreen.calledOff') };
  if (!everyPhase) return null;
  if (event.phase === 'draft') return { kind: 'notyet', word: t('eventsScreen.draft') };
  if (event.phase === 'live') return { kind: 'yes', word: t('eventsScreen.live') };

  return { kind: 'ended', word: t('eventsScreen.finished') };
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

const DAY = 86_400_000;

function dayNumber(moment: string | Date, timeZone: string): number {
  return Date.parse(`${wallDay(moment, timeZone)}T00:00:00Z`) / DAY;
}

export function dayCount(event: Pick<ListEvent, 'startsAt' | 'endsAt' | 'timeZone'>): number {
  return dayNumber(event.endsAt, event.timeZone) - dayNumber(event.startsAt, event.timeZone) + 1;
}

export interface DayTile {
  weekday: string;
  day: string;
  today: boolean;
}

export function dayTiles(event: Shown, now: Date, locale: string): DayTile[] | null {
  const count = dayCount(event);

  if (count < 2 || event.phase === 'finished') return null;

  const first = dayNumber(event.startsAt, event.timeZone);
  const today = dayNumber(now, event.timeZone);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const number = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });

  return Array.from({ length: count }, (_, index) => {
    const day = new Date((first + index) * DAY);

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
  mark?: PhaseMark;
}

export function cardTags(event: Shown, now: Date, t: TFunction): CardTag[] {
  const soon = howSoon(event, now, t);
  const soonTag = soon == null ? [] : [{ word: soon }];

  switch (event.phase) {
    case 'draft':
      return [{ word: t('eventsScreen.draft'), mark: 'draft' }, ...soonTag];
    case 'live':
      return [{ word: t('eventsScreen.live'), mark: 'live' }, ...soonTag];
    case 'paused':
      return [{ word: t('eventsScreen.paused'), mark: 'paused' }, ...soonTag];
    case 'happening_now': {
      const day = dayNumber(now, event.timeZone) - dayNumber(event.startsAt, event.timeZone) + 1;
      const count = dayCount(event);
      const tag = { word: t('eventsScreen.happeningNow'), mark: 'now' } as const;

      return count > 1
        ? [tag, { word: t('todayScreen.dayOfCapital', { day, total: count }) }]
        : [tag];
    }
    case 'finished':
      return event.calledOff
        ? [{ word: t('eventsScreen.calledOff'), mark: 'calledOff' }]
        : [{ word: t('eventsScreen.finished'), mark: 'finished' }];
  }
}

export type StepAction = CardStepAction;

export type CardStep =
  | { kind: 'button'; line: string; label: string; action: StepAction }
  | { kind: 'next'; title: string; when: string; you: boolean; overdue: boolean };

const STEP_BY_PHASE: ReadonlySet<EventPhase> = new Set(['draft', 'paused', 'finished']);

/** The card's one step, by the domain's nextStep: what the phase asks for, else the next thing that happens; Duplicate once it is over. Null while a live event's milestones are still unread. */
export function cardStep(event: Shown, now: Date, locale: string, t: TFunction): CardStep | null {
  if (event.milestones == null && !STEP_BY_PHASE.has(event.phase)) return null;

  const step = nextStep({ ...event, milestones: event.milestones ?? [] }, event.phase, now);

  switch (step?.kind) {
    case 'makeLive':
      return {
        kind: 'button',
        line: t('eventsScreen.nextMakeLive'),
        label: t('eventLive.makeLive'),
        action: 'makeLive',
      };
    case 'changeDates':
      return {
        kind: 'button',
        line: t('eventsScreen.nextChangeDates'),
        label: t('eventLive.changeDates'),
        action: 'changeDates',
      };
    case 'resume':
      return {
        kind: 'button',
        line: t('eventsScreen.nextResume'),
        label: t('eventPause.resume'),
        action: 'resume',
      };
    case 'nextUp':
      return {
        kind: 'next',
        title: t('eventsScreen.nextUp', { title: step.milestone.title }),
        when: t('todayScreen.dateAndHowFar', {
          date: formatEventMoment(step.milestone.at, event.timeZone, locale),
          far: distanceWords(step.milestone.at, event.timeZone, now, t),
        }),
        you: step.milestone.owner === 'you',
        overdue: step.milestone.owner === 'you' && Date.parse(step.milestone.at) < now.getTime(),
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

/** Each tab's width as CSS shares a row: an equal share of the room, or the tab's own words where they need more. */
export function tabWidths(room: number, mins: readonly number[]): number[] {
  const fixed = mins.map(() => false);

  for (;;) {
    const free = fixed.filter((f) => !f).length;
    const left = room - mins.reduce((sum, min, i) => (fixed[i] ? sum + min : sum), 0);
    const share = free > 0 ? left / free : 0;
    const grown = mins.findIndex((min, i) => !fixed[i] && min > share);

    if (grown < 0) return mins.map((min, i) => (fixed[i] ? min : share));
    fixed[grown] = true;
  }
}
