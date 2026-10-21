/** Read from /event-states.json, the table the API's policy is tested against: never copy it here. */
import declaration from '../../../event-states.json' with { type: 'json' };

export type EventState = keyof typeof declaration.states;

export type EventAction = string;

export const EVENT_STATES = Object.keys(declaration.states) as readonly EventState[];

export const EVENT_ACTIONS: readonly EventAction[] = declaration.actions;

export function allowedActions(state: EventState): readonly EventAction[] {
  return declaration.states[state];
}

export function eventAllows(state: EventState, action: EventAction): boolean {
  return allowedActions(state).includes(action);
}
