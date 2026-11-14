import { addDays, copyStartRefusal } from '@soirely/domain';

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
/** As the app's `OPENING_AFTER`: the line is read before the copy opens. */
export const OPENING_MS = 700;

export interface Starts {
  date: string;
  time: string;
}

export type DuplicateStatus = 'editing' | 'creating' | 'failed' | 'created';

export interface DuplicateRun {
  starts: Starts;
  status: DuplicateStatus;
  error: string | null;
  /** The half that takes focus with the error. */
  focus: 'date' | 'time' | null;
}

/** The copy starts on the original's weekday and time, a year on. */
export function startsAfter(begins: Starts): Starts {
  return { date: addDays(begins.date, 52 * 7), time: begins.time };
}

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
    case 'picked': {
      if (busy) return run;
      const { date, time } = action.starts;
      const whole = date !== '' && time !== '';

      return {
        ...run,
        starts: action.starts,
        status: 'editing',
        error: whole ? null : run.error,
        focus: whole ? null : run.focus,
      };
    }
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
