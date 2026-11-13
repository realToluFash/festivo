import { type EventState, endLabel, eventPhase } from '@soirely/domain';

import { type EventStateName, type Manage, EVENT_WORDS as W } from './events.ts';

export type RefusedVerb = 'callOff' | 'endNow';

export interface Refusal {
  /** The button the page shows at this moment: Call off before the start, End now from it. */
  verb: RefusedVerb;
  canChange: boolean;
}

/** sc-14445, the demo's stand-in for the resource's deleteRefusedBecause: with a guest Invited, an event that can still be called off or ended is deleted only once it has been. */
export function refusalOf(
  event: { status: EventState; startsAt: string; endsAt: string },
  now: Date,
  invited: number,
  canChange: boolean,
): Refusal | null {
  if (invited === 0) return null;

  const verb = endLabel(event, eventPhase(event, now), now);

  return verb == null ? null : { verb, canChange };
}

export interface RefusalWords {
  title: string;
  line: string;
  who: string | null;
  verb: string | null;
}

export function refusalWords(refusal: Refusal, name: string, organisation: string): RefusalWords {
  const before = refusal.verb === 'callOff';

  return {
    title: before ? W.callOffFirst(name) : W.endFirst(name),
    line: before ? W.callOffFirstLine : W.endFirstLine,
    who: refusal.canChange
      ? null
      : before
        ? W.askToCallOff(W.title, organisation)
        : W.askToEnd(W.title, organisation),
    verb: refusal.canChange ? (before ? W.callOff : W.endNow) : null,
  };
}

/** Pause, Call off and End now need Events at Change (sc-3585), so the page shows a reader at Read none of them. */
export function usableManage(keys: readonly Manage[], canChange: boolean): Manage[] {
  return keys.filter(
    (key) => canChange || (key !== 'pause' && key !== 'callOff' && key !== 'endNow'),
  );
}

export const REFUSED_STATES = [
  'deleteRefused',
  'deleteRefusedStarted',
  'deleteRefusedRead',
  'deleteRefusedStartedRead',
  'deleteRace',
] as const satisfies readonly EventStateName[];

export interface RefusedStart {
  canChange: boolean;
  started: boolean;
  /** Delete opened on the name while nobody was Invited, and a guest was by the time Delete is pressed. */
  race: boolean;
}

export function refusedStartOf(state: EventStateName | null): RefusedStart | null {
  switch (state) {
    case 'deleteRefused':
      return { canChange: true, started: false, race: false };
    case 'deleteRefusedStarted':
      return { canChange: true, started: true, race: false };
    case 'deleteRefusedRead':
      return { canChange: false, started: false, race: false };
    case 'deleteRefusedStartedRead':
      return { canChange: false, started: true, race: false };
    case 'deleteRace':
      return { canChange: true, started: false, race: true };
    default:
      return null;
  }
}

/** The sample's Invited guests in this story's states; none in the others, whose delete boards (sc-3592, sc-1468) came before the rule. */
export function invitedOf(start: RefusedStart | null, sample: number, pressed: boolean): number {
  return start == null || (start.race && !pressed) ? 0 : sample;
}

/** The board's reader without Events at Change: a custom role with Create events and Events at Read. */
export const AT_READ = { name: 'Ana Souza', initials: 'AS', role: 'Coordinator' } as const;
