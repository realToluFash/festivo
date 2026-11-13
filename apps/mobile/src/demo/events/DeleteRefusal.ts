import { type EventState, endLabel, eventPhase } from '@soirely/domain';

import type { ManageKey } from '../../kit/eventOverview.ts';
import { W, say } from './EventsWords.ts';

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
    title: before ? say.callOffFirst(name) : say.endFirst(name),
    line: before ? W.callOffFirstBody : W.endFirstBody,
    who: refusal.canChange
      ? null
      : before
        ? say.askToCallOff(W.events, organisation)
        : say.askToEnd(W.events, organisation),
    verb: refusal.canChange ? (before ? W.callOff : W.endNow) : null,
  };
}

/** Pause, Call off and End now need Events at Change (sc-3585), so the page shows a reader at Read none of them. */
export function usableManage(keys: readonly ManageKey[], canChange: boolean): ManageKey[] {
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
] as const;
export type RefusedState = (typeof REFUSED_STATES)[number];

export interface RefusedStart {
  canChange: boolean;
  started: boolean;
  /** Delete opened on the name while nobody was Invited, and a guest was by the time Delete is pressed. */
  race: boolean;
}

export function refusedStartOf(state: string | null): RefusedStart | null {
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
