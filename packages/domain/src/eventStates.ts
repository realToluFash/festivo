/** Read from /event-states.json, the table the API's enums are tested against: never copy it here. */
import declaration from '../../../event-states.json' with { type: 'json' };

export type EventState = 'draft' | 'live' | 'paused' | 'ended';

export type EventPhase = keyof typeof declaration.phases;

export type EventAction = string;

export const EVENT_STATES = declaration.states as readonly EventState[];

export const EVENT_PHASES = Object.keys(declaration.phases) as readonly EventPhase[];

export const EVENT_ACTIONS: readonly EventAction[] = declaration.actions;

export function isEventState(value: unknown): value is EventState {
  return (EVENT_STATES as readonly unknown[]).includes(value);
}

/** Live becomes Happening now at its start and Finished at its end; `startsAt` and `endsAt` carry their offsets. */
export function eventPhase(
  event: { status: EventState; startsAt: string; endsAt: string },
  now: Date,
): EventPhase {
  switch (event.status) {
    case 'draft':
      return 'draft';
    case 'paused':
      return 'paused';
    case 'ended':
      return 'finished';
    case 'live': {
      const at = now.getTime();

      if (at >= Date.parse(event.endsAt)) return 'finished';

      return at >= Date.parse(event.startsAt) ? 'happening_now' : 'live';
    }
  }
}

export function allowedActions(phase: EventPhase): readonly EventAction[] {
  return declaration.phases[phase];
}

export function eventAllows(phase: EventPhase, action: EventAction): boolean {
  return allowedActions(phase).includes(action);
}

/** The row an action takes from a stored state, or null when the API refuses it `event_state_invalid`. */
export function eventTransition(
  from: EventState,
  action: EventAction,
): { to: EventState; guards: readonly string[] } | null {
  const row = declaration.transitions.find(
    (transition) => transition.from === from && transition.action === action,
  );

  return row == null ? null : { to: row.to as EventState, guards: row.guards };
}

export interface MakeLiveRow {
  line: 'guestsBlocked' | 'endPassed';
  makeLive: boolean;
}

/** A Draft's one line for the areas it blocks, while the table still leads it to Live; past `end_not_passed` it says so instead. */
export function makeLiveRow(
  event: { status: EventState; startsAt: string; endsAt: string },
  now: Date,
): MakeLiveRow | null {
  const phase = eventPhase(event, now);
  const transition = eventTransition(event.status, 'make_live');

  if (transition == null || eventAllows(phase, 'invite')) return null;

  const endPassed =
    transition.guards.includes('end_not_passed') && now.getTime() >= Date.parse(event.endsAt);

  return {
    line: endPassed ? 'endPassed' : 'guestsBlocked',
    makeLive: !endPassed && eventAllows(phase, 'make_live'),
  };
}

const SCHEDULE = ['startsAt', 'endsAt', 'timeZone'];

/** A change to the start, end or zone needs `edit_schedule`, and to anything else `edit`: a save of both needs both. */
export function editActions(changed: readonly string[]): EventAction[] {
  const schedule = changed.filter((field) => SCHEDULE.includes(field));

  return [
    ...(schedule.length > 0 ? ['edit_schedule'] : []),
    ...(schedule.length < changed.length ? ['edit'] : []),
  ];
}
