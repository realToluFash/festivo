import type { EventCover, OrganisationEvent } from '@soirely/api-client';
import {
  type CardStepAction,
  type EventPhase,
  type EventState,
  type EventType,
  type Milestone,
  calledOff,
  eventDayWords,
  formatEventDate,
  milestoneDistance,
  nextStep,
  milestoneMoment,
  numberFormat,
  shownDays,
  stepAwaitsMilestones,
  wallDayNumber,
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
export function listEventOf(event: OrganisationEvent & Pick<ListEvent, 'milestones'>): ListEvent {
  return {
    ...event,
    place: event.venue?.name ?? event.venue?.address?.formatted ?? null,
    photo: event.cover == null ? null : { cover: event.cover, type: event.type },
  };
}

/** Its day or its first and last day, with their year unless it is this one; in a `list`, a called-off event's day it was called off. */
export function daysWords(
  event: Pick<ListEvent, 'status' | 'startsAt' | 'endsAt' | 'timeZone' | 'concludedAt'>,
  now: Date,
  locale: string,
  list: boolean,
  t: TFunction,
): string {
  const days = eventDayWords(event, now, locale, !list);

  switch (days.kind) {
    case 'calledOffOn':
      return t('eventsScreen.calledOffOn', { date: days.date });
    case 'oneDay':
      return days.day;
    case 'days':
      return t('eventsScreen.days', { first: days.first, last: days.last });
  }
}

export function rowLine(
  event: Shown,
  now: Date,
  locale: string,
  t: TFunction,
  list = true,
): string {
  return t('todayScreen.dayAndPlace', {
    day: daysWords(event, now, locale, list, t),
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

export function dayCount(event: Pick<ListEvent, 'startsAt' | 'endsAt' | 'timeZone'>): number {
  return (
    wallDayNumber(event.endsAt, event.timeZone) - wallDayNumber(event.startsAt, event.timeZone) + 1
  );
}

export type DayTile =
  | { kind: 'day'; key: string; weekday: string; day: string; today: boolean }
  | { kind: 'gap'; key: string; hidden: number; more: string };

const DAY = 86_400_000;

/** A tile a day up to a week; past that its first day, today while it is on, and its last, with the days between counted. */
export function dayTiles(event: Shown, now: Date, locale: string): DayTile[] | null {
  const count = dayCount(event);

  if (count < 2 || event.phase === 'finished') return null;

  const first = wallDayNumber(event.startsAt, event.timeZone);
  const today = wallDayNumber(now, event.timeZone);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const number = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });
  const plain = numberFormat(locale);
  const shown = shownDays({
    first,
    last: first + count - 1,
    today,
    on: event.phase === 'happening_now',
  });

  return shown.flatMap((dayAt, index): DayTile[] => {
    const date = new Date(dayAt * DAY);
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
      const day =
        wallDayNumber(now, event.timeZone) - wallDayNumber(event.startsAt, event.timeZone) + 1;
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

/** The card's one step, by the domain's nextStep: what the phase asks for, else the next thing that happens; Duplicate once it is over. Null while a live event's milestones are still unread. */
export function cardStep(event: Shown, now: Date, locale: string, t: TFunction): CardStep | null {
  if (event.milestones == null && stepAwaitsMilestones(event.phase)) return null;

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
          date: milestoneMoment(step.milestone.at, event.timeZone, now, locale),
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
