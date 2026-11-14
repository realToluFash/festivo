import { copyStartRefusal } from '@soirely/domain';

import {
  type DuplicateRun,
  OPENING_AFTER,
  type Starts,
  pickedRun,
} from '../../kit/eventDuplicate.ts';
import type { SampleEvent } from './EventsSample.ts';
import { t } from './EventsWords.ts';

export const DUPLICATE_STATES = [
  'duplicate',
  'duplicateCreating',
  'duplicateStartsBlank',
  'duplicateStartsRefused',
  'duplicateNotCreated',
  'duplicateCreated',
] as const;
export type DuplicateState = (typeof DUPLICATE_STATES)[number];

export function duplicateStateOf(state: string | null): DuplicateState | null {
  return DUPLICATE_STATES.find((one) => one === state) ?? null;
}

/** The API's only refusal of a copy's start (`validation.event_time_invalid`), shown as it comes back under `startsAt`. */
export const START_REFUSED = 'Enter a date and a time with no time zone offset.';

export const CREATING_MS = 900;
export const OPENING_MS = OPENING_AFTER;

export function duplicateStart(state: DuplicateState | null, starts: Starts): DuplicateRun {
  const run: DuplicateRun = { starts, status: 'editing', error: null, focus: null };

  switch (state) {
    case 'duplicateCreating':
      return { ...run, status: 'creating' };
    case 'duplicateStartsBlank':
      return { ...run, starts: { date: '', time: '' }, ...refusedOf('', '') };
    case 'duplicateStartsRefused':
      return { ...run, error: START_REFUSED, focus: 'date' };
    case 'duplicateNotCreated':
      return { ...run, status: 'failed' };
    case 'duplicateCreated':
      return { ...run, status: 'created' };
    default:
      return run;
  }
}

function refusedOf(date: string, time: string): Pick<DuplicateRun, 'error' | 'focus'> {
  const refusal = copyStartRefusal(date, time, t);

  return refusal == null
    ? { error: null, focus: null }
    : { error: refusal.message, focus: refusal.focus };
}

export type DuplicateAction =
  { type: 'picked'; starts: Starts } | { type: 'create' } | { type: 'created' };

/** Create draft refuses a start not fully chosen without asking; the demo's answer always comes back created. */
export function reduceDuplicate(run: DuplicateRun, action: DuplicateAction): DuplicateRun {
  const busy = run.status === 'creating' || run.status === 'created';

  switch (action.type) {
    case 'picked':
      return pickedRun(run, action.starts);
    case 'create': {
      if (busy) return run;
      const refused = refusedOf(run.starts.date, run.starts.time);

      return refused.error == null
        ? { ...run, status: 'creating', error: null, focus: null }
        : { ...run, status: 'editing', ...refused };
    }
    case 'created':
      return run.status === 'creating' ? { ...run, status: 'created' } : run;
  }
}

/** The copy as it opens: a draft with the same name, the chosen start, the original's length, and no hosts. */
export function copyOf(event: SampleEvent, startsAt: string): SampleEvent {
  const length = Date.parse(event.endsAt) - Date.parse(event.startsAt);

  return {
    ...event,
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + length).toISOString(),
    hosts: [],
    status: 'draft',
    concludedAt: null,
  };
}
