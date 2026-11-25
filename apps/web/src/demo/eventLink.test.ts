import { describe, expect, it } from 'vitest';

import {
  EVENT_IN,
  LINK_PAGE,
  LINK_STATES,
  WORKING_IN,
  answerOf,
  eventOrgOf,
  linkStateOf,
  moveOf,
} from './eventLink.ts';
import { eventStateOf } from './events.ts';

describe('an event link from another organisation at a desk', () => {
  it('moves only once the event has loaded', () => {
    expect(moveOf('loading', EVENT_IN, WORKING_IN)).toBeNull();
    expect(moveOf('failed', EVENT_IN, WORKING_IN)).toBeNull();
    expect(moveOf('unavailable', EVENT_IN, WORKING_IN)).toBeNull();
    expect(moveOf('loaded', EVENT_IN, WORKING_IN)).toBe(EVENT_IN);
  });

  it('does not move for an event of the organisation already worked in', () => {
    expect(moveOf('loaded', eventOrgOf('same'), WORKING_IN)).toBeNull();
  });

  it('loads after Try again, and holds loading and not available', () => {
    expect(answerOf('failed', 0)).toBe('failed');
    expect(answerOf('failed', 1)).toBe('loaded');
    expect(answerOf('loading', 2)).toBe('loading');
    expect(answerOf('unavailable', 1)).toBe('unavailable');
  });

  it('names no state the event page already reads', () => {
    for (const state of LINK_STATES) expect(eventStateOf(state)).toBeNull();
    expect(linkStateOf('elsewhere')).toBeNull();
  });

  it('links every state from the demo home', () => {
    expect(LINK_PAGE.states.map(({ to }) => to)).toEqual(
      LINK_STATES.map((state) => `/demo/events/evt-wed-4?link=${state}`),
    );
  });
});
