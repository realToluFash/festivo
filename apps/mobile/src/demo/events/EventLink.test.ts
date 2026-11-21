import { describe, expect, it } from 'vitest';

import {
  EVENT_IN,
  LINK_BOARDS,
  LINK_STATES,
  WORKING_IN,
  answerOf,
  eventOrgOf,
  linkStateOf,
  moveOf,
} from './EventLink.ts';

describe('an event link from another organisation', () => {
  it('moves only once the event has loaded', () => {
    expect(moveOf('loading', EVENT_IN, WORKING_IN)).toBeNull();
    expect(moveOf('failed', EVENT_IN, WORKING_IN)).toBeNull();
    expect(moveOf('unavailable', EVENT_IN, WORKING_IN)).toBeNull();
    expect(moveOf('loaded', EVENT_IN, WORKING_IN)).toBe(EVENT_IN);
  });

  it('does not move for an event of the organisation already worked in', () => {
    expect(moveOf('loaded', eventOrgOf('same'), WORKING_IN)).toBeNull();
    expect(moveOf('loaded', EVENT_IN, EVENT_IN)).toBeNull();
  });

  it('loads after Try again', () => {
    expect(answerOf('failed', 0)).toBe('failed');
    expect(answerOf('failed', 1)).toBe('loaded');
  });

  it('holds loading and not available as they are', () => {
    expect(answerOf('loading', 3)).toBe('loading');
    expect(answerOf('unavailable', 1)).toBe('unavailable');
    expect(answerOf('moved', 0)).toBe('loaded');
  });

  it('reads its state from the query', () => {
    expect(linkStateOf('moved')).toBe('moved');
    expect(linkStateOf('elsewhere')).toBeNull();
    expect(linkStateOf(undefined)).toBeNull();
  });

  it('lists a board for every state', () => {
    expect(LINK_BOARDS.map(({ href }) => href)).toEqual(
      LINK_STATES.map((state) => `/demo/events/evt-wed-4?link=${state}`),
    );
  });
});
