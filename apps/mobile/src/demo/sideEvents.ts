import { type ShownEvent, meshFor } from '../kit/today.ts';
import { EVENTS } from './events/EventsSample.ts';
import { sample } from './today.ts';

export const SIDEBAR_EVENTS: readonly ShownEvent[] = (
  ['wed', 'ireti', 'party', 'draft'] as const
).map(sample);

/** The list's region never shows fewer than four rows; below that the whole sidebar scrolls (sc-39340). */
export const LEAST_ROWS = 4;

/** `?sidebar=none` lists nothing and `?sidebar=many` all twenty sample events, past ones borrowed only for length; a new organisation has none to list. */
export function sideEventsOf(
  events: readonly ShownEvent[],
  asked: string | undefined,
  fresh: boolean,
): readonly ShownEvent[] {
  if (fresh || asked === 'none') return [];
  if (asked === 'many')
    return EVENTS.map(({ id, name }) => ({ id, name, mesh: meshFor(id), photo: null }));

  return events;
}
