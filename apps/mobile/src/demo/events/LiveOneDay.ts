import {
  type EventPhase,
  type MarkedMilestone,
  type Milestone,
  comingUp,
  formatEventClock,
  nextUp,
} from '@soirely/domain';

import type { SampleEvent } from './EventsSample.ts';

export const LIVE_ONE_DAY_STATES = ['liveOneDay', 'liveOneDaySpeeches', 'liveOneDayOver'] as const;
export type LiveOneDayState = (typeof LIVE_ONE_DAY_STATES)[number];

export function liveOneDayOf(value: string | null | undefined): LiveOneDayState | null {
  return LIVE_ONE_DAY_STATES.find((state) => state === value) ?? null;
}

/** Dîner en direct runs 19:00 to 23:30 London: on with nothing ahead, before Speeches at 22:00, and after its end. */
const CLOCKS: Record<LiveOneDayState, string> = {
  liveOneDay: '2026-11-03T20:40:00Z',
  liveOneDaySpeeches: '2026-11-03T21:15:00Z',
  liveOneDayOver: '2026-11-03T23:45:00Z',
};

export function liveOneDayClock(state: LiveOneDayState): Date {
  return new Date(CLOCKS[state]);
}

/** Speeches, Dîner's only run of show item, at 22:00 and fixed-time: the server dates it as the day's first item and under its own title (sc-3893). */
const RUN_OF_SHOW: Milestone[] = ['Run of show begins', 'Speeches'].map((title) => ({
  at: '2026-11-03T22:00:00Z',
  title,
  note: null,
  owner: 'event',
  area: 'runOfShow',
  action: null,
}));

let speeches = false;

/** Whether the opened state puts Speeches in its run of show. */
export function seedRunOfShow(state: string | null): void {
  speeches = state === 'liveOneDaySpeeches';
}

/** Dîner's dates as the server returns them: its start, and Run of show begins then Speeches when its run of show has Speeches; a one-day event's end is never one (sc-3594). */
export function dinerDates(event: Pick<SampleEvent, 'startsAt'>, starts: string): Milestone[] {
  const own = { note: null, owner: 'event', area: 'events', action: null } as const;

  return [{ ...own, at: event.startsAt, title: starts }, ...(speeches ? RUN_OF_SHOW : [])];
}

/** While it is happening now with nothing ahead, the card has no step at all: not the finished line, and no Duplicate. */
export function stepless(
  phase: EventPhase,
  milestones: readonly Milestone[],
  now: Date,
  ended: boolean,
): boolean {
  return phase === 'happening_now' && nextUp(milestones, now, ended) == null;
}

export type ComingUpShows =
  { kind: 'rows'; rows: MarkedMilestone[] } | { kind: 'ends'; time: string } | { kind: 'finished' };

/** Coming up's rows; with none, the end as Today's live cover says it while the event is on, else the finished sentence. */
export function comingUpShows(
  event: Pick<SampleEvent, 'endsAt' | 'timeZone'>,
  phase: EventPhase,
  milestones: readonly Milestone[],
  now: Date,
  ended: boolean,
  locale: string,
): ComingUpShows {
  const rows = comingUp(milestones, now, ended);

  if (rows.length > 0) return { kind: 'rows', rows };
  if (phase === 'happening_now')
    return { kind: 'ends', time: formatEventClock(event.endsAt, event.timeZone, locale) };

  return { kind: 'finished' };
}
