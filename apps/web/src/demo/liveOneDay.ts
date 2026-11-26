import {
  type EventPhase,
  type MarkedMilestone,
  type Milestone,
  comingUp,
  formatEventClock,
  nextUp,
} from '@soirely/domain';

import type { SampleEvent } from './events.ts';

export const DINER_ID = 'evt-diner-1';

export const LIVE_ONE_DAY_STATES = ['liveOneDay', 'liveOneDaySpeeches', 'liveOneDayOver'] as const;
export type LiveOneDayState = (typeof LIVE_ONE_DAY_STATES)[number];

export function isLiveOneDay(state: string | null): state is LiveOneDayState {
  return LIVE_ONE_DAY_STATES.some((one) => one === state);
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

let speeches = false;

/** Whether the opened state puts Speeches in Dîner's run of show. */
export function seedRunOfShow(state: string | null): void {
  speeches = state === 'liveOneDaySpeeches';
}

/** Dîner's run of show, as the server adds it to the event's dates. */
export function runOfShowOf(eventId: string): Milestone[] {
  if (eventId !== DINER_ID || !speeches) return [];

  return [
    {
      at: '2026-11-03T22:00:00Z',
      title: 'Speeches',
      note: null,
      owner: 'event',
      area: 'runOfShow',
      action: null,
    },
  ];
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
